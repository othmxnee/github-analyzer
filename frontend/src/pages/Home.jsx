import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeRepo } from '../services/api'
import Loader from '../components/Loader'
import ThemeToggle from '../components/ThemeToggle'

function Home() {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL')
      return
    }

    if (!repoUrl.includes('github.com')) {
      setError('Please enter a valid GitHub URL')
      return
    }

    setLoading(true)

    try {
      const results = await analyzeRepo(repoUrl)
      sessionStorage.setItem('analysisResults', JSON.stringify(results))
      sessionStorage.setItem('repoUrl', repoUrl)
      navigate('/dashboard')
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'An unknown error occurred'
      if (errorMsg === 'developer_id' || !errorMsg) {
        setError('Analysis failed. Please check the repository URL and try again.')
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="top-bar">
          <span className="badge">v1 • analyzer</span>
          <ThemeToggle />
        </div>

        <div className="hero">
          <h1 className="hero-title">GitHub Repository Analyzer</h1>
          <p className="hero-subtitle">Analyze code ownership, developer activity, and architectural metrics</p>

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <div className="form-card">
              <input
                className="input"
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/pallets/flask"
                disabled={loading}
              />

              {error && (
                <div className="alert" style={{ marginTop: '12px', color: '#ef4444' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '16px' }}
              >
                {loading ? 'Analyzing...' : 'Analyze Repository'}
              </button>
            </div>
          </form>

          {loading && <Loader message="Analyzing repository... please wait" />}

          <div style={{ marginTop: '20px', color: 'var(--muted)', fontSize: '0.9rem' }}>
            <p>Example: https://github.com/pallets/flask</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
