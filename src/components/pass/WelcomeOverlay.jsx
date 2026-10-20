import { useEffect, useMemo } from 'react'

const SHOW_MS = 8_000
const CONFETTI = 28
const COLOURS = ['#C8A84B', '#F0D78C', '#ffffff', '#9E7D2A', '#7dd3fc']

/**
 * The moment a scan or a desk moves them on: a full-screen welcome on their own phone, saying where
 * to go next. Eight seconds — long enough to read the desk off it (ATOP, 2026-10-17) — or until they
 * tap it: they are in a queue, and a screen that waits for a button holds it up.
 *
 * The confetti is CSS only, and a phone set to reduce motion gets the words without it.
 */
export default function WelcomeOverlay({ title, line, onDone }) {
  useEffect(() => {
    // A buzz in the pocket says "you're in" before they look. Android only; iOS ignores it quietly.
    try { navigator.vibrate?.([60, 40, 120]) } catch { /* not allowed here: nothing to do */ }
    const timer = setTimeout(onDone, SHOW_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  const pieces = useMemo(
    () => Array.from({ length: CONFETTI }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      delay: `${(i % 7) * 0.12}s`,
      duration: `${2.2 + (i % 5) * 0.35}s`,
      colour: COLOURS[i % COLOURS.length],
      tilt: `${(i * 53) % 360}deg`,
    })),
    [],
  )

  return (
    <div className="wo" role="alertdialog" aria-live="assertive" aria-label={title} onClick={onDone}>
      <div className="wo-confetti" aria-hidden="true">
        {pieces.map((p, i) => (
          <span
            key={i}
            style={{
              left: p.left, background: p.colour, animationDelay: p.delay,
              animationDuration: p.duration, '--tilt': p.tilt,
            }}
          />
        ))}
      </div>

      <div className="wo-card">
        <div className="wo-tick" aria-hidden="true"><i className="fas fa-check" /></div>
        <h2 className="wo-title">{title}</h2>
        <p className="wo-line">{line}</p>
        <p className="wo-hint">Tap anywhere to continue</p>
      </div>
      <div className="wo-timer" aria-hidden="true" />

      <style>{`
        .wo {
          position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px;
          background: radial-gradient(circle at 50% 35%, var(--navy-light) 0%, var(--navy) 70%);
          color: var(--white); text-align: center; cursor: pointer; overflow: hidden;
          animation: wo-in 0.35s ease-out both;
        }
        .wo-card { position: relative; max-width: 22rem; animation: wo-pop 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .wo-tick {
          width: 88px; height: 88px; margin: 0 auto 22px; border-radius: 50%; display: grid; place-items: center;
          background: linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark));
          color: var(--navy); font-size: 2.4rem; box-shadow: 0 0 0 10px rgba(200, 168, 75, 0.18);
          animation: wo-ring 1.6s ease-out 0.3s infinite;
        }
        .wo-title {
          margin: 0; font-family: var(--font-heading); font-weight: 800; line-height: 1.15;
          font-size: clamp(1.7rem, 8vw, 2.4rem); letter-spacing: -0.01em;
        }
        .wo-line { margin: 14px 0 0; font-size: 1.05rem; line-height: 1.5; color: rgba(255, 255, 255, 0.86); }
        .wo-hint { margin: 28px 0 0; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-light); opacity: 0.8; }
        .wo-timer {
          position: absolute; left: 0; bottom: 0; height: 4px; width: 100%; background: var(--gold);
          transform-origin: left; animation: wo-timer ${SHOW_MS}ms linear both;
        }
        .wo-confetti { position: absolute; inset: 0; pointer-events: none; }
        .wo-confetti span {
          position: absolute; top: -12px; width: 8px; height: 14px; border-radius: 2px; opacity: 0.95;
          animation-name: wo-fall; animation-timing-function: cubic-bezier(0.3, 0.6, 0.6, 1); animation-fill-mode: both;
        }
        @keyframes wo-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wo-pop { from { opacity: 0; transform: scale(0.85) translateY(12px) } to { opacity: 1; transform: none } }
        @keyframes wo-ring {
          0% { box-shadow: 0 0 0 0 rgba(200, 168, 75, 0.45) }
          100% { box-shadow: 0 0 0 26px rgba(200, 168, 75, 0) }
        }
        @keyframes wo-fall {
          from { transform: translateY(0) rotate(0deg) }
          to { transform: translateY(110vh) rotate(var(--tilt)) }
        }
        @keyframes wo-timer { from { transform: scaleX(1) } to { transform: scaleX(0) } }
        @media (prefers-reduced-motion: reduce) {
          .wo, .wo-card, .wo-tick { animation: none; }
          .wo-confetti { display: none; }
        }
      `}</style>
    </div>
  )
}
