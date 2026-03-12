import { neon, NeonQueryFunction } from '@neondatabase/serverless'

// Cache the connection per serverless instance
let _sql: NeonQueryFunction<false, false> | null = null

function getDb(): NeonQueryFunction<false, false> {
  if (_sql) return _sql
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!url) throw new Error('No database URL found. Set POSTGRES_URL in environment variables.')
  _sql = neon(url)
  return _sql
}

export async function initDb() {
  const sql = getDb()
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
  await sql`CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date)`
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
  const sql = getDb()
  const rows = await sql`
    SELECT slot_num, login_type, login_val
    FROM bookings
    WHERE date = ${date}
    ORDER BY slot_num
  `
  const taken = new Map(rows.map((r) => [Number(r.slot_num), r]))
  return Array.from({ length: 4 }, (_, i) => {
    const n = i + 1
    const b = taken.get(n)
    return b
      ? { slot_num: n, booked: true, login_val: String(b.login_val), login_type: String(b.login_type) }
      : { slot_num: n, booked: false }
  })
}

// Returns slot_num on success, null if day is full, throws on DB error
export async function atomicBook(
  date: string,
  loginType: string,
  loginVal: string,
  id: string
): Promise<number | null> {
  const sql = getDb()

  // Step 1: count current bookings
  const countRows = await sql`
    SELECT COUNT(*)::int AS cnt FROM bookings WHERE date = ${date}
  `
  const current = Number(countRows[0]?.cnt ?? 0)
  if (current >= 4) return null

  // Step 2: find next free slot
  const freeRows = await sql`
    SELECT s.n AS slot_num
    FROM generate_series(1, 4) s(n)
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings WHERE date = ${date} AND slot_num = s.n
    )
    ORDER BY s.n
    LIMIT 1
  `
  if (freeRows.length === 0) return null
  const slotNum = Number(freeRows[0].slot_num)

  // Step 3: insert (UNIQUE constraint on date+slot_num prevents race condition)
  await sql`
    INSERT INTO bookings (id, date, slot_num, login_type, login_val)
    VALUES (${id}, ${date}, ${slotNum}, ${loginType}, ${loginVal})
    ON CONFLICT (date, slot_num) DO NOTHING
  `

  // Step 4: verify our insert won the race
  const verify = await sql`
    SELECT id FROM bookings WHERE date = ${date} AND slot_num = ${slotNum} AND id = ${id}
  `
  if (verify.length === 0) {
    // Someone else took that slot in a race — try again with next free slot
    const retryRows = await sql`
      SELECT s.n AS slot_num
      FROM generate_series(1, 4) s(n)
      WHERE NOT EXISTS (
        SELECT 1 FROM bookings WHERE date = ${date} AND slot_num = s.n
      )
      ORDER BY s.n
      LIMIT 1
    `
    if (retryRows.length === 0) return null
    const retrySlot = Number(retryRows[0].slot_num)
    const newId = id + '_r'
    await sql`
      INSERT INTO bookings (id, date, slot_num, login_type, login_val)
      VALUES (${newId}, ${date}, ${retrySlot}, ${loginType}, ${loginVal})
    `
    return retrySlot
  }

  return slotNum
}

export async function cancelBooking(date: string, slotNum: number): Promise<boolean> {
  const sql = getDb()
  const rows = await sql`
    DELETE FROM bookings WHERE date = ${date} AND slot_num = ${slotNum} RETURNING id
  `
  return rows.length > 0
}

export async function getWeekSummary(saturdayStr: string): Promise<DaySummary[]> {
  const DAY_NAMES = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
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
      booked: slots.filter((s) => s.booked).length,
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
