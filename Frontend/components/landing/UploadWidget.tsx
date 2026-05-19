'use client';

import { useState } from 'react';
import { parseExcelFile } from '@/lib/parser/sheetjs';
import { calculateCCCMetrics } from '@/lib/ccc-engine/calculator';
import { evaluateLayer1 } from '@/lib/recommendations/layer1Rules';
import { CCCResult } from '@/lib/ccc-engine/types';

export function UploadWidget({ onResultsReady }: { onResultsReady: (result: CCCResult) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: File | null }>({
    sales: null,
    purchase: null,
    stock: null,
  });
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    try {
      setError(null);
      setIsLoading(true);

      const fileArray = Array.from(files);
      const filesByType: { [key: string]: File | null } = { ...uploadedFiles };

      for (const file of fileArray) {
        const name = file.name.toLowerCase();
        if (name.includes('sales')) filesByType.sales = file;
        else if (name.includes('purchase') || name.includes('bill')) filesByType.purchase = file;
        else if (name.includes('stock') || name.includes('inventory')) filesByType.stock = file;
      }

      setUploadedFiles(filesByType);

      // If all three files are uploaded, process them
      if (filesByType.sales && filesByType.purchase && filesByType.stock) {
        await processFiles(filesByType.sales, filesByType.purchase, filesByType.stock);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files');
      setIsLoading(false);
    }
  };

  const processFiles = async (salesFile: File, purchaseFile: File, stockFile: File) => {
    try {
      setIsLoading(true);

      // Parse all three files
      const [salesResult, purchaseResult, stockResult] = await Promise.all([
        parseExcelFile(salesFile),
        parseExcelFile(purchaseFile),
        parseExcelFile(stockFile),
      ]);

      // Combine results
      const combinedResult = {
        sales: salesResult.sales,
        purchases: purchaseResult.sales, // The purchase file contains purchase invoices
        inventory: stockResult.inventory,
        warnings: [...salesResult.warnings, ...purchaseResult.warnings, ...stockResult.warnings],
      };

      // Calculate CCC metrics
      const cccResult = calculateCCCMetrics(combinedResult);

      // Evaluate Layer 1 rules
      const layer1Candidates = evaluateLayer1(cccResult);

      // Fetch Layer 2 AI enrichment
      try {
        const response = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cccResult,
            companyContext: {
              fabricTypes: [],
              buyerTypes: [],
              month: new Date().getMonth() + 1,
              revenueRange: 'unknown',
            },
            layer1Candidates,
          }),
        });

        if (response.ok) {
          const enrichedData = await response.json();
          cccResult.recommendations = enrichedData.recommendations;
        }
      } catch {
        // Fallback to Layer 1 only
        cccResult.recommendations = layer1Candidates.map((c) => ({
          id: c.id,
          dimension: c.dimension,
          priority: c.priority > 7 ? 'HIGH' : c.priority > 4 ? 'MEDIUM' : 'LOW',
          title: c.title,
          explanation: 'AI analysis pending',
          actionSteps: ['Review this recommendation', 'Take action'],
          estimatedDaysReduction: c.estimatedDays,
          estimatedCashFreedLakhs: 0,
        }));
      }

      onResultsReady(cccResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-upload-widget className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            Parsing your data...
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { key: 'sales', name: 'Sales Register', icon: '📄' },
          { key: 'purchase', name: 'Purchase Register', icon: '📄' },
          { key: 'stock', name: 'Stock Summary', icon: '📦' },
        ].map((slot) => (
          <UploadSlot
            key={slot.key}
            name={slot.name}
            icon={slot.icon}
            file={uploadedFiles[slot.key]}
            isDragging={isDragging}
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(files) => {
              setIsDragging(false);
              handleFiles(files);
            }}
          />
        ))}
      </div>

      {Object.values(uploadedFiles).filter(Boolean).length > 0 && (
        <button
          onClick={() =>
            uploadedFiles.sales &&
            uploadedFiles.purchase &&
            uploadedFiles.stock &&
            processFiles(uploadedFiles.sales, uploadedFiles.purchase, uploadedFiles.stock)
          }
          disabled={isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? 'Processing...' : 'Calculate CCC'}
        </button>
      )}
    </div>
  );
}

function UploadSlot({
  name,
  icon,
  file,
  isDragging,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  name: string;
  icon: string;
  file: File | null;
  isDragging: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (files: FileList) => void;
}) {
  return (
    <label
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e.dataTransfer.files);
      }}
      onDragOver={(e) => e.preventDefault()}
      className={`relative block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
      } ${file ? 'border-green-500 bg-green-50' : ''}`}
    >
      <input
        type="file"
        accept=".xlsx,.csv"
        onChange={(e) => onDrop(e.target.files!)}
        className="hidden"
      />

      <div className="space-y-2">
        <div className="text-2xl">{icon}</div>
        {file ? (
          <div>
            <p className="font-medium text-green-700">{file.name}</p>
            <p className="text-xs text-gray-600">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">{name}</p>
            <p className="text-xs text-gray-500">Drag or click</p>
          </div>
        )}
      </div>
    </label>
  );
}
