'use client';

import { useMemo, useState } from 'react';
import type { CCCResult, Layer1Candidate, Recommendation } from '@/lib/ccc-engine/types';
import { calculateCCC, calculateDIO, calculateDPO, calculateDSO } from '@/lib/ccc-engine/calculator';
import { parseExcelFile, parseExcelWorkbook } from '@/lib/parser/sheetjs';
import { evaluateLayer1 } from '@/lib/recommendations/layer1Rules';
import type { ExpectedFileType, ParseResult } from '@/lib/parser/types';

type UploadKey = 'sales' | 'purchase' | 'stock';
type UploadedFiles = Record<UploadKey, File | null>;

const EMPTY_FILES: UploadedFiles = {
  sales: null,
  purchase: null,
  stock: null,
};

const SLOT_CONFIG: Array<{
  key: UploadKey;
  expectedType: ExpectedFileType;
  name: string;
  helper: string;
}> = [
  {
    key: 'sales',
    expectedType: 'SALES_REGISTER',
    name: 'Sales Register',
    helper: 'Customer invoices and due dates',
  },
  {
    key: 'purchase',
    expectedType: 'PURCHASE_REGISTER',
    name: 'Purchase Register',
    helper: 'Vendor bills and payment dates',
  },
  {
    key: 'stock',
    expectedType: 'STOCK_SUMMARY',
    name: 'Stock Summary',
    helper: 'Closing stock value and quantity',
  },
];

const SOFTWARE_BADGES = ['Tally', 'Zoho Books', 'Busy', 'Excel'];

export function UploadWidget({ onResultsReady }: { onResultsReady: (result: CCCResult, recommendations: Recommendation[]) => void }) {
  const [isDragging, setIsDragging] = useState<UploadKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>(EMPTY_FILES);
  const [error, setError] = useState<string | null>(null);
  const uploadedCount = useMemo(
    () => Object.values(uploadedFiles).filter(Boolean).length,
    [uploadedFiles]
  );

  const handleSlotFiles = async (slotKey: UploadKey, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    try {
      setError(null);
      const files = Array.from(fileList);

      if (files.length === 1) {
        const file = files[0];
        const completeWorkbook = await tryProcessCompleteWorkbook(file);

        if (completeWorkbook) return;

        const nextFiles = { ...uploadedFiles, [slotKey]: file };
        setUploadedFiles(nextFiles);
        return;
      }

      const nextFiles = classifyDroppedFiles(files, uploadedFiles, slotKey);
      setUploadedFiles(nextFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files.');
      setIsLoading(false);
    }
  };

  const tryProcessCompleteWorkbook = async (file: File): Promise<boolean> => {
    setIsLoading(true);

    try {
      const parsed = await parseExcelWorkbook(file);
      const isComplete =
        parsed.sales.length > 0 && parsed.purchases.length > 0 && parsed.inventory.length > 0;

      if (!isComplete) return false;

      setUploadedFiles({ sales: file, purchase: file, stock: file });
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const processFiles = async (files: UploadedFiles) => {
    if (!hasAllFiles(files)) return;

    setIsLoading(true);

    try {
      const [salesResult, purchaseResult, stockResult] = await Promise.all([
        parseExcelFile(files.sales, 'SALES_REGISTER'),
        parseExcelFile(files.purchase, 'PURCHASE_REGISTER'),
        parseExcelFile(files.stock, 'STOCK_SUMMARY'),
      ]);

      await finishParse({
        sales: salesResult.detectedType === 'SALES_REGISTER' ? salesResult.data : [],
        purchases: purchaseResult.detectedType === 'PURCHASE_REGISTER' ? purchaseResult.data : [],
        inventory: stockResult.detectedType === 'STOCK_SUMMARY' ? stockResult.data : [],
        warnings: [...salesResult.warnings, ...purchaseResult.warnings, ...stockResult.warnings],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const finishParse = async (parseResult: ParseResult) => {
    const result = createCCCResult(parseResult);
    const layer1Candidates = evaluateLayer1(result);
    const recommendations = await fetchRecommendations(result, layer1Candidates);
    onResultsReady(result, recommendations);
  };

  return (
    <div data-upload-widget className="space-y-5">
      <div className="flex flex-wrap justify-center gap-2">
        {SOFTWARE_BADGES.map((badge) => (
          <span
            key={badge}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
          >
            {badge}
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            Parsing your data in this browser...
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SLOT_CONFIG.map((slot) => (
          <UploadSlot
            key={slot.key}
            slotKey={slot.key}
            name={slot.name}
            helper={slot.helper}
            file={uploadedFiles[slot.key]}
            isDragging={isDragging === slot.key}
            onDragEnter={() => setIsDragging(slot.key)}
            onDragLeave={() => setIsDragging(null)}
            onDrop={(files) => {
              setIsDragging(null);
              void handleSlotFiles(slot.key, files);
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void processFiles(uploadedFiles)}
          disabled={isLoading || !hasAllFiles(uploadedFiles)}
          className="btn-primary min-h-11 flex-1"
        >
          {isLoading ? 'Processing...' : 'Calculate CCC'}
        </button>
        <button
          type="button"
          onClick={() => {
            setUploadedFiles(EMPTY_FILES);
            setError(null);
          }}
          disabled={isLoading || uploadedCount === 0}
          className="btn-secondary min-h-11 sm:w-36"
        >
          Clear
        </button>
      </div>
      <p className="text-center text-sm text-slate-500">
        Your files are processed entirely in your browser. No data is uploaded.
      </p>
    </div>
  );
}

function UploadSlot({
  slotKey,
  name,
  helper,
  file,
  isDragging,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  slotKey: UploadKey;
  name: string;
  helper: string;
  file: File | null;
  isDragging: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (files: FileList | null) => void;
}) {
  return (
    <label
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.files);
      }}
      onDragOver={(event) => event.preventDefault()}
      className={`relative block min-h-40 cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 bg-white hover:border-primary'
      } ${file ? 'border-green-500 bg-green-50' : ''}`}
    >
      <input
        type="file"
        accept=".xlsx,.csv"
        aria-label={`Upload ${name}`}
        onChange={(event) => onDrop(event.target.files)}
        className="hidden"
      />

      <div className="flex h-full flex-col items-center justify-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-primary">
          {slotKey === 'stock' ? 'ST' : slotKey === 'sales' ? 'AR' : 'AP'}
        </div>
        {file ? (
          <div className="max-w-full">
            <p className="truncate text-sm font-semibold text-green-700">{file.name}</p>
            <p className="text-xs text-slate-600">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-slate-800">{name}</p>
            <p className="text-xs text-slate-500">{helper}</p>
            <p className="mt-2 text-xs font-medium text-primary">Drag here or click</p>
          </div>
        )}
      </div>
    </label>
  );
}

function hasAllFiles(files: UploadedFiles): files is Record<UploadKey, File> {
  return Boolean(files.sales && files.purchase && files.stock);
}

function classifyDroppedFiles(
  files: File[],
  currentFiles: UploadedFiles,
  fallbackSlot: UploadKey
): UploadedFiles {
  const nextFiles = { ...currentFiles };

  files.forEach((file) => {
    const name = file.name.toLowerCase();
    if (name.includes('sales') || name.includes('sale') || name.includes('customer')) {
      nextFiles.sales = file;
    } else if (name.includes('purchase') || name.includes('bill') || name.includes('vendor')) {
      nextFiles.purchase = file;
    } else if (name.includes('stock') || name.includes('inventory')) {
      nextFiles.stock = file;
    } else {
      nextFiles[fallbackSlot] = file;
    }
  });

  return nextFiles;
}

function createCCCResult(parseResult: ParseResult): CCCResult {
  const periodDays = inferPeriodDays(parseResult);
  const revenue = parseResult.sales.reduce((sum, invoice) => sum + invoice.amount, 0);
  const purchaseCOGS = parseResult.purchases.reduce((sum, invoice) => sum + invoice.amount, 0);
  const cogs = purchaseCOGS > 0 ? purchaseCOGS : revenue * 0.65;
  const dio = calculateDIO(parseResult.inventory, parseResult.sales, periodDays);
  const dso = calculateDSO(parseResult.sales, revenue, periodDays);
  const dpo = calculateDPO(parseResult.purchases, cogs, periodDays);

  return calculateCCC(dio, dso, dpo, periodDays);
}

function inferPeriodDays(parseResult: ParseResult): number {
  const timestamps = [...parseResult.sales, ...parseResult.purchases]
    .map((invoice) => invoice.invoiceDate.getTime())
    .filter((timestamp) => Number.isFinite(timestamp));

  if (timestamps.length < 2) return 90;

  const rawDays = Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / 86400000) + 1;

  if (rawDays <= 30) return 30;
  if (rawDays <= 60) return 60;
  return 90;
}

function serializeCCCResult(cccResult: CCCResult) {
  return {
    ...cccResult,
    calculatedAt: cccResult.calculatedAt.toISOString(),
  };
}

async function fetchRecommendations(
  cccResult: CCCResult,
  layer1Candidates: Layer1Candidate[]
): Promise<Recommendation[]> {
  try {
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cccResult: serializeCCCResult(cccResult),
        layer1Candidates,
      }),
    });

    const payload = (await response.json()) as { recommendations?: Recommendation[]; error?: string };

    if (!response.ok || !payload.recommendations) {
      throw new Error(payload.error ?? 'Unable to fetch recommendations');
    }

    return payload.recommendations;
  } catch (error) {
    console.warn('Recommendation API failed, using fallback recommendations.', error);
    return fallbackRecommendations(layer1Candidates);
  }
}

function fallbackRecommendations(candidates: Layer1Candidate[]): Recommendation[] {
  return candidates.slice(0, 5).map((candidate) => ({
    id: candidate.id,
    dimension: candidate.dimension,
    priority: priorityLabel(candidate.priority),
    title: candidate.title,
    explanation: `Your ${candidate.dimension} metric is outside the textile benchmark. Addressing this could reduce your CCC by approximately ${candidate.estimatedDaysReduction} days.`,
    actionSteps: [
      `Review outstanding ${candidate.dimension === 'DIO' ? 'inventory items' : candidate.dimension === 'DSO' ? 'customer receivables' : 'supplier payables'} today`,
      `Prioritise the top 3 ${candidate.dimension === 'DPO' ? 'suppliers' : candidate.dimension === 'DSO' ? 'customers' : 'inventory items'}`,
      `Agree a target deadline to reduce the ${candidate.dimension} gap this week`,
    ],
    estimatedDaysReduction: candidate.estimatedDaysReduction,
    estimatedCashFreedLakhs: Math.round(candidate.estimatedDaysReduction * 0.75 * 10) / 10,
  }));
}

function priorityLabel(priority: number) {
  if (priority >= 8) return 'HIGH' as const;
  if (priority >= 5) return 'MEDIUM' as const;
  return 'LOW' as const;
}
