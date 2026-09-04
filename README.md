# JC Command Center

Ek personal work cockpit. Demo build: **ek admin + ek client**, aage jaakar SaaS.

Teen screens: **Dashboard** (free canvas, user apne widgets khud lagata hai),
**To-do**, **Calendar**.

Stack: React (Vite) + Node/Express + Postgres.

---

## Ban chuka hai — Phase 1 se 5

| | |
|---|---|
| Auth | Login, httpOnly cookie session, logout, change password |
| Roles | `admin` accounts banata hai, `client` apna kaam karta hai |
| **Data isolation** | Har query `user_id` se scoped. **Admin bhi client ke tasks nahi dekh sakta** |
| Users screen | Admin only — user list, add user, reset password, enable/disable |
| To-do | List, 7 filter views, search, quick add, detail drawer, bulk actions |
| Urgency engine | 9 labels + attention score — overdue apne aap upar aata hai |
| Calendar | Month / Week / Day, apne events, double-click se create, drag se reschedule |
| Deadlines on calendar | Open tasks ki deadline markers ki tarah, SOS laal mein |
| **Dashboard canvas** | Free canvas — drag, resize, overlap, z-order, snap, undo/redo |
| Layout persistence | Per user, per breakpoint; default layout jab tak kuch save na ho |
| Widgets | Chart, number card, progress, task list, mini calendar, quick add, clock, note |
| **Charts** | Pie · donut · bar · horizontal bar · line · table, sab ek config se |
| Config panel | Widget select karo → type / group by / scope / range / title |
| **Buckets** | User apne banata hai — Payment, Sales, HR, jo bhi. Rename, delete, colour |
| **Dump → Triage** | Title-only dump, phir Triage se ek-ek click mein bucket assign |
| **Board** | Buckets columns ki tarah, task drag karke daalo |

Baaki: mobile layout editor (P5).

**Chart ke combinations:** 6 types × 10 group-by × 3 scopes × 4 ranges = **720**,
aur banane mein sirf ek config object + teen dropdowns lage.

## Setup

Postgres chahiye. Ek baar:

```bash
createdb jc_command_center

cd backend
cp .env.example .env          # JWT_SECRET mein koi lamba random string daalo
npm install
npm run db:setup -- you@example.com "your-password" "Your Name"

cd ../frontend && npm install
```

## Rozana chalane ke liye

Do terminal:

```bash
cd backend && npm run dev     # API  → http://localhost:4000
```

```bash
cd frontend && npm run dev    # App  → http://localhost:5180
```

## Tests

```bash
cd backend  && npm test   # urgency, CORS, layout validation, chart aggregation — 33 checks
cd frontend && npm test   # date math + calendar overlap layout — 8 checks
```

Yahi do jagah asli logic hai; baaki sab CRUD aur layout hai.

---

## Structure

```
backend/                → Render
  schema.sql            tables: accounts, users, tasks, buckets, events, dashboard_layouts
  render.yaml           Render blueprint
  src/
    index.js            express app + routes wiring
    db.js               pg pool
    auth.js             hashing, JWT cookie, requireAuth / requireAdmin
    score.js            urgency engine (charts P4 mein isi ko use karenge)
    layout.js           widget shape, defaults aur validation
    stats.js            chart aggregation — group by, scope, range
    allowed-origin.js   CORS allowlist
    migrate.js          schema.sql apply karta hai (npm run db:migrate)
    setup.js            schema + pehla admin banata hai
    routes/             auth.js · tasks.js · buckets.js · calendar.js · dashboard.js · stats.js · admin.js
  test/score.test.js

frontend/               → Vercel
  vercel.json           /api rewrite to Render + SPA fallback
  src/
    App.jsx             auth gate + routes
    api.js              fetch wrapper
    dates.js            local-time helpers + overlap lane layout
    useHistory.js       undo/redo (ek drag = ek undo step)
    useSize.js          element measurement (charts real px par draw hote hain)
    useBuckets.js       user ke buckets + counts
    widgets/            registry + charts.jsx (SVG) + 8 widgets
    components/         Shell · TaskDrawer · EventDrawer · BucketBar · Triage · Board · canvas/
    pages/              Login · Todo · Calendar · Dashboard · Admin
  test/dates.test.js
```


## Deploy

Backend **Render** par, frontend **Vercel** par. Do alag services, ek repo.

### 1. Database

Koi bhi managed Postgres (Render Postgres, Neon, Supabase). Connection string
copy kar lo. TLS apne aap handle hota hai — `db.js` local ke alawa har jagah
SSL on kar deta hai.

Schema ek baar apply karna hai:

```bash
DATABASE_URL="<prod connection string>" npm --prefix backend run db:migrate
DATABASE_URL="<prod connection string>" JWT_SECRET=x \
  npm --prefix backend run db:setup -- you@example.com "your-password" "Your Name"
```

### 2. Backend → Render

`backend/render.yaml` blueprint hai, ya dashboard se manually:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check | `/api/health` |

Env vars: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (lamba random —
badalne par sab log out ho jaayenge), aur `CORS_ORIGINS` (neeche dekho).

### 3. Frontend → Vercel

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework | Vite |
| Build command | `npm run build` |
| Output | `dist` |

`frontend/vercel.json` mein Render ka URL daalna hai:

```json
{ "source": "/api/:path*", "destination": "https://<your-app>.onrender.com/api/:path*" }
```

Doosra rewrite (`/:path*` → `/index.html`) React Router ke liye hai — uske bina
`/todo` refresh karte hi 404 aayega.

### Cookie — ye padh lena

Session ek httpOnly cookie hai. Do tareeke hain:

**A. Vercel se proxy (default, aur kam tootne wala).** `vercel.json` `/api` ko
Render par bhej deta hai, toh browser ke liye sab kuch ek hi domain hai. Cookie
first-party rehti hai. `VITE_API_URL` khaali chhod do aur `CORS_ORIGINS` bhi.

**B. Render ko seedha call karo.** `VITE_API_URL=https://<app>.onrender.com` set
karo **aur** Render par `CORS_ORIGINS=https://<app>.vercel.app`. Dono chahiye —
ek bhi chhoot gaya toh login chup-chaap fail hoga. Cookie tab third-party ho
jaati hai, jise kuch browsers (Safari) block kar sakte hain. Isi liye A default hai.

Production mein cookie `SameSite=None; Secure` par set hoti hai, isliye backend
sirf HTTPS par kaam karega — Render par ye apne aap hai.

## Design decisions

- **Koi ORM nahi.** Teen tables ke liye plain SQL kaafi hai.
- **`account_id` har table mein, abhi se.** Aaj bekaar lagta hai (2 users hain),
  par SaaS ke waqt na hone ka matlab har table migrate karna.
- **`client` aur `category` sirf text fields hain**, alag module nahi. Isse P4 ke
  charts mein "group by client" bina koi module banaye kaam karega.
- **Score JS mein compute hota hai**, SQL mein nahi. Hazaar tasks tak theek hai;
  usse aage `score.js` ka logic SQL mein le jaana padega.
- **Admin ke paas doosre user ka data padhne ka koi route nahi.** Ye decision hai,
  bhool nahi — isliye Users screen woh offer bhi nahi karti.
- **Calendar hath se likha hai, koi calendar library nahi.** Month grid thoda sa
  date math hai; drag-reschedule native HTML5 drag-and-drop se chalta hai. Ek
  library apna poora CSS bhi laati, jo hamare design se ladta.
- **Ek hi call se calendar bharta hai** — `GET /api/calendar?from&to` events aur
  task deadlines dono deta hai.
- **Drag ghante par snap karta hai.** Exact time chahiye toh drawer se set karo.
- **Canvas bhi hath se likha hai** — koi grid/dnd library nahi. Native pointer
  events, absolute positioning, overlap allowed, 8px optional snap.
- **Ek drag = ek undo step.** History gesture ke shuru mein ek baar snapshot
  leti hai, har pointermove par nahi.
- **Widget registry se chalta hai** (`frontend/src/widgets/index.jsx`). Naya
  widget add karne ke liye canvas ko chhune ki zaroorat nahi. Anjaan type
  placeholder ban jaata hai, taaki aaj ka layout kal bhi khule.
- **Layout server par sanitize hota hai** — position clamp, unknown type drop,
  duplicate id fix. Ek kharab widget poora dashboard nahi rok sakta.
- **Chart library nahi li.** Pie/bar/line hath ke SVG hain (~250 lines). Ek
  library ~100KB laati aur apni theming bhi, jo hamare tokens se ladti. Bundle
  charts ke saath sirf 10KB bada hua.
- **Categorical palette validated hai** (dataviz skill ka validator, dono modes).
  Hues fixed order mein milte hain, kabhi cycle nahi hote — cap ke baad tail
  "Other" ban jaati hai. Status colours (red/amber/green) series ke liye kabhi
  use nahi hote.
- **Bucket delete karne par tasks nahi jaate.** Foreign key `on delete set null`
  hai, toh wo wapas bina-bucket ho kar Triage mein aa jaate hain — app code par
  bharosa nahi karna padta.
- **Dump hamesha title-only hai.** Bees soch bees Enter mein jaani chahiye;
  baaki sab Triage mein decide hota hai. Ye jaan-boojh kar hai.
- **Bucket ke naam case-insensitive unique hain** — "Sales" aur "sales" do alag
  buckets nahi ban sakte.
- **Grouping JS mein hoti hai**, SQL mein nahi — ek hi code path computed
  dimensions (urgency, due bucket) aur plain columns dono ke liye.

## Abhi jo nahi hai

Charts (pie/bar/line) aur widget config panel, mobile layout editor,
recurring events, calendar sync, Inbox/Delegated/Waiting/
Think, Clients/Payments/Revenue, Ideas, Recurring, reviews, notifications,
integrations, public signup, billing.
