import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'

export default function AdminLogin() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!username.trim() || !password) { setError('All fields required.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (data.ok) {
        router.push('/admin')
      } else {
        setError(data.error || 'Login failed.')
      }
    } catch { setError('Network error. Try again.') }
    finally { setLoading(false) }
  }

  return (
    <>
      <Head>
        <title>Admin Login · Booking</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
      </Head>

      <div style={{
        maxWidth: 360, margin: '0 auto', padding: '2rem 1rem',
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="fade-up">
          <span style={{ fontSize: '.64rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--accent)', display: 'block', marginBottom: '.5rem' }}>
            Restricted Area
          </span>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.9rem', fontWeight: 800 }}>
            Admin Access
          </h1>
        </div>

        <div className="card fade-up" style={{ animationDelay: '.06s' }}>
          {error && <div className="error-box">{error}</div>}

          <div className="field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              maxLength={64}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={128}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <button
            className="btn btn-primary btn-full"
            disabled={loading}
            onClick={handleLogin}
            style={{ marginTop: '.25rem' }}
          >
            {loading ? <><span className="spinner" />Signing in…</> : 'Sign In'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '.68rem' }}>
          <a href="/" style={{ color: 'var(--muted)' }}>← Back to booking</a>
        </div>
      </div>
    </>
  )
}
