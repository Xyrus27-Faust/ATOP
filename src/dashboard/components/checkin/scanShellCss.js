// The full-screen scanner's shell — bar, stage, dock — shared by the checkpoint scanner and the tour scanner.
export const SCN_CSS = `
  .scn-shell {
    min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
    background: var(--off-white); font-family: var(--font-body);
  }
  .scn-shell.is-scanning { background: var(--navy); }

  .scn-bar {
    position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 10px;
    min-height: 60px; padding: max(8px, env(safe-area-inset-top)) 12px 8px 16px;
    background: var(--navy); border-bottom: 2px solid var(--gold); color: var(--white);
  }
  .scn-logo { height: 32px; width: auto; }
  .scn-brand { font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; letter-spacing: 0.04em; }
  .scn-spacer { flex: 1; }
  .scn-post { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .scn-post-day {
    font-family: var(--font-heading); font-weight: 700; font-size: 0.7rem; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--gold-light);
  }
  /* The one line a guard must never misread: which meal this phone is serving. */
  .scn-post-label {
    font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem; text-transform: uppercase;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  /* A bus label is "Package — Bus 3 (AM)": the part that matters is at the end, so it wraps, never cut. */
  .scn-post-label.is-bus {
    font-size: 1.3rem; line-height: 1.15; white-space: normal;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .scn-bar-btn {
    min-height: 44px; padding: 0 14px; flex-shrink: 0; cursor: pointer;
    background: transparent; color: var(--white); border: 1.5px solid rgba(255,255,255,0.35);
    border-radius: var(--radius-sm); font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem;
  }
  .scn-bar-btn:hover { border-color: var(--gold); color: var(--gold-light); }
  .scn-bar-btn.is-icon { width: 44px; padding: 0; }

  .scn-main { flex: 1; display: flex; flex-direction: column; }
  .scn-pad { padding: 20px 16px; }

  .scn-stage { flex: 1; display: flex; flex-direction: column; align-items: stretch; gap: 14px; padding: 20px 16px 120px; }
  .scn-aim { text-align: center; color: var(--white); font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; }
  .scn-tally { width: min(100%, 320px); margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
  .scn-count { text-align: center; color: rgba(255,255,255,0.7); font-size: 0.9rem; }
  .dash-meter.scn-meter { height: 6px; background: rgba(255,255,255,0.15); }
  .scn-count strong { color: var(--gold-light); font-family: var(--font-heading); font-size: 1.1rem; }

  .scn-trouble { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-width: 420px; width: 100%; margin: 0 auto; }
  .scn-trouble > i { font-size: 1.8rem; color: var(--bad); background: var(--bad-bg); width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; }
  .scn-trouble h2 { font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem; color: var(--navy); }
  .scn-trouble p { color: var(--gray-600); line-height: 1.6; }

  /* The thumb's zone: the fallback is always one reach away, never hidden behind a menu. */
  .scn-dock {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
    padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(15,25,46,0) 0%, var(--navy) 35%);
  }
  .scn-search-btn {
    width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 10px;
    background: var(--white); color: var(--navy); border: 0; border-radius: var(--radius-sm); cursor: pointer;
    font-family: var(--font-heading); font-weight: 700; font-size: 1rem; box-shadow: var(--shadow-lg);
  }
  .scn-search-btn:hover:not(:disabled) { background: var(--gold-light); }
  .scn-search-btn:disabled { opacity: 0.55; cursor: default; }
  .scn-dock:has(.scn-search-btn + .scn-search-btn) { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .scn-wrongbus {
    display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; margin: 0 0 4px;
    background: #FFF7ED; border: 1.5px solid #FED7AA; border-radius: var(--radius-sm); color: #C2410C;
    font-family: var(--font-body); font-size: 0.95rem; line-height: 1.5; cursor: default;
  }
  .scn-wrongbus strong { font-family: var(--font-heading); }
  .scn-wrongbus .dash-btn { width: 100%; min-height: 52px; justify-content: center; }
  .scn-wrongbus-hint { font-size: 0.88rem; }

  @media (min-width: 640px) {
    .scn-dock { left: 50%; right: auto; width: 480px; transform: translateX(-50%); background: none; bottom: 12px; }
    .scn-stage { padding-top: 32px; }
  }
`
