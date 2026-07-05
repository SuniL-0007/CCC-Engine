/**
 * End-to-end test of the FabricCash pipeline without a browser:
 *   parse (real template files + synthetic Tally-style data)
 *   → CCC calculation → Layer 1 rules → cash estimates → trends
 *   → POST /api/recommendations (requires `npm run dev` on :3000; skipped with --no-api)
 *
 * Run: npx tsx scripts/e2e-test.ts
 */
import { readFileSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { config } from 'dotenv';
import { parseExcelFile } from '../lib/parser/sheetjs';
import {
  calculateCCC,
  calculateDIO,
  calculateDPO,
  calculateDSO,
} from '../lib/ccc-engine/calculator';
import { estimateCashFreedLakhs, estimateCashLockedLakhs } from '../lib/ccc-engine/cash';
import { evaluateLayer1 } from '../lib/recommendations/layer1Rules';
import { applyTrends, type StoredSnapshot } from '../lib/history/snapshots';
import type { CCCResult } from '../lib/ccc-engine/types';
import type { ParseResult } from '../lib/parser/types';

config({ path: path.resolve(process.cwd(), '.env.local') });

let failures = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function fileFromDisk(relativePath: string): File {
  const buffer = readFileSync(path.resolve(process.cwd(), relativePath));
  return new File([new Uint8Array(buffer)], path.basename(relativePath));
}

function syntheticWorkbookFile(
  sheetName: string,
  rows: Record<string, unknown>[],
  fileName: string
): File {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new File([new Uint8Array(buffer)], fileName);
}

function buildCCCResult(parsed: ParseResult, periodDays: number): CCCResult {
  const revenue = parsed.sales.reduce((sum, invoice) => sum + invoice.amount, 0);
  const purchaseCOGS = parsed.purchases.reduce((sum, invoice) => sum + invoice.amount, 0);
  const cogs = purchaseCOGS > 0 ? purchaseCOGS : revenue * 0.65;
  const dio = calculateDIO(parsed.inventory, parsed.sales, periodDays);
  const dso = calculateDSO(parsed.sales, revenue, periodDays);
  const dpo = calculateDPO(parsed.purchases, cogs, periodDays);
  return calculateCCC(dio, dso, dpo, periodDays, revenue);
}

async function testTemplateParsing(): Promise<void> {
  console.log('\n[1] Parsing the bundled Excel templates');
  const sales = await parseExcelFile(fileFromDisk('public/templates/Sales_Template.xlsx'), 'SALES_REGISTER');
  const purchase = await parseExcelFile(fileFromDisk('public/templates/Purchase_Template.xlsx'), 'PURCHASE_REGISTER');
  const stock = await parseExcelFile(fileFromDisk('public/templates/Stock_Template.xlsx'), 'STOCK_SUMMARY');

  check('Sales template detected as SALES_REGISTER', sales.detectedType === 'SALES_REGISTER', String(sales.detectedType));
  check('Purchase template detected as PURCHASE_REGISTER', purchase.detectedType === 'PURCHASE_REGISTER', String(purchase.detectedType));
  check('Stock template detected as STOCK_SUMMARY', stock.detectedType === 'STOCK_SUMMARY', String(stock.detectedType));
  console.log(
    `  info  rows: sales=${sales.data.length}, purchase=${purchase.data.length}, stock=${stock.data.length}, warnings=${[...sales.warnings, ...purchase.warnings, ...stock.warnings].length}`
  );
}

async function buildSyntheticParseResult(): Promise<ParseResult> {
  console.log('\n[2] Parsing synthetic Tally-style data (Indian formats)');
  const salesFile = syntheticWorkbookFile(
    'Sales Register',
    [
      { Date: '01-Apr-2026', 'Party Name': 'Reliance Retail', 'Invoice No': 'S-101', 'Gross Total': '4,50,000', 'Due Date': '15-May-2026' },
      { Date: '10-Apr-2026', 'Party Name': 'Myntra', 'Invoice No': 'S-102', 'Gross Total': '2,25,000', 'Due Date': '25-May-2026' },
      { Date: '22-Apr-2026', 'Party Name': 'DMart', 'Invoice No': 'S-103', 'Gross Total': 375000, 'Due Date': '06-Jun-2026', 'Payment Date': '30-May-2026' },
      { Date: '05-May-2026', 'Party Name': 'Surat Wholesale Co', 'Invoice No': 'S-104', 'Gross Total': '1,80,000', 'Due Date': '19-Jun-2026' },
      { Date: '25-Jun-2026', 'Party Name': 'Ajio', 'Invoice No': 'S-105', 'Gross Total': '3,10,000', 'Due Date': '09-Aug-2026' },
    ],
    'sales_register.xlsx'
  );
  const purchaseFile = syntheticWorkbookFile(
    'Purchase Register',
    [
      { Date: '02-Apr-2026', 'Party Name': 'Gujarat Cotton Mills', 'Invoice No': 'P-201', 'Gross Total': '3,00,000', 'Due Date': '02-May-2026' },
      { Date: '15-Apr-2026', 'Party Name': 'Surat Yarn Traders', 'Invoice No': 'P-202', 'Gross Total': '1,50,000', 'Due Date': '15-May-2026', 'Payment Date': '10-May-2026' },
      { Date: '01-Jun-2026', 'Party Name': 'Dye Chem Industries', 'Invoice No': 'P-203', 'Gross Total': '95,000', 'Due Date': '01-Jul-2026' },
    ],
    'purchase_register.xlsx'
  );
  const stockFile = syntheticWorkbookFile(
    'Stock Summary',
    [
      { 'Stock Item': 'Cotton Knit Fabric', 'Closing Balance (Qty)': 1200, Rate: 250, 'Closing Value': '3,00,000' },
      { 'Stock Item': 'Polyester Blend', 'Closing Balance (Qty)': 800, Rate: 180, 'Closing Value': '1,44,000' },
      { 'Stock Item': 'Grey Fabric', 'Closing Balance (Qty)': 500, Rate: 120, 'Closing Value': '60,000' },
    ],
    'stock_summary.xlsx'
  );

  const [sales, purchase, stock] = await Promise.all([
    parseExcelFile(salesFile, 'SALES_REGISTER'),
    parseExcelFile(purchaseFile, 'PURCHASE_REGISTER'),
    parseExcelFile(stockFile, 'STOCK_SUMMARY'),
  ]);

  check('Synthetic sales rows parsed (5)', sales.data.length === 5, `got ${sales.data.length}`);
  check('Synthetic purchase rows parsed (3)', purchase.data.length === 3, `got ${purchase.data.length}`);
  check('Synthetic stock rows parsed (3)', stock.data.length === 3, `got ${stock.data.length}`);

  const firstSale = sales.data[0] as { amount: number; invoiceDate: Date; paymentDate: Date | null };
  check('Indian comma amount parsed to number (4,50,000 → 450000)', firstSale?.amount === 450000, `got ${firstSale?.amount}`);
  check('DD-MMM-YYYY date parsed to Date', firstSale?.invoiceDate instanceof Date && !Number.isNaN(firstSale.invoiceDate.getTime()));
  check('Missing payment date is null (unpaid)', firstSale?.paymentDate === null, `got ${String(firstSale?.paymentDate)}`);

  return {
    sales: sales.data as ParseResult['sales'],
    purchases: purchase.data as ParseResult['purchases'],
    inventory: stock.data as ParseResult['inventory'],
    warnings: [...sales.warnings, ...purchase.warnings, ...stock.warnings],
  };
}

function testEngine(parsed: ParseResult): CCCResult {
  console.log('\n[3] CCC engine + unified cash math');
  const result = buildCCCResult(parsed, 90);

  check('CCC = DIO + DSO − DPO', Math.abs(result.ccc - (result.dio.value + result.dso.value - result.dpo.value)) < 0.01);
  check('All metric values finite', [result.dio, result.dso, result.dpo].every((c) => Number.isFinite(c.value)));
  check('Real daily revenue derived from Sales Register', typeof result.dailyRevenueLakhs === 'number' && result.dailyRevenueLakhs! > 0, `got ${result.dailyRevenueLakhs}`);

  const expectedDaily = Math.round((1540000 / 90 / 100000) * 100) / 100; // 15.4L revenue over 90d
  check(`dailyRevenueLakhs ≈ ${expectedDaily}`, result.dailyRevenueLakhs === expectedDaily, `got ${result.dailyRevenueLakhs}`);

  const locked = estimateCashLockedLakhs(result);
  check('Cash locked uses real revenue (gapDays × dailyRevenueLakhs)', Math.abs(locked - Math.round(Math.max(result.gapDays, 0) * result.dailyRevenueLakhs! * 10) / 10) < 0.01, `got ${locked}`);

  const candidates = evaluateLayer1(result);
  check('Layer 1 produced candidates', candidates.length > 0, 'no rules fired');
  check('Candidate cash freed consistent with shared helper', candidates.every((c) => c.estimatedCashFreedLakhs === estimateCashFreedLakhs(c.estimatedDaysReduction, result)));
  check('Candidate priorities are labels (HIGH/MEDIUM/LOW)', candidates.every((c) => ['HIGH', 'MEDIUM', 'LOW'].includes(c.priority)));
  check('Candidates carry specific action steps (no empty)', candidates.every((c) => c.actionSteps.length === 3 && c.actionSteps.every((s) => s.split(' ').length > 3)));

  console.log(`  info  DIO=${result.dio.value} DSO=${result.dso.value} DPO=${result.dpo.value} CCC=${result.ccc.toFixed(1)} gap=${result.gapDays} dailyRev=${result.dailyRevenueLakhs}L locked=${locked}L rules=${candidates.map((c) => c.id).join(',')}`);
  return result;
}

function testTrends(result: CCCResult): void {
  console.log('\n[4] Trend deltas vs previous snapshot');
  const previous: StoredSnapshot = {
    id: 'snap_prev',
    createdAt: new Date('2026-06-01').toISOString(),
    periodDays: 90,
    dio: result.dio.value - 4,
    dso: result.dso.value + 6,
    dpo: result.dpo.value - 1.5,
    ccc: result.ccc,
    gapDays: result.gapDays,
  };

  const withTrends = applyTrends(result, previous);
  check('DIO trendDelta = +4 (worsened)', withTrends.dio.trendDelta === 4, `got ${withTrends.dio.trendDelta}`);
  check('DSO trendDelta = −6 (improved)', withTrends.dso.trendDelta === -6, `got ${withTrends.dso.trendDelta}`);
  check('DPO trendDelta = +1.5 (improved)', withTrends.dpo.trendDelta === 1.5, `got ${withTrends.dpo.trendDelta}`);
  check('No previous snapshot leaves trends at 0', applyTrends(result, null).dio.trendDelta === 0);
}

async function testApi(result: CCCResult): Promise<void> {
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  console.log(`\n[5] POST ${baseUrl}/api/recommendations (live Gemini via dev server)`);
  const candidates = evaluateLayer1(result);
  const body = JSON.stringify({
    cccResult: { ...result, calculatedAt: result.calculatedAt.toISOString() },
    layer1Candidates: candidates,
  });

  const response = await fetch(`${baseUrl}/api/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  check('API responded 200', response.status === 200, `got ${response.status}`);
  const payload = (await response.json()) as {
    recommendations?: { explanation: string; actionSteps: string[]; estimatedCashFreedLakhs: number }[];
    source?: string;
  };

  check('Response includes recommendations', Array.isArray(payload.recommendations) && payload.recommendations.length > 0);
  check('Source is gemini (AI enrichment worked)', payload.source === 'gemini', `got ${payload.source}`);
  check('≤ 5 recommendations', (payload.recommendations?.length ?? 0) <= 5);
  check(
    'Explanations reference specific numbers',
    (payload.recommendations ?? []).every((rec) => /\d/.test(rec.explanation))
  );
  console.log(`  info  source=${payload.source}, count=${payload.recommendations?.length}`);
  console.log(`  info  sample: ${payload.recommendations?.[0]?.explanation.slice(0, 140)}...`);
}

async function main(): Promise<void> {
  const skipApi = process.argv.includes('--no-api');

  await testTemplateParsing();
  const parsed = await buildSyntheticParseResult();
  const result = testEngine(parsed);
  testTrends(result);

  if (skipApi) {
    console.log('\n[5] Skipped API test (--no-api)');
  } else {
    await testApi(result);
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('E2E test crashed:', error);
  process.exit(1);
});
