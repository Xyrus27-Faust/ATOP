/**
 * What a delegate can't eat: the allergy first and in red, the rest of what they avoid after it, then
 * their own words. Grey when they declared nothing, so "nothing" reads as an answer rather than a
 * missing strip. Shared by the scan result and the desk card.
 */
export default function DietStrip({ diet }) {
  const none = !diet.hasAllergy && diet.restrictions.length === 0 && !diet.notes
  return (
    <div className={`diet${none ? ' is-none' : diet.hasAllergy ? ' is-allergy' : ''}`}>
      <p className="diet-head">
        <i className={`fas ${diet.hasAllergy ? 'fa-triangle-exclamation' : 'fa-utensils'}`} aria-hidden="true" />
        {none ? 'No dietary needs' : diet.hasAllergy ? 'Food allergy' : 'Dietary needs'}
      </p>
      {diet.restrictions.length > 0 && <p className="diet-tags">{diet.restrictions.join(' · ')}</p>}
      {diet.notes && <p className="diet-note">“{diet.notes}”</p>}
      <style>{DIET_CSS}</style>
    </div>
  )
}

const DIET_CSS = `
  .diet {
    margin-bottom: 14px; padding: 12px 14px; border-radius: var(--radius-sm);
    background: var(--warn-bg); border-left: 5px solid var(--warn);
  }
  .diet.is-allergy { background: var(--bad-bg); border-left-color: var(--bad); }
  .diet-head {
    display: flex; align-items: center; gap: 8px; color: var(--warn);
    font-family: var(--font-heading); font-weight: 800; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.03em;
  }
  .diet.is-allergy .diet-head { color: var(--bad); }
  .diet.is-none { background: var(--gray-100); border-left-color: var(--gray-400); padding: 8px 14px; }
  .diet.is-none .diet-head { color: var(--gray-600); font-size: 0.85rem; }
  .diet-tags { margin-top: 6px; font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; color: var(--navy); }
  .diet-note { margin-top: 4px; font-family: var(--font-body); font-size: 1rem; line-height: 1.4; color: var(--gray-800); overflow-wrap: anywhere; }
`
