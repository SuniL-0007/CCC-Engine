/**
 * Generates synthetic test datasets for FabricCash and verifies each one
 * through the app's REAL parser + CCC engine, printing what to expect
 * when you upload it.
 *
 * Run: npx tsx test-data/generate.ts
 *
 * Scenarios (each in its own folder under test-data/):
 *   healthy-mill/       CCC well under benchmark -> "no urgent actions" state
 *   stressed-mill/      high DSO + high DIO + low DPO -> many HIGH rules fire
 *   messy-tally-export/ title rows, Indian comma amounts, mixed date formats,
 *                       Grand Total row, blank rows, Tally column names
 *   all-in-one.xlsx     single workbook with all three sheets
 *   broken/             a salary sheet -> should trigger the friendly error
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { parseExcelFile, parseExcelWorkbook } from '../lib/parser/sheetjs';
import {
  calculateCCC,
  calculateDIO,
  calculateDPO,
  calculateDSO,
} from '../lib/ccc-engine/calculator';
import { estimateCashLockedLakhs } from '../lib/ccc-engine/cash';
import { evaluateLayer1 } from '../lib/recommendations/layer1Rules';
import type { ParseResult } from '../lib/parser/types';

const OUT = path.resolve(process.cwd(), 'test-data');
const L = 100000; // one lakh

// ---------------------------------------------------------------- helpers

type Row = Record<string, string | number>;

function sheetFile(dir: string, fileName: string, sheetName: string, rows: Row[]): string {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  const target = path.join(OUT, dir, fileName);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
  return target;
}

function aoaFile(dir: string, fileName: string, sheetName: string, rows: (string | number)[][]): string {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  const target = path.join(OUT, dir, fileName);
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
  return { 'Stock Item': item, 'Closing Balance (Qty)': qty, Rate: rate, 'Closing Value': valueLakhs * L };
}

// ---------------------------------------------------------------- scenario 1: healthy mill

const HEALTHY_SALES: Row[] = [
  invoice('01-Apr-2026', 'Reliance Retail', 'S-1001', 20, '01-May-2026', '28-Apr-2026'),
  invoice('08-Apr-2026', 'DMart', 'S-1002', 18, '08-May-2026', '05-May-2026'),
  invoice('16-Apr-2026', 'Myntra', 'S-1003', 16, '16-May-2026', '12-May-2026'),
  invoice('24-Apr-2026', 'Trends (Reliance)', 'S-1004', 15, '24-May-2026', '20-May-2026'),
  invoice('02-May-2026', 'Ajio', 'S-1005', 14, '01-Jun-2026', '28-May-2026'),
  invoice('10-May-2026', 'Surat Wholesale Co', 'S-1006', 13, '09-Jun-2026', '04-Jun-2026'),
  invoice('18-May-2026', 'Panipat Handlooms', 'S-1007', 12, '17-Jun-2026', '15-Jun-2026'),
  invoice('26-May-2026', 'Bhilwara Fabrics', 'S-1008', 12, '25-Jun-2026', '22-Jun-2026'),
  invoice('03-Jun-2026', 'Reliance Retail', 'S-1009', 18, '03-Jul-2026'),
  invoice('11-Jun-2026', 'Myntra', 'S-1010', 16, '11-Jul-2026'),
  invoice('19-Jun-2026', 'DMart', 'S-1011', 14, '19-Jul-2026'),
  invoice('28-Jun-2026', 'Ajio', 'S-1012', 12, '28-Jul-2026'),
];

const HEALTHY_PURCHASES: Row[] = [
  invoice('01-Apr-2026', 'Gujarat Cotton Mills', 'P-2001', 15, '01-May-2026', '29-Apr-2026'),
  invoice('12-Apr-2026', 'Surat Yarn Traders', 'P-2002', 14, '12-May-2026', '08-May-2026'),
  invoice('25-Apr-2026', 'Colourtex Dyes', 'P-2003', 13, '25-May-2026', '20-May-2026'),
  invoice('08-May-2026', 'Gujarat Cotton Mills', 'P-2004', 12, '07-Jun-2026', '03-Jun-2026'),
  invoice('20-May-2026', 'Surat Yarn Traders', 'P-2005', 18, '19-Jun-2026'),
  invoice('01-Jun-2026', 'Dye Chem Industries', 'P-2006', 17, '01-Jul-2026'),
  invoice('12-Jun-2026', 'Gujarat Cotton Mills', 'P-2007', 16, '12-Jul-2026'),
  invoice('28-Jun-2026', 'Surat Yarn Traders', 'P-2008', 15, '28-Jul-2026'),
];

const HEALTHY_STOCK: Row[] = [
  stock('Cotton Knit Fabric', 16000, 250, 40),
  stock('Polyester Blend', 15000, 200, 30),
  stock('Grey Fabric', 25000, 120, 30),
];

// ---------------------------------------------------------------- scenario 2: stressed mill

const STRESSED_SALES: Row[] = [
  // paid: 40L
  invoice('01-Apr-2026', 'Surat Wholesale Co', 'S-3001', 10, '01-May-2026', '10-May-2026'),
  invoice('10-Apr-2026', 'Bhilwara Fabrics', 'S-3002', 10, '10-May-2026', '25-May-2026'),
  invoice('20-Apr-2026', 'Panipat Handlooms', 'S-3003', 10, '20-May-2026', '08-Jun-2026'),
  invoice('30-Apr-2026', 'Surat Wholesale Co', 'S-3004', 10, '30-May-2026', '20-Jun-2026'),
  // unpaid: 200L
  invoice('05-Apr-2026', 'Reliance Retail', 'S-3005', 22, '05-May-2026'),
  invoice('12-Apr-2026', 'Myntra', 'S-3006', 21, '12-May-2026'),
  invoice('19-Apr-2026', 'DMart', 'S-3007', 20, '19-May-2026'),
  invoice('28-Apr-2026', 'Ajio', 'S-3008', 20, '28-May-2026'),
  invoice('06-May-2026', 'Reliance Retail', 'S-3009', 19, '05-Jun-2026'),
  invoice('14-May-2026', 'Trends (Reliance)', 'S-3010', 18, '13-Jun-2026'),
  invoice('22-May-2026', 'Myntra', 'S-3011', 18, '21-Jun-2026'),
  invoice('30-May-2026', 'DMart', 'S-3012', 17, '29-Jun-2026'),
  invoice('08-Jun-2026', 'Ajio', 'S-3013', 16, '08-Jul-2026'),
  invoice('17-Jun-2026', 'Reliance Retail', 'S-3014', 15, '17-Jul-2026'),
  invoice('28-Jun-2026', 'Myntra', 'S-3015', 14, '28-Jul-2026'),
];

const STRESSED_PURCHASES: Row[] = [
  // paid quickly: 110.2L (low DPO — paying too fast)
  invoice('01-Apr-2026', 'Gujarat Cotton Mills', 'P-4001', 30, '01-May-2026', '10-Apr-2026'),
  invoice('20-Apr-2026', 'Surat Yarn Traders', 'P-4002', 29, '20-May-2026', '28-Apr-2026'),
  invoice('10-May-2026', 'Colourtex Dyes', 'P-4003', 26, '09-Jun-2026', '18-May-2026'),
  invoice('01-Jun-2026', 'Gujarat Cotton Mills', 'P-4004', 25.2, '01-Jul-2026', '08-Jun-2026'),
  // unpaid: 49.8L
  invoice('10-Jun-2026', 'Surat Yarn Traders', 'P-4005', 18, '10-Jul-2026'),
  invoice('18-Jun-2026', 'Dye Chem Industries', 'P-4006', 16.8, '18-Jul-2026'),
  invoice('28-Jun-2026', 'Gujarat Cotton Mills', 'P-4007', 15, '28-Jul-2026'),
];

const STRESSED_STOCK: Row[] = [
  stock('Cotton Knit Fabric', 48000, 250, 120),
  stock('Polyester Blend', 55000, 200, 110),
  stock('Technical Textiles', 20000, 500, 100),
  stock('Grey Fabric', 80833, 120, 97),
];

// ---------------------------------------------------------------- scenario 3: messy tally export

const MESSY_SALES_AOA: (string | number)[][] = [
  ['M/s Surat Textiles Pvt Ltd'],
  ['Sales Register'],
  ['1-Apr-2026 to 30-Jun-2026'],
  [],
  ['Date', 'Particulars', 'Vch No.', 'Gross Total', 'Due Date', 'Payment Date'],
  ['05-Apr-2026', 'Reliance Retail', 'VCH-101', '₹22,00,000', '05-May-2026', ''],
  ['12/04/2026', 'Myntra Jabong', 'VCH-102', '18,50,000.00', '12/05/2026', ''],
  ['21-Apr-2026', 'DMart Avenue', 'VCH-103', 'Rs. 16,25,000', '21-May-2026', '15-Jun-2026'],
  [],
  ['02-May-2026', 'Ajio (Reliance)', 'VCH-104', '14,00,000', '01-Jun-2026', ''],
  ['15/05/2026', 'Surat Wholesale Co', 'VCH-105', '12,75,000', '14/06/2026', ''],
  ['26-Jun-2026', 'Trends', 'VCH-106', '9,50,000', '26-Jul-2026', ''],
  ['Grand Total', '', '', '93,00,000', '', ''],
];

const MESSY_PURCHASES_AOA: (string | number)[][] = [
  ['M/s Surat Textiles Pvt Ltd'],
  ['Purchase Register'],
  ['1-Apr-2026 to 30-Jun-2026'],
  [],
  ['Date', 'Particulars', 'Vch No.', 'Gross Total', 'Due Date', 'Payment Date'],
  ['03-Apr-2026', 'Gujarat Cotton Mills', 'PUR-201', '₹20,00,000', '03-May-2026', '12-Apr-2026'],
  ['18/04/2026', 'Surat Yarn Traders', 'PUR-202', '15,60,000.00', '18-May-2026', '25-Apr-2026'],
  ['08-May-2026', 'Colourtex Dyes', 'PUR-203', 'Rs. 12,40,000', '07-Jun-2026', ''],
  ['20-Jun-2026', 'Dye Chem Industries', 'PUR-204', '9,00,000', '20-Jul-2026', ''],
  ['Grand Total', '', '', '57,00,000', '', ''],
];

const MESSY_STOCK_AOA: (string | number)[][] = [
  ['M/s Surat Textiles Pvt Ltd'],
  ['Stock Summary as on 30-Jun-2026'],
  [],
  ['Name of Item', 'Closing Balance', 'Rate', 'Closing Value'],
  ['Cotton Knit Fabric', '32,000', 250, '₹80,00,000'],
  ['Polyester Blend', '27,500', 200, '55,00,000'],
  ['Grey Fabric (Unprocessed)', '37,500', 120, '45,00,000'],
  ['Grand Total', '', '', '1,80,00,000'],
];

// ---------------------------------------------------------------- scenario 5: broken file

const BROKEN_AOA: (string | number)[][] = [
  ['Employee Name', 'Department', 'Designation', 'Monthly Salary', 'Join Month'],
  ['Ramesh Kumar', 'Weaving', 'Supervisor', 45000, 'Jan-2024'],
  ['Suresh Patel', 'Dyeing', 'Operator', 32000, 'Mar-2023'],
  ['Mahesh Shah', 'Accounts', 'Clerk', 28000, 'Jul-2022'],
];

// ---------------------------------------------------------------- generate

console.log('Generating datasets under test-data/ ...\n');

sheetFile('healthy-mill', 'Sales_Register.xlsx', 'Sales Register', HEALTHY_SALES);
sheetFile('healthy-mill', 'Purchase_Register.xlsx', 'Purchase Register', HEALTHY_PURCHASES);
sheetFile('healthy-mill', 'Stock_Summary.xlsx', 'Stock Summary', HEALTHY_STOCK);

sheetFile('stressed-mill', 'Sales_Register.xlsx', 'Sales Register', STRESSED_SALES);
sheetFile('stressed-mill', 'Purchase_Register.xlsx', 'Purchase Register', STRESSED_PURCHASES);
sheetFile('stressed-mill', 'Stock_Summary.xlsx', 'Stock Summary', STRESSED_STOCK);

aoaFile('messy-tally-export', 'Sales_Register.xlsx', 'Sales Register', MESSY_SALES_AOA);
aoaFile('messy-tally-export', 'Purchase_Register.xlsx', 'Purchase Register', MESSY_PURCHASES_AOA);
aoaFile('messy-tally-export', 'Stock_Summary.xlsx', 'Stock Summary', MESSY_STOCK_AOA);

// all-in-one workbook (healthy data, three sheets)
{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(HEALTHY_SALES), 'Sales Register');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(HEALTHY_PURCHASES), 'Purchase Register');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(HEALTHY_STOCK), 'Stock Summary');
  writeFileSync(path.join(OUT, 'all-in-one.xlsx'), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
}

aoaFile('broken', 'Salary_Sheet.xlsx', 'Salaries', BROKEN_AOA);

console.log('Files written.\n');

// ---------------------------------------------------------------- verify through the real pipeline

import { readFileSync } from 'node:fs';

function fileOf(rel: string): File {
  const buffer = readFileSync(path.join(OUT, rel));
  return new File([new Uint8Array(buffer)], path.basename(rel));
}

async function verifyScenario(name: string, dir: string): Promise<void> {
  const [sales, purchases, inventory] = await Promise.all([
    parseExcelFile(fileOf(`${dir}/Sales_Register.xlsx`), 'SALES_REGISTER'),
    parseExcelFile(fileOf(`${dir}/Purchase_Register.xlsx`), 'PURCHASE_REGISTER'),
    parseExcelFile(fileOf(`${dir}/Stock_Summary.xlsx`), 'STOCK_SUMMARY'),
  ]);

  const parsed: ParseResult = {
    sales: sales.data as ParseResult['sales'],
    purchases: purchases.data as ParseResult['purchases'],
    inventory: inventory.data as ParseResult['inventory'],
    warnings: [...sales.warnings, ...purchases.warnings, ...inventory.warnings],
  };
  report(name, parsed);
}

function report(name: string, parsed: ParseResult): void {
  const periodDays = 90;
  const revenue = parsed.sales.reduce((sum, invoiceRow) => sum + invoiceRow.amount, 0);
  const purchaseCOGS = parsed.purchases.reduce((sum, invoiceRow) => sum + invoiceRow.amount, 0);
  const cogs = purchaseCOGS > 0 ? purchaseCOGS : revenue * 0.65;

  const dio = calculateDIO(parsed.inventory, parsed.sales, periodDays);
  const dso = calculateDSO(parsed.sales, revenue, periodDays);
  const dpo = calculateDPO(parsed.purchases, cogs, periodDays);
  const result = calculateCCC(dio, dso, dpo, periodDays, revenue);
  const rules = evaluateLayer1(result);

  console.log(`== ${name}`);
  console.log(
    `   rows: sales=${parsed.sales.length} purchases=${parsed.purchases.length} stock=${parsed.inventory.length}` +
    ` · warnings=${parsed.warnings.length}`
  );
  if (parsed.warnings.length > 0) console.log(`   warnings: ${parsed.warnings.slice(0, 3).join(' | ')}`);
  console.log(
    `   DIO=${dio.value} DSO=${dso.value} DPO=${dpo.value} CCC=${result.ccc.toFixed(1)} (benchmark 41, gap ${result.gapDays >= 0 ? '+' : ''}${result.gapDays})`
  );
  console.log(
    `   dailyRevenue=${result.dailyRevenueLakhs}L · cash locked=Rs ${estimateCashLockedLakhs(result)}L` +
    ` · rules fired: ${rules.length ? rules.map((r) => `${r.id}(${r.priority})`).join(', ') : 'none — healthy state'}`
  );
  console.log();
}

async function main(): Promise<void> {
  await verifyScenario('healthy-mill (expect: within benchmark, few/no rules)', 'healthy-mill');
  await verifyScenario('stressed-mill (expect: severe gap, 5 HIGH/MEDIUM rules)', 'stressed-mill');
  await verifyScenario('messy-tally-export (expect: parses despite junk, warnings ok)', 'messy-tally-export');

  // all-in-one workbook goes through the workbook path the UploadWidget uses
  const workbook = await parseExcelWorkbook(fileOf('all-in-one.xlsx'));
  report('all-in-one.xlsx via parseExcelWorkbook (expect: same as healthy-mill)', workbook);

  // broken file: expect zero rows -> the UI should show the friendly error
  const broken = await parseExcelFile(fileOf('broken/Salary_Sheet.xlsx'), 'SALES_REGISTER');
  console.log('== broken/Salary_Sheet.xlsx (expect: 0 usable rows -> UI shows friendly error)');
  console.log(`   rows parsed: ${broken.data.length} · warnings: ${broken.warnings.length}`);
  if (broken.warnings.length > 0) console.log(`   first warning: ${broken.warnings[0]}`);
  console.log();

  console.log('Done. Drag the files from test-data/<scenario>/ into the upload widget.');
}

main().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
