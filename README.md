# MightyMAK — AI Video Generator (front-end)

"Seedance, but simple." A friendly web app to generate AI videos, save every clip, and
organize your own assets into categories.

> **This is the front-end-only phase.** Everything runs on **mock data** with a **simulated**
> generation engine — no real auth, payments, or model calls yet. The real backend
> (Supabase + Stripe + BytePlus / Seedance 2.0) plugs into the clearly-marked seams later.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## What's here

| Screen | Route | What it does |
|---|---|---|
| **Studio** | `/` | A "future film studio": **pick** a Set, Cast, Style, Camera move and Score from curated rails, add an optional director's note, and watch them **compose into a shot** (live prompt + preview). Quality/duration/aspect/audio controls, live credit-cost, and a simulated render that returns a real clip. |
| **My Videos** | `/videos` | Every generated video, with play, **remix** (restores the full recipe), save-to-assets, download, delete. |
| **Assets** | `/assets` | Pre-stocked with **30 curated starter assets** across Sets / Cast / Styles / Camera / Soundtrack. Upload your own images / video / audio and organize everything into your own **categories**. |

Credits, videos, assets, and categories are persisted in your browser (localStorage).

## Architecture & the backend seam

All data and actions flow through the Zustand store in `src/lib/store.ts`. The simulated
generator lives there too (`generate()` → progress ticks → a sample from `src/lib/samples.ts`).
To go live later, replace those mock actions with real service calls — the UI doesn't change.

```
src/
  app/                 routes: / (generate), /videos, /assets
  components/
    app-shell.tsx      sidebar + topbar + credits + buy-credits
    ui.tsx             shared primitives (Button, Modal, Segmented, …)
    generate/          the generation studio
    videos/            the My Videos library + player modal
    assets/            upload + categories
  lib/
    store.ts           Zustand store + simulated generation + seeded library (the seam)
    catalog.ts         the curated studio elements + prompt composition
    types.ts           domain types + credit-cost formula
    samples.ts         stand-in output clips (swap for BytePlus output URL)
public/studio/         art tiles for the curated catalog elements
public/samples/        local demo clips for generated results
```

## Next phase (not built yet)

Supabase (auth, database, storage) · Stripe (subscriptions + top-up credit packs) ·
BytePlus ModelArk Seedance 2.0 (real async generation). See the project plan PDF.
