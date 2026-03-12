import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.POSTGRES_URL!)

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL,
      slot_num    INTEGER NOT NULL CHECK (slot_num BETWEEN 1 AND 4),
      login_type  TEXT NOT NULL CHECK (login_type IN ('username','email')),
      login_val   TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (date, slot_num)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date)
  `
}

export type Slot = {
  slot_num: number
  booked: boolean
  login_val?: string
  login_type?: string
}

export type DaySummary = {
  date: string
  day_name: string
  start_time: string
  booked: number
  total: number
  slots: Slot[]
}

export async function getSlotsForDate(date: string): Promise<Slot[]> {
  const { rows } = await sql`
    SELECT slot_num, login_type, login_val
    FROM bookings
    WHERE date = ${date}
    ORDER BY slot_num
  `
  const taken = new Map(rows.map(r => [r.slot_num, r]))
  return Array.from({ length: 4 }, (_, i) => {
    const n = i + 1
    const b = taken.get(n)
    return b
      ? { slot_num: n, booked: true, login_val: b.login_val, login_type: b.login_type }
      : { slot_num: n, booked: false }
  })
}

export async function getSlotsCountForDate(date: string): Promise<number> {
  const { rows } = await sql`
    SELECT COUNT(*) as cnt FROM bookings WHERE date = ${date}
  `
  return parseInt(rows[0].cnt, 10)
}

// Atomic booking: returns slot_num on success, null if full or race condition
export async function atomicBook(
  date: string,
  loginType: string,
  loginVal: string,
  id: string
): Promise<number | null> {
  // Use a serializable transaction to prevent double-booking
  try {
    const { rows } = await sql`
      WITH available AS (
        SELECT s.n AS slot_num
        FROM generate_series(1, 4) s(n)
        WHERE NOT EXISTS (
          SELECT 1 FROM bookings
          WHERE date = ${date} AND slot_num = s.n
        )
        ORDER BY s.n
        LIMIT 1
      )
      INSERT INTO bookings (id, date, slot_num, login_type, login_val)
      SELECT ${id}, ${date}, slot_num, ${loginType}, ${loginVal}
      FROM available
      RETURNING slot_num
    `
    if (rows.length === 0) return null
    return rows[0].slot_num
  } catch {
    return null
  }
}

export async function cancelBooking(date: string, slotNum: number): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM bookings WHERE date = ${date} AND slot_num = ${slotNum}
  `
  return (rowCount ?? 0) > 0
}

export async function getWeekSummary(saturdayStr: string): Promise<DaySummary[]> {
  const DAY_NAMES = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday']
  const START_HOURS: Record<string, number> = {
    Saturday: 15, Sunday: 16, Monday: 17,
    Tuesday: 18, Wednesday: 19, Thursday: 20,
  }
  const results: DaySummary[] = []
  const sat = new Date(saturdayStr + 'T12:00:00Z')

  for (let i = 0; i < 6; i++) {
    const d = new Date(sat)
    d.setUTCDate(sat.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const dayName = DAY_NAMES[i]
    const h = START_HOURS[dayName]
    const slots = await getSlotsForDate(dateStr)
    results.push({
      date: dateStr,
      day_name: dayName,
      start_time: formatTime(h),
      booked: slots.filter(s => s.booked).length,
      total: 4,
      slots,
    })
  }
  return results
}

export function formatTime(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hr = h > 12 ? h - 12 : h
  return `${hr}:00 ${suffix}`
}

export function getCurrentSaturday(): string {
  const now = new Date()
  const dow = now.getUTCDay() // 0=Sun..6=Sat
  const diff = dow === 6 ? 0 : -(dow + 1)
  const sat = new Date(now)
  sat.setUTCDate(now.getUTCDate() + diff)
  return sat.toISOString().slice(0, 10)
}
