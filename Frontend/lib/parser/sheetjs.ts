import * as XLSX from 'xlsx';
import { buildColumnMap, normalizeColumn } from './columnAliases';
import type {
  ColumnMap,
  DetectedFileType,
  ExpectedFileType,
  ParsedFileResult,
  ParsedInventoryItem,
  ParsedInvoice,
  ParseResult,
  ParserField,
  RawSheetRow,
} from './types';

export type {
  DetectedFileType,
  ExpectedFileType,
  ParsedFileResult,
  ParsedInventoryItem,
  ParsedInvoice,
  ParseResult,
} from './types';

type SheetMatrix = unknown[][];

interface HeaderCandidate {
  index: number;
  headers: string[];
  score: number;
}

interface SheetParseResult {
  sheetName: string;
  detectedType: DetectedFileType;
  data: ParsedInvoice[] | ParsedInventoryItem[];
  warnings: string[];
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const HEADER_SCAN_ROW_LIMIT = 25;

const INVOICE_FIELDS: ParserField[] = [
  'invoiceDate',
  'invoiceNo',
  'counterpartyName',
  'amount',
  'dueDate',
  'paymentDate',
];

const STOCK_FIELDS: ParserField[] = ['itemName', 'quantity', 'rate', 'inventoryValue'];

const FILE_TYPE_LABELS: Record<ExpectedFileType, string> = {
  SALES_REGISTER: 'Sales Register',
  PURCHASE_REGISTER: 'Purchase Register',
  STOCK_SUMMARY: 'Stock Summary',
};

export async function parseExcelFile(
  file: File,
  expectedType?: ExpectedFileType
): Promise<ParsedFileResult> {
  validateFile(file);

  const workbook = await readWorkbook(file);
  const sheetResults = parseWorkbookSheets(workbook, file.name, expectedType);

  return collapseToDataResult(sheetResults, expectedType);
}

export async function parseExcelWorkbook(file: File): Promise<ParseResult> {
  validateFile(file);

  const workbook = await readWorkbook(file);
  const sheetResults = parseWorkbookSheets(workbook, file.name);
  const result: ParseResult = {
    sales: [],
    purchases: [],
    inventory: [],
    warnings: [],
  };

  sheetResults.forEach((sheetResult) => {
    result.warnings.push(...sheetResult.warnings);

    if (sheetResult.detectedType === 'SALES_REGISTER') {
      result.sales.push(...(sheetResult.data as ParsedInvoice[]));
    } else if (sheetResult.detectedType === 'PURCHASE_REGISTER') {
      result.purchases.push(...(sheetResult.data as ParsedInvoice[]));
    } else if (sheetResult.detectedType === 'STOCK_SUMMARY') {
      result.inventory.push(...(sheetResult.data as ParsedInventoryItem[]));
    }
  });

  if (result.sales.length === 0 && result.purchases.length === 0 && result.inventory.length === 0) {
    result.warnings.push(
      'No usable rows were found. Check that your file has invoice, amount, or stock value columns.'
    );
  }

  return result;
}

function validateFile(file: File): void {
  const name = file.name.toLowerCase();
  const isSupported = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');

  if (!isSupported) {
    throw new Error('Upload an Excel or CSV file (.xlsx, .xls, or .csv).');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Each file must be 10MB or smaller.');
  }
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const data = await file.arrayBuffer();

  return XLSX.read(data, {
    type: 'array',
    cellDates: true,
    raw: false,
  });
}

function parseWorkbookSheets(
  workbook: XLSX.WorkBook,
  fileName: string,
  expectedType?: ExpectedFileType
): SheetParseResult[] {
  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    });

    if (isEmptyMatrix(matrix)) return [];

    return [parseSheetMatrix(matrix, sheetName, fileName, expectedType)];
  });
}

function parseSheetMatrix(
  matrix: SheetMatrix,
  sheetName: string,
  fileName: string,
  expectedType?: ExpectedFileType
): SheetParseResult {
  const sourceLabel = `${fileName} / ${sheetName}`;
  const warnings: string[] = [];
  const headerCandidate = findHeaderCandidate(matrix, sheetName, fileName, expectedType);

  if (!headerCandidate) {
    warnings.push(`${sourceLabel}: could not find a recognizable header row.`);
    return { sheetName, detectedType: 'UNKNOWN', data: [], warnings };
  }

  const detectedType = detectFileType(
    headerCandidate.headers,
    sheetName,
    fileName,
    expectedType
  );
  const rows = matrixToRows(matrix.slice(headerCandidate.index + 1), headerCandidate.headers);

  if (detectedType === 'UNKNOWN') {
    warnings.push(
      `${sourceLabel}: columns look like a register, but the parser could not classify it as sales, purchase, or stock.`
    );
    return { sheetName, detectedType, data: [], warnings };
  }

  const parsed = parseRowsForType(rows, detectedType, sourceLabel);

  return {
    sheetName,
    detectedType,
    data: parsed.data,
    warnings: [...warnings, ...parsed.warnings],
  };
}

function findHeaderCandidate(
  matrix: SheetMatrix,
  sheetName: string,
  fileName: string,
  expectedType?: ExpectedFileType
): HeaderCandidate | null {
  const candidates = matrix
    .slice(0, HEADER_SCAN_ROW_LIMIT)
    .map((row, index) => {
      const headers = createHeaders(row);
      const score = scoreHeaderCandidate(headers, sheetName, fileName, expectedType);

      return { index, headers, score };
    })
    .filter((candidate) => candidate.score > 0);

  candidates.sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

function scoreHeaderCandidate(
  headers: string[],
  sheetName: string,
  fileName: string,
  expectedType?: ExpectedFileType
): number {
  const nonBlankHeaders = headers.filter((header) => !isBlank(header));
  if (nonBlankHeaders.length < 2) return 0;

  const invoiceScore = scoreInvoiceColumns(buildColumnMap(headers, INVOICE_FIELDS));
  const stockScore = scoreStockColumns(buildColumnMap(headers, STOCK_FIELDS));

  if (expectedType === 'STOCK_SUMMARY') return stockScore;
  if (expectedType === 'SALES_REGISTER' || expectedType === 'PURCHASE_REGISTER') {
    return invoiceScore;
  }

  const context = normalizeColumn(`${sheetName} ${fileName} ${headers.join(' ')}`);
  const hintScore = scoreTypeHints(context, 'STOCK_SUMMARY') + scoreTypeHints(context, 'SALES_REGISTER') + scoreTypeHints(context, 'PURCHASE_REGISTER');

  return Math.max(invoiceScore, stockScore) + Math.min(hintScore, 2);
}

function detectFileType(
  headers: string[],
  sheetName: string,
  fileName: string,
  expectedType?: ExpectedFileType
): DetectedFileType {
  const invoiceMap = buildColumnMap(headers, INVOICE_FIELDS);
  const stockMap = buildColumnMap(headers, STOCK_FIELDS);
  const invoiceScore = scoreInvoiceColumns(invoiceMap);
  const stockScore = scoreStockColumns(stockMap);
  const context = normalizeColumn(`${sheetName} ${fileName} ${headers.join(' ')}`);

  if (expectedType === 'STOCK_SUMMARY' && stockScore >= 5) return 'STOCK_SUMMARY';
  if (
    (expectedType === 'SALES_REGISTER' || expectedType === 'PURCHASE_REGISTER') &&
    invoiceScore >= 6
  ) {
    return expectedType;
  }

  if (stockScore >= 5 && stockScore > invoiceScore) return 'STOCK_SUMMARY';

  if (invoiceScore >= 7) {
    const salesHintScore = scoreTypeHints(context, 'SALES_REGISTER');
    const purchaseHintScore = scoreTypeHints(context, 'PURCHASE_REGISTER');

    if (purchaseHintScore > salesHintScore) return 'PURCHASE_REGISTER';
    if (salesHintScore > purchaseHintScore) return 'SALES_REGISTER';
    if (expectedType === 'SALES_REGISTER' || expectedType === 'PURCHASE_REGISTER') return expectedType;
  }

  if (expectedType) return expectedType;

  return 'UNKNOWN';
}

function scoreInvoiceColumns(map: ColumnMap): number {
  return (
    (map.invoiceDate ? 4 : 0) +
    (map.counterpartyName ? 3 : 0) +
    (map.amount ? 4 : 0) +
    (map.invoiceNo ? 1 : 0) +
    (map.dueDate ? 1 : 0) +
    (map.paymentDate ? 1 : 0)
  );
}

function scoreStockColumns(map: ColumnMap): number {
  return (
    (map.inventoryValue ? 5 : 0) +
    (map.itemName ? 2 : 0) +
    (map.quantity ? 1 : 0) +
    (map.rate ? 1 : 0)
  );
}

function scoreTypeHints(context: string, fileType: ExpectedFileType): number {
  const tokens = context.split(' ');

  if (fileType === 'SALES_REGISTER') {
    return countHints(tokens, ['sales', 'sale', 'customer', 'buyer', 'debtor', 'receivable', 'ar']);
  }

  if (fileType === 'PURCHASE_REGISTER') {
    return countHints(tokens, ['purchase', 'purchases', 'supplier', 'vendor', 'bill', 'creditor', 'payable', 'ap']);
  }

  return countHints(tokens, ['stock', 'inventory', 'item', 'closing', 'quantity', 'qty', 'warehouse']);
}

function countHints(tokens: string[], hints: string[]): number {
  return hints.reduce((score, hint) => score + (tokens.includes(hint) ? 1 : 0), 0);
}

function createHeaders(row: unknown[]): string[] {
  const seen = new Map<string, number>();

  return row.map((cell, index) => {
    const baseHeader = stringifyCell(cell) || `Column ${index + 1}`;
    const seenCount = seen.get(baseHeader) ?? 0;
    seen.set(baseHeader, seenCount + 1);

    return seenCount === 0 ? baseHeader : `${baseHeader} ${seenCount + 1}`;
  });
}

function matrixToRows(matrix: SheetMatrix, headers: string[]): RawSheetRow[] {
  return matrix
    .map((row) => {
      const record: RawSheetRow = {};

      headers.forEach((header, index) => {
        record[header] = row[index] ?? '';
      });

      return record;
    })
    .filter((row) => Object.values(row).some((value) => !isBlank(value)));
}

function collapseToDataResult(
  sheetResults: SheetParseResult[],
  expectedType?: ExpectedFileType
): ParsedFileResult {
  const warnings = sheetResults.flatMap((sheetResult) => sheetResult.warnings);
  const selectedType = expectedType ?? pickSingleDetectedType(sheetResults);

  if (selectedType === 'SALES_REGISTER') {
    return {
      detectedType: 'SALES_REGISTER',
      data: sheetResults
        .filter((sheetResult) => sheetResult.detectedType === 'SALES_REGISTER')
        .flatMap((sheetResult) => sheetResult.data as ParsedInvoice[]),
      warnings,
    };
  }

  if (selectedType === 'PURCHASE_REGISTER') {
    return {
      detectedType: 'PURCHASE_REGISTER',
      data: sheetResults
        .filter((sheetResult) => sheetResult.detectedType === 'PURCHASE_REGISTER')
        .flatMap((sheetResult) => sheetResult.data as ParsedInvoice[]),
      warnings,
    };
  }

  if (selectedType === 'STOCK_SUMMARY') {
    return {
      detectedType: 'STOCK_SUMMARY',
      data: sheetResults
        .filter((sheetResult) => sheetResult.detectedType === 'STOCK_SUMMARY')
        .flatMap((sheetResult) => sheetResult.data as ParsedInventoryItem[]),
      warnings,
    };
  }

  return {
    detectedType: 'UNKNOWN',
    data: [],
    warnings: buildUnknownResultWarnings(warnings, sheetResults),
  };
}

function pickSingleDetectedType(sheetResults: SheetParseResult[]): DetectedFileType {
  const detectedTypes = new Set(
    sheetResults
      .filter((sheetResult) => sheetResult.data.length > 0)
      .map((sheetResult) => sheetResult.detectedType)
      .filter((detectedType): detectedType is ExpectedFileType => detectedType !== 'UNKNOWN')
  );

  if (detectedTypes.size === 1) return Array.from(detectedTypes)[0];

  return 'UNKNOWN';
}

function buildUnknownResultWarnings(
  warnings: string[],
  sheetResults: SheetParseResult[]
): string[] {
  const detectedTypes = new Set(
    sheetResults
      .filter((sheetResult) => sheetResult.data.length > 0)
      .map((sheetResult) => sheetResult.detectedType)
      .filter((detectedType): detectedType is ExpectedFileType => detectedType !== 'UNKNOWN')
  );

  if (detectedTypes.size > 1) {
    return [
      ...warnings,
      'Workbook contains multiple detected register types; call parseExcelWorkbook or pass an expected file type to parseExcelFile.',
    ];
  }

  return warnings.length > 0
    ? warnings
    : ['No recognizable sales, purchase, or stock summary columns were found.'];
}

function parseRowsForType(
  rows: RawSheetRow[],
  fileType: ExpectedFileType,
  sourceLabel: string
): ParsedFileResult {
  if (fileType === 'STOCK_SUMMARY') {
    return {
      detectedType: 'STOCK_SUMMARY',
      data: parseStockSummary(rows),
      warnings: collectStockWarnings(rows, sourceLabel),
    };
  }

  const kind = fileType === 'SALES_REGISTER' ? 'sales' : 'purchase';

  return {
    detectedType: fileType,
    data: parseInvoiceRegister(rows, kind, sourceLabel),
    warnings: collectInvoiceWarnings(rows, kind, sourceLabel),
  };
}

function parseInvoiceRegister(
  rows: RawSheetRow[],
  kind: 'sales' | 'purchase',
  sourceLabel: string
): ParsedInvoice[] {
  const headers = collectHeaders(rows);
  const columnMap = buildColumnMap(headers, INVOICE_FIELDS);

  if (!columnMap.invoiceDate || !columnMap.amount) return [];

  return rows
    .map((row, index): ParsedInvoice | null => {
      const invoiceDate = parseDate(row[columnMap.invoiceDate as string]);
      const amount = parseAmount(row[columnMap.amount as string]);

      if (!invoiceDate || amount === null || amount === 0) return null;

      const invoiceNo = columnMap.invoiceNo ? stringifyCell(row[columnMap.invoiceNo]) : '';
      const counterpartyName = columnMap.counterpartyName
        ? stringifyCell(row[columnMap.counterpartyName])
        : '';
      const dueDate = columnMap.dueDate ? parseDate(row[columnMap.dueDate]) : null;
      const paymentDate = columnMap.paymentDate ? parseDate(row[columnMap.paymentDate]) : null;

      return {
        id: buildInvoiceId(kind, sourceLabel, index, invoiceNo),
        counterpartyName: counterpartyName || defaultParty(kind, index),
        invoiceNo: invoiceNo || undefined,
        invoiceDate,
        amount: Math.abs(amount),
        dueDate: dueDate ?? addDays(invoiceDate, 30),
        paymentDate: paymentDate ?? undefined,
      };
    })
    .filter((invoice): invoice is ParsedInvoice => invoice !== null);
}

function collectInvoiceWarnings(
  rows: RawSheetRow[],
  kind: 'sales' | 'purchase',
  sourceLabel: string
): string[] {
  const warnings: string[] = [];
  const label = kind === 'sales' ? FILE_TYPE_LABELS.SALES_REGISTER : FILE_TYPE_LABELS.PURCHASE_REGISTER;
  const headers = collectHeaders(rows);
  const columnMap = buildColumnMap(headers, INVOICE_FIELDS);

  if (!columnMap.invoiceDate) {
    warnings.push(`${sourceLabel}: missing Invoice Date column for ${label}.`);
  }

  if (!columnMap.counterpartyName) {
    warnings.push(`${sourceLabel}: missing Party/Customer/Vendor column for ${label}; default names were used.`);
  }

  if (!columnMap.amount) {
    warnings.push(`${sourceLabel}: missing Amount column for ${label}.`);
  }

  if (!columnMap.dueDate) {
    warnings.push(`${sourceLabel}: missing Due Date column for ${label}; due dates defaulted to invoice date + 30 days.`);
  }

  if (!columnMap.paymentDate) {
    warnings.push(`${sourceLabel}: missing Payment Date column for ${label}; invoices without payment dates were treated as outstanding.`);
  }

  if (!columnMap.invoiceDate || !columnMap.amount) return warnings;

  const validRowCount = parseInvoiceRegister(rows, kind, sourceLabel).length;
  const skippedRowCount = rows.length - validRowCount;

  if (validRowCount === 0) {
    warnings.push(`${sourceLabel}: ${label} was detected, but no valid invoice rows could be parsed.`);
  } else if (skippedRowCount > 0) {
    warnings.push(`${sourceLabel}: skipped ${skippedRowCount} row(s) with missing invoice date or amount.`);
  }

  return warnings;
}

function parseStockSummary(rows: RawSheetRow[], dropTotalRows = true): ParsedInventoryItem[] {
  const headers = collectHeaders(rows);
  const columnMap = buildColumnMap(headers, STOCK_FIELDS);

  if (!columnMap.inventoryValue) return [];

  const items = rows
    .map((row, index): ParsedInventoryItem | null => {
      const inventoryValue = parseAmount(row[columnMap.inventoryValue as string]);
      if (inventoryValue === null) return null;

      const itemName = columnMap.itemName ? stringifyCell(row[columnMap.itemName]) : '';
      const quantity = columnMap.quantity ? parseAmount(row[columnMap.quantity]) : null;
      const rate = columnMap.rate ? parseAmount(row[columnMap.rate]) : null;

      return {
        itemName: itemName || `Item ${index + 1}`,
        inventoryValue: Math.abs(inventoryValue),
        closingValue: Math.abs(inventoryValue),
        quantity: quantity === null ? undefined : Math.abs(quantity),
        rate: rate === null ? undefined : Math.abs(rate),
        period: new Date().toISOString().split('T')[0],
      };
    })
    .filter((item): item is ParsedInventoryItem => item !== null);

  return dropTotalRows ? dropTotalRowsWhenDetailsExist(items) : items;
}

function collectStockWarnings(rows: RawSheetRow[], sourceLabel: string): string[] {
  const warnings: string[] = [];
  const headers = collectHeaders(rows);
  const columnMap = buildColumnMap(headers, STOCK_FIELDS);

  if (!columnMap.inventoryValue) {
    warnings.push(`${sourceLabel}: missing Closing Value/Inventory Value column for Stock Summary.`);
  }

  if (!columnMap.itemName) {
    warnings.push(`${sourceLabel}: missing Stock Item column for Stock Summary; default item names were used.`);
  }

  if (!columnMap.inventoryValue) return warnings;

  const validItemCount = parseStockSummary(rows, false).length;
  const skippedRowCount = rows.length - validItemCount;

  if (validItemCount === 0) {
    warnings.push(`${sourceLabel}: Stock Summary was detected, but no valid inventory rows could be parsed.`);
  } else if (skippedRowCount > 0) {
    warnings.push(`${sourceLabel}: skipped ${skippedRowCount} row(s) with missing inventory value.`);
  }

  return warnings;
}

function collectHeaders(rows: RawSheetRow[]): string[] {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date || value === null || value === undefined) return null;

  const text = String(value).trim();
  if (!text) return null;

  const isNegative = /^\(.*\)$/.test(text) || /(^-)|(-$)/.test(text);
  const cleaned = text
    .replace(/,/g, '')
    .replace(/\((.*)\)/, '$1')
    .replace(/rs\.?/gi, '')
    .replace(/inr/gi, '')
    .replace(/₹/g, '')
    .replace(/\b(dr|cr)\b/gi, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleaned) return null;

  const amount = Number.parseFloat(cleaned);
  if (!Number.isFinite(amount)) return null;

  return isNegative ? -Math.abs(amount) : amount;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return parseExcelSerialDate(value);
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (!text) return null;

  const numericValue = Number(text);
  if (Number.isFinite(numericValue) && numericValue > 1000) {
    return parseExcelSerialDate(numericValue);
  }

  const delimitedDate = parseDelimitedDate(text);
  if (delimitedDate) return delimitedDate;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseExcelSerialDate(value: number): Date | null {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;

  return new Date(parsed.y, parsed.m - 1, parsed.d);
}

function parseDelimitedDate(text: string): Date | null {
  const match = text.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (!match) return null;

  const first = Number.parseInt(match[1], 10);
  const second = Number.parseInt(match[2], 10);
  const third = Number.parseInt(match[3], 10);

  if (first > 1900) return validDateOrNull(new Date(first, second - 1, third));

  const year = third < 100 ? 2000 + third : third;
  const day = first > 12 ? first : second > 12 ? second : first;
  const month = first > 12 ? second : second > 12 ? first : second;

  return validDateOrNull(new Date(year, month - 1, day));
}

function validDateOrNull(date: Date): Date | null {
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function buildInvoiceId(
  kind: 'sales' | 'purchase',
  sourceLabel: string,
  index: number,
  invoiceNo?: string
): string {
  const sourceSlug = sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const invoiceSlug = invoiceNo
    ? invoiceNo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : `${index + 1}`;

  return `${kind}-${sourceSlug}-${invoiceSlug}`;
}

function defaultParty(kind: 'sales' | 'purchase', index: number): string {
  return kind === 'sales' ? `Customer ${index + 1}` : `Vendor ${index + 1}`;
}

function stringifyCell(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (value === null || value === undefined) return '';

  return String(value).trim();
}

function isBlank(value: unknown): boolean {
  return stringifyCell(value) === '';
}

function isEmptyMatrix(matrix: SheetMatrix): boolean {
  return matrix.every((row) => row.every((cell) => isBlank(cell)));
}

function dropTotalRowsWhenDetailsExist(items: ParsedInventoryItem[]): ParsedInventoryItem[] {
  if (items.length <= 1) return items;

  return items.filter((item) => !/^(grand\s+)?total$/i.test(item.itemName.trim()));
}

export function __sheetjsParserInlineTest(): {
  sales: ParsedFileResult;
  purchase: ParsedFileResult;
  stock: ParsedFileResult;
} {
  const salesRows: RawSheetRow[] = [
    {
      'Invoice Date': '01/04/2026',
      'Customer Name': 'Acme Retail',
      'Invoice Amount': '₹1,20,000',
      'Due Date': '30/04/2026',
      'Payment Date': '',
    },
  ];
  const purchaseRows: RawSheetRow[] = [
    {
      'Bill Date': '05/04/2026',
      'Supplier Name': 'Cotton House',
      'Bill Amount': '₹80,000',
      'Payment Due Date': '05/05/2026',
      'Paid Date': '28/04/2026',
    },
  ];
  const stockRows: RawSheetRow[] = [
    {
      'Stock Item': 'Dyed Cotton',
      'Closing Qty': '250',
      'Avg Rate': '320',
      'Closing Value': '₹80,000',
    },
  ];

  return {
    sales: parseRowsForType(salesRows, 'SALES_REGISTER', 'inline sales mock'),
    purchase: parseRowsForType(purchaseRows, 'PURCHASE_REGISTER', 'inline purchase mock'),
    stock: parseRowsForType(stockRows, 'STOCK_SUMMARY', 'inline stock mock'),
  };
}

// Expose test function to browser console in development only
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__sheetjsParserInlineTest = __sheetjsParserInlineTest;
}
