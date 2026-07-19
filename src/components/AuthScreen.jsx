// src/components/AuthScreen.jsx
// The front door: log in or create an account. Shown by the auth gate whenever
// nobody is signed in and the visitor hasn't chosen to explore as a guest.
import { useState } from 'react'
import { useAuth } from '../lib/auth-context.jsx'
import './AuthScreen.css'

export default function AuthScreen() {
  const { login, signup, continueAsGuest } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignup = mode === 'signup'

  async function onSubmit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (isSignup) await signup({ email, password, username })
      else await login({ email, password })
      // success unmounts this screen (the gate re-renders with a user)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden="true">◐</span>
          <span className="auth-brandname">Leeway</span>
        </div>
        <h1 className="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-sub">Know exactly what you can safely spend today.</p>

        <div className="auth-tabs" role="tablist" aria-label="Log in or sign up">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={`auth-tab ${!isSignup ? 'is-active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={`auth-tab ${isSignup ? 'is-active' : ''}`}
            onClick={() => { setMode('signup'); setError('') }}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {isSignup && (
            <label className="auth-field">
              <span>Display name <span className="auth-opt">(optional)</span></span>
              <input
                type="text"
                autoComplete="nickname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Sam"
                maxLength={60}
              />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.ac.uk"
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
            />
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <button type="button" className="auth-link" onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError('') }}>
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>

        <div className="auth-divider"><span>or</span></div>

        <button type="button" className="auth-guest" onClick={continueAsGuest}>
          Just exploring? Continue as guest
        </button>
        <p className="auth-note">Guest data stays on this device. Make an account to save it and use Leeway anywhere.</p>
      </div>
    </div>
  )
}
