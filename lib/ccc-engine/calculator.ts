import type { ParsedInventoryItem, ParsedInvoice } from '@/lib/parser/types';
import benchmarks from './benchmarks.json';
import type { CCCResult, ComponentResult } from './types';

const TEXTILE_COGS_RATIO = 0.65;

export function calculateDIO(
  inventory: ParsedInventoryItem[],
  sales: ParsedInvoice[],
  periodDays: number
): ComponentResult {
  const benchmark = benchmarks.textile.dio;

  if (inventory.length === 0) {
    return createComponentResult(0, benchmark, 0);
  }

  const avgInventoryValue =
    inventory.reduce((sum, item) => sum + item.inventoryValue, 0) / inventory.length;
  const directCOGS = sumDirectCOGS(sales);
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalCOGS = directCOGS ?? totalRevenue * TEXTILE_COGS_RATIO;
  const dataCompleteness = directCOGS === null ? 0.8 : 1;

  if (totalCOGS === 0 || periodDays <= 0) {
    return createComponentResult(0, benchmark, dataCompleteness);
  }

  return createComponentResult(avgInventoryValue / (totalCOGS / periodDays), benchmark, dataCompleteness);
}

export function calculateDSO(
  arInvoices: ParsedInvoice[],
  revenue: number,
  periodDays: number
): ComponentResult {
  const benchmark = benchmarks.textile.dso;

  if (revenue === 0 || periodDays <= 0) {
    return createComponentResult(0, benchmark, 0.5);
  }

  const unpaidInvoices = arInvoices.filter((invoice) => invoice.paymentDate === null);
  const avgARBalance = unpaidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const dataCompleteness = arInvoices.length > 0 ? 1 : 0.5;

  return createComponentResult(avgARBalance / (revenue / periodDays), benchmark, dataCompleteness);
}

export function calculateDPO(
  apInvoices: ParsedInvoice[],
  cogs: number,
  periodDays: number
): ComponentResult {
  const benchmark = benchmarks.textile.dpo;

  if (cogs === 0 || periodDays <= 0) {
    return createComponentResult(0, benchmark, 0.5);
  }

  const outstandingInvoices = apInvoices.filter((invoice) => invoice.paymentDate === null);
  const avgAPBalance = outstandingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const dataCompleteness = apInvoices.length > 0 ? 1 : 0.5;

  return createComponentResult(avgAPBalance / (cogs / periodDays), benchmark, dataCompleteness);
}

export function calculateCCC(
  dio: ComponentResult,
  dso: ComponentResult,
  dpo: ComponentResult,
  periodDays: number,
  revenue?: number
): CCCResult {
  const ccc = dio.value + dso.value - dpo.value;
  const benchmarkCCC = benchmarks.textile.ccc;
  const dailyRevenueLakhs =
    revenue !== undefined && Number.isFinite(revenue) && revenue > 0 && periodDays > 0
      ? Math.round((revenue / periodDays / 100000) * 100) / 100
      : undefined;

  return {
    dio,
    dso,
    dpo,
    ccc,
    benchmarkCCC,
    gapDays: Math.round(ccc - benchmarkCCC),
    periodDays,
    calculatedAt: new Date(),
    ...(dailyRevenueLakhs !== undefined ? { dailyRevenueLakhs } : {}),
  };
}

function createComponentResult(
  rawValue: number,
  benchmark: number,
  dataCompleteness: number
): ComponentResult {
  const value = Number.isFinite(rawValue) ? Math.round(rawValue * 10) / 10 : 0;

  return {
    value,
    benchmark,
    gapDays: Math.round(value - benchmark),
    trendDelta: 0,
    dataCompleteness,
  };
}

function sumDirectCOGS(sales: ParsedInvoice[]): number | null {
  let totalCOGS = 0;
  let hasDirectCOGS = false;

  sales.forEach((sale) => {
    if ('cogs' in sale && typeof sale.cogs === 'number' && Number.isFinite(sale.cogs)) {
      totalCOGS += sale.cogs;
      hasDirectCOGS = true;
    }
  });

  return hasDirectCOGS ? totalCOGS : null;
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as Window & { __cccTest?: () => CCCResult }).__cccTest = () => {
    const mockInventory = [
      {
        itemName: 'Cotton Knit',
        description: 'Cotton Knit',
        inventoryValue: 500000,
        closingValue: 500000,
        period: '2026-Q1',
      },
    ];
    const mockSales = [
      {
        id: 'S1',
        amount: 200000,
        invoiceDate: new Date('2026-01-01'),
        paymentDate: new Date('2026-02-01'),
        dueDate: new Date('2026-02-01'),
        counterpartyName: 'Buyer A',
        invoiceNo: null,
      },
    ];
    const mockAR = [
      {
        id: 'AR1',
        amount: 150000,
        invoiceDate: new Date('2026-01-01'),
        paymentDate: null,
        dueDate: new Date('2026-02-01'),
        counterpartyName: 'Reliance Retail',
        invoiceNo: null,
      },
      {
        id: 'AR2',
        amount: 90000,
        invoiceDate: new Date('2026-02-01'),
        paymentDate: null,
        dueDate: new Date('2026-03-01'),
        counterpartyName: 'Myntra',
        invoiceNo: null,
      },
    ];
    const mockAP = [
      {
        id: 'AP1',
        amount: 80000,
        invoiceDate: new Date('2026-01-01'),
        paymentDate: null,
        dueDate: new Date('2026-02-15'),
        counterpartyName: 'Cotton Supplier',
        invoiceNo: null,
      },
    ];

    const dio = calculateDIO(mockInventory, mockSales, 90);
    const dso = calculateDSO(mockAR, 200000, 90);
    const dpo = calculateDPO(mockAP, 130000, 90);
    const result = calculateCCC(dio, dso, dpo, 90);

    console.log('--- CCC ENGINE TEST ---');
    console.log(
      `DIO : ${dio.value.toFixed(1)} days | benchmark: ${dio.benchmark} | gap: ${dio.gapDays.toFixed(1)}`
    );
    console.log(
      `DSO : ${dso.value.toFixed(1)} days | benchmark: ${dso.benchmark} | gap: ${dso.gapDays.toFixed(1)}`
    );
    console.log(
      `DPO : ${dpo.value.toFixed(1)} days | benchmark: ${dpo.benchmark} | gap: ${dpo.gapDays.toFixed(1)}`
    );
    console.log(
      `CCC : ${result.ccc.toFixed(1)} days | benchmark: ${result.benchmarkCCC} | gap: ${result.gapDays.toFixed(1)}`
    );
    console.log(
      `Check: DIO(${dio.value.toFixed(1)}) + DSO(${dso.value.toFixed(1)}) - DPO(${dpo.value.toFixed(1)}) = ${(dio.value + dso.value - dpo.value).toFixed(1)}`
    );

    const { evaluateLayer1 } = require('../recommendations/layer1Rules');
    const candidates = evaluateLayer1(result);
    console.log(
      `Layer 1 fired ${candidates.length} rules:`,
      candidates.map((candidate: any) => `${candidate.id}(${candidate.title})`)
    );
    console.log('--- END TEST ---');
    return result;
  };
}
