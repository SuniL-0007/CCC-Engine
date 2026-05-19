import { CCCResult, ParseResult } from './types';

/**
 * Calculate Days Inventory Outstanding (DIO)
 * DIO = (Average Inventory / COGS) * Number of Days
 */
export function calculateDIO(
  inventory: number,
  cogs: number,
  days: number = 365
): number {
  if (cogs === 0) return 0;
  return (inventory / cogs) * days;
}

/**
 * Calculate Days Sales Outstanding (DSO)
 * DSO = (Average Accounts Receivable / Net Sales) * Number of Days
 */
export function calculateDSO(
  accountsReceivable: number,
  sales: number,
  days: number = 365
): number {
  if (sales === 0) return 0;
  return (accountsReceivable / sales) * days;
}

/**
 * Calculate Days Payable Outstanding (DPO)
 * DPO = (Average Accounts Payable / COGS) * Number of Days
 */
export function calculateDPO(
  accountsPayable: number,
  cogs: number,
  days: number = 365
): number {
  if (cogs === 0) return 0;
  return (accountsPayable / cogs) * days;
}

/**
 * Calculate Cash Conversion Cycle (CCC)
 * CCC = DIO + DSO - DPO
 */
export function calculateCCC(dio: number, dso: number, dpo: number): number {
  return Math.round((dio + dso - dpo) * 100) / 100;
}

/**
 * Calculate CCC metrics from parse result
 */
export function calculateCCCMetrics(
  parseResult: ParseResult,
  benchmarks: { DIO: number; DSO: number; DPO: number; CCC: number } = {
    DIO: 38,
    DSO: 45,
    DPO: 42,
    CCC: 41,
  }
): CCCResult {
  const periodDays = inferAnalysisPeriodDays(parseResult);

  const totalSales = parseResult.sales.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPurchases = parseResult.purchases.reduce((sum, inv) => sum + inv.amount, 0);
  const totalInventory = parseResult.inventory.reduce((sum, item) => sum + item.closingValue, 0);

  const warnings = [...parseResult.warnings];
  const cogs = totalPurchases > 0 ? totalPurchases : totalSales * 0.7;

  if (totalPurchases === 0 && totalSales > 0) {
    warnings.push('Purchase data was missing, so COGS was estimated as 70% of sales.');
  }

  const outstandingAR = parseResult.sales
    .filter(inv => !inv.paymentDate)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingAP = parseResult.purchases
    .filter(inv => !inv.paymentDate)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const dio = calculateDIO(totalInventory, cogs, periodDays);
  const dso = calculateDSO(outstandingAR, totalSales, periodDays);
  const dpo = calculateDPO(outstandingAP, cogs, periodDays);
  const ccc = calculateCCC(dio, dso, dpo);
  const gapDays = Math.round((ccc - benchmarks.CCC) * 100) / 100;
  const estimatedCashLockedLakhs = estimateCashLockedLakhs(totalSales, periodDays, gapDays);

  return {
    dio: {
      value: Math.round(dio * 100) / 100,
      trendDelta: 0,
      benchmark: benchmarks.DIO,
    },
    dso: {
      value: Math.round(dso * 100) / 100,
      trendDelta: 0,
      benchmark: benchmarks.DSO,
    },
    dpo: {
      value: Math.round(dpo * 100) / 100,
      trendDelta: 0,
      benchmark: benchmarks.DPO,
    },
    ccc,
    benchmarkCCC: benchmarks.CCC,
    gapDays,
    periodDays,
    estimatedCashLockedLakhs,
    summary: {
      totalSales,
      totalPurchases,
      totalInventory,
      outstandingAR,
      outstandingAP,
      cogs,
    },
    generatedAt: new Date().toISOString(),
    warnings,
  };
}

function inferAnalysisPeriodDays(parseResult: ParseResult): number {
  const dates = [...parseResult.sales, ...parseResult.purchases]
    .map((invoice) => invoice.invoiceDate)
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getTime());

  if (dates.length < 2) return 365;

  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const days = Math.ceil((max - min) / (24 * 60 * 60 * 1000)) + 1;

  return Math.min(365, Math.max(30, days));
}

function estimateCashLockedLakhs(totalSales: number, periodDays: number, gapDays: number): number {
  if (gapDays <= 0 || totalSales <= 0 || periodDays <= 0) return 0;

  const dailySales = totalSales / periodDays;
  return Math.round((dailySales * gapDays) / 1000) / 100;
}
