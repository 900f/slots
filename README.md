# 📅 Slot Booking System — Vercel

A secure, mobile-first slot booking system with real-time slot tracking and an admin dashboard. Built for Vercel + Neon Postgres.

---

## ⚡ Deploy to Vercel (Step by Step)

### 1. Create a GitHub repo and push this code

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Import into Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Don't deploy yet — set up the database first

### 3. Set up Neon Postgres (free)

**Option A — Vercel Postgres (recommended, auto-connects):**
1. In Vercel dashboard → your project → **Storage** tab
2. Click **Create Database** → **Neon Postgres**
3. Follow the wizard — it auto-injects `POSTGRES_URL` etc.

**Option B — Neon directly (free tier):**
1. Go to [neon.tech](https://neon.tech) → create a free project
2. Copy the connection string
3. Add it as `POSTGRES_URL` in Vercel env vars

### 4. Set Environment Variables

In Vercel dashboard → your project → **Settings** → **Environment Variables**, add:

| Variable              | Value                                    | Required |
|-----------------------|------------------------------------------|----------|
| `ADMIN_USERNAME`      | Your chosen admin username               | ✅       |
| `ADMIN_PASSWORD`      | A strong password (12+ chars)            | ✅       |
| `SESSION_SECRET`      | 32-byte random hex (see below)           | ✅       |
| `POSTGRES_URL`        | Auto-set if using Vercel Postgres        | ✅       |
| `DISCORD_WEBHOOK_URL` | Your Discord webhook URL                 | Optional |

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Deploy

Click **Deploy** in Vercel. First build takes ~2 minutes.

### 6. Initialize the Database

After deployment, run this once to create the tables:

```bash
curl -X POST https://YOUR_DOMAIN.vercel.app/api/init-db \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD"
```

Replace `YOUR_ADMIN_PASSWORD` with your actual `ADMIN_PASSWORD` value.

You should see: `{"ok":true,"message":"Database initialized."}`

---

## 🔑 Admin Dashboard

Visit `https://your-domain.vercel.app/admin`

- Log in with your `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- View all bookings week by week
- See who booked each slot (username/email)
- Cancel individual bookings
- Stats: total booked / open / available

---

## 📅 Schedule

| Day       | Start Time |
|-----------|-----------|
| Saturday  | 3:00 PM   |
| Sunday    | 4:00 PM   |
| Monday    | 5:00 PM   |
| Tuesday   | 6:00 PM   |
| Wednesday | 7:00 PM   |
| Thursday  | 8:00 PM   |

4 slots per day. Repeats every week automatically.

---

## 🔒 Security Features

- **Atomic booking** — PostgreSQL `INSERT ... WHERE NOT EXISTS` prevents any double-booking, even under concurrent load
- **CSRF protection** — HMAC-SHA256 time-windowed tokens on all mutation endpoints  
- **Rate limiting** — 10 booking attempts per IP/minute; 10 admin login attempts per minute
- **Timing-safe auth** — `crypto.timingSafeEqual` for admin password comparison
- **Brute-force delay** — 600ms artificial delay on failed admin logins
- **Secure sessions** — `iron-session` with HttpOnly, SameSite=Strict cookies, 8h TTL
- **Input sanitization** — All inputs stripped of `< > " ' ; & \`` before processing
- **Security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, etc. on every response
- **Slot isolation** — Once booked, a slot is permanently locked until an admin cancels it

---

## 🛠 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up local env
cp .env.local.example .env.local
# Edit .env.local with your Neon/Postgres connection string

# 3. Initialize the DB
curl -X POST http://localhost:3000/api/init-db \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD"

# 4. Start dev server
npm run dev
```

Visit `http://localhost:3000`

---

## 📁 Project Structure

```
├── pages/
│   ├── index.tsx              # Booking page
│   ├── admin/
│   │   ├── index.tsx          # Admin dashboard
│   │   └── login.tsx          # Admin login
│   └── api/
│       ├── slots.ts           # GET: week slot availability
│       ├── book.ts            # POST: create booking
│       ├── init-db.ts         # POST: initialize database (run once)
│       └── admin/
│           ├── login.ts       # POST: admin auth
│           ├── logout.ts      # POST: destroy session
│           ├── week.ts        # GET: admin week data
│           └── cancel.ts      # POST: cancel a booking
├── lib/
│   ├── db.ts                  # Database queries (Vercel Postgres)
│   ├── session.ts             # iron-session config
│   ├── rateLimit.ts           # In-memory rate limiter
│   ├── security.ts            # CSRF, sanitization, validation
│   └── discord.ts             # Discord webhook notifications
├── styles/
│   └── globals.css            # Global styles
└── .env.local.example         # Environment variable template
```
