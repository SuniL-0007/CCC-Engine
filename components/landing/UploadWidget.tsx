'use client';

import { useMemo, useRef, useState } from 'react';
import type { CCCResult, Layer1Candidate, Recommendation } from '@/lib/ccc-engine/types';
import { calculateCCC, calculateDIO, calculateDPO, calculateDSO } from '@/lib/ccc-engine/calculator';
import { applyTrends, latestSnapshot, saveSnapshot } from '@/lib/history/snapshots';
import { parseExcelFile, parseExcelWorkbook } from '@/lib/parser/sheetjs';
import { evaluateLayer1 } from '@/lib/recommendations/layer1Rules';
import type { ExpectedFileType, ParseResult } from '@/lib/parser/types';

export type RecommendationSource = 'gemini' | 'fallback';

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


export function UploadWidget({ onResultsReady }: { onResultsReady: (result: CCCResult, recommendations: Recommendation[], source: RecommendationSource) => void }) {
  const [isDragging, setIsDragging] = useState<UploadKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Parsing your data...');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>(EMPTY_FILES);
  const [error, setError] = useState<string | null>(null);
  const slowNoticeTimer = useRef<number | null>(null);
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
    setLoadingMessage('Parsing your data...');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyse your files.');
    } finally {
      if (slowNoticeTimer.current !== null) {
        window.clearTimeout(slowNoticeTimer.current);
        slowNoticeTimer.current = null;
      }
      setIsLoading(false);
    }
  };

  const finishParse = async (parseResult: ParseResult) => {
    const validationError = validateParseResult(parseResult);
    if (validationError) {
      setError(validationError);
      return;
    }

    const previous = latestSnapshot();
    const result = applyTrends(createCCCResult(parseResult), previous);
    saveSnapshot(result);

    const layer1Candidates = evaluateLayer1(result);

    setLoadingMessage('Generating AI recommendations...');
    slowNoticeTimer.current = window.setTimeout(() => {
      setLoadingMessage('Taking longer than usual... preparing your recommendations.');
    }, 8000);

    const { recommendations, source } = await fetchRecommendations(result, layer1Candidates);
    onResultsReady(result, recommendations, source);
  };

  return (
    <div data-upload-widget className="rounded-2xl border border-edge bg-surface p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="mb-6 text-center">
        <h3 className="text-lg font-semibold text-ink">Upload your accounting files</h3>
        <p className="mt-1 text-xs text-faint">Processed entirely in your browser. Nothing is uploaded to any server.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <div className="flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            {loadingMessage}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void processFiles(uploadedFiles)}
          disabled={isLoading || !hasAllFiles(uploadedFiles)}
          className={`w-full rounded-[7px] py-3 text-[13px] font-semibold transition-all ${
            hasAllFiles(uploadedFiles) && !isLoading
              ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
              : 'bg-surface2 text-faint cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Processing...' : 'Calculate my CCC →'}
        </button>
        {uploadedCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setUploadedFiles(EMPTY_FILES);
              setError(null);
            }}
            disabled={isLoading}
            className="text-xs text-faint hover:text-body"
          >
            Clear files
          </button>
        )}
      </div>
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
  const isSales = slotKey === 'sales';
  const isPurchase = slotKey === 'purchase';

  return (
    <label
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.files);
      }}
      onDragOver={(event) => event.preventDefault()}
      className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border p-4 text-center transition-all ${
        isDragging
          ? 'border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/20 dark:bg-blue-950/40'
          : file
          ? 'border-edge bg-surface'
          : isSales
          ? 'border-[#BFDBFE] bg-surface hover:border-[#2563EB] dark:border-blue-900'
          : isPurchase
          ? 'border-[#FED7AA] bg-[#FFFBEB] hover:border-[#F97316] dark:border-orange-900 dark:bg-orange-950/25'
          : 'border-[#BBF7D0] bg-[#F0FDF4] hover:border-[#22C55E] dark:border-green-900 dark:bg-green-950/25'
      }`}
    >
      <input
        type="file"
        accept=".xlsx,.csv"
        aria-label={`Upload ${name}`}
        onChange={(event) => onDrop(event.target.files)}
        className="hidden"
      />

      <div className="mb-2 text-xl">
        {isSales ? '📊' : isPurchase ? '📋' : '📦'}
      </div>
      
      {file ? (
        <div className="w-full">
          <p className="truncate text-xs font-semibold text-[#059669] dark:text-green-400">✓ {file.name}</p>
        </div>
      ) : (
        <div>
          <p className={`text-[11px] font-semibold ${
            isSales ? 'text-[#1D4ED8] dark:text-blue-400' : isPurchase ? 'text-[#C2410C] dark:text-orange-400' : 'text-[#15803D] dark:text-green-400'
          }`}>
            {name}
          </p>
          <p className={`text-[10px] mt-0.5 ${
            isSales ? 'text-[#60A5FA]' : isPurchase ? 'text-[#FDBA74]' : 'text-[#86EFAC]'
          }`}>
            {helper}
          </p>
        </div>
      )}
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

function validateParseResult(parseResult: ParseResult): string | null {
  const empty: string[] = [];
  if (parseResult.sales.length === 0) empty.push('Sales Register');
  if (parseResult.purchases.length === 0) empty.push('Purchase Register');
  if (parseResult.inventory.length === 0) empty.push('Stock Summary');

  if (empty.length === 3) {
    return "We couldn't read any rows from your files. Make sure you're uploading Excel/CSV exports from Tally, Zoho Books, or our templates — not PDFs or scanned copies.";
  }
  if (empty.length > 0) {
    return `We couldn't find any usable rows in your ${empty.join(' and ')}. Check that you exported the right report and date range (try the last 90 days), or download our templates below.`;
  }
  return null;
}

function createCCCResult(parseResult: ParseResult): CCCResult {
  const periodDays = inferPeriodDays(parseResult);
  const revenue = parseResult.sales.reduce((sum, invoice) => sum + invoice.amount, 0);
  const purchaseCOGS = parseResult.purchases.reduce((sum, invoice) => sum + invoice.amount, 0);
  const cogs = purchaseCOGS > 0 ? purchaseCOGS : revenue * 0.65;
  const dio = calculateDIO(parseResult.inventory, parseResult.sales, periodDays);
  const dso = calculateDSO(parseResult.sales, revenue, periodDays);
  const dpo = calculateDPO(parseResult.purchases, cogs, periodDays);

  return calculateCCC(dio, dso, dpo, periodDays, revenue);
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
): Promise<{ recommendations: Recommendation[]; source: RecommendationSource }> {
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

    const payload = (await response.json()) as {
      recommendations?: Recommendation[];
      source?: RecommendationSource;
      error?: string;
    };

    if (!response.ok || !payload.recommendations) {
      throw new Error(payload.error ?? 'Unable to fetch recommendations');
    }

    return {
      recommendations: payload.recommendations,
      source: payload.source === 'gemini' ? 'gemini' : 'fallback',
    };
  } catch (error) {
    console.warn('Recommendation API failed, using rule-based recommendations.', error);
    // Layer 1 candidates already carry rule-specific explanations and action steps.
    return { recommendations: layer1Candidates.slice(0, 5), source: 'fallback' };
  }
}
