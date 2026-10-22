import { useEffect, useRef } from 'react'
import { isAnswered } from './evaluationDraft'

const RATINGS = [5, 4, 3, 2, 1]

/**
 * One part of the form on one screen: the paper form's sections, a page each, so a phone never
 * shows sixty questions at once. Everything is a button big enough for a thumb; nothing needs a
 * keyboard except the comment boxes, and those are optional.
 */
export default function EvaluationSection({ section, index, total, answers, onAnswer, missing, serverErrors }) {
  const hasRatings = section.questions.some((q) => q.kind === 'Rating')
  const headingRef = useRef(null)

  // A new part starts at its heading — for a screen reader as much as for the scroll position.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [section.id])

  return (
    <section className="ev-section" aria-labelledby={`sec-${section.code}`}>
      <div className="ev-progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <p className="ev-step">Part {index + 1} of {total}</p>
      <h1 id={`sec-${section.code}`} className="ev-h1" tabIndex={-1} ref={headingRef}>{section.title}</h1>
      {section.schedule && <p className="ev-schedule"><i className="far fa-calendar" aria-hidden="true" /> {section.schedule}</p>}
      {section.note && <p className="ev-note">{section.note}</p>}

      {hasRatings && (
        <p className="ev-legend">
          Tap a number: <strong>5</strong> is the best, <strong>1</strong> the lowest.
          Tap <strong>N/A</strong> for anything you didn&rsquo;t take part in.
        </p>
      )}

      <ol className="ev-questions">
        {section.questions.map((q) => (
          <Question
            key={q.id}
            question={q}
            answer={answers[q.id]}
            onAnswer={(patch) => onAnswer(q.id, patch)}
            error={serverErrors?.[q.code] ?? (missing.includes(q.id) ? missingMessage(q) : null)}
          />
        ))}
      </ol>
    </section>
  )
}

const missingMessage = (q) => (q.kind === 'Rating' ? 'Please pick a number, or N/A.' : 'Please pick a number.')

function Question({ question: q, answer, onAnswer, error }) {
  const promptId = `q-${q.code}-prompt`
  return (
    <li id={`q-${q.code}`} className={`ev-q${error ? ' has-error' : ''}${isAnswered(q, answer) ? ' is-done' : ''}`}>
      <p id={promptId} className="ev-prompt">
        {q.prompt}
        {!q.required && q.kind !== 'Text' && <span className="ev-optional"> (optional)</span>}
      </p>
      {q.kind === 'Rating' && <Rating answer={answer} onAnswer={onAnswer} labelledBy={promptId} />}
      {q.kind === 'Scale' && <Scale question={q} answer={answer} onAnswer={onAnswer} labelledBy={promptId} />}
      {q.kind === 'Choice' && <Choice question={q} answer={answer} onAnswer={onAnswer} labelledBy={promptId} />}
      {q.kind === 'Text' && (
        <textarea
          className="ev-text"
          rows={3}
          maxLength={2000}
          aria-labelledby={promptId}
          placeholder="Optional — type here"
          value={answer?.text ?? ''}
          onChange={(e) => onAnswer({ text: e.target.value })}
        />
      )}
      {q.kind === 'ShortText' && (
        <input
          className="ev-input"
          maxLength={200}
          aria-labelledby={promptId}
          value={answer?.text ?? ''}
          onChange={(e) => onAnswer({ text: e.target.value })}
        />
      )}
      {error && <p className="ev-error" role="alert"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}</p>}
    </li>
  )
}

function Rating({ answer, onAnswer, labelledBy }) {
  return (
    <div className="ev-rating" role="radiogroup" aria-labelledby={labelledBy}>
      {RATINGS.map((n) => (
        <Pick key={n} on={!answer?.na && answer?.value === n} onClick={() => onAnswer({ value: n, na: false })}>
          {n}
        </Pick>
      ))}
      <Pick on={Boolean(answer?.na)} onClick={() => onAnswer({ value: null, na: true })} className="is-na">
        N/A
      </Pick>
    </div>
  )
}

function Scale({ question: q, answer, onAnswer, labelledBy }) {
  const values = []
  for (let n = q.scaleMin; n <= q.scaleMax; n++) values.push(n)
  return (
    <>
      {/* Eleven buttons don't fit a phone's width at thumb size: two rows there, one row on a wider screen. */}
      <div
        className="ev-scale"
        role="radiogroup"
        aria-labelledby={labelledBy}
        style={{ '--n': values.length, '--half': Math.ceil(values.length / 2) }}
      >
        {values.map((n) => (
          <Pick key={n} on={answer?.value === n} onClick={() => onAnswer({ value: n })}>{n}</Pick>
        ))}
      </div>
      <div className="ev-scale-ends" aria-hidden="true">
        {q.minLabel && <span>{q.scaleMin} = {q.minLabel}</span>}
        {q.maxLabel && <span className="is-max">{q.scaleMax} = {q.maxLabel}</span>}
      </div>
    </>
  )
}

function Choice({ question: q, answer, onAnswer, labelledBy }) {
  return (
    <>
      <div className="ev-choices" role="radiogroup" aria-labelledby={labelledBy}>
        {q.options.map((option) => (
          <Pick
            key={option}
            on={answer?.choice === option}
            // Tapping the picked option again clears it — the whole section is optional.
            onClick={() => onAnswer({ choice: answer?.choice === option ? null : option })}
            className="is-wide"
          >
            {option}
          </Pick>
        ))}
      </div>
      {answer?.choice === 'Other' && (
        <input
          className="ev-input"
          maxLength={200}
          aria-label="Please specify"
          placeholder="Please specify"
          value={answer?.text ?? ''}
          onChange={(e) => onAnswer({ text: e.target.value })}
        />
      )}
    </>
  )
}

function Pick({ on, onClick, className = '', children }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`ev-pick ${className}${on ? ' is-on' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}
