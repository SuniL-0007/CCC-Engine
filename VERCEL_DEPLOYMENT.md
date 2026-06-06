# FabricCash Vercel Deployment Checklist

## Required Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables for Production and Preview:

- `GEMINI_API_KEY`: your Google AI Studio / Gemini API key.
- `GEMINI_MODEL`: optional. Defaults to `gemini-2.5-flash`.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL used by browser auth.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key used by browser auth.
- `DATABASE_URL`: PostgreSQL connection string used by Prisma on the server.

Do not prefix `GEMINI_API_KEY` or `DATABASE_URL` with `NEXT_PUBLIC_`; they must stay server-side.

## Database Setup

Before the first production deployment, apply the Prisma migration to the production database:

```bash
npx prisma migrate deploy
```

The repo includes `prisma/migrations/0001_init/migration.sql` for:

- `Company`
- `CCCSnapshot`

## Vercel Build

Vercel can use the default Next.js build command:

```bash
npm run build
```

`postinstall` runs `prisma generate`, so the Prisma Client is available during the Vercel build.

## Gemini Recommendation Flow

The browser calculates deterministic Layer 1 recommendations immediately. Then `POST /api/recommendations` calls Gemini and returns up to 5 enriched recommendations.

If `GEMINI_API_KEY` is missing or invalid, the API returns deterministic fallback recommendations instead of failing the upload flow.
