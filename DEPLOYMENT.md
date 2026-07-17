# Deploying Aura

Read this first — the architecture decides what's possible.

Aura is two programs:

- **Frontend** (`frontend/`, Next.js) — static/serverless. Deploys to Vercel
  for free.
- **Backend** (`backend/`, FastAPI + Whisper large-v3 + pyannote + Ollama) —
  needs ~8 GB RAM, heavy CPU, and long-running processes. **It cannot run on
  Vercel** (serverless functions are short-lived and memory-capped, and there's
  no place to run Ollama). It runs on a real machine.

So "deploy to Vercel" only ever means the frontend. The frontend must be able
to reach the backend over HTTPS. The backend is where the money question lives.

---

## 1. Frontend → Vercel (free)

1. Push to GitHub (already done: `PavanAksshay/aura`).
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. **Root Directory: `frontend`** (important — the repo is a monorepo).
   Framework preset: Next.js. Build/output settings: defaults.
4. Add **Environment Variables** (Production + Preview):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `NEXT_PUBLIC_API_URL` | the **public** URL of your backend (see §2) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | your VAPID public key |

   These are read at **build time** (the Content-Security-Policy is compiled
   from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_API_URL`). If you change
   them, **redeploy**.
5. Deploy. You get `https://aura-xxxx.vercel.app`.
6. In **Supabase → Authentication → URL Configuration**, add that URL to the
   allowed redirect URLs so Google/OAuth works.

Values in `frontend/.env.local` are for local dev only; Vercel uses the ones
you set in its dashboard.

---

## 2. Backend → somewhere reachable

The frontend can't talk to `localhost:8000` on your Mac from the internet, so
the backend needs a public HTTPS address. Two paths:

### Free + permanent: an ngrok static domain (recommended)

ngrok's free plan includes **one permanent static domain**, so the backend URL
never changes — set it in Vercel once and forget it.

```bash
brew install ngrok
ngrok config add-authtoken <your-token>          # one-time, from ngrok dashboard
# each time you run the backend (keep it running alongside uvicorn):
ngrok http 8000 --url=https://<your-name>.ngrok-free.dev
```

The frontend sends an `ngrok-skip-browser-warning` header so ngrok's free-tier
interstitial never replaces an API response (the backend allows that header in
CORS). Set the static URL as `NEXT_PUBLIC_API_URL` in Vercel and **redeploy**
(it's baked into the build + CSP).

Trade-offs, stated plainly:
- Your Mac must be **on and running** the backend + Ollama + the tunnel.
- The URL is stable across restarts, so no Vercel changes are needed again.

_(The quick-and-dirty alternative is `cloudflared tunnel --url http://localhost:8000`,
but its `trycloudflare.com` URL changes every restart — a permanent Cloudflare
tunnel needs a domain you own.)_

### Paid: a real host

Whisper large-v3 + pyannote want RAM and ideally a GPU. A small always-on VM
(Fly.io, Render, Railway, a cheap VPS) runs the backend without your Mac, but
that's **~$20–80+/month** and Ollama/models still need to fit. Not needed while
it's just you — the tunnel is enough.

### Backend settings for production

In the backend `.env`:

- `ENVIRONMENT=production` — hides the API docs.
- `ALLOWED_ORIGINS=https://aura-xxxx.vercel.app` (comma-separate multiple).

---

## 3. Getting it onto phones / app stores

You already have the **free** option: Aura is an installable PWA. On the
Profile tab, "Install app" adds it to the home screen (iOS: Share → Add to Home
Screen). That gives a real app icon with **no store and no fee** — but it needs
the app served over HTTPS (i.e. the Vercel deploy above), because iOS won't
offer "Add to Home Screen" over plain `http://` LAN.

Actual app stores are a different commitment:

| Store | How | Cost | Notes |
|---|---|---|---|
| **Google Play** | Wrap the PWA as a **TWA** with [PWABuilder](https://pwabuilder.com) or Bubblewrap, upload the `.aab` | **$25 one-time** dev account | Easiest real store. Needs the app on public HTTPS + a Digital Asset Links file. |
| **Apple App Store** | Wrap in a WebView/Capacitor shell, submit via Xcode | **$99/year** dev account | Most work; Apple rejects thin "just a website" wrappers, so it needs to feel app-like. |
| **Microsoft Store** | PWABuilder generates a package | Small one-time fee | Desktop only. |

All of them require the app to be **publicly hosted on HTTPS first** (§1 + §2)
— there is no way to ship a store app that points at `localhost`. And each
needs a paid developer account. Given "no spend right now", the honest
recommendation is: **deploy to Vercel, then install the PWA** — same home-screen
icon, zero cost. Move to Play Store (the cheapest at $25) only when you want a
store listing.
