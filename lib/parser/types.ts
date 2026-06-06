export type ExpectedFileType = 'SALES_REGISTER' | 'PURCHASE_REGISTER' | 'STOCK_SUMMARY';
export type DetectedFileType = ExpectedFileType | 'UNKNOWN';

export type ParserField =
  | 'invoiceDate'
  | 'invoiceNo'
  | 'counterpartyName'
  | 'amount'
  | 'dueDate'
  | 'paymentDate'
  | 'inventoryValue'
  | 'itemName'
  | 'quantity'
  | 'rate';

export type ColumnMap = Partial<Record<ParserField, string>>;

export type RawSheetRow = Record<string, unknown>;

export interface ParsedInvoice {
  id: string;
  counterpartyName: string;
  invoiceNo: string | null;
  invoiceDate: Date;
  amount: number;
  dueDate: Date;
  paymentDate: Date | null;
}

export interface ParsedInventoryItem {
  itemName: string;
  inventoryValue: number;
  closingValue: number;
  quantity?: number;
  rate?: number;
  period: string;
}

export interface ParseResult {
  sales: ParsedInvoice[];
  purchases: ParsedInvoice[];
  inventory: ParsedInventoryItem[];
  warnings: string[];
}

export interface ParsedDataResult<TData extends ParsedInvoice[] | ParsedInventoryItem[] | []> {
  detectedType: DetectedFileType;
  data: TData;
  warnings: string[];
}

export type ParsedSalesRegisterResult = ParsedDataResult<ParsedInvoice[]> & {
  detectedType: 'SALES_REGISTER';
};

export type ParsedPurchaseRegisterResult = ParsedDataResult<ParsedInvoice[]> & {
  detectedType: 'PURCHASE_REGISTER';
};

export type ParsedStockSummaryResult = ParsedDataResult<ParsedInventoryItem[]> & {
  detectedType: 'STOCK_SUMMARY';
};

export type ParsedUnknownResult = ParsedDataResult<[]> & {
  detectedType: 'UNKNOWN';
};

export type ParsedFileResult =
  | ParsedSalesRegisterResult
  | ParsedPurchaseRegisterResult
  | ParsedStockSummaryResult
  | ParsedUnknownResult;
