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
  // Calculate totals
  const totalSales = parseResult.sales.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPurchases = parseResult.purchases.reduce((sum, inv) => sum + inv.amount, 0);
  const totalInventory = parseResult.inventory.reduce((sum, item) => sum + item.closingValue, 0);

  // For simplicity, using total purchases as COGS
  const cogs = totalPurchases;

  // Outstanding amounts (unpaid invoices)
  const outstandingAR = parseResult.sales
    .filter(inv => !inv.paymentDate)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingAP = parseResult.purchases
    .filter(inv => !inv.paymentDate)
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Calculate metrics
  const dio = calculateDIO(totalInventory, cogs);
  const dso = calculateDSO(outstandingAR, totalSales);
  const dpo = calculateDPO(outstandingAP, cogs);
  const ccc = calculateCCC(dio, dso, dpo);

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
    gapDays: Math.round((ccc - benchmarks.CCC) * 100) / 100,
  };
}
