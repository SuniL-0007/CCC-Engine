# FabricCash Frontend

Textile CCC (Cash Conversion Cycle) Optimization Platform - Frontend

## Overview

FabricCash is an AI-powered working capital optimization tool for textile mills. It analyzes financial data (from Tally, Zoho Books, or Excel) to calculate your Cash Conversion Cycle and provides actionable recommendations to free up cash.

## Key Features

- ✅ Upload-first flow (zero friction)
- ✅ Client-side file parsing (100% privacy - no data uploaded)
- ✅ Instant CCC calculation
- ✅ AI-powered recommendations (Layer 1 rules + Layer 2 Claude API)
- ✅ PDF report generation
- ✅ Free for all users (no paywall)

## Project Structure

```
/app                          # Next.js App Router
  /api
    /recommendations          # Layer 2 Claude AI enrichment
    /snapshots/save          # Save CCC snapshots to database
  /login                      # Login page
  /dashboard                  # User dashboard (future)
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
  /ui                         # shadcn/ui components (future)
  /dashboard                  # Dashboard components (future)

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
    - claudeClient.ts        # Claude API client (future)
  /report                     # PDF generation
    - pdfGenerator.ts        # jsPDF report builder
  /auth                       # Authentication
    - supabase.ts            # Supabase client

/prisma                       # Database schema
  schema.prisma              # Prisma schema

/public                       # Static assets
  /templates                 # Excel templates

docker-compose.yml            # Local PostgreSQL setup
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + Prisma
- **Auth**: Supabase
- **AI**: Claude API (Anthropic)
- **File Parsing**: SheetJS (XLSX)
- **PDF**: jsPDF + jspdf-autotable
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Anthropic API key (for Claude)
- Supabase account (for auth)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start PostgreSQL**
   ```bash
   npm run db:up
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Run database migrations**
   ```bash
   npm run prisma:migrate
   ```

5. **Start development server**
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

npm run db:up            # Start PostgreSQL
npm run db:down          # Stop PostgreSQL
npm run db:studio        # Open Prisma Studio
npm run prisma:migrate   # Run database migrations
```

## Architecture

### Layer 1: Rule Engine (Client-Side)
- Pure TypeScript rules
- Runs in browser (100ms)
- 8 conditions checking DIO, DSO, DPO metrics
- Outputs up to 8 candidate recommendations

### Layer 2: AI Enrichment (Server-Side)
- Claude Sonnet 4 API
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

See `.env.example` for all required variables:

- `DATABASE_URL`: PostgreSQL connection string
- `ANTHROPIC_API_KEY`: Claude API key
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

## File Format Specifications

### Sales Register
- Columns: Date, Party Name, Invoice No, Gross Total, Due Date, Payment Date (optional)
- Used for: DSO calculation, AR analysis

### Purchase Register
- Columns: Date, Party Name, Invoice No, Gross Total, Due Date, Payment Date (optional)
- Used for: DPO calculation, AP analysis, COGS

### Stock Summary
- Columns: Stock Item, Closing Balance (Qty), Rate, Closing Value
- Used for: DIO calculation, inventory analysis

## Deployment

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
