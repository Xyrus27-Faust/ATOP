// The one place an entry's bidbook is rendered for a back-office reader.
//
// Reviewers, 3PIC assessors and Adjudicators all read the SAME payload — every one of
// /review/entries/{id}, /scoring/entries/{id} and /finals/entries/{id} returns the identical
// EntryDetailResponse (nominator, exec summary, narratives, evidence, documents, declaration, LCE
// endorsement). The only thing that differs per role is the route prefix the presigned file URLs
// hang off, so that's injected via `useEntryFiles(filesBase)`.
//
// Before this existed the bidbook was rendered three separate times and had drifted: reviewers got
// inline video, assessors got a plain link and no endorsement, adjudicators got neither. One
// implementation means they can't drift again.
//
// Review and Finals render <EntryDossier> whole. Scoring composes the sections instead, because its
// per-criterion block has to host the 0–5 rating control between the narrative and the evidence.

import { formatDate, labelFor, COVERAGE_OPTIONS, videoEmbed, looksLikeVideo } from '@/lib/pearlAwards'

// The role-scoped file accessor lives in lib/entryFiles.js — pages pass the result in as `files`.

const emptyBidbook = { executiveSummary: '', narratives: [], supportingDocuments: [], evidence: [] }

/**
 * Normalises the two shapes of "criterion + narrative" into one list.
 * With `criteria` (the rubric) we can also show the indicators; without it we fall back to the
 * narratives, which carry their own criterion name/points.
 */
function criteriaView(entry, criteria) {
  const bb = entry?.bidbook || emptyBidbook
  const evidenceBy = (bb.evidence || []).reduce((m, e) => { (m[e.criterionId] ||= []).push(e); return m }, {})
  const narrativeBy = new Map((bb.narratives || []).map((n) => [n.criterionId, n]))

  if (criteria?.length) {
    return criteria.map((c) => ({
      id: c.criterionId,
      name: c.name,
      points: c.points,
      indicators: c.indicators,
      text: narrativeBy.get(c.criterionId)?.text || '',
      evidence: evidenceBy[c.criterionId] || [],
    }))
  }
  return (bb.narratives || []).map((n) => ({
    id: n.criterionId,
    name: n.criterionName,
    points: n.criterionPoints,
    indicators: null,
    text: n.text,
    evidence: evidenceBy[n.criterionId] || [],
  }))
}

export function DossierSection({ icon, title, children, className = '' }) {
  return (
    <section className={`dash-card dash-card-pad ${className}`}>
      <div className="ed-section-title"><i className={`fas ${icon}`} aria-hidden="true" /> {title}</div>
      {children}
    </section>
  )
}

export function DossierGrid({ items }) {
  return (
    <dl className="ed-grid">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || <span className="ed-empty">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Evidence files attached to a single criterion. */
export function EvidenceRow({ files, onViewEvidence }) {
  if (!files?.length) return null
  return (
    <div className="ed-evidence">
      <span className="ed-evidence-label"><i className="fas fa-paperclip" aria-hidden="true" /> Supporting evidence</span>
      {files.map((f) => (
        <button key={f.fileKey} type="button" className="dash-btn is-ghost is-sm" onClick={() => onViewEvidence(f.fileKey)}>
          <i className="fas fa-file-lines" aria-hidden="true" /> {f.fileName || 'View file'}
        </button>
      ))}
    </div>
  )
}

/**
 * One criterion: its narrative and evidence. `children` is a slot beneath the narrative — the
 * scoring page drops its 0–5 rating control in there.
 */
export function NarrativeBlock({ item, onViewEvidence, children, id, className = '' }) {
  return (
    <div id={id} className={`ed-narr ${className}`}>
      <div className="ed-narr-head">
        <span className="ed-narr-name">{item.name}</span>
        {item.points != null && <span className="dash-badge tone-progress">{item.points} pts</span>}
      </div>
      {item.indicators && <p className="ed-indicators">{item.indicators}</p>}
      <p className="ed-prose">{item.text || <em className="ed-empty">No narrative provided.</em>}</p>
      <EvidenceRow files={item.evidence} onViewEvidence={onViewEvidence} />
      {children}
    </div>
  )
}

export function NominatorSection({ entry }) {
  const n = entry.nominator
  if (!n) return null
  return (
    <DossierSection icon="fa-user-tie" title="Nominator">
      <DossierGrid items={[
        ['Name', `${n.firstName} ${n.lastName}`.trim()],
        ['Designation', n.designation],
        ['Office', n.office],
        ['Email', n.email],
        ['Mobile', n.mobile],
        ['Official LGU email', n.officialLguEmail],
        ['Official address', n.officialAddress],
        ['Third-party nominator', n.isThirdParty ? 'Yes' : 'No'],
      ]} />
    </DossierSection>
  )
}

export function ExecutiveSummarySection({ entry }) {
  const bb = entry.bidbook || emptyBidbook
  return (
    <DossierSection icon="fa-book-open" title="Executive summary">
      <p className="ed-prose">{bb.executiveSummary || <em className="ed-empty">Not provided.</em>}</p>
    </DossierSection>
  )
}

export function NarrativesSection({ entry, criteria, onViewEvidence }) {
  const items = criteriaView(entry, criteria)
  return (
    <DossierSection icon="fa-list-check" title="Criteria narratives">
      {items.length === 0
        ? <p className="ed-empty">No narratives provided.</p>
        : items.map((item) => <NarrativeBlock key={item.id} item={item} onViewEvidence={onViewEvidence} />)}
    </DossierSection>
  )
}

/**
 * Supporting documents. A recognised video link is embedded inline; a link that is *meant* to be a
 * video but can't be previewed says so rather than failing silently.
 */
export function DocumentsSection({ entry, category, onViewDoc }) {
  const bb = entry.bidbook || emptyBidbook
  const kindByLabel = new Map((category?.requiredSubmissions || []).map((r) => [r.label, r.kind]))

  return (
    <DossierSection icon="fa-paperclip" title="Supporting documents">
      {bb.supportingDocuments.length === 0 ? <p className="ed-empty">No documents attached.</p> : bb.supportingDocuments.map((d) => {
        const embed = !d.fileKey ? videoEmbed(d.link) : null
        const brokenVideo = !d.fileKey && !embed && (kindByLabel.get(d.label) === 'VideoLink' || looksLikeVideo(d.link))
        return (
          <div key={d.label} className="ed-doc-item">
            <div className="ed-doc">
              <span className="ed-doc-label">{d.label}</span>
              {embed ? (
                <a className="dash-btn is-ghost is-sm" href={d.link} target="_blank" rel="noopener noreferrer">
                  <i className="fas fa-up-right-from-square" aria-hidden="true" /> Open in {embed.provider}
                </a>
              ) : (
                <button type="button" className="dash-btn is-ghost is-sm" onClick={() => onViewDoc(d.label)}>
                  <i className={`fas ${d.fileKey ? 'fa-file-lines' : 'fa-link'}`} aria-hidden="true" /> {d.fileName || (d.fileKey ? 'View file' : 'Open link')}
                </button>
              )}
            </div>
            {embed && (
              <div className="ed-video">
                <iframe
                  src={embed.embedUrl}
                  title={d.label}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            )}
            {brokenVideo && (
              <div className="ed-video-fallback">
                <i className="fas fa-circle-exclamation" aria-hidden="true" />
                <div>
                  <strong>This video cannot be previewed.</strong>
                  {d.link
                    ? <a href={d.link} target="_blank" rel="noopener noreferrer" className="ed-video-link">{d.link}</a>
                    : <span className="ed-empty">No link was provided.</span>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </DossierSection>
  )
}

export function DeclarationSection({ entry }) {
  return (
    <DossierSection icon="fa-file-signature" title="Declaration">
      {entry.declaration ? (
        <DossierGrid items={[
          ['Certified', entry.declaration.certified ? 'Yes' : 'No'],
          ['Certified at', formatDate(entry.declaration.signedAt, { dateStyle: 'medium', timeStyle: 'short' })],
        ]} />
      ) : <p className="ed-empty">Not certified.</p>}
    </DossierSection>
  )
}

export function EndorsementSection({ entry, onViewEndorsement }) {
  const e = entry.lceEndorsement
  return (
    <DossierSection icon="fa-stamp" title="LCE endorsement">
      {e ? (
        <>
          <DossierGrid items={[
            ['Endorsed', e.endorsed ? 'Yes' : 'No'],
            ['Recorded', formatDate(e.signedAt, { dateStyle: 'medium', timeStyle: 'short' })],
          ]} />
          {e.fileKey && (
            <div className="ed-doc" style={{ marginTop: 10 }}>
              <span className="ed-doc-label">Signed endorsement</span>
              <button type="button" className="dash-btn is-ghost is-sm" onClick={onViewEndorsement}>
                <i className="fas fa-file-lines" aria-hidden="true" /> {e.fileName || 'View document'}
              </button>
            </div>
          )}
        </>
      ) : <p className="ed-empty">Not endorsed.</p>}
    </DossierSection>
  )
}

/** Entry identity — category, LGU, coverage, submitted date. */
export function EntryFacts({ entry, category }) {
  return (
    <p className="ed-facts">
      {category?.name ? `${category.name} · ` : ''}{entry.lguName} ({entry.lguLevel} · {entry.lguRegion}) · {labelFor(COVERAGE_OPTIONS, entry.coverage)}
      {entry.submittedAt ? ` · submitted ${formatDate(entry.submittedAt, { dateStyle: 'medium' })}` : ''}
    </p>
  )
}

/**
 * The whole bidbook, in reading order. Used by Review and by the Adjudicator's dossier.
 * `files` is the object from useEntryFiles().
 */
export default function EntryDossier({ entry, category, criteria, files }) {
  return (
    <>
      {files.fileError && (
        <div className="dash-banner tone-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{files.fileError}</span></div>
      )}
      <div className="ed-stack">
        <NominatorSection entry={entry} />
        <ExecutiveSummarySection entry={entry} />
        <NarrativesSection entry={entry} criteria={criteria} onViewEvidence={files.viewEvidence} />
        <DocumentsSection entry={entry} category={category} onViewDoc={files.viewDoc} />
        <DeclarationSection entry={entry} />
        <EndorsementSection entry={entry} onViewEndorsement={files.viewEndorsement} />
      </div>
      <style>{DOSSIER_CSS}</style>
    </>
  )
}

// Exported so pages that compose the sections themselves (Scoring) can inject the styles once.
export const DOSSIER_CSS = `
  .ed-stack { display: flex; flex-direction: column; gap: 18px; }
  .ed-section-title { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--navy); display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
  .ed-section-title i { color: var(--gold-dark); }
  .ed-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; }
  .ed-grid dt { font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 2px; }
  .ed-grid dd { color: var(--navy); font-size: 0.9rem; word-break: break-word; }
  .ed-prose { color: var(--text-body); line-height: 1.7; white-space: pre-wrap; }
  .ed-empty { color: var(--gray-400); font-style: italic; }
  .ed-facts { color: var(--gray-600); font-size: 0.9rem; margin-top: 6px; }

  .ed-narr { padding: 14px 0; border-top: 1px solid var(--gray-100); }
  .ed-narr:first-of-type { border-top: none; padding-top: 0; }
  .ed-narr-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .ed-narr-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; }
  .ed-indicators { color: var(--gray-600); font-size: 0.84rem; line-height: 1.55; margin-bottom: 8px; }

  .ed-evidence { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .ed-evidence-label { font-family: var(--font-heading); font-weight: 700; font-size: 0.72rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gray-600); display: inline-flex; align-items: center; gap: 6px; margin-right: 2px; }
  .ed-evidence-label i { color: var(--gold-dark); }

  .ed-doc { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ed-doc-label { font-family: var(--font-heading); font-weight: 600; color: var(--navy); font-size: 0.9rem; }
  .ed-doc-item { padding: 12px 0; border-top: 1px solid var(--gray-100); }
  .ed-doc-item:first-of-type { border-top: none; padding-top: 0; }

  .ed-video { margin-top: 12px; width: 100%; max-width: 680px; aspect-ratio: 16 / 9; border-radius: var(--radius-md); overflow: hidden; background: #000; border: 1px solid var(--gray-200); }
  .ed-video iframe { width: 100%; height: 100%; border: 0; display: block; }
  .ed-video-fallback { margin-top: 12px; display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: var(--radius-md); background: var(--gray-100); border: 1px solid var(--gray-200); font-size: 0.88rem; }
  .ed-video-fallback i { color: var(--gold-dark); margin-top: 2px; }
  .ed-video-fallback strong { color: var(--navy); display: block; margin-bottom: 2px; }
  .ed-video-link { color: var(--gold-dark); word-break: break-all; font-size: 0.84rem; text-decoration: underline; text-underline-offset: 2px; }

  @media (max-width: 620px) { .ed-grid { grid-template-columns: 1fr; } }
`
