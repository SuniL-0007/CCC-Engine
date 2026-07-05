/** Renders the CCC report PDF headlessly (no browser) for formatting checks.
 *  Run: npx tsx scripts/render-report-preview.ts [output.pdf]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildCCCReport } from '../lib/report/pdfGenerator';
import { parseExcelFile } from '../lib/parser/sheetjs';
import { calculateCCC, calculateDIO, calculateDPO, calculateDSO } from '../lib/ccc-engine/calculator';
import type { Recommendation } from '../lib/ccc-engine/types';
import type { ParseResult } from '../lib/parser/types';

function fileOf(rel: string): File {
  const buffer = readFileSync(path.resolve(process.cwd(), rel));
  return new File([new Uint8Array(buffer)], path.basename(rel));
}

// Gemini-style recommendations with LONG texts + hostile Unicode (− ✓ ₹ — … ×)
const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'R1', dimension: 'DSO', priority: 'HIGH',
    title: 'Actively collect the ₹2 crore stuck in overdue customer payments',
    explanation: 'Your DSO is 75 days — 30 days above the 45-day benchmark for a mixed buyer base. That means roughly ₹200 lakhs is sitting in unpaid customer accounts right now, most of it with retail chains that respond well to structured follow-up.',
    actionSteps: [
      'Run an AR aging report today, identify every invoice over 60 days old, and assign a named owner to each of the top 10 accounts with a follow-up call scheduled before Friday',
      'Offer your three largest overdue buyers a one-time 1.5% early-settlement discount valid for 7 days — cash now beats margin later at your current borrowing cost',
      'Add a 25% advance-payment clause to every new proforma invoice above ₹5 lakhs starting this week',
    ],
    estimatedDaysReduction: 18, estimatedCashFreedLakhs: 48.0,
  },
  {
    id: 'R3', dimension: 'DIO', priority: 'HIGH',
    title: 'Clear slow-moving polyester and technical textile stock',
    explanation: 'Inventory is turning in 61.6 days versus the 38-day benchmark — about ₹165 lakhs of fabric is sitting longer than it should. June is a moderate demand period, so clearance now will not cannibalise festive-season sales.',
    actionSteps: [
      'Pull inventory turnover by SKU and list every lot with zero sales in the last 90 days for immediate clearance pricing at 15–25% off',
      'Reallocate the freed warehouse space to cotton knits, which are turning 2× faster than blends in your sales register ✓',
      'Defer the next two polyester purchase orders and renegotiate delivery schedules with suppliers this week',
    ],
    estimatedDaysReduction: 12, estimatedCashFreedLakhs: 32.0,
  },
  {
    id: 'R5', dimension: 'DPO', priority: 'HIGH',
    title: 'Stop paying suppliers 14 days early',
    explanation: 'Your DPO is 28 days against a 42-day benchmark — you are effectively financing your suppliers. Moving to Net 45 with your top three suppliers alone frees roughly ₹37 lakhs of working capital permanently.',
    actionSteps: [
      'List your top 5 suppliers by annual spend and request a terms review meeting this week, leading with your consistent on-time payment history',
      'Propose Net 45 in exchange for a committed quarterly volume or automated NEFT payment on the due date',
      'Instruct accounts payable to schedule all non-critical payments on the due date rather than on receipt of invoice, effective immediately',
    ],
    estimatedDaysReduction: 14, estimatedCashFreedLakhs: 37.3,
  },
  {
    id: 'R2', dimension: 'DSO', priority: 'MEDIUM',
    title: 'Automate payment reminders before due dates',
    explanation: 'Buyers are drifting past due dates unprompted. Automated reminders 5 days before due recover 3–5 days of DSO on average without straining relationships.',
    actionSteps: [
      'Configure your accounting software to email a payment reminder 5 days before each invoice falls due',
      'State the due date and NEFT details prominently on every invoice PDF',
      'Assign one person to call any account that is 3+ days past due, every Monday morning',
    ],
    estimatedDaysReduction: 8, estimatedCashFreedLakhs: 21.3,
  },
  {
    id: 'R4', dimension: 'DIO', priority: 'MEDIUM',
    title: 'Tighten reorder points on fast-moving fabrics',
    explanation: 'Safety stock levels look set for peak season even though demand is moderate. Right-sizing reorder points for the top 10 SKUs reduces average inventory 10–20% without stockout risk.',
    actionSteps: [
      'Recalculate reorder points as (lead time × daily sales) + 15 days safety stock for the top 10 SKUs',
      'Move from 12-week to 6-week purchase cycles for cotton yarn given current supplier lead times',
      'Have the sales team quote slow-moving lots first to rotate stock faster',
    ],
    estimatedDaysReduction: 6, estimatedCashFreedLakhs: 16.0,
  },
];

async function main(): Promise<void> {
  const [sales, purchases, inventory] = await Promise.all([
    parseExcelFile(fileOf('test-data/stressed-mill/Sales_Register.xlsx'), 'SALES_REGISTER'),
    parseExcelFile(fileOf('test-data/stressed-mill/Purchase_Register.xlsx'), 'PURCHASE_REGISTER'),
    parseExcelFile(fileOf('test-data/stressed-mill/Stock_Summary.xlsx'), 'STOCK_SUMMARY'),
  ]);

  const periodDays = 90;
  const salesRows = sales.data as ParseResult['sales'];
  const purchaseRows = purchases.data as ParseResult['purchases'];
  const revenue = salesRows.reduce((sum, row) => sum + row.amount, 0);
  const cogs = purchaseRows.reduce((sum, row) => sum + row.amount, 0);
  const dio = calculateDIO(inventory.data as ParseResult['inventory'], salesRows, periodDays);
  const dso = calculateDSO(salesRows, revenue, periodDays);
  const dpo = calculateDPO(purchaseRows, cogs, periodDays);
  const result = calculateCCC(dio, dso, dpo, periodDays, revenue);

  const doc = buildCCCReport(result, RECOMMENDATIONS);
  const out = path.resolve(process.argv[2] ?? 'report-preview.pdf');
  writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
  console.log(`written ${out} · pages=${doc.getNumberOfPages()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
