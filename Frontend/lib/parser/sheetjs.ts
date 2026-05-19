import * as XLSX from 'xlsx';
import { ParseResult, ParsedInvoice, ParsedInventoryItem } from '@/lib/ccc-engine/types';
import { findMatchingColumn } from './columnAliases';

/**
 * Parse Excel file and extract invoice/inventory data
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Failed to read file');

        const workbook = XLSX.read(data, { type: 'array' });
        const result: ParseResult = {
          sales: [],
          purchases: [],
          inventory: [],
          warnings: [],
        };

        // Process each sheet
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

          if (rows.length === 0) return;

          const headers = Object.keys(rows[0]);
          const fileType = detectFileType(sheetName, headers);

          if (fileType === 'SALES_REGISTER') {
            result.sales = parseSalesRegister(rows, headers, result.warnings);
          } else if (fileType === 'PURCHASE_REGISTER') {
            result.purchases = parsePurchaseRegister(rows, headers, result.warnings);
          } else if (fileType === 'STOCK_SUMMARY') {
            result.inventory = parseStockSummary(rows, headers, result.warnings);
          }
        });

        if (result.sales.length === 0 && result.purchases.length === 0 && result.inventory.length === 0) {
          result.warnings.push('No valid data found in the uploaded file.');
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

/**
 * Detect file type based on sheet name and headers
 */
function detectFileType(
  sheetName: string,
  headers: string[]
): 'SALES_REGISTER' | 'PURCHASE_REGISTER' | 'STOCK_SUMMARY' | 'UNKNOWN' {
  const name = sheetName.toLowerCase();
  const headerText = headers.join(' ').toLowerCase();

  if (name.includes('sales') || headerText.includes('customer')) {
    return 'SALES_REGISTER';
  } else if (name.includes('purchase') || name.includes('bill') || headerText.includes('vendor')) {
    return 'PURCHASE_REGISTER';
  } else if (name.includes('stock') || name.includes('inventory')) {
    return 'STOCK_SUMMARY';
  }

  return 'UNKNOWN';
}

/**
 * Parse Sales Register
 */
function parseSalesRegister(
  rows: Record<string, unknown>[],
  headers: string[],
  warnings: string[]
): ParsedInvoice[] {
  const dateCol = findMatchingColumn(headers, 'invoiceDate');
  const partyCol = findMatchingColumn(headers, 'counterpartyName');
  const amountCol = findMatchingColumn(headers, 'amount');
  const dueCol = findMatchingColumn(headers, 'dueDate');
  const paymentCol = findMatchingColumn(headers, 'paymentDate');

  if (!dateCol || !amountCol) {
    warnings.push('Could not find required columns (Date, Amount) in Sales Register');
    return [];
  }

  return rows
    .map((row, idx) => {
      try {
        const invoiceDate = parseDate(row[dateCol]);
        const amount = parseFloat(String(row[amountCol]));
        
        if (!invoiceDate || isNaN(amount)) return null;
        
        const dueDate = dueCol ? parseDate(row[dueCol]) : new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const paymentDate = paymentCol && row[paymentCol] ? parseDate(row[paymentCol]) : undefined;

        return {
          id: `sales-${idx}`,
          counterpartyName: partyCol && row[partyCol] ? String(row[partyCol]) : `Customer ${idx}`,
          invoiceDate,
          amount,
          dueDate: dueDate || invoiceDate,
          paymentDate,
        };
      } catch {
        return null;
      }
    })
    .filter((inv): inv is ParsedInvoice => inv !== null);
}

/**
 * Parse Purchase Register
 */
function parsePurchaseRegister(
  rows: Record<string, unknown>[],
  headers: string[],
  warnings: string[]
): ParsedInvoice[] {
  const dateCol = findMatchingColumn(headers, 'invoiceDate');
  const partyCol = findMatchingColumn(headers, 'counterpartyName');
  const amountCol = findMatchingColumn(headers, 'amount');
  const dueCol = findMatchingColumn(headers, 'dueDate');
  const paymentCol = findMatchingColumn(headers, 'paymentDate');

  if (!dateCol || !amountCol) {
    warnings.push('Could not find required columns (Date, Amount) in Purchase Register');
    return [];
  }

  return rows
    .map((row, idx) => {
      try {
        const invoiceDate = parseDate(row[dateCol]);
        
        if (!invoiceDate || isNaN(amount)) return null;
        
        const dueDate = dueCol ? parseDate(row[dueCol]) : new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const paymentDate = paymentCol && row[paymentCol] ? parseDate(row[paymentCol]) : undefined;

        return {
          id: `purchase-${idx}`,
          counterpartyName: partyCol && row[partyCol] ? String(row[partyCol]) : `Vendor ${idx}`,
          invoiceDate,
          amount,
          dueDate: dueDate || invoicount,
          dueDate,
          paymentDate,
        };
      } catch {
        return null;
      }
    })
    .filter((inv): inv is ParsedInvoice => inv !== null);
}

/**
 * Parse Stock Summary
 */
function parseStockSummary(
  rows: Record<string, unknown>[],
  headers: string[],
  warnings: string[]
): ParsedInventoryItem[] {
  const itemCol = findMatchingColumn(headers, 'quantity') || headers[0];
  const valueCol = findMatchingColumn(headers, 'inventoryValue');

  if (!valueCol) {
    warnings.push('Could not find Closing Value column in Stock Summary');
    return [];
  }

  return rows
    .map((row, idx) => {
      try {
        const closingValue = parseFloat(String(row[valueCol]));

        if (isNaN(closingValue)) return null;

        return {
          itemName: itemCol && row[itemCol] ? String(row[itemCol]) : `Item ${idx}`,
          closingValue,
          period: new Date().toISOString().split('T')[0],
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is ParsedInventoryItem => item !== null);
}

/**
 * Parse date from various formats
 */
function parseDate(value: unknown): Date | null {
  if (!value) return null;

  if (typeof value === 'number') {
    // Excel serial date
    const date = new Date((value - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}
