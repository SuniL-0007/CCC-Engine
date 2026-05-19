import * as XLSX from 'xlsx';
import { ParseResult, ParsedInventoryItem, ParsedInvoice } from '@/lib/ccc-engine/types';
import { findMatchingColumn } from './columnAliases';

export type ExpectedFileType = 'SALES_REGISTER' | 'PURCHASE_REGISTER' | 'STOCK_SUMMARY';

type Row = Record<string, unknown>;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function parseExcelFile(
  file: File,
  expectedType?: ExpectedFileType
): Promise<ParseResult> {
  validateFile(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) throw new Error('Failed to read file');

        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          raw: false,
        });

        const result: ParseResult = {
          sales: [],
          purchases: [],
          inventory: [],
          warnings: [],
        };

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
            defval: '',
            raw: false,
          });

          if (rows.length === 0) return;

          const headers = Object.keys(rows[0]);
          const fileType = detectFileType(sheetName, headers, file.name, expectedType);

          if (fileType === 'SALES_REGISTER') {
            result.sales.push(...parseInvoiceRegister(rows, headers, 'sales', result.warnings));
          } else if (fileType === 'PURCHASE_REGISTER') {
            result.purchases.push(...parseInvoiceRegister(rows, headers, 'purchase', result.warnings));
          } else if (fileType === 'STOCK_SUMMARY') {
            result.inventory.push(...parseStockSummary(rows, headers, result.warnings));
          }
        });

        if (result.sales.length === 0 && result.purchases.length === 0 && result.inventory.length === 0) {
          result.warnings.push(
            'No usable rows were found. Check that your file has Date, Party Name, Amount, or Closing Value columns.'
          );
        }

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
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

function detectFileType(
  sheetName: string,
  headers: string[],
  fileName: string,
  expectedType?: ExpectedFileType
): ExpectedFileType | 'UNKNOWN' {
  const haystack = `${sheetName} ${fileName} ${headers.join(' ')}`.toLowerCase();
  const hasAmountColumns = Boolean(
    findMatchingColumn(headers, 'invoiceDate') && findMatchingColumn(headers, 'amount')
  );
  const hasInventoryColumns = Boolean(findMatchingColumn(headers, 'inventoryValue'));

  if (haystack.includes('stock') || haystack.includes('inventory') || hasInventoryColumns) {
    return 'STOCK_SUMMARY';
  }

  if (
    haystack.includes('purchase') ||
    haystack.includes('bill') ||
    haystack.includes('supplier') ||
    haystack.includes('vendor')
  ) {
    return 'PURCHASE_REGISTER';
  }

  if (
    haystack.includes('sales') ||
    haystack.includes('sale ') ||
    haystack.includes('customer') ||
    haystack.includes('debtor')
  ) {
    return 'SALES_REGISTER';
  }

  if (expectedType && (hasAmountColumns || hasInventoryColumns)) {
    return expectedType;
  }

  return 'UNKNOWN';
}

function parseInvoiceRegister(
  rows: Row[],
  headers: string[],
  kind: 'sales' | 'purchase',
  warnings: string[]
): ParsedInvoice[] {
  const dateCol = findMatchingColumn(headers, 'invoiceDate');
  const invoiceNoCol = findMatchingColumn(headers, 'invoiceNo');
  const partyCol = findMatchingColumn(headers, 'counterpartyName');
  const amountCol = findMatchingColumn(headers, 'amount');
  const dueCol = findMatchingColumn(headers, 'dueDate');
  const paymentCol = findMatchingColumn(headers, 'paymentDate');
  const label = kind === 'sales' ? 'Sales Register' : 'Purchase Register';

  if (!dateCol || !amountCol) {
    warnings.push(`Could not find Date and Amount columns in ${label}.`);
    return [];
  }

  const invoices = rows
    .map((row, index): ParsedInvoice | null => {
      const invoiceDate = parseDate(row[dateCol]);
      const amount = parseAmount(row[amountCol]);

      if (!invoiceDate || amount === null || amount <= 0) return null;

      const dueDate = dueCol ? parseDate(row[dueCol]) : null;
      const paymentDate = paymentCol ? parseDate(row[paymentCol]) : null;

      const invoice: ParsedInvoice = {
        id: `${kind}-${index}-${invoiceNoCol ? String(row[invoiceNoCol] || index) : index}`,
        counterpartyName: partyCol && row[partyCol] ? String(row[partyCol]).trim() : defaultParty(kind, index),
        invoiceDate,
        amount,
        dueDate: dueDate ?? addDays(invoiceDate, 30),
        paymentDate: paymentDate ?? undefined,
      };

      if (invoiceNoCol && row[invoiceNoCol]) {
        invoice.invoiceNo = String(row[invoiceNoCol]).trim();
      }

      return invoice;
    })
    .filter((invoice): invoice is ParsedInvoice => invoice !== null);

  if (invoices.length === 0) {
    warnings.push(`${label} was detected, but no valid invoice rows could be parsed.`);
  }

  return invoices;
}

function parseStockSummary(
  rows: Row[],
  headers: string[],
  warnings: string[]
): ParsedInventoryItem[] {
  const itemCol = findMatchingColumn(headers, 'itemName') ?? headers[0];
  const valueCol = findMatchingColumn(headers, 'inventoryValue');
  const quantityCol = findMatchingColumn(headers, 'quantity');
  const rateCol = findMatchingColumn(headers, 'rate');

  if (!valueCol) {
    warnings.push('Could not find a Closing Value column in Stock Summary.');
    return [];
  }

  const items = rows
    .map((row, index): ParsedInventoryItem | null => {
      const closingValue = parseAmount(row[valueCol]);
      if (closingValue === null || closingValue < 0) return null;

      const quantity = quantityCol ? parseAmount(row[quantityCol]) ?? undefined : undefined;
      const rate = rateCol ? parseAmount(row[rateCol]) ?? undefined : undefined;

      const item: ParsedInventoryItem = {
        itemName: itemCol && row[itemCol] ? String(row[itemCol]).trim() : `Item ${index + 1}`,
        closingValue,
        period: new Date().toISOString().split('T')[0],
      };

      if (quantity !== undefined) item.quantity = quantity;
      if (rate !== undefined) item.rate = rate;

      return item;
    })
    .filter((item): item is ParsedInventoryItem => item !== null);

  if (items.length === 0) {
    warnings.push('Stock Summary was detected, but no valid inventory rows could be parsed.');
  }

  return items;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return null;
  if (value === null || value === undefined) return null;

  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/rs\.?/gi, '')
    .replace(/inr/gi, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleaned) return null;

  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? Math.abs(amount) : null;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  const text = String(value).trim();
  if (!text) return null;

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const first = Number.parseInt(slashMatch[1], 10);
    const second = Number.parseInt(slashMatch[2], 10);
    const yearPart = Number.parseInt(slashMatch[3], 10);
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    const parsed = new Date(year, month - 1, day);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function defaultParty(kind: 'sales' | 'purchase', index: number): string {
  return kind === 'sales' ? `Customer ${index + 1}` : `Vendor ${index + 1}`;
}
