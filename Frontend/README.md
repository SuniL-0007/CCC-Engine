# FabricCash Frontend

Textile CCC (Cash Conversion Cycle) Optimization Platform - Frontend

## Overview

FabricCash is an AI-powered working capital optimization tool for textile mills. It analyzes financial data (from Tally, Zoho Books, or Excel) to calculate your Cash Conversion Cycle and provides actionable recommendations to free up cash.

## Key Features

- ✅ Upload-first flow (zero friction)
- ✅ Client-side file parsing (100% privacy - no data uploaded)
- ✅ Instant CCC calculation
- ✅ AI-powered recommendations (Layer 1 rules + Layer 2 Gemini API)
- ✅ PDF report generation
- ✅ Free for all users (no paywall)


## Project Structure

```
/app                          # Next.js App Router
  /api
    /recommendations          # Layer 2 Gemini AI enrichment
  /dashboard                  # User dashboard
  page.tsx                    # Landing page
  layout.tsx                  # Root layout
  globals.css                 # Global styles

/components
  /landing                    # Landing page components
    - Navbar
    - UploadWidget
    - ResultPanel
    - TallyGuide
    - HowItWorks
    - Footer
  /ui                         # shadcn/ui components
  /dashboard                  # Dashboard components

/lib
  /parser                     # Excel/CSV file parsing
    - sheetjs.ts             # SheetJS parser
    - columnAliases.ts       # Fuzzy column matching
  /ccc-engine                 # CCC calculation engine
    - calculator.ts          # DIO, DSO, DPO, CCC calculations
    - types.ts               # TypeScript types
    - benchmarks.json        # Industry benchmarks
  /recommendations           # Recommendation engine
    - layer1Rules.ts         # Rule-based recommendations
    - geminiClient.ts        # Gemini API client
  /report                     # PDF generation
    - pdfGenerator.ts        # jsPDF report builder

/public                       # Static assets
  /templates                 # Excel templates

docker-compose.yml            # Local PostgreSQL setup
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Gemini API
- **File Parsing**: SheetJS (XLSX)
- **PDF**: jsPDF + jspdf-autotable
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+
- Gemini API key

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env .env.local
   # Edit .env.local with your API keys
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

## Architecture

### Layer 1: Rule Engine (Client-Side)
- Pure TypeScript rules
- Runs in browser (100ms)
- 8 conditions checking DIO, DSO, DPO metrics
- Outputs up to 8 candidate recommendations

### Layer 2: AI Enrichment (Server-Side)
- Gemini API with structured JSON output
- Re-ranks candidates by business impact
- Enriches with action steps and estimated cash freed
- Returns top 5 recommendations (~2s latency)

## Development

### Adding a New Recommendation Rule

Edit `/lib/recommendations/layer1Rules.ts`:

```typescript
{
  id: 'R9',
  dimension: 'DSO',
  priority: 8,
  condition: (result) => result.dso.value > 60,
  titleTemplate: (result) => 'Your DSO is critically high',
  estimatedDaysTemplate: (result) => result.dso.value - result.dso.benchmark,
}
```

### Running Tests

```bash
npm test
```

## Environment Variables

See `.env` for all required variables:

- `GEMINI_API_KEY`: Gemini API key
- `GEMINI_MODEL`: Gemini model name, defaults to `gemini-2.5-flash`

### Purchase Register
- Columns: Date, Party Name, Invoice No, Gross Total, Due Date, Payment Date (optional)
- Used for: DPO calculation, AP analysis, COGS

### Stock Summary
- Columns: Stock Item, Closing Balance (Qty), Rate, Closing Value
- Used for: DIO calculation, inventory analysis

## Deployment

See `VERCEL_DEPLOYMENT.md` for the Vercel environment variable and database migration checklist.

### Build
```bash
npm run build
```

### Production
```bash
npm run start
```

Recommended: Deploy to Vercel, Netlify, or Docker

## Contributing

Please follow the coding standards:
- TypeScript strict mode
- ESLint rules
- Component naming: PascalCase
- Function naming: camelCase
- Files: kebab-case.tsx

## License

MIT

## Support

- Issues: GitHub Issues
- Email: hello@fabriccash.in
- Documentation: [Internal Wiki]

---

**FabricCash**: Free AI-powered cash conversion cycle optimization for Indian textile mills.
