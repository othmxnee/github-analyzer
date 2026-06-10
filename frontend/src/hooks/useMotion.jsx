import { useEffect, useState, useRef } from 'react'

/* Terminal Noir — motion primitives.
   Design rule: content is VISIBLE BY DEFAULT. We only hide-then-animate after
   probing that requestAnimationFrame actually fires. If rAF is suspended
   (some preview / embed / hydration contexts), everything stays visible —
   counters snap to their final value, reveals just render in place. A safety
   timeout force-reveals everything after a few seconds no matter what. */

const _easeOut = p => 1 - Math.pow(1 - p, 3)

function probeMotion(cb) {
  let fired = false
  requestAnimationFrame(() => { fired = true })
  setTimeout(() => cb(fired), 240)
}

function tweenIn(el, dur = 640) {
  const start = performance.now()
  const step = t => {
    const p = Math.min((t - start) / dur, 1)
    const e = _easeOut(p)
    el.style.opacity = String(e)
    el.style.transform = `translateY(${(1 - e) * 18}px)`
    if (p < 1) requestAnimationFrame(step)
    else { el.style.opacity = ''; el.style.transform = ''; el.classList.add('in') }
  }
  requestAnimationFrame(step)
}

/* Reveal: hide elements with `.hp-reveal` until they scroll near the viewport.
   Always-visible fallback if motion is suspended. */
export function useReveal(selector = '.hp-reveal') {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(selector))
    if (!els.length) return
    let raf, safety
    const forceVisible = () => els.forEach(el => {
      el.style.opacity = ''
      el.style.transform = ''
      el.classList.add('hp-visible', 'in')
    })

    probeMotion(live => {
      if (!live) { forceVisible(); return }
      els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(18px)' })
      const pending = new Set(els)
      const tick = () => {
        const vh = window.innerHeight || document.documentElement.clientHeight
        for (const el of [...pending]) {
          if (el.getBoundingClientRect().top < vh * 0.9) {
            pending.delete(el)
            tweenIn(el)
            el.classList.add('hp-visible')
          }
        }
        if (pending.size) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      safety = setTimeout(forceVisible, 5000)
    })
    return () => { if (raf) cancelAnimationFrame(raf); if (safety) clearTimeout(safety) }
  }, [selector])
}

/* Entrance: staggered tween-in for matched elements on mount. */
export function useEntrance(selector, stagger = 130, baseDelay = 80) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(selector))
    if (!els.length) return
    probeMotion(live => {
      if (!live) return
      els.forEach((el, i) => {
        el.style.opacity = '0'
        el.style.transform = 'translateY(22px)'
        setTimeout(() => tweenIn(el, 720), baseDelay + i * stagger)
      })
      setTimeout(() => els.forEach(el => {
        el.style.opacity = ''
        el.style.transform = ''
      }), 5000)
    })
  }, [selector, stagger, baseDelay])
}

/* useCount: eases 0 → target on mount, snaps if rAF never fires. */
export function useCount(target, dur = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf, fired = false
    const snap = setTimeout(() => { if (!fired) setV(target) }, 280)
    const tick = t => {
      fired = true
      const p = Math.min((t - start) / dur, 1)
      setV(target * _easeOut(p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf); clearTimeout(snap) }
  }, [target, dur])
  return v
}

export function CountUp({ value, decimals = 0, prefix = '', suffix = '', dur = 900 }) {
  const v = useCount(Number(value) || 0, dur)
  const safeDecimals = Math.max(0, Math.min(6, decimals))
  const txt = safeDecimals > 0 ? v.toFixed(safeDecimals) : Math.round(v).toLocaleString()
  return <>{prefix}{txt}{suffix}</>
}

/* useInView: returns [ref, true] once the element scrolls into view. */
export function useInView() {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    let raf, fired = false
    requestAnimationFrame(() => { fired = true })
    const fallback = setTimeout(() => { if (!fired) setInView(true) }, 260)
    const tick = () => {
      const r = ref.current?.getBoundingClientRect()
      const vh = window.innerHeight || document.documentElement.clientHeight
      if (r && r.top < vh * 0.9) { setInView(true); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf); clearTimeout(fallback) }
  }, [])
  return [ref, inView]
}
