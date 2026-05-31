'use client';

import { useMemo, useState } from 'react';
import { CCCResult, CompanyContext, ParseResult } from '@/lib/ccc-engine/types';
import { calculateCCCMetrics } from '@/lib/ccc-engine/calculator';
import { evaluateLayer1, buildFallbackRecommendations } from '@/lib/recommendations/layer1Rules';
import { ExpectedFileType, parseExcelFile, parseExcelWorkbook } from '@/lib/parser/sheetjs';

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

export function UploadWidget({ onResultsReady }: { onResultsReady: (result: CCCResult) => void }) {
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
        if (hasAllFiles(nextFiles)) {
          await processFiles(nextFiles);
        }
        return;
      }

      const nextFiles = classifyDroppedFiles(files, uploadedFiles, slotKey);
      setUploadedFiles(nextFiles);

      if (hasAllFiles(nextFiles)) {
        await processFiles(nextFiles);
      }
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
      await finishParse(parsed);
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
    const cccResult = calculateCCCMetrics(parseResult);
    const companyContext = createCompanyContext();
    const layer1Candidates = evaluateLayer1(cccResult, companyContext);
    cccResult.recommendations = buildFallbackRecommendations(layer1Candidates, cccResult, companyContext);
    onResultsReady(cccResult);

    fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cccResult,
        companyContext,
        layer1Candidates,
      }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const enrichedData = (await response.json()) as { recommendations?: CCCResult['recommendations'] };
        if (enrichedData.recommendations?.length) {
          onResultsReady({ ...cccResult, recommendations: enrichedData.recommendations });
        }
      })
      .catch(() => {
        onResultsReady(cccResult);
      });
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
        accept=".xlsx,.xls,.csv"
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

function createCompanyContext(): CompanyContext {
  return {
    fabricTypes: [],
    buyerTypes: [],
    month: new Date().getMonth() + 1,
    revenueRange: 'unknown',
    dataSource: 'Tally/Excel export',
  };
}
