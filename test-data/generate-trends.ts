/**
 * Generates sequential test datasets for a model company (Apex Weaving)
 * across 3 months/periods (Month 1: Stressed, Month 2: Mid-improvement, Month 3: Optimized)
 * to verify and test trend analysis.
 *
 * Run: npx tsx test-data/generate-trends.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { parseExcelFile } from '../lib/parser/sheetjs';
import {
  calculateCCC,
  calculateDIO,
  calculateDPO,
  calculateDSO,
} from '../lib/ccc-engine/calculator';
import { estimateCashLockedLakhs } from '../lib/ccc-engine/cash';
import type { ParseResult } from '../lib/parser/types';

const OUT = path.resolve(process.cwd(), 'test-data', 'trend-mill');
const L = 100000; // one lakh

type Row = Record<string, string | number>;

function sheetFile(subDir: string, fileName: string, sheetName: string, rows: Row[]): string {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  const target = path.join(OUT, subDir, fileName);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
  return target;
}

function invoice(date: string, party: string, no: string, amountLakhs: number, due: string, paid?: string): Row {
  const row: Row = {
    Date: date,
    'Party Name': party,
    'Invoice No': no,
    'Gross Total': amountLakhs * L,
    'Due Date': due,
  };
  if (paid) row['Payment Date'] = paid;
  return row;
}

function stock(item: string, qty: number, rate: number, valueLakhs: number): Row {
  return {
    'Stock Item': item,
    'Closing Balance (Qty)': qty,
    Rate: rate,
    'Closing Value': valueLakhs * L,
  };
}

// ==========================================
// Period 1 (Month 1): Baseline / Stressed
// Target Metrics: DSO ≈ 75, DIO ≈ 65, DPO ≈ 25 (CCC ≈ 115)
// ==========================================

const M1_SALES: Row[] = [
  // paid (total 40L)
  invoice('01-Apr-2026', 'Surat Wholesale Co', 'S-1001', 10, '01-May-2026', '10-May-2026'),
  invoice('10-Apr-2026', 'Bhilwara Fabrics', 'S-1002', 10, '10-May-2026', '25-May-2026'),
  invoice('20-Apr-2026', 'Panipat Handlooms', 'S-1003', 10, '20-May-2026', '08-Jun-2026'),
  invoice('30-Apr-2026', 'Surat Wholesale Co', 'S-1004', 10, '30-May-2026', '20-Jun-2026'),
  // unpaid/outstanding (total 200L) -> high DSO
  invoice('05-Apr-2026', 'Reliance Retail', 'S-1005', 40, '05-May-2026'),
  invoice('12-Apr-2026', 'Myntra', 'S-1006', 40, '12-May-2026'),
  invoice('19-Apr-2026', 'DMart', 'S-1007', 40, '19-May-2026'),
  invoice('28-Apr-2026', 'Ajio', 'S-1008', 40, '28-May-2026'),
  invoice('06-May-2026', 'Trends', 'S-1009', 40, '05-Jun-2026'),
];

const M1_PURCHASES: Row[] = [
  // paid quickly (total 108.3L) -> paying suppliers too fast (low DPO)
  invoice('01-Apr-2026', 'Gujarat Cotton Mills', 'P-1001', 30, '01-May-2026', '10-Apr-2026'),
  invoice('20-Apr-2026', 'Surat Yarn Traders', 'P-1002', 30, '20-May-2026', '28-Apr-2026'),
  invoice('10-May-2026', 'Colourtex Dyes', 'P-1003', 28.3, '09-Jun-2026', '18-May-2026'),
  invoice('01-Jun-2026', 'Gujarat Cotton Mills', 'P-1004', 20, '01-Jul-2026', '08-Jun-2026'),
  // unpaid/outstanding (total 41.7L)
  invoice('10-Jun-2026', 'Surat Yarn Traders', 'P-1005', 21.7, '10-Jul-2026'),
  invoice('28-Jun-2026', 'Gujarat Cotton Mills', 'P-1006', 20, '28-Jul-2026'),
];

const M1_STOCK: Row[] = [
  // high inventory (total 108.3L) -> high DIO
  stock('Cotton Knit Fabric', 20000, 250, 50),
  stock('Polyester Blend', 15000, 200, 30),
  stock('Grey Fabric', 23583, 120, 28.3),
];

// ==========================================
// Period 2 (Month 2): Mid-improvement
// Target Metrics: DSO ≈ 60, DIO ≈ 50, DPO ≈ 35 (CCC ≈ 75)
// ==========================================

const M2_SALES: Row[] = [
  // paid (total 80L) -> collections improved
  invoice('01-Apr-2026', 'Surat Wholesale Co', 'S-2001', 10, '01-May-2026', '05-May-2026'),
  invoice('10-Apr-2026', 'Bhilwara Fabrics', 'S-2002', 10, '10-May-2026', '20-May-2026'),
  invoice('20-Apr-2026', 'Panipat Handlooms', 'S-2003', 10, '20-May-2026', '02-Jun-2026'),
  invoice('30-Apr-2026', 'Surat Wholesale Co', 'S-2004', 10, '30-May-2026', '10-Jun-2026'),
  invoice('05-Apr-2026', 'Reliance Retail', 'S-2005', 40, '05-May-2026', '25-May-2026'), // paid!
  // unpaid/outstanding (total 160L) -> lower AR balance
  invoice('12-Apr-2026', 'Myntra', 'S-2006', 40, '12-May-2026'),
  invoice('19-Apr-2026', 'DMart', 'S-2007', 40, '19-May-2026'),
  invoice('28-Apr-2026', 'Ajio', 'S-2008', 40, '28-May-2026'),
  invoice('06-May-2026', 'Trends', 'S-2009', 40, '05-Jun-2026'),
];

const M2_PURCHASES: Row[] = [
  // paid (total 91.7L) -> paid slightly slower
  invoice('01-Apr-2026', 'Gujarat Cotton Mills', 'P-2001', 30, '01-May-2026', '25-Apr-2026'),
  invoice('20-Apr-2026', 'Surat Yarn Traders', 'P-2002', 30, '20-May-2026', '15-May-2026'),
  invoice('10-May-2026', 'Colourtex Dyes', 'P-2003', 31.7, '09-Jun-2026', '05-Jun-2026'),
  // unpaid/outstanding (total 58.3L) -> higher DPO
  invoice('01-Jun-2026', 'Gujarat Cotton Mills', 'P-2004', 20, '01-Jul-2026'),
  invoice('10-Jun-2026', 'Surat Yarn Traders', 'P-2005', 21.7, '10-Jul-2026'),
  invoice('28-Jun-2026', 'Gujarat Cotton Mills', 'P-2006', 16.6, '28-Jul-2026'),
];

const M2_STOCK: Row[] = [
  // moderate inventory (total 83.3L) -> moderate DIO
  stock('Cotton Knit Fabric', 16000, 250, 40),
  stock('Polyester Blend', 12500, 200, 25),
  stock('Grey Fabric', 15250, 120, 18.3),
];

// ==========================================
// Period 3 (Month 3): Optimized / Healthy
// Target Metrics: DSO ≈ 45, DIO ≈ 35, DPO ≈ 45 (CCC ≈ 35)
// ==========================================

const M3_SALES: Row[] = [
  // paid (total 120L) -> excellent collection velocity
  invoice('01-Apr-2026', 'Surat Wholesale Co', 'S-3001', 10, '01-May-2026', '02-May-2026'),
  invoice('10-Apr-2026', 'Bhilwara Fabrics', 'S-3002', 10, '10-May-2026', '12-May-2026'),
  invoice('20-Apr-2026', 'Panipat Handlooms', 'S-3003', 10, '20-May-2026', '22-May-2026'),
  invoice('30-Apr-2026', 'Surat Wholesale Co', 'S-3004', 10, '30-May-2026', '02-Jun-2026'),
  invoice('05-Apr-2026', 'Reliance Retail', 'S-3005', 40, '05-May-2026', '15-May-2026'), // paid!
  invoice('12-Apr-2026', 'Myntra', 'S-3006', 40, '12-May-2026', '20-May-2026'), // paid!
  // unpaid/outstanding (total 120L) -> lowest AR balance
  invoice('19-Apr-2026', 'DMart', 'S-3007', 40, '19-May-2026'),
  invoice('28-Apr-2026', 'Ajio', 'S-3008', 40, '28-May-2026'),
  invoice('06-May-2026', 'Trends', 'S-3009', 40, '05-Jun-2026'),
];

const M3_PURCHASES: Row[] = [
  // paid (total 75L) -> paying suppliers exactly on/close to due dates (extended terms)
  invoice('01-Apr-2026', 'Gujarat Cotton Mills', 'P-3001', 30, '01-May-2026', '01-May-2026'),
  invoice('20-Apr-2026', 'Surat Yarn Traders', 'P-3002', 30, '20-May-2026', '20-May-2026'),
  invoice('10-May-2026', 'Colourtex Dyes', 'P-3003', 15, '09-Jun-2026', '09-Jun-2026'),
  // unpaid/outstanding (total 75L) -> highest DPO (safely within industry guidelines)
  invoice('01-Jun-2026', 'Gujarat Cotton Mills', 'P-3004', 30, '01-Jul-2026'),
  invoice('10-Jun-2026', 'Surat Yarn Traders', 'P-3005', 25, '10-Jul-2026'),
  invoice('28-Jun-2026', 'Gujarat Cotton Mills', 'P-3006', 20, '28-Jul-2026'),
];

const M3_STOCK: Row[] = [
  // low optimized inventory (total 58.3L) -> low DIO
  stock('Cotton Knit Fabric', 12000, 250, 30),
  stock('Polyester Blend', 7500, 200, 15),
  stock('Grey Fabric', 11083, 120, 13.3),
];

// ==========================================
// Generation and Verification
// ==========================================

console.log('Generating trend datasets for Apex Weaving...\n');

// Write Excel files
sheetFile('month-1', 'Sales_Register.xlsx', 'Sales Register', M1_SALES);
sheetFile('month-1', 'Purchase_Register.xlsx', 'Purchase Register', M1_PURCHASES);
sheetFile('month-1', 'Stock_Summary.xlsx', 'Stock Summary', M1_STOCK);

sheetFile('month-2', 'Sales_Register.xlsx', 'Sales Register', M2_SALES);
sheetFile('month-2', 'Purchase_Register.xlsx', 'Purchase Register', M2_PURCHASES);
sheetFile('month-2', 'Stock_Summary.xlsx', 'Stock Summary', M2_STOCK);

sheetFile('month-3', 'Sales_Register.xlsx', 'Sales Register', M3_SALES);
sheetFile('month-3', 'Purchase_Register.xlsx', 'Purchase Register', M3_PURCHASES);
sheetFile('month-3', 'Stock_Summary.xlsx', 'Stock Summary', M3_STOCK);

console.log('Trend files written successfully under test-data/trend-mill/.\n');

// Verify files via real calculator code
import { readFileSync } from 'node:fs';

function fileOf(rel: string): File {
  const buffer = readFileSync(path.join(OUT, rel));
  return new File([new Uint8Array(buffer)], path.basename(rel));
}

async function verifyMonth(name: string, folder: string): Promise<void> {
  const [sales, purchases, inventory] = await Promise.all([
    parseExcelFile(fileOf(`${folder}/Sales_Register.xlsx`), 'SALES_REGISTER'),
    parseExcelFile(fileOf(`${folder}/Purchase_Register.xlsx`), 'PURCHASE_REGISTER'),
    parseExcelFile(fileOf(`${folder}/Stock_Summary.xlsx`), 'STOCK_SUMMARY'),
  ]);

  const parsed: ParseResult = {
    sales: sales.data as ParseResult['sales'],
    purchases: purchases.data as ParseResult['purchases'],
    inventory: inventory.data as ParseResult['inventory'],
    warnings: [...sales.warnings, ...purchases.warnings, ...inventory.warnings],
  };

  const periodDays = 90;
  const revenue = parsed.sales.reduce((sum, invoiceRow) => sum + invoiceRow.amount, 0);
  const purchaseCOGS = parsed.purchases.reduce((sum, invoiceRow) => sum + invoiceRow.amount, 0);
  const cogs = purchaseCOGS > 0 ? purchaseCOGS : revenue * 0.65;

  const dio = calculateDIO(parsed.inventory, parsed.sales, periodDays);
  const dso = calculateDSO(parsed.sales, revenue, periodDays);
  const dpo = calculateDPO(parsed.purchases, cogs, periodDays);
  const result = calculateCCC(dio, dso, dpo, periodDays, revenue);

  console.log(`== ${name}`);
  console.log(`   DIO=${dio.value}d | DSO=${dso.value}d | DPO=${dpo.value}d | CCC=${result.ccc.toFixed(1)}d`);
  console.log(`   Daily Revenue: Rs ${result.dailyRevenueLakhs}L | Cash Locked: Rs ${estimateCashLockedLakhs(result)}L`);
  console.log();
}

async function runVerification() {
  await verifyMonth('Month 1 (Stressed baseline)', 'month-1');
  await verifyMonth('Month 2 (Mid-way improvement)', 'month-2');
  await verifyMonth('Month 3 (Fully optimized)', 'month-3');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
});
