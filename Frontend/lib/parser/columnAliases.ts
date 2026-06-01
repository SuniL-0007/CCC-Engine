import type { ColumnMap, ParserField } from './types';

export const COLUMN_ALIASES: Record<ParserField, string[]> = {
  invoiceDate: [
    'Date',
    'Invoice Date',
    'Voucher Date',
    'Bill Date',
    'Transaction Date',
    'Posting Date',
    'Document Date',
    'Inv Date',
  ],
  invoiceNo: [
    'invoiceNo',
    'Invoice No',
    'Vch No.',
    'Voucher No',
    'Invoice Number',
    'Voucher Number',
    'Bill No',
    'Reference No',
    'Ref No',
    'Document No',
  ],
  counterpartyName: [
    'Party Name',
    "Party's Name",
    'Customer Name',
    'Customer',
    'Vendor Name',
    'Supplier Name',
    'Account Name',
    'Buyer Name',
  ],
  amount: [
    'Amount',
    'Gross Total',
    'Net Amount',
    'Invoice Amount',
    'Bill Amount',
    'Total',
    'Grand Total',
    'Taxable Amount',
  ],
  dueDate: [
    'Due Date',
    'Payment Due',
    'Payment Due Date',
    'Due On',
    'Expected Date',
    'Credit Due Date',
    'Bill Due Date',
  ],
  paymentDate: [
    'Payment Date',
    'Paid Date',
    'Settlement Date',
    'Receipt Date',
    'Cheque Date',
    'Cleared Date',
    'Collection Date',
  ],
  inventoryValue: [
    'Closing Value',
    'Stock Value',
    'Inventory Value',
    'Balance Value',
    'Closing Balance Value',
    'Closing Amount',
    'Stock Amount',
    'Value',
  ],
  itemName: [
    'Stock Item',
    'Stock Item Name',
    'Item Name',
    'Item',
    'Product Name',
    'Product',
    'Description',
    'Particulars',
  ],
  quantity: [
    'Closing Balance',
    'Closing Qty',
    'Closing Quantity',
    'Qty',
    'Quantity',
    'Units',
    'Balance Qty',
    'Stock Qty',
  ],
  rate: [
    'Rate',
    'Unit Rate',
    'Price',
    'Unit Price',
    'Average Rate',
    'Avg Rate',
  ],
};

const MIN_MATCH_SCORE = 60;

const FIELD_EXCLUSIONS: Partial<Record<ParserField, string[]>> = {
  invoiceDate: ['due', 'payment', 'paid', 'settlement', 'cheque', 'cleared', 'collection'],
  dueDate: ['invoice', 'voucher', 'transaction', 'posting', 'document', 'paid', 'settlement'],
  paymentDate: ['invoice', 'voucher', 'bill', 'due', 'transaction', 'posting', 'document'],
};

export function buildColumnMap(
  headers: string[],
  fields: ParserField[] = Object.keys(COLUMN_ALIASES) as ParserField[]
): ColumnMap {
  const candidates = fields.flatMap((field) =>
    headers.map((header) => ({
      field,
      header,
      score: getColumnMatchScore(header, field),
    }))
  );

  candidates.sort((a, b) => b.score - a.score);

  const map: ColumnMap = {};
  const usedHeaders = new Set<string>();

  candidates.forEach(({ field, header, score }) => {
    if (score < MIN_MATCH_SCORE || map[field] || usedHeaders.has(header)) return;

    map[field] = header;
    usedHeaders.add(header);
  });

  return map;
}

export function findMatchingColumn(headers: string[], fieldKey: ParserField): string | undefined {
  return buildColumnMap(headers, [fieldKey])[fieldKey];
}

export function fuzzyMatchColumn(columnName: string, fieldKey: ParserField): boolean {
  return getColumnMatchScore(columnName, fieldKey) >= MIN_MATCH_SCORE;
}

export function getColumnMatchScore(columnName: string, fieldKey: ParserField): number {
  const normalizedHeader = normalizeColumn(columnName);
  if (!normalizedHeader) return 0;

  const headerTokens = normalizedHeader.split(' ');
  const exclusions = FIELD_EXCLUSIONS[fieldKey] ?? [];
  if (exclusions.some((token) => headerTokens.includes(token))) return 0;

  return COLUMN_ALIASES[fieldKey].reduce((bestScore, alias) => {
    const normalizedAlias = normalizeColumn(alias);
    const aliasTokens = normalizedAlias.split(' ');

    if (normalizedHeader === normalizedAlias) return Math.max(bestScore, 100);

    if (normalizedHeader.includes(normalizedAlias) && normalizedAlias.length >= 4) {
      return Math.max(bestScore, 92);
    }

    if (normalizedAlias.includes(normalizedHeader) && normalizedHeader.length >= 4) {
      return Math.max(bestScore, 82);
    }

    const matchedAliasTokens = aliasTokens.filter((token) => headerTokens.includes(token)).length;
    const tokenScore = (matchedAliasTokens / aliasTokens.length) * 76;
    const typoScore =
      normalizedAlias.length >= 5 && normalizedHeader.length >= 5
        ? scoreByEditDistance(normalizedHeader, normalizedAlias)
        : 0;

    return Math.max(bestScore, tokenScore, typoScore);
  }, 0);
}

export function normalizeColumn(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function scoreByEditDistance(left: string, right: string): number {
  const distance = levenshtein(left, right);
  const longest = Math.max(left.length, right.length);
  const similarity = longest === 0 ? 0 : 1 - distance / longest;

  return similarity >= 0.82 ? similarity * 78 : 0;
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const insertion = previous[rightIndex] + 1;
      const deletion = previous[rightIndex - 1] + 1;
      const substitution = diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);

      diagonal = previous[rightIndex];
      previous[rightIndex] = Math.min(insertion, deletion, substitution);
    }
  }

  return previous[right.length];
}
