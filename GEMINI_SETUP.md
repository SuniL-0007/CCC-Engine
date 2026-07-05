# Gemini API Setup Guide

FabricCash uses the Google Gemini API for Layer 2 recommendation enrichment.
If the key or model is misconfigured, the app still works — it silently falls
back to the Layer 1 rule-based recommendations (the result panel shows an
"Instant rule-based" badge instead of "AI-personalised").

## Getting Your Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click **"Create API Key"** (new or existing project)
4. Copy your API key

## Environment Variables

In `.env.local` (local dev) **and** in Vercel → Project → Settings →
Environment Variables (production):

```
GEMINI_API_KEY=your_copied_key_here
GEMINI_MODEL=gemini-2.5-flash
```

> After changing environment variables on Vercel you must trigger a
> **redeploy** — they are not applied to the currently live deployment.

## Choosing a Model

`GEMINI_MODEL` must be a model id that exists on the `v1beta`
`generateContent` API. Known-good options (see `models.json` at the repo root
for the full ListModels dump):

- `gemini-2.5-flash` — fast, generous free tier (default)
- `gemini-2.5-pro` — higher quality, slower, tighter free-tier limits
- `gemini-flash-latest` — tracks the latest flash release

An invalid model name (e.g. `gemini-3.0-flash`) causes a 404 from the API and
every request falls back to rule-based recommendations.

## Verify It Works

```bash
npx tsx scripts/test-gemini.ts
```

You should see:

```
Calling Gemini...
SUCCESS. Result from Gemini:
[array of recommendations...]
```

## Troubleshooting

- **`models/<name> is not found`** — the `GEMINI_MODEL` value is not a real
  model; pick one from the list above.
- **403 / API key not valid** — regenerate the key at
  https://aistudio.google.com/app/apikey and update both `.env.local` and
  Vercel.
- **429 Resource exhausted** — free-tier rate limit hit; wait or switch to
  `gemini-2.5-flash-lite`.
- **Fallback in production but not locally** — the env vars are missing on
  Vercel, or the deployment predates the env var change (redeploy).
