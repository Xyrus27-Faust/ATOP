import { useMemo, useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { getRoster } from '@/lib/roster'
import { REGIONS } from '@/lib/pearlAwards'
import { useAsync } from '@/dashboard/useAsync'

const NO_REGION = 'Other organizations'

/**
 * The convention roster (ATOP, 2026-10-29) — the page the QR on a Certificate of Appearance opens.
 * Everyone who checked in at the convention with nothing owed, by region and LGU, with a search so a
 * name on a certificate can be found in a few keystrokes on a phone.
 *
 * <p>Public and read-only. The API sends names and where people came from, nothing else.</p>
 */
export default function RosterPage() {
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    if (!event) return null
    return getRoster(event.slug)
  }, [])

  return (
    <div className="ro">
      <header className="ro-head">
        <img src="/Untitled.png" alt="ATOP" className="ro-logo" />
        <div className="ro-head-text">
          <span className="ro-event">{data?.eventName || 'ATOP National Convention'}</span>
          <span className="ro-sub">Convention roster</span>
        </div>
      </header>
      <main className="ro-main">
        {loading ? (
          <div className="ro-card ro-state"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Loading the roster…</div>
        ) : error ? (
          <div className="ro-card ro-state">
            <p>We couldn&rsquo;t load the roster. Check your connection and try again.</p>
            <button type="button" className="ro-btn" onClick={reload}>Try again</button>
          </div>
        ) : !data ? (
          <div className="ro-card ro-state">There&rsquo;s no convention roster to show yet.</div>
        ) : (
          <Roster roster={data} />
        )}
      </main>
      <style>{ROSTER_CSS}</style>
    </div>
  )
}

function Roster({ roster }) {
  const [query, setQuery] = useState('')

  // Region → LGU or organization → names, in the order of the regions list; anything without a region last.
  const regions = useMemo(() => {
    const order = new Map(REGIONS.map((r, i) => [r.value, i]))
    const byRegion = new Map()
    for (const p of roster.people) {
      const region = p.region || ''
      const place = p.lgu || p.organization || 'Unaffiliated'
      if (!byRegion.has(region)) byRegion.set(region, new Map())
      const places = byRegion.get(region)
      if (!places.has(place)) places.set(place, [])
      places.get(place).push(p.name)
    }
    return [...byRegion.entries()]
      .map(([code, places]) => ({
        code,
        label: code ? REGIONS.find((r) => r.value === code)?.label || code : NO_REGION,
        places: [...places.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      }))
      .sort((a, b) => (order.get(a.code) ?? 999) - (order.get(b.code) ?? 999))
  }, [roster])

  const needle = fold(query.trim())
  const shown = useMemo(() => {
    if (!needle) return regions
    return regions
      .map((r) => ({
        ...r,
        places: r.places
          .map(([place, names]) => [place, fold(place).includes(needle) ? names : names.filter((n) => fold(n).includes(needle))])
          .filter(([, names]) => names.length > 0),
      }))
      .filter((r) => r.places.length > 0)
  }, [regions, needle])

  const matches = shown.reduce((n, r) => n + r.places.reduce((m, [, names]) => m + names.length, 0), 0)

  return (
    <>
      <section className="ro-card ro-intro">
        <p className="ro-kicker">Official roster</p>
        <h1 className="ro-h1">{roster.total.toLocaleString('en-PH')} attendees</h1>
        <p className="ro-lead">
          Everyone who checked in at the convention, by region and LGU. Use it to confirm the name on a
          Certificate of Appearance.
        </p>
        <label className="ro-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search a name or LGU"
            aria-label="Search a name or LGU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {needle && (
          <p className="ro-count" role="status">
            {matches === 0 ? 'No one matches that search.' : `${matches} match${matches === 1 ? '' : 'es'}`}
          </p>
        )}
      </section>

      {shown.map((region) => (
        <details key={region.code || 'none'} className="ro-card ro-region" open={Boolean(needle)}>
          <summary>
            <span className="ro-region-name">{region.label}</span>
            <span className="ro-region-n">{region.places.reduce((n, [, names]) => n + names.length, 0)}</span>
            <i className="fas fa-chevron-down ro-chev" aria-hidden="true" />
          </summary>
          {region.places.map(([place, names]) => (
            <div key={place} className="ro-place">
              <h2 className="ro-place-name">{place}</h2>
              <ul className="ro-names">
                {names.map((name, i) => <li key={`${name}-${i}`}>{name}</li>)}
              </ul>
            </div>
          ))}
        </details>
      ))}

      <p className="ro-foot">
        As of {new Date(roster.asOf).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}.
        Not on the list but attended? Please contact the ATOP Secretariat.
      </p>
    </>
  )
}

/** Case- and accent-blind, so "pena" finds "Peña". */
function fold(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const ROSTER_CSS = `
  .ro { min-height: 100dvh; background: var(--off-white); color: var(--text-body); font-family: var(--font-body); }
  .ro-head {
    display: flex; align-items: center; gap: 12px; padding: 16px 16px 72px;
    background: linear-gradient(160deg, var(--navy) 0%, var(--navy-mid) 60%, var(--navy-light) 100%);
    color: var(--white);
  }
  .ro-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; background: var(--white); padding: 3px; }
  .ro-head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .ro-event { font-family: var(--font-heading); font-weight: 700; font-size: 0.92rem; line-height: 1.2; }
  .ro-sub { font-size: 0.76rem; color: rgba(255, 255, 255, 0.7); }
  .ro-main {
    max-width: 640px; margin: -56px auto 0; padding: 0 16px calc(48px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 12px;
  }
  .ro-card { background: var(--white); border-radius: 18px; padding: 20px 16px; box-shadow: var(--shadow-md); }
  .ro-state { text-align: center; padding: 48px 16px; color: var(--gray-600); display: flex; flex-direction: column; gap: 14px; align-items: center; }
  .ro-state p { margin: 0; }
  .ro-btn {
    min-height: 48px; padding: 0 22px; border: 0; border-radius: 14px; background: var(--navy); color: var(--white);
    font-family: var(--font-heading); font-weight: 800; font-size: 1rem; cursor: pointer;
  }
  .ro-intro { border-top: 5px solid var(--gold); }
  .ro-kicker { margin: 0; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold-dark); }
  .ro-h1 { margin: 4px 0 0; font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: clamp(1.35rem, 6vw, 1.6rem); line-height: 1.2; }
  .ro-lead { margin: 8px 0 14px; font-size: 0.96rem; line-height: 1.55; }
  .ro-search {
    display: flex; align-items: center; gap: 10px; border: 2px solid var(--gray-200); border-radius: 12px;
    padding: 0 14px; background: var(--white); color: var(--gray-600);
  }
  .ro-search:focus-within { border-color: var(--navy-light); box-shadow: 0 0 0 3px rgba(200, 168, 75, 0.35); }
  .ro-search input { flex: 1; min-width: 0; border: 0; outline: none; padding: 12px 0; font: inherit; font-size: 16px; color: var(--navy); background: transparent; }
  .ro-count { margin: 10px 0 0; font-size: 0.86rem; color: var(--gray-600); }
  .ro-region { padding: 0; overflow: hidden; }
  .ro-region > summary {
    list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 16px; font-family: var(--font-heading); font-weight: 800; color: var(--navy);
  }
  .ro-region > summary::-webkit-details-marker { display: none; }
  .ro-chev { font-size: 0.8rem; color: var(--gray-600); transition: transform 0.15s; }
  .ro-region[open] .ro-chev { transform: rotate(180deg); }
  .ro-region-name { flex: 1; min-width: 0; font-size: 0.98rem; line-height: 1.3; }
  .ro-region-n { padding: 2px 10px; border-radius: 999px; background: var(--gray-100); font-size: 0.8rem; font-variant-numeric: tabular-nums; }
  .ro-place { padding: 4px 16px 14px; border-top: 1px solid var(--gray-100); }
  .ro-place-name { margin: 12px 0 6px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gold-dark); }
  .ro-names { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 0.95rem; color: var(--navy); }
  @media (min-width: 560px) { .ro-names { grid-template-columns: 1fr 1fr; column-gap: 16px; } }
  .ro-foot { margin: 8px 4px 0; font-size: 0.8rem; color: var(--gray-600); line-height: 1.5; text-align: center; }
  @media (prefers-reduced-motion: reduce) { .ro-chev { transition: none; } }
`
