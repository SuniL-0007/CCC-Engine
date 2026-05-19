export type MetricDimension = 'DIO' | 'DSO' | 'DPO' | 'CCC';

export interface ParsedInvoice {
  id: string;
  counterpartyName: string;
  invoiceNo?: string;
  invoiceDate: Date;
  amount: number;
  dueDate: Date;
  paymentDate?: Date;
}

export interface ParsedInventoryItem {
  itemName: string;
  closingValue: number;
  quantity?: number;
  rate?: number;
  period: string;
}

export interface ParsedSalesRecord {
  counterpartyName: string;
  invoiceDate: Date;
  amount: number;
}

export interface DIOMetric {
  value: number;
  trendDelta: number;
  benchmark: number;
}

export interface DSOMetric {
  value: number;
  trendDelta: number;
  benchmark: number;
}

export interface DPOMetric {
  value: number;
  trendDelta: number;
  benchmark: number;
}

export interface CCCResult {
  dio: DIOMetric;
  dso: DSOMetric;
  dpo: DPOMetric;
  ccc: number;
  benchmarkCCC: number;
  gapDays: number;
  periodDays: number;
  estimatedCashLockedLakhs: number;
  summary: CCCSummary;
  generatedAt: string;
  warnings: string[];
  recommendations?: Recommendation[];
}

export interface Recommendation {
  id: string;
  dimension: MetricDimension;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  explanation: string;
  actionSteps: string[];
  estimatedDaysReduction: number;
  estimatedCashFreedLakhs: number;
}

export interface CompanyContext {
  fabricTypes: string[];
  buyerTypes: string[];
  month: number;
  revenueRange: string;
  companyName?: string;
  city?: string;
  dataSource?: string;
}

export interface RecommendationCandidate {
  id: string;
  dimension: MetricDimension;
  priority: number;
  title: string;
  estimatedDays: number;
}

export interface CCCSummary {
  totalSales: number;
  totalPurchases: number;
  totalInventory: number;
  outstandingAR: number;
  outstandingAP: number;
  cogs: number;
}

export interface ParseResult {
  sales: ParsedInvoice[];
  purchases: ParsedInvoice[];
  inventory: ParsedInventoryItem[];
  warnings: string[];
}
