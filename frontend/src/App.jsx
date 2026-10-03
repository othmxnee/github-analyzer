import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { host, isEmbedded, LOCAL_PREFIX } from './services/host'
import Loader from './components/Loader'

/* Each page is its own chunk: the website's landing page no longer downloads
   the dashboard's chart libraries, and the embedded apps never download the
   marketing landing page. */
const Home = lazy(() => import('./pages/Home'))
const LocalHome = lazy(() => import('./pages/LocalHome'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Portfolio = lazy(() => import('./pages/Portfolio'))

function App() {
  const navigate = useNavigate()

  // Host commands (desktop menu "Open repository", VS Code "Analyze" /
  // "Refresh") start a run from wherever the user currently is.
  useEffect(() => {
    if (!isEmbedded || !host.on) return undefined
    return host.on('analyze', ({ repoPath, force } = {}) => {
      if (!repoPath) { navigate('/'); return }
      navigate('/', { state: { repoUrl: LOCAL_PREFIX + repoPath, autoSubmit: true, force: !!force } })
    })
  }, [navigate])

  return (
    <div className="app">
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={isEmbedded ? <LocalHome /> : <Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {!isEmbedded && <Route path="/portfolio" element={<Portfolio />} />}
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
