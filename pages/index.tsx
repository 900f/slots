import Head from 'next/head'
import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
type Slot = { slot_num: number; booked: boolean; login_val?: string }
type DaySummary = { date: string; day_name: string; start_time: string; booked: number; total: number; slots: Slot[] }

// ── Constants ──────────────────────────────────────────────────────────────
const DAY_CFG = [
  { short: 'Sat', full: 'Saturday',   h: 15 },
  { short: 'Sun', full: 'Sunday',     h: 16 },
  { short: 'Mon', full: 'Monday',     h: 17 },
  { short: 'Tue', full: 'Tuesday',    h: 18 },
  { short: 'Wed', full: 'Wednesday',  h: 19 },
  { short: 'Thu', full: 'Thursday',   h: 20 },
]
const MAX_SLOTS = 4

// ── Helpers ────────────────────────────────────────────────────────────────
function getSaturday(offset = 0): string {
  const now = new Date()
  const dow = now.getDay()
  const diff = dow === 6 ? 0 : -(dow + 1)
  const sat = new Date(now)
  sat.setDate(now.getDate() + diff + offset * 7)
  sat.setHours(0, 0, 0, 0)
  return sat.toISOString().slice(0, 10)
}
function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
function fmtDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}
function fmtTime(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h > 12 ? h - 12 : h}:00 ${suffix}`
}

// ── Component ──────────────────────────────────────────────────────────────
export default function BookingPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekData, setWeekData] = useState<Record<string, DaySummary>>({})
  const [loading, setLoading] = useState(false)
  const [selDate, setSelDate] = useState<string | null>(null)
  const [loginMode, setLoginMode] = useState<'username' | 'email'>('username')
  const [loginVal, setLoginVal] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [csrf, setCsrf] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const satStr = getSaturday(weekOffset)
  const thuStr = (() => {
    const d = new Date(satStr + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 5)
    return d.toISOString().slice(0, 10)
  })()

  // Generate CSRF client-side seed (session-less: uses IP on server)
  useEffect(() => {
    // CSRF seed generated on-page by fetching a lightweight ping
    // We rely on server-side IP-keyed CSRF for stateless pages
    setCsrf(btoa(`${Date.now()}:${Math.random()}`).slice(0, 24))
  }, [])

  const loadWeek = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/slots?saturday=${satStr}`)
      if (!res.ok) throw new Error()
      const rows: DaySummary[] = await res.json()
      const map: Record<string, DaySummary> = {}
      rows.forEach(r => { map[r.date] = r })
      setWeekData(map)
      // If selected date is no longer in this week, clear it
      setSelDate(d => {
        if (d && !map[d]) return null
        return d
      })
    } catch { showToast('Failed to load slots', 'err') }
    finally { setLoading(false) }
  }, [satStr])

  useEffect(() => { loadWeek() }, [loadWeek])

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3400)
  }

  async function handleSubmit() {
    if (!selDate) return showToast('Please select a day first.', 'err')
    const val = loginVal.trim()
    if (!val) return showToast(`${loginMode === 'email' ? 'Email' : 'Username'} is required.`, 'err')
    if (loginMode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
      return showToast('Enter a valid email address.', 'err')
    }
    if (!password.trim()) return showToast('Password is required.', 'err')
    const day = weekData[selDate]
    if (day && day.booked >= MAX_SLOTS) return showToast('This day is fully booked!', 'err')

    setSubmitting(true)
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf,
          date: selDate,
          login_type: loginMode,
          login_val: val,
          password: password.trim(),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        showToast(`✓ Slot #${data.slot_num} confirmed!`, 'ok')
        setLoginVal(''); setPassword(''); setSelDate(null)
        await loadWeek()
      } else {
        showToast(data.error || 'Booking failed.', 'err')
      }
    } catch { showToast('Network error. Try again.', 'err') }
    finally { setSubmitting(false) }
  }

  const selDaySummary = selDate ? weekData[selDate] : null

  return (
    <>
      <Head>
        <title>Book a Slot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Book your slot online" />
      </Head>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '2rem 1rem', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="fade-up">
          <span style={{ fontSize: '.66rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--accent)', display: 'block', marginBottom: '.5rem' }}>
            Registration
          </span>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(1.7rem, 6vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.1 }}>
            Book Your Slot
          </h1>
          <p style={{ marginTop: '.5rem', color: 'var(--muted)', fontSize: '.8rem', lineHeight: 1.6 }}>
            Pick a day, enter your details, and secure your spot.
          </p>
        </div>

        <div className="card fade-up" style={{ animationDelay: '.06s' }}>
          {/* ── Step 1: Date ── */}
          <span className="sec-label">01 — Choose a Day</span>

          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.7rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setWeekOffset(o => o - 1); setSelDate(null) }}>
              ← Prev
            </button>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '.82rem' }}>
              {fmtShort(satStr)} → {fmtShort(thuStr)}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setWeekOffset(o => o + 1); setSelDate(null) }}>
              Next →
            </button>
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5, marginBottom: '1rem' }}>
            {DAY_CFG.map((cfg, i) => {
              const d = new Date(satStr + 'T12:00:00Z')
              d.setUTCDate(d.getUTCDate() + i)
              const dateStr = d.toISOString().slice(0, 10)
              const info = weekData[dateStr]
              const booked = info?.booked ?? 0
              const full = booked >= MAX_SLOTS
              const isSel = selDate === dateStr
              return (
                <button
                  key={dateStr}
                  disabled={full || loading}
                  onClick={() => { if (!full) setSelDate(dateStr) }}
                  style={{
                    background: isSel ? 'rgba(79,110,247,.18)' : full ? 'rgba(247,85,85,.04)' : 'rgba(79,110,247,.06)',
                    border: `1px solid ${isSel ? 'var(--accent)' : full ? 'rgba(247,85,85,.15)' : 'var(--border)'}`,
                    boxShadow: isSel ? '0 0 0 1px var(--accent)' : 'none',
                    borderRadius: 9, padding: '.45rem .15rem', cursor: full ? 'not-allowed' : 'pointer',
                    textAlign: 'center', transition: 'all .18s',
                    opacity: full ? .32 : 1,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span style={{ fontSize: '.52rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>{cfg.short}</span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '.95rem', fontWeight: 800, display: 'block' }}>{d.getUTCDate()}</span>
                  <span style={{ fontSize: '.49rem', color: 'var(--accent)', display: 'block', marginTop: 2 }}>{fmtTime(cfg.h)}</span>
                  <span style={{ fontSize: '.46rem', color: full ? 'var(--error)' : 'var(--muted)', display: 'block', marginTop: 1 }}>
                    {loading ? '…' : full ? 'FULL' : `${MAX_SLOTS - booked} left`}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Selected day slot panel */}
          {selDaySummary ? (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '.85rem', marginBottom: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.6rem',
            }}>
              <div>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '.8rem', display: 'block', marginBottom: 2 }}>
                  {selDaySummary.day_name}, {fmtDay(selDaySummary.date)}
                </span>
                <span style={{ color: 'var(--accent)', fontSize: '.7rem' }}>
                  Starts at {selDaySummary.start_time}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {selDaySummary.slots.map(s => (
                  <div key={s.slot_num} style={{
                    width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.58rem', fontFamily: 'Syne, sans-serif', fontWeight: 800,
                    background: s.booked ? 'rgba(247,85,85,.1)' : 'rgba(45,217,138,.07)',
                    border: `1px solid ${s.booked ? 'rgba(247,85,85,.3)' : 'rgba(45,217,138,.22)'}`,
                    color: s.booked ? 'var(--error)' : 'var(--success)',
                  }}>
                    {s.booked ? '✕' : s.slot_num}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: '.72rem',
              border: '1px dashed var(--border)', borderRadius: 9, marginBottom: '1rem',
            }}>
              ← Select a day to see available slots
            </div>
          )}

          <div className="divider" />

          {/* ── Step 2: Details ── */}
          <span className="sec-label">02 — Your Details</span>

          {/* Login type toggle */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: '.9rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 9, padding: 3,
          }}>
            {(['username', 'email'] as const).map(m => (
              <button key={m} onClick={() => { setLoginMode(m); setLoginVal('') }}
                style={{
                  flex: 1, background: loginMode === m ? 'var(--card)' : 'transparent',
                  border: `1px solid ${loginMode === m ? 'var(--border-hi)' : 'transparent'}`,
                  borderRadius: 7, padding: '.42rem 0',
                  fontSize: '.7rem', color: loginMode === m ? 'var(--text)' : 'var(--muted)',
                  cursor: 'pointer', transition: 'all .18s', textTransform: 'capitalize',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {m === 'username' ? 'Username' : 'Email'}
              </button>
            ))}
          </div>

          <div className="field">
            <label>{loginMode === 'email' ? 'Email Address' : 'Username'}</label>
            <input
              type={loginMode === 'email' ? 'email' : 'text'}
              value={loginVal}
              onChange={e => setLoginVal(e.target.value)}
              placeholder={loginMode === 'email' ? 'you@example.com' : 'your_username'}
              maxLength={128}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode={loginMode === 'email' ? 'email' : 'text'}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              maxLength={128}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <button
            className="btn btn-primary btn-full"
            disabled={submitting}
            onClick={handleSubmit}
            style={{ marginTop: '.2rem' }}
          >
            {submitting ? <><span className="spinner" />Booking…</> : 'Confirm Booking'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.1rem', fontSize: '.66rem', color: 'var(--muted)' }}>
          <a href="/admin" style={{ color: 'var(--muted)', borderBottom: '1px dotted var(--border-hi)' }}>
            Admin Dashboard
          </a>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast ${toast ? 'show' : ''} ${toast?.type ?? ''}`}>
        <span className="toast-dot" />
        <span>{toast?.msg}</span>
      </div>
    </>
  )
}
