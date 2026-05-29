import { useState, useEffect, useCallback } from 'react'
import { getAuthStatus, logout as apiLogout } from '../services/api'

const EMPTY = { github: null, gitlab: null, bitbucket: null }

export function useAuth() {
  const [state, setState] = useState({ loading: true, providers: EMPTY })

  const refresh = useCallback(() => {
    setState(s => ({ ...s, loading: true }))
    getAuthStatus()
      .then(data => setState({
        loading: false,
        providers: { ...EMPTY, ...(data.providers || {}) },
      }))
      .catch(() => setState({ loading: false, providers: EMPTY }))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const logout = useCallback(async (provider) => {
    await apiLogout(provider).catch(() => {})
    setState(s => {
      if (!provider) return { loading: false, providers: EMPTY }
      return { loading: false, providers: { ...s.providers, [provider]: null } }
    })
  }, [])

  const { providers, loading } = state
  const connectedCount = Object.values(providers).filter(Boolean).length
  const authenticated = connectedCount > 0

  // Back-compat: expose .user as the first connected provider's user
  const user = providers.github || providers.gitlab || providers.bitbucket || null

  return { loading, authenticated, user, providers, connectedCount, logout, refresh }
}
