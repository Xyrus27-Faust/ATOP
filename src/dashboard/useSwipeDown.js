import { useRef, useState } from 'react'

// Past this far down, letting go closes the sheet; short of it, the sheet springs back.
const CLOSE_PX = 70
// A quick flick closes it from a shorter drag.
const FLICK_PX = 20
const FLICK_PX_PER_MS = 0.6
// Under this, a finger that wobbled is still a tap.
const TAP_SLOP_PX = 8

/**
 * Swipe down to close, for a sheet pinned to the bottom of the scanner.
 *
 * <p>Spread {@code handlers} on the sheet and move it by {@code offset} (px, null at rest). A touch
 * that starts on a button never starts a drag, so Next scan, Board and the rest stay plain taps.
 * After a real drag the click that follows is swallowed: a sheet that closes on any tap would
 * otherwise close on a drag that sprang back. {@code pressed} is a finger resting on the sheet, which
 * is how a guard holds a self-closing result to read it.</p>
 *
 * <p>Off ({@code enabled} false) while a tap on the sheet is with the server: closing it then would
 * bring the camera back, and the reply would land on whoever is scanned next.</p>
 */
export function useSwipeDown(onClose, enabled = true) {
  const drag = useRef(null)
  const moved = useRef(false)
  const [offset, setOffset] = useState(null)
  const [pressed, setPressed] = useState(false)

  const settle = () => {
    drag.current = null
    setOffset(null)
    setPressed(false)
  }

  if (!enabled) return { handlers: {}, offset: null, pressed: false }

  const handlers = {
    onPointerDown: (e) => {
      if (e.button !== 0 || e.target.closest('button')) return
      drag.current = { y: e.clientY, at: e.timeStamp }
      moved.current = false
      setPressed(true)
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    onPointerMove: (e) => {
      if (!drag.current) return
      const dy = Math.max(0, e.clientY - drag.current.y)
      if (dy > TAP_SLOP_PX) moved.current = true
      if (moved.current) setOffset(dy)
    },
    onPointerUp: (e) => {
      const d = drag.current
      if (!d) return
      const dy = Math.max(0, e.clientY - d.y)
      const speed = dy / Math.max(1, e.timeStamp - d.at)
      settle()
      if (dy > CLOSE_PX || (dy > FLICK_PX && speed > FLICK_PX_PER_MS)) onClose()
    },
    onPointerCancel: settle,
    onClickCapture: (e) => {
      if (!moved.current) return
      moved.current = false
      e.stopPropagation()
    },
  }

  return { handlers, offset, pressed }
}
