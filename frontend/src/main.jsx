import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { isEmbedded } from './services/host'
import './styles.css'


/* The desktop app and VS Code load the build from a file-like URL with no
   server to rewrite deep links, so they use hash routing. */
const Router = isEmbedded ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
)
