import Head from 'next/head'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'

type Slot = { slot_num: number; booked: boolean; login_val?: string; login_type?: string }
type DaySummary = { date: string; day_name: string; start_time: string; booked: number; total: number; slots: Slot[] }

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
function fmtFull(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function AdminDashboard() {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekData, setWeekData] = useState<DaySummary[]>([])
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [cancellingSlot, setCancellingSlot] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const satStr = getSaturday(weekOffset)
  const [authChecked, setAuthChecked] = useState(false)

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  const loadWeek = useCallback(async (sat: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/week?saturday=${sat}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setWeekData(json.data)
      setUsername(json.username)
      setAuthChecked(true)
    } catch (e: unknown) {
      if ((e as Error)?.message !== 'Unauthorized') showToast('Failed to load data', 'err')
    }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { loadWeek(satStr) }, [satStr, loadWeek])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  async function cancelSlot(date: string, slotNum: number) {
    const key = `${date}:${slotNum}`
    if (!confirm(`Cancel slot #${slotNum} on ${date}?`)) return
    setCancellingSlot(key)
    try {
      const res = await fetch('/api/admin/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, slot_num: slotNum }),
      })
      const data = await res.json()
      if (data.ok) {
        showToast('Booking cancelled', 'ok')
        await loadWeek(satStr)
      } else {
        showToast(data.error || 'Failed to cancel', 'err')
      }
    } catch { showToast('Network error', 'err') }
    finally { setCancellingSlot(null) }
  }

  const totalBooked = weekData.reduce((a, d) => a + d.booked, 0)
  const totalSlots  = weekData.reduce((a, d) => a + d.total, 0)
  const totalOpen   = totalSlots - totalBooked

  const thuStr = (() => {
    const d = new Date(satStr + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 5)
    return d.toISOString().slice(0, 10)
  })()

  if (!authChecked && loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard · Booking</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
      </Head>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem', position: 'relative', zIndex: 1 }}>

        {/* ── Topbar ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}
          className="fade-up">
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(1.3rem, 5vw, 1.6rem)', fontWeight: 800, lineHeight: 1.1 }}>
              Dashboard
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '.72rem', marginTop: '.2rem' }}>
              Booking overview & management
            </p>
          </div>
          <div style={{ display: 'flex', gap: '.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '.66rem', color: 'var(--muted-hi)', padding: '.38rem .75rem',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
            }}>
              @{username}
            </span>
            <a href="/" className="btn btn-ghost btn-sm">Booking</a>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.65rem', marginBottom: '1.25rem' }}
          className="fade-up" >
          {[
            { label: 'Booked', val: totalBooked, color: 'var(--accent)' },
            { label: 'Open',   val: totalOpen,   color: 'var(--success)' },
            { label: 'Total',  val: totalSlots,  color: 'var(--warn)' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '.85rem .5rem', textAlign: 'center',
            }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(1.5rem, 6vw, 2rem)', fontWeight: 800, color: s.color, display: 'block', lineHeight: 1 }}>
                {loading ? '—' : s.val}
              </span>
              <span style={{ fontSize: '.6rem', color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '.3rem', display: 'block' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Week nav ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '.72rem 1rem', marginBottom: '1rem',
        }} className="fade-up">
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(o => o - 1)}>← Prev</button>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '.82rem' }}>
            {fmtShort(satStr)} → {fmtShort(thuStr)}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(o => o + 1)}>Next →</button>
        </div>

        {/* ── Day cards ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--muted)', fontSize: '.8rem' }}>
            <span className="spinner" /> Loading…
          </div>
        ) : (
          weekData.map((day, i) => {
            const isExpanded = expandedDay === day.date
            const fillPct = Math.round((day.booked / day.total) * 100)
            const barColor = day.booked === day.total ? 'var(--error)' : day.booked > 0 ? 'var(--accent)' : 'var(--border)'

            return (
              <div key={day.date} className="fade-up" style={{ animationDelay: `${i * .04}s`, marginBottom: '.65rem' }}>
                <div style={{
                  background: 'var(--card)', border: `1px solid ${isExpanded ? 'var(--border-hi)' : 'var(--border)'}`,
                  borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s',
                }}>
                  {/* Day header — tappable */}
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '.9rem 1rem', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: '.75rem',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.92rem', display: 'block' }}>
                        {day.day_name}
                      </span>
                      <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{fmtFull(day.date)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                      {/* Slot dot indicators */}
                      <div style={{ display: 'flex', gap: 3 }}>
                        {day.slots.map(s => (
                          <div key={s.slot_num} style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: s.booked ? 'var(--error)' : 'var(--success)',
                            opacity: s.booked ? 1 : .45,
                          }} />
                        ))}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '.66rem', color: 'var(--accent)', display: 'block' }}>{day.start_time}</span>
                        <span style={{
                          fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem',
                          color: day.booked === day.total ? 'var(--error)' : 'var(--text)',
                        }}>
                          {day.booked}/{day.total}
                        </span>
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: '.7rem', transition: 'transform .2s', display: 'block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                        ▾
                      </span>
                    </div>
                  </button>

                  {/* Progress bar */}
                  <div style={{ height: 3, background: 'var(--border)', margin: '0 1rem' }}>
                    <div style={{ height: 3, background: barColor, width: `${fillPct}%`, borderRadius: 2, transition: 'width .4s ease' }} />
                  </div>

                  {/* Expanded slots */}
                  {isExpanded && (
                    <div style={{ padding: '.6rem' }}>
                      {day.slots.map(slot => {
                        const cancelKey = `${day.date}:${slot.slot_num}`
                        return (
                          <div key={slot.slot_num} style={{
                            display: 'flex', alignItems: 'center', gap: '.7rem',
                            padding: '.55rem .6rem', borderRadius: 8, marginBottom: '.35rem',
                            background: slot.booked ? 'rgba(79,110,247,.06)' : 'rgba(45,217,138,.04)',
                            border: `1px solid ${slot.booked ? 'rgba(79,110,247,.14)' : 'rgba(45,217,138,.1)'}`,
                          }}>
                            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.72rem', color: 'var(--muted)', width: 22, flexShrink: 0 }}>
                              #{slot.slot_num}
                            </span>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              {slot.booked ? (
                                <>
                                  <span style={{ display: 'block', fontSize: '.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {slot.login_val}
                                  </span>
                                  <span style={{ fontSize: '.6rem', color: 'var(--muted)', letterSpacing: '.05em' }}>
                                    {slot.login_type}
                                  </span>
                                </>
                              ) : (
                                <span style={{ fontSize: '.74rem', color: 'var(--success)' }}>Available</span>
                              )}
                            </div>

                            {slot.booked && (
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={cancellingSlot === cancelKey}
                                onClick={() => cancelSlot(day.date, slot.slot_num)}
                              >
                                {cancellingSlot === cancelKey ? <span className="spinner" /> : 'Cancel'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Toast */}
      <div className={`toast ${toast ? 'show' : ''} ${toast?.type ?? ''}`}>
        <span className="toast-dot" />
        <span>{toast?.msg}</span>
      </div>
    </>
  )
}
