# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FabricCash: a free, client-side-first Cash Conversion Cycle (CCC) optimizer for Indian textile mills. Users upload Tally/Zoho/Excel exports (Sales Register, Purchase Register, Stock Summary), get DIO/DSO/DPO/CCC calculated instantly against textile-industry benchmarks, and receive AI-enriched recommendations. No login, no server-side data storage — everything except the Gemini enrichment call runs in the browser.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint (next lint)

npx tsx scripts/e2e-test.ts            # Full pipeline test: parse → CCC → Layer 1 → cash → trends → POST /api/recommendations
npx tsx scripts/e2e-test.ts --no-api   # Same, but skips the live API call (no dev server needed)
npx tsx scripts/test-gemini.ts         # Verify GEMINI_API_KEY / GEMINI_MODEL work against the live API
npx tsx test-data/generate.ts          # Regenerate synthetic test workbooks in test-data/
npx tsx test-data/generate-trends.ts   # Regenerate trend-mill test data
```

There is no unit test framework (no jest/vitest) — `scripts/e2e-test.ts` is the primary correctness check and asserts real computed values (see below). Run it after touching `lib/parser`, `lib/ccc-engine`, or `lib/recommendations`.

### Manual verification via synthetic data

`test-data/` contains scenario folders (`healthy-mill/`, `stressed-mill/`, `messy-tally-export/`, `broken/`) with known expected outputs — see `test-data/README.md` for exact numbers per scenario (e.g. stressed-mill should compute CCC 108.6, 5 recommendation cards). Upload the three files from a scenario into the widget at localhost:3000, or drop `all-in-one.xlsx` onto any single upload slot to fill all three at once. Use this to sanity-check parser/calculator changes against known-good results, not just unit assertions.

## Environment

`.env.local` (gitignored):
```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash   # optional, this is the default
```
If the key/model is missing or invalid, the app silently falls back to Layer 1 rule-based recommendations — this is expected behavior, not a bug. See `GEMINI_SETUP.md` for troubleshooting model names and API errors.

## Architecture

### Data flow (all client-side except the last hop)

```
File upload (UploadWidget)
  → lib/parser/sheetjs.ts        parse + detect file type + fuzzy column match
  → lib/ccc-engine/calculator.ts  compute DIO / DSO / DPO / CCC vs benchmarks
  → lib/history/snapshots.ts      persist to localStorage, compute trendDelta vs last run
  → lib/recommendations/layer1Rules.ts   client-side rule engine (instant, ~100ms)
  → POST /api/recommendations     server-side Gemini enrichment (~2s), Zod-validated in/out
  → ResultPanel                   render cards; PDF export via lib/report/pdfGenerator.ts
```

### `lib/parser/sheetjs.ts` — the parsing engine
Takes raw `.xlsx`/`.csv` files with **no assumed schema**. It scans the first `HEADER_SCAN_ROW_LIMIT` rows of each sheet to find the most plausible header row (scores candidates by how many expected columns fuzzy-match, via `columnAliases.ts`), then classifies the sheet as `SALES_REGISTER` / `PURCHASE_REGISTER` / `STOCK_SUMMARY` / `UNKNOWN` using column-presence scores plus filename/sheetname keyword hints (`scoreTypeHints`). This is what lets it survive real Tally exports with title rows, blank rows, `₹`/`Rs.`/`(negative)` amount formats, and `DD-MMM-YYYY` vs `DD/MM/YYYY` dates — see `parseAmount`/`parseDate`/`parseDelimitedDate`. `parseExcelFile` returns a single detected type (for the 3-slot upload widget); `parseExcelWorkbook` returns all three types at once (for the single-workbook `all-in-one.xlsx` path). Warnings are accumulated per-sheet and surfaced to the user rather than throwing, except for hard failures (bad file extension, >10MB, unreadable workbook).

### `lib/ccc-engine/calculator.ts` — the math
DIO/DSO/DPO/CCC formulas against `benchmarks.json` (textile-specific). Falls back to `TEXTILE_COGS_RATIO = 0.65` of revenue when no direct COGS column exists, and tracks `dataCompleteness` per component so downstream code knows when a number is an estimate. Has an inline dev-only smoke test exposed as `window.__cccTest()` when `NODE_ENV === 'development'`.

### Two-layer recommendation engine
- **Layer 1** (`lib/recommendations/layer1Rules.ts`): pure, deterministic TypeScript rules (`R1`-`R8`) that fire on CCC gap conditions, sorted by priority, capped at 5. Runs entirely client-side. This is also the fallback output if Gemini fails or returns low-quality results.
- **Layer 2** (`lib/recommendations/geminiClient.ts` + `app/api/recommendations/route.ts`): sends Layer 1 candidates + company context + trend data to Gemini with a detailed system prompt (`SYSTEM_PROMPT`) encoding textile-specific domain knowledge (seasonal DIO swings around Diwali, buyer-type-specific DSO norms, DPO negotiation ceilings). Response is JSON-schema-constrained (`RESPONSE_SCHEMA`) and Zod-validated on the server. The route additionally runs a heuristic quality gate (`isRecommendationQuality`) and silently substitutes the Layer 1 fallback (`source: 'fallback'` in the response) if Gemini's output looks vague — never surface a Gemini failure or low-quality output directly to the user.

### `lib/history/snapshots.ts` — trends
All history is `localStorage`-only (`fabriccash:snapshots`, capped at 24 entries) — there is no backend database. `applyTrends` diffs the current result against the most recent prior snapshot to populate `trendDelta` on each component. The `/dashboard` route reads this same storage.

### `lib/report/pdfGenerator.ts`
Builds the downloadable PDF report client-side via jsPDF + jspdf-autotable.

### Path aliases
`@/*` maps to the repo root (see `tsconfig.json`). Import as `@/lib/...`, `@/components/...`.

### `vercel-plugin/`
A local Claude Code plugin (zero-dependency Node script) for Vercel operations (`/vercel:status`, `/vercel:deploy`, `/vercel:logs`, `/vercel:env`) — see `vercel-plugin/README.md`. Not part of the app runtime.
