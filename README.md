# Priceport

Your world. Better priced.

AI-powered global hotel price intelligence. TinyFish agents investigate booking providers across markets; Priceport normalizes findings into comparable, evidence-backed recommendations.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- Root `app/`, `components/`, `lib/` (no `src/`)
- `@tiny-fish/sdk` for Search + Agent investigations

## Setup

```bash
npm install
cp .env.example .env.local
# Add TINYFISH_API_KEY=sk-tinyfish-...
npm run dev
```

Dev server defaults to [http://localhost:3005](http://localhost:3005).

## Product flow

1. `/search` — destination + hotel autocomplete, smart stay/markets defaults, investigation preview
2. `/investigate/[id]` — live Investigation Room (real TinyFish events)
3. `/results/[id]` — decision summary, true-cost, verification, evidence, alternatives
4. `/tracks` — manual price monitoring (no background scheduler claimed)

Landing page previews are illustrative only. Search, investigation, and results never use fabricated prices.

## Notes

- API keys stay server-side (never `NEXT_PUBLIC_`)
- TinyFish proxy countries (documented): US, GB, CA, DE, FR, JP, AU
- India / UAE use storefront access only when selected — not claimed as local IP
- Local persistence: `.data/investigations/`, `.data/observations/`, `.data/tracks/` (gitignored)
- Supabase schema prepared in `supabase/schema.sql` (not wired)
- Monitoring is manual re-check only until a scheduler is configured
