# CarWash Pro

Production car-wash management system. Arabic RTL UI, per-stage timing, employee
tracking, expenses, analytics, photo capture, and an offline-first data layer with
Supabase cloud sync.

## Stack

- React 18 + Vite
- Tailwind CSS
- Supabase (Postgres + Auth + Storage) — cloud database & photo backup
- IndexedDB (via `idb`) — local source of truth, works fully offline
- `vite-plugin-pwa` — installable PWA with offline app-shell caching
- Recharts, xlsx, jsPDF — analytics charts and CSV/Excel/PDF export

## 1. Install

```bash
npm install
```

## 2. Connect Supabase (optional but recommended)

Follow **SUPABASE_SETUP.md** to create your project and run the schema. Then:

```bash
cp .env.example .env
# paste your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY into .env
```

Without a `.env`, the app still runs completely — it just stays local-only
(IndexedDB) until you connect Supabase.

## 3. Run locally

```bash
npm run dev
```

Open the printed `localhost` URL. To test PWA/offline behavior locally, use
`npm run build && npm run preview` (service workers only fully activate on a
built app, not on the dev server).

## 4. Deploy (required for real installable PWA)

A service worker and "Add to Home Screen" only work on a real HTTPS domain —
not in any sandboxed preview. Easiest path:

```bash
npm run build
```

Then deploy the `dist/` folder to any static host:

- **Vercel**: `npx vercel --prod` (or connect the repo in the Vercel dashboard)
- **Netlify**: drag-and-drop `dist/` into the Netlify dashboard, or `netlify deploy --prod`
- Any static host works (Cloudflare Pages, GitHub Pages, your own server) — it's a
  plain static site after build.

Set the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as environment
variables in your hosting provider's dashboard so the production build has them
at build time.

## 5. Install as an app

Once deployed and opened over HTTPS:

- **Android (Chrome)**: menu → *Install app*, or tap the in-app "تثبيت" banner.
- **iPhone/iPad (Safari)**: Share button → *Add to Home Screen*.
- **Windows/Mac (Chrome/Edge)**: address-bar install icon, or menu → *Install CarWash Pro*.

After installing, the app opens full-screen with no browser chrome, has its own
home-screen icon, and keeps working offline — data typed while offline is saved
to the device immediately and syncs to Supabase automatically the next time
there's a connection.

## Data safety model

- Every write lands in **IndexedDB first** — instant, no network required.
- If Supabase is configured and reachable, the same write is pushed to the cloud
  in the background. If not, it's queued and retried automatically on reconnect.
- **Nothing is ever hard-deleted.** Deletes set a `deleted` flag; the row stays in
  IndexedDB and Supabase forever and can be recovered from the database directly.
- Photos are kept as local files (always viewable offline) *and* uploaded to
  Supabase Storage as a redundant cloud backup.
- Full backup export/import and a one-click "Export Complete Business Data"
  (JSON + CSV + Excel + PDF, zipped) live under **Settings**.

## Project structure

```
src/
  App.jsx                 — the app (UI unchanged from the original build; only the
                             persistence layer was replaced)
  components/LoginScreen.jsx
  lib/
    db.js                 — IndexedDB schema & access
    dataStore.js           — offline-first sync engine (IndexedDB <-> Supabase)
    supabaseClient.js
    auth.js
SUPABASE_SETUP.md          — SQL schema + step-by-step project setup
```
