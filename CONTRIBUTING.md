# Contributing to Priceport

Thanks for taking an interest in Priceport. This guide covers the current development workflow.

## Before you start

- Node.js compatible with the installed Next.js 16 release
- npm
- A TinyFish API key for live investigation work

## Local setup

1. Fork the repository and clone your fork.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Add your TinyFish credential to `.env.local`:

   ```dotenv
   TINYFISH_API_KEY=your_key_here
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3005](http://localhost:3005).

Never commit `.env.local`, API keys, browser session data, or files from the local `.data/` store.

## Checks before opening a pull request

Run the checks relevant to your change:

```bash
npm run lint
npm run test:unit
npm run build
```

The live hotel test suite makes real provider requests and may consume API quota. Run it only when you have configured a valid TinyFish key and intentionally want to test live integrations:

```bash
npm run test:live
```

## Project conventions

- Keep the existing App Router structure; application code lives in the root `app/`, `components/`, and `lib/` directories.
- Keep provider credentials and external API calls on the server. Do not expose secrets through `NEXT_PUBLIC_*` variables.
- Treat observed hotel offers as evidence-backed data. Do not add placeholder prices to search, investigation, or results flows.
- Preserve the distinction between live investigation results and illustrative landing-page content.
- Price tracking currently supports manual re-checks; do not describe it as scheduled background monitoring.
- Local investigation, observation, and tracking files live under `.data/` and should remain untracked.

## Pull requests

- Keep each pull request focused on one change.
- Explain the user-facing problem and the approach taken.
- Include the commands you ran and their results.
- For UI changes, include screenshots at desktop and mobile widths.
- Call out any change to provider behavior, data handling, environment variables, or external API usage.
