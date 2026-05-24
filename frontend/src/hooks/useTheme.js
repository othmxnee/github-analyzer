import { useState, useEffect } from 'react'

/**
 * Watches the `data-theme` attribute on <html> and returns whether light mode is active.
 * Charts use this to pick readable grid/tick colors without prop drilling.
 */
export function useTheme() {
  const [isLight, setIsLight] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'light'
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return isLight
}

/** Returns Chart.js color tokens for the current theme. */
export function useChartColors() {
  const isLight = useTheme()
  return {
    grid:     isLight ? 'rgba(0,0,0,0.07)'  : 'rgba(255,255,255,0.1)',
    tick:     isLight ? '#4b5563'            : '#9ca3af',
    legend:   isLight ? '#4b5563'            : '#9ca3af',
    muted:    isLight ? '#6b7280'            : '#9ca3af',
  }
}
