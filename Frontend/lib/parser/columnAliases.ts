export const COLUMN_ALIASES: Record<string, string[]> = {
  invoiceDate: [
    'Date',
    'Invoice Date',
    'Voucher Date',
    'Date of Invoice',
    'Bill Date',
    'Transaction Date',
  ],
  invoiceNo: [
    'Invoice No',
    'Invoice Number',
    'Voucher No',
    'Bill No',
    'Reference No',
    'Ref No',
  ],
  counterpartyName: [
    'Party Name',
    "Party's Name",
    'Customer',
    'Vendor',
    'Supplier Name',
    'Party',
    'Counterparty',
    'Customer Name',
    'Vendor Name',
  ],
  amount: [
    'Gross Total',
    'Amount',
    'Net Amount',
    'Total',
    'Bill Amount',
    'Invoice Amount',
    'Sales Amount',
    'Purchase Amount',
    'Grand Total',
    'Debit',
    'Credit',
  ],
  dueDate: [
    'Due Date',
    'Payment Due',
    'Due On',
    'Credit Period End',
    'Due Date',
    'Payment Due Date',
  ],
  paymentDate: [
    'Payment Date',
    'Paid Date',
    'Settlement Date',
    'Cheque Date',
    'Payment Cleared Date',
  ],
  inventoryValue: [
    'Closing Value',
    'Stock Value',
    'Inventory Value',
    'Balance Value',
    'Closing Balance Value',
    'Stock Balance Value',
    'Value',
  ],
  itemName: [
    'Stock Item',
    'Item Name',
    'Item',
    'Particulars',
    'Product',
    'Description',
  ],
  quantity: [
    'Closing Balance',
    'Qty',
    'Quantity',
    'Units',
    'Closing Qty',
  ],
  rate: [
    'Rate',
    'Unit Rate',
    'Price',
    'Unit Price',
  ],
};

export function fuzzyMatchColumn(columnName: string, fieldKey: keyof typeof COLUMN_ALIASES): boolean {
  const aliases = COLUMN_ALIASES[fieldKey];
  const normalized = normalizeColumn(columnName);
  
  return aliases.some(alias => 
    normalized === normalizeColumn(alias) || 
    normalized.includes(normalizeColumn(alias)) ||
    normalizeColumn(alias).includes(normalized)
  );
}

export function findMatchingColumn(
  headers: string[],
  fieldKey: keyof typeof COLUMN_ALIASES
): string | undefined {
  return headers.find(header => fuzzyMatchColumn(header, fieldKey));
}

function normalizeColumn(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
