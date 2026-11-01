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

1. `/search` — discover a hotel, set dates/guests, choose markets & providers
2. `/investigate/[id]` — live Investigation Room (real TinyFish events)
3. `/results/[id]` — Market Lens comparison with source URLs

Landing page previews are illustrative only. Search, investigation, and results never use fabricated prices.

## Notes

- API keys stay server-side (never `NEXT_PUBLIC_`)
- TinyFish proxy countries (documented): US, GB, CA, DE, FR, JP, AU
- India / UAE use storefront access only when selected — not claimed as local IP
- Local job persistence: `.data/investigations/` (gitignored). Supabase schema prepared in `supabase/schema.sql`
