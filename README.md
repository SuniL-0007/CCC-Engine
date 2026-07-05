# FabricCash — Textile Working Capital, Simplified

> **Live App**: [https://ccc-engine.vercel.app](https://ccc-engine.vercel.app)

FabricCash is a free, AI-powered Cash Conversion Cycle (CCC) optimizer built for Indian textile mills. Upload your Tally, Zoho Books, or Excel exports — get your CCC calculated instantly, with actionable recommendations to free up working capital.

No login. No data upload. 100% private.

---

## What It Does

1. **Upload** your Sales Register, Purchase Register, and Stock Summary
2. **Instant CCC calculation** — DIO, DSO, DPO benchmarked against textile industry standards
3. **AI recommendations** — rule-based Layer 1 engine + Gemini API Layer 2 enrichment
4. **Download** a PDF report with your results and action steps

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | Google Gemini API |
| File Parsing | SheetJS (XLSX) |
| PDF Generation | jsPDF + jspdf-autotable |
| Validation | Zod |
| Deployment | Vercel |

---

## Project Structure

```
/app
  /api/recommendations      # Gemini AI enrichment endpoint
  /dashboard                # Local (browser-only) CCC history & trends
  /privacy, /terms          # Policy pages
  page.tsx                  # Landing page
  layout.tsx                # Root layout

/components
  /landing                  # Navbar, UploadWidget, ResultPanel, etc.

/lib
  /parser                   # SheetJS file parsing + fuzzy column matching
  /ccc-engine               # DIO, DSO, DPO, CCC calculator + benchmarks + cash estimates
  /recommendations          # Layer 1 rules + Gemini client
  /history                  # localStorage snapshots powering trends/dashboard
  /report                   # jsPDF report builder

/public/templates           # Downloadable Excel templates
```

---

## How the Recommendation Engine Works

**Layer 1 — Rule Engine (Client-Side, ~100ms)**
Pure TypeScript rules that run entirely in the browser. Checks 8 conditions across DIO, DSO, and DPO metrics and outputs up to 8 candidate recommendations.

**Layer 2 — AI Enrichment (Server-Side, ~2s)**
Sends candidates to the Gemini API, which re-ranks them by business impact, enriches with specific action steps, and estimates cash freed. Returns the top 5 recommendations.

---

## Getting Started

### Prerequisites
- Node.js 18+
- Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env .env.local
# Add your GEMINI_API_KEY to .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `GEMINI_MODEL` | Model name (default: `gemini-2.5-flash`) |

---

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

---

## Input File Format

| File | Required Columns |
|---|---|
| Sales Register | Date, Party Name, Invoice No, Gross Total, Due Date |
| Purchase Register | Date, Party Name, Invoice No, Gross Total, Due Date |
| Stock Summary | Stock Item, Closing Balance (Qty), Rate, Closing Value |

Fuzzy column matching is built in — exact column names are not required.

---

## Deployment

Deployed on Vercel. Any push to `main` triggers an automatic redeployment.

To deploy your own instance:
1. Fork this repo
2. Import into [Vercel](https://vercel.com)
3. Add `GEMINI_API_KEY` under Environment Variables
4. Deploy

---

## Issues & Feedback

[GitHub Issues](https://github.com/SuniL-0007/CCC-Engine/issues)
