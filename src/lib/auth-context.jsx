// src/lib/auth-context.jsx
// Session state for the app: who's signed in, plus login/signup/logout and a
// "continue as guest" escape hatch (guests use localStorage only, no cloud sync).
import { createContext, useContext, useEffect, useState, useCallback, createElement } from 'react'
import * as authClient from './auth-client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guest, setGuest] = useState(false)

  // Bootstrap: ask the server who we are (validates the session cookie).
  useEffect(() => {
    let alive = true
    authClient.me().then((u) => {
      if (!alive) return
      setUser(u)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const signup = useCallback(async (fields) => {
    const { user: u } = await authClient.signup(fields)
    setUser(u)
    setGuest(false)
    return u
  }, [])

  const login = useCallback(async (fields) => {
    const { user: u } = await authClient.login(fields)
    setUser(u)
    setGuest(false)
    return u
  }, [])

  const logout = useCallback(async () => {
    await authClient.logout()
    setUser(null)
    setGuest(false)
  }, [])

  const continueAsGuest = useCallback(() => setGuest(true), [])
  // Leaving guest mode drops you back at the sign-in screen; whatever the guest
  // built locally is pushed up to the new account on first sync (see CloudSync).
  const exitGuest = useCallback(() => setGuest(false), [])

  const value = { user, loading, guest, signup, login, logout, continueAsGuest, exitGuest }
  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
