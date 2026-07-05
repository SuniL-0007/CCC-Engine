import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CCCResult, Recommendation } from '@/lib/ccc-engine/types';
import { estimateCashLockedLakhs } from '@/lib/ccc-engine/cash';
import { evaluateLayer1 } from '@/lib/recommendations/layer1Rules';

interface ReportContext {
  companyName?: string;
  city?: string;
  dataSource?: string;
}

const PAGE_WIDTH = 210;
const MARGIN_X = 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 190
const PAGE_BREAK_Y = 272; // keep clear of the footer at 285+

// Helper function to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

/**
 * jsPDF's built-in Helvetica only supports WinAnsi (Latin-1) characters.
 * Anything outside it (Unicode minus, checkmarks, rupee sign...) renders as
 * garbage AND corrupts line-width measurement, which breaks text wrapping.
 */
function pdfSafe(text: string): string {
  return text
    .replace(/−/g, '-')   // − minus sign
    .replace(/✓|✔/g, '') // ✓ ✔
    .replace(/₹/g, 'Rs ') // ₹
    .replace(/⚠/g, '!')   // ⚠
    .replace(/…/g, '...') // …
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[↑↓]/g, '') // arrows
    .replace(/[^\x00-\xFF]/g, '');  // drop anything else non-Latin-1
}

function drawText(doc: jsPDF, text: string, x: number, y: number, options?: Record<string, unknown>): void {
  doc.text(pdfSafe(text), x, y, options);
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(pdfSafe(text), maxWidth) as string[];
}

export function generateCCCReport(
  result: CCCResult,
  recommendations?: Recommendation[],
  context: ReportContext = {
    dataSource: 'Excel/Tally export',
  }
): void {
  const doc = buildCCCReport(result, recommendations, context);
  doc.save(`FabricCash_CCC_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

/** Builds the report document without saving — also used by tests. */
export function buildCCCReport(
  result: CCCResult,
  recommendations?: Recommendation[],
  context: ReportContext = {
    dataSource: 'Excel/Tally export',
  }
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generatedDate = formatReportDate(result.calculatedAt);
  // Prefer the recommendations shown in the UI (possibly AI-enriched);
  // regenerate from the rule engine only when none were passed.
  const reportRecommendations =
    recommendations && recommendations.length > 0
      ? recommendations.slice(0, 5)
      : evaluateLayer1(result);

  // Page 1: Header + Metrics + Gap + Recommendations
  drawHeaderBlock(doc, context, generatedDate);
  drawMetricsBanner(doc, result);
  drawGapCallout(doc, result);
  drawRecommendationsSection(doc, reportRecommendations);

  // Methodology always starts on its own page
  doc.addPage();
  drawMethodologyPage(doc, result);

  // Add footers to all pages
  const totalPages = (doc as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, generatedDate, i, totalPages);
  }

  return doc;
}

function drawHeaderBlock(doc: jsPDF, context: ReportContext, generatedDate: string): void {
  // Dark navy background
  const [r, g, b] = hexToRgb('#1e3a5f');
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_WIDTH, 42, 'F');

  // "FabricCash" title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  drawText(doc, 'FabricCash', 15, 18);

  // Subtitle
  const [lr, lg, lb] = hexToRgb('#93c5fd');
  doc.setTextColor(lr, lg, lb);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  drawText(doc, 'Cash Conversion Cycle Report', 15, 27);

  // Right-aligned info — only show what we actually know
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const rightX = 195;
  const identity = [context.companyName, context.city].filter(Boolean).join(', ');
  if (identity) drawText(doc, identity, rightX, 27, { align: 'right' });
  drawText(doc, `Analysis date: ${generatedDate}`, rightX, identity ? 33 : 30, { align: 'right' });
}

function drawMetricsBanner(doc: jsPDF, result: CCCResult): void {
  // Light grey background
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 52, PAGE_WIDTH, 24, 'F');

  const blockWidth = 47;
  const blocks = [
    { label: 'DIO', value: result.dio.value, benchmark: result.dio.benchmark, x: 10 },
    { label: 'DSO', value: result.dso.value, benchmark: result.dso.benchmark, x: 10 + blockWidth },
    { label: 'DPO', value: result.dpo.value, benchmark: result.dpo.benchmark, x: 10 + blockWidth * 2 },
    { label: 'CCC', value: result.ccc, benchmark: result.benchmarkCCC, x: 10 + blockWidth * 3 },
  ];

  blocks.forEach((block, idx) => {
    // Metric name
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    drawText(doc, block.label, block.x + 2, 56);

    // Large value
    const gap = block.value - block.benchmark;
    const isGood = block.label === 'DPO' ? gap >= 0 : gap <= 0;
    const [vr, vg, vb] = isGood ? hexToRgb('#16a34a') : hexToRgb('#dc2626');
    doc.setTextColor(vr, vg, vb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    drawText(doc, block.value.toFixed(1), block.x + 2, 65);

    // Benchmark text
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    drawText(doc, `Benchmark: ${block.benchmark}d`, block.x + 2, 71);

    // Separator line (except after last block)
    if (idx < blocks.length - 1) {
      const [sr, sg, sb] = hexToRgb('#cbd5e1');
      doc.setDrawColor(sr, sg, sb);
      doc.setLineWidth(0.3);
      doc.line(block.x + blockWidth - 1, 53, block.x + blockWidth - 1, 76);
    }
  });
}

function drawGapCallout(doc: jsPDF, result: CCCResult): void {
  const isGood = result.gapDays <= 0;
  const [br, bg, bb] = isGood ? hexToRgb('#16a34a') : hexToRgb('#dc2626');

  const gapText = isGood
    ? `Your CCC is ${result.ccc.toFixed(1)} days - ${Math.abs(result.gapDays).toFixed(1)} days below the textile industry benchmark of ${result.benchmarkCCC} days.`
    : `Your CCC is ${result.ccc.toFixed(1)} days - ${result.gapDays.toFixed(1)} days above the textile industry benchmark of ${result.benchmarkCCC} days.`;
  const cashText = isGood
    ? 'Your working capital position is ahead of the industry average.'
    : `Estimated Rs ${estimateCashLockedLakhs(result).toFixed(1)} lakhs locked in working capital.`;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  const lines = wrap(doc, `${gapText} ${cashText}`, CONTENT_WIDTH - 10);
  const boxHeight = Math.max(14, lines.length * 4.5 + 8);

  if (isGood) {
    doc.setFillColor(240, 253, 244);
  } else {
    doc.setFillColor(254, 242, 242);
  }
  doc.rect(MARGIN_X, 82, CONTENT_WIDTH, boxHeight, 'F');
  doc.setDrawColor(br, bg, bb);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN_X, 82, CONTENT_WIDTH, boxHeight, 'S');

  doc.setTextColor(51, 65, 85);
  doc.text(lines, 15, 88);
}

function drawRecommendationsSection(doc: jsPDF, recommendations: Recommendation[]): void {
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 95);
  drawText(doc, 'Top Recommendations', MARGIN_X, 110);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  drawText(doc, 'Ranked by estimated cash-cycle impact. Maximum 5 actions.', MARGIN_X, 115.5);

  let currentY = 121;

  if (recommendations.length === 0) {
    doc.setFontSize(9.5);
    doc.setTextColor(22, 101, 52);
    drawText(
      doc,
      'No urgent actions found - your CCC is within the textile benchmark. Re-run the analysis next month to keep it that way.',
      MARGIN_X,
      currentY + 4
    );
    return;
  }

  recommendations.forEach((rec, index) => {
    const layout = measureRecommendationCard(doc, rec);
    if (currentY + layout.height > PAGE_BREAK_Y) {
      doc.addPage();
      currentY = 16;
    }
    drawRecommendationCard(doc, rec, index + 1, currentY, layout);
    currentY += layout.height + 4;
  });
}

interface CardLayout {
  height: number;
  titleLines: string[];
  explanationLines: string[];
  stepLines: string[][];
  impactLines: string[];
}

const CARD_TEXT_X = 6; // offset from card left edge
const CARD_TEXT_WIDTH = CONTENT_WIDTH - 3 - CARD_TEXT_X - 5; // minus colour bar and right padding

function measureRecommendationCard(doc: jsPDF, rec: Recommendation): CardLayout {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const titleLines = wrap(doc, rec.title, CARD_TEXT_WIDTH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const explanationLines = wrap(doc, rec.explanation, CARD_TEXT_WIDTH);

  doc.setFontSize(8);
  const stepLines = rec.actionSteps
    .slice(0, 3)
    .map((step, i) => wrap(doc, `${i + 1}. ${step}`, CARD_TEXT_WIDTH - 2));

  const impactText = `${rec.estimatedDaysReduction.toFixed(1)} days CCC reduction - approximately Rs ${rec.estimatedCashFreedLakhs.toFixed(1)} lakhs freed`;
  const impactLines = wrap(doc, impactText, CARD_TEXT_WIDTH - 28);

  const height =
    5.5 + // top padding + badge row
    titleLines.length * 4.6 +
    1 +
    explanationLines.length * 3.8 +
    2.5 + // gap + "Action steps:" label
    3.8 +
    stepLines.reduce((sum, lines) => sum + lines.length * 3.6 + 0.6, 0) +
    2 + // gap before impact
    impactLines.length * 3.8 +
    3.5; // bottom padding

  return { height, titleLines, explanationLines, stepLines, impactLines };
}

function drawRecommendationCard(
  doc: jsPDF,
  rec: Recommendation,
  rank: number,
  y: number,
  layout: CardLayout
): void {
  const cardX = MARGIN_X;
  const cardWidth = CONTENT_WIDTH;
  const cardHeight = layout.height;

  const priorityColors: Record<string, string> = {
    HIGH: '#dc2626',
    MEDIUM: '#d97706',
    LOW: '#6b7280',
  };
  const bgColors: Record<string, string> = {
    HIGH: '#fff7f7',
    MEDIUM: '#fffbeb',
    LOW: '#f9fafb',
  };

  const [pr, pg, pb] = hexToRgb(priorityColors[rec.priority] ?? priorityColors.LOW);
  const [bgr, bgg, bgb] = hexToRgb(bgColors[rec.priority] ?? bgColors.LOW);

  // Left colour bar
  doc.setFillColor(pr, pg, pb);
  doc.rect(cardX, y, 3, cardHeight, 'F');

  // Card background + border
  doc.setFillColor(bgr, bgg, bgb);
  doc.rect(cardX + 3, y, cardWidth - 3, cardHeight, 'F');
  const [br, bg, bb] = hexToRgb('#e5e7eb');
  doc.setDrawColor(br, bg, bb);
  doc.setLineWidth(0.3);
  doc.rect(cardX + 3, y, cardWidth - 3, cardHeight, 'S');

  const textX = cardX + CARD_TEXT_X;
  let lineY = y + 5.5;

  // Badge row: "1. HIGH" + dimension
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(pr, pg, pb);
  drawText(doc, `${rank}. ${rec.priority}`, textX, lineY);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  drawText(doc, rec.dimension, textX + 22, lineY);
  lineY += 5;

  // Title (all lines)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  layout.titleLines.forEach((line) => {
    doc.text(line, textX, lineY);
    lineY += 4.6;
  });
  lineY += 1;

  // Explanation (all lines)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const [exr, exg, exb] = hexToRgb('#374151');
  doc.setTextColor(exr, exg, exb);
  layout.explanationLines.forEach((line) => {
    doc.text(line, textX, lineY);
    lineY += 3.8;
  });
  lineY += 2.5;

  // Action steps label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const [asr, asg, asb] = hexToRgb('#1e3a5f');
  doc.setTextColor(asr, asg, asb);
  drawText(doc, 'Action steps:', textX, lineY);
  lineY += 3.8;

  // Steps (all lines of each)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(exr, exg, exb);
  layout.stepLines.forEach((lines) => {
    lines.forEach((line, lineIndex) => {
      doc.text(line, textX + (lineIndex === 0 ? 0 : 3), lineY);
      lineY += 3.6;
    });
    lineY += 0.6;
  });
  lineY += 2;

  // Impact
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(asr, asg, asb);
  drawText(doc, 'Estimated impact:', textX, lineY);
  doc.setFont('helvetica', 'normal');
  const [impr, img, imb] = hexToRgb('#16a34a');
  doc.setTextColor(impr, img, imb);
  layout.impactLines.forEach((line, lineIndex) => {
    doc.text(line, textX + 28, lineY + lineIndex * 3.8);
  });
}

function drawMethodologyPage(doc: jsPDF, result: CCCResult): void {
  // Header (smaller than page 1)
  const [r, g, b] = hexToRgb('#1e3a5f');
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  drawText(doc, 'Methodology & Data Notes', 15, 14);

  // Methodology table (ASCII-safe: jsPDF's Helvetica cannot render U+2212)
  const definitions = [
    [
      'Cash Conversion Cycle (CCC)',
      'DIO + DSO - DPO. Lower CCC means cash returns to the business faster. Every day of improvement releases cash trapped in operations.',
    ],
    [
      'Days Inventory Outstanding (DIO)',
      'Average days inventory sits before sale. Calculated as (Avg Inventory / COGS) x Days in period. Lower = faster inventory turnover.',
    ],
    [
      'Days Sales Outstanding (DSO)',
      'Average days to collect payment after sale. Calculated as (Avg AR / Revenue) x Days in period. Lower = faster collections.',
    ],
    [
      'Days Payable Outstanding (DPO)',
      'Average days before paying suppliers. Calculated as (Avg AP / COGS) x Days in period. Higher = more time to pay (working capital benefit).',
    ],
    [
      'Benchmark Source',
      'Textile industry benchmarks (DIO 38d, DSO 45d, DPO 42d) are directional references based on SIDBI SME textile data. Review with your accountant before making financial decisions.',
    ],
  ];

  autoTable(doc, {
    startY: 28,
    head: [['Term', 'Plain-language definition']],
    body: definitions,
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 150 },
    },
    margin: { left: 10, right: 10 },
  });

  // Data quality note
  const noteY = (doc as any).lastAutoTable.finalY + 6;
  if (result.dio.dataCompleteness < 0.8) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 38, 38);
    const noteText = `Data Completeness Warning: only ${(result.dio.dataCompleteness * 100).toFixed(0)}% of expected fields were matched during parsing. DIO and CCC calculations may be incomplete.`;
    doc.text(wrap(doc, noteText, 170), 15, noteY);
  }
}

function drawFooter(doc: jsPDF, generatedDate: string, pageNum: number, totalPages: number): void {
  const y = 287;

  // Horizontal line
  const [lr, lg, lb] = hexToRgb('#e5e7eb');
  doc.setDrawColor(lr, lg, lb);
  doc.setLineWidth(0.3);
  doc.line(10, y - 2, 200, y - 2);

  // Footer text (left)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const [tr, tg, tb] = hexToRgb('#9ca3af');
  doc.setTextColor(tr, tg, tb);
  drawText(doc, `Generated by FabricCash - fabriccash.in - For internal planning only - ${generatedDate}`, 15, y + 2);

  // Page numbers (right)
  drawText(doc, `Page ${pageNum} of ${totalPages}`, 195, y + 2, { align: 'right' });
}

function formatReportDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
