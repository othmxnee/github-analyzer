import { useEffect, useState } from 'react'

function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem('theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <button className={`theme-toggle ${className}`} onClick={toggleTheme} type="button">
      <span className="theme-label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
      <span className={`theme-dot ${theme}`} />
    </button>
  )
}

export default ThemeToggle
