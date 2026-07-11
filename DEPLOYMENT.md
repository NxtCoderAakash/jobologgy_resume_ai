# Deployment Guide — Live URL for the Client Demo

Two pieces go live, plus Supabase which is already hosted:

| Piece | Host | Why |
|-------|------|-----|
| Frontend (Next.js) | **Vercel** | Native Next.js host, free, instant |
| Backend (Node + Puppeteer) | **Render** (Docker) | Needs headless Chrome to render the PDFs |
| Database / Auth / Storage | **Supabase** | Already live — no deploy needed |

> ⚠️ **Free-tier note:** the Render backend **sleeps after ~15 min idle**. The first request after
> it sleeps takes ~50s while it wakes. Before showing the client, open the backend `/health` URL
> once to warm it up.

---

## Order of operations
Deploy the **backend first** (so you have its URL), then the **frontend**, then come back and set
the backend's `FRONTEND_ORIGIN` to the frontend URL.

---

## Step 1 — Push the repo to GitHub
From `elegant-resume-ai/`:

```bash
git init
git add .
git commit -m "Elegant Resume AI — deployable"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Create the empty repo first at https://github.com/new (no README/gitignore — the repo already has them).

✅ Your `.env` / `.env.local` files are git-ignored, so **no secrets get pushed**.

---

## Step 2 — Deploy the backend on Render
1. https://render.com → sign up (with GitHub) → **New → Blueprint**
2. Select your repo. Render reads [`render.yaml`](render.yaml) and proposes the backend service.
3. It will prompt for the **4 environment variables** — paste these values:

   | Key | Value |
   |-----|-------|
   | `GEMINI_API_KEY` | your Gemini key |
   | `SUPABASE_URL` | `https://hzreglaxlsapgzptdfml.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase **service_role** key |
   | `FRONTEND_ORIGIN` | leave as `*` for now — update in Step 4 |

4. Click **Apply**. First build takes ~5–8 min (it installs Chromium).
5. When live, note the URL, e.g. `https://elegant-resume-ai-backend.onrender.com`.
   Open `<that-url>/health` — you should see `{"ok":true,...}`.

> Not using the Blueprint? Create a **Web Service** manually: Root Directory `backend`,
> Runtime **Docker**, Health Check Path `/health`, and add the 4 env vars above.

---

## Step 3 — Deploy the frontend on Vercel
1. https://vercel.com → sign up (with GitHub) → **Add New → Project** → import the repo.
2. **Root Directory:** set to `frontend` (important — the repo has two apps).
3. Framework preset auto-detects **Next.js**. Leave build settings default.
4. Add **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://hzreglaxlsapgzptdfml.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase **anon** key |
   | `NEXT_PUBLIC_BACKEND_URL` | the Render backend URL from Step 2 |

5. **Deploy.** You'll get a URL like `https://elegant-resume-ai.vercel.app` — **this is the link for the client.**

---

## Step 4 — Connect the two (CORS + auth redirects)
1. **Render → backend service → Environment:** set `FRONTEND_ORIGIN` to your exact Vercel URL
   (e.g. `https://elegant-resume-ai.vercel.app`, no trailing slash). Save → it redeploys.
2. **Supabase → Authentication → URL Configuration:**
   - **Site URL:** your Vercel URL
   - **Redirect URLs:** add your Vercel URL
   This makes signup / email confirmation links point at the live site instead of localhost.

---

## Step 5 — Smoke test the live site
1. Open `<render-url>/health` once to wake the backend.
2. Open the Vercel URL → **Sign up** → upload a CV + paste a job description → **Optimize**.
3. Confirm the before/after scores show and both PDFs download.

---

## Troubleshooting
- **CORS error in browser console** → `FRONTEND_ORIGIN` on Render doesn't exactly match the Vercel URL (check https, no trailing slash). Redeploy after fixing.
- **First request hangs ~50s** → backend was asleep (free tier). Normal; warm it via `/health`.
- **"AI model quota is unavailable"** → Gemini key quota; the app uses `gemini-flash-lite-latest`.
- **PDF step fails on Render** → check the Render logs; the Dockerfile installs all Chromium libs, so this should not happen. Puppeteer launches with `--no-sandbox` already.
- **Signup email link points to localhost** → set Supabase Site URL / Redirect URLs (Step 4.2).
