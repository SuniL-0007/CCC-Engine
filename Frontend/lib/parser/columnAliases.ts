export const COLUMN_ALIASES: Record<string, string[]> = {
  invoiceDate: [
    'Date',
    'Invoice Date',
    'Voucher Date',
    'Date of Invoice',
    'Bill Date',
    'Transaction Date',
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
  const normalized = columnName.toLowerCase().trim();
  
  return aliases.some(alias => 
    normalized === alias.toLowerCase() || 
    normalized.includes(alias.toLowerCase()) ||
    alias.toLowerCase().includes(normalized)
  );
}

export function findMatchingColumn(
  headers: string[],
  fieldKey: keyof typeof COLUMN_ALIASES
): string | undefined {
  return headers.find(header => fuzzyMatchColumn(header, fieldKey));
}
