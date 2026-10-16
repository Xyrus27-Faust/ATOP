import { useEffect, useState } from 'react'
import {
  CARD,
  CLASSIFICATION,
  FAMILY,
  ID_NO,
  NAME,
  NAME_COLUMN,
  NAME_LEADING,
  WELL,
  baselineFromTop,
  fit,
  layoutName,
} from './idCard'

/**
 * The convention ID front, drawn to scale, with whatever is passed as children living inside its
 * photo well.
 *
 * <p>The artwork is the printer's own front.png (portrait, no sample text), scaled down, so the
 * three lines drawn here land where the printed ones do. See {@link ./idCard.js} for the geometry and the rules both sides share.</p>
 */
export default function IdCardPreview({ width, name, classification, idNo, children }) {
  const scale = width / CARD.w
  const pt = (v) => v * scale

  useFontLoaded()

  const upperName = (name || '').toUpperCase()
  const upperClass = (classification || '').toUpperCase()
  const idLine = `ID NO: ${idNo || ''}`.trim()

  const nameLayout = layoutName(upperName)

  return (
    <div className="idp" style={{ width, height: pt(CARD.h), fontFamily: FAMILY }}>
      <img className="idp-art" src="/atop-id-front-2026.jpg" alt="" />

      <div
        className="idp-well"
        style={{
          left: pt(WELL.x),
          top: pt(WELL.y),
          width: pt(WELL.w),
          height: pt(WELL.h),
          borderRadius: pt(WELL.r),
        }}
      >
        {/* The renderer cover-fits a square photo into a well a hair taller than it is wide: the
            photo meets the well's height and loses a sliver off each side. Same here. */}
        <div
          className="idp-well-square"
          style={{ left: pt((WELL.w - WELL.h) / 2), width: pt(WELL.h), height: pt(WELL.h) }}
        >
          {children}
        </div>
      </div>

      {/* The name grows upward from its baseline, never down into the classification under it. */}
      <div
        className="idp-line"
        style={{
          left: `${(NAME.cx / CARD.w) * 100}%`,
          bottom:
            pt(CARD.h - NAME.baseline)
            - pt(nameLayout.size) * (NAME_LEADING - baselineFromTop(NAME_LEADING)),
          width: pt(NAME_COLUMN),
          fontSize: pt(nameLayout.size),
          lineHeight: NAME_LEADING,
        }}
      >
        {nameLayout.lines.map((line, i) => <div key={i} className="idp-nowrap">{line}</div>)}
      </div>

      <Line scale={scale} line={CLASSIFICATION} size={fit(upperClass, CLASSIFICATION.size, CLASSIFICATION.size * 0.7)}>
        {upperClass}
      </Line>
      <Line scale={scale} line={ID_NO} size={fit(idLine, ID_NO.size, ID_NO.size * 0.7)}>
        {idLine}
      </Line>

      <style>{idpStyles}</style>
    </div>
  )
}

/** One single line, sitting on its baseline. */
function Line({ scale, line, size, children }) {
  return (
    <div
      className="idp-line idp-nowrap"
      style={{
        left: `${(line.cx / CARD.w) * 100}%`,
        top: (line.baseline - size * baselineFromTop(1)) * scale,
        fontSize: size * scale,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Re-render once the webfont has actually arrived. Until then the lines are measured against the
 * fallback serif, fitted to the wrong widths, and the preview would settle visibly wrong.
 */
function useFontLoaded() {
  const [, setLoaded] = useState(false)

  useEffect(() => {
    let live = true
    document.fonts?.load(`${NAME.max}px ${FAMILY}`)
      .then(() => document.fonts.ready)
      .then(() => live && setLoaded(true))
      .catch(() => {})
    return () => { live = false }
  }, [])
}

const idpStyles = `
  .idp { position: relative; overflow: hidden; border-radius: 8px; box-shadow: 0 6px 18px rgba(15,25,46,0.18); color: #111; }
  .idp-art { display: block; width: 100%; height: 100%; }

  .idp-well { position: absolute; overflow: hidden; background: #fff; }
  .idp-well-square { position: absolute; top: 0; overflow: hidden; }
  .idp-well-square img { position: absolute; top: 0; left: 0; max-width: none; user-select: none; -webkit-user-drag: none; }

  .idp-line { position: absolute; transform: translateX(-50%); text-align: center; font-weight: 400; }
  .idp-nowrap { white-space: nowrap; }
`
