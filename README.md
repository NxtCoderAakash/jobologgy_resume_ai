# Jobologgy — AI Resume Optimizer

Upload a résumé (PDF / DOCX / image / screenshot / pasted text) + a job description. A free AI model
(Google Gemini) rewrites it to be **ATS-compliant and tailored to the JD**, scores it **before vs
after**, explains **what was lacking, what it now has, and why keyword matching improved**, and
produces **two PDFs** — the optimized CV and a diagnostic report.

Stack: **Next.js + React + TypeScript + Tailwind** (frontend) · **plain Node.js, native `http`, no
framework** (backend) · **Supabase** (Auth + Postgres + Storage) · **Google Gemini** (free tier).

```
jobologgy/
├── backend/     plain Node.js service (native http) — the language-agnostic integration surface
└── frontend/    Next.js demo app + a copy-paste integration module (JS and TS flavors)
```

---

## 1. Prerequisites

- Node.js 18+ (uses global `fetch`; native `http`)
- A free **Google Gemini** API key — https://aistudio.google.com/apikey
- A **Supabase** project — https://supabase.com (grab the project URL, anon key, service-role key)

## 2. Supabase setup

1. Open your Supabase project → **SQL Editor** → paste and run
   [`backend/supabase/migrations/0001_init.sql`](backend/supabase/migrations/0001_init.sql).
   This creates the `profiles` + `resume_jobs` tables, RLS policies, and the `uploads` / `generated`
   storage buckets.
2. Under **Authentication → Providers**, keep Email enabled (it is by default).

## 3. Backend

```bash
cd backend
cp .env.example .env      # fill in the values
npm install               # note: puppeteer downloads Chromium on first install (slow)
npm run dev               # starts on http://localhost:8787
```

`.env`:

| var | meaning |
|-----|---------|
| `PORT` | backend port (default 8787) |
| `GEMINI_API_KEY` | from Google AI Studio |
| `SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key (server only — never expose to the browser) |
| `FRONTEND_ORIGIN` | allowed CORS origin, e.g. `http://localhost:3000` |

## 4. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in the values
npm install
npm run dev                        # http://localhost:3000
```

`.env.local`:

| var | meaning |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key |
| `NEXT_PUBLIC_BACKEND_URL` | e.g. `http://localhost:8787` |

Sign up, go to **/app**, upload a résumé + paste a JD, click **Optimize**.

---

## 5. Integrating into your existing product

The **backend is the real integration surface and it is language-agnostic** — it speaks HTTP + JSON,
so your existing frontend calls `POST /api/analyze` the same way whether it's JavaScript or
TypeScript. You can also import `services/analyzeResume.ts` directly into your existing plain-Node
backend (no framework assumptions).

For the UI, a self-contained, copy-paste feature module is provided in **both flavors**:

- **TypeScript app** → copy [`frontend/integration/ts/`](frontend/integration/ts/)
- **JavaScript app** → copy [`frontend/integration/js/`](frontend/integration/js/)

Then set `NEXT_PUBLIC_BACKEND_URL` (and pass the user's Supabase JWT to the API client). See
[`frontend/integration/README.md`](frontend/integration/README.md).

---

## Notes / limits

- Gemini free tier is rate-limited; the backend returns a friendly "try again shortly" on HTTP 429.
- Scanned/low-quality images depend on Gemini's OCR quality — pasted text is the most reliable path.
- The AI prompt forbids fabricating employers/dates, so the optimized CV stays truthful and ATS-safe.
