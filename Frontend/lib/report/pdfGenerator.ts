import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CCCResult, Layer1Candidate } from '@/lib/ccc-engine/types';
import { evaluateLayer1 } from '@/lib/recommendations/layer1Rules';

interface ReportContext {
  companyName?: string;
  city?: string;
  dataSource?: string;
}

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

export function generateCCCReport(
  result: CCCResult,
  context: ReportContext = {
    dataSource: 'Excel/Tally export',
  }
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generatedDate = formatReportDate(result.calculatedAt);
  const recommendations = evaluateLayer1(result);

  // Page 1: Header + Metrics + Gap + Recommendations
  drawHeaderBlock(doc, context, generatedDate);
  drawMetricsBanner(doc, result);
  drawGapCallout(doc, result);
  drawRecommendationsSection(doc, recommendations);

  // Page 2: Methodology
  doc.addPage();
  drawMethodologyPage(doc, result);

  // Add footers to all pages
  const totalPages = (doc as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, generatedDate, i, totalPages);
  }

  doc.save(`FabricCash_CCC_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

function drawHeaderBlock(doc: jsPDF, context: ReportContext, generatedDate: string): void {
  // Dark navy background
  const [r, g, b] = hexToRgb('#1e3a5f');
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 42, 'F');

  // "FabricCash" title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('FabricCash', 15, 18);

  // Subtitle
  const [lr, lg, lb] = hexToRgb('#93c5fd');
  doc.setTextColor(lr, lg, lb);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Cash Conversion Cycle Report', 15, 27);

  // Right-aligned info
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const rightX = 195;
  const company = context.companyName || 'Guest Analysis';
  const city = context.city || 'Not provided';
  doc.text(`${company}, ${city}`, rightX, 27, { align: 'right' });
  doc.text(`Analysis: ${generatedDate}`, rightX, 33, { align: 'right' });
}

function drawMetricsBanner(doc: jsPDF, result: CCCResult): void {
  // Light grey background
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 52, 210, 24, 'F');

  const blockWidth = 47;
  const blocks = [
    {
      label: 'DIO',
      value: result.dio.value,
      benchmark: result.dio.benchmark,
      x: 10,
    },
    {
      label: 'DSO',
      value: result.dso.value,
      benchmark: result.dso.benchmark,
      x: 10 + blockWidth,
    },
    {
      label: 'DPO',
      value: result.dpo.value,
      benchmark: result.dpo.benchmark,
      x: 10 + blockWidth * 2,
    },
    {
      label: 'CCC',
      value: result.ccc,
      benchmark: result.benchmarkCCC,
      x: 10 + blockWidth * 3,
    },
  ];

  blocks.forEach((block, idx) => {
    // Metric name
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(block.label, block.x + 2, 56);

    // Large value
    const gap = block.value - block.benchmark;
    const isGood =
      block.label === 'DPO'
        ? gap >= 0
        : block.label === 'CCC'
          ? gap <= 0
          : gap <= 0;
    const [vr, vg, vb] = isGood ? hexToRgb('#16a34a') : hexToRgb('#dc2626');
    doc.setTextColor(vr, vg, vb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(block.value.toFixed(1), block.x + 2, 65);

    // Benchmark text
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Benchmark: ${block.benchmark}d`, block.x + 2, 71);

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

  doc.setDrawColor(br, bg, bb);
  doc.setLineWidth(0.5);
  doc.rect(10, 82, 190, 16, 'S');

  // Background fill with slight tint
  if (isGood) {
    doc.setFillColor(240, 253, 244);
  } else {
    doc.setFillColor(254, 242, 242);
  }
  doc.rect(10, 82, 190, 16, 'F');

  // Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(br, bg, bb);

  const gapText = isGood
    ? `Your CCC is ${result.ccc.toFixed(1)} days — ${Math.abs(result.gapDays).toFixed(1)} days below the textile industry benchmark of 41 days.`
    : `Your CCC is ${result.ccc.toFixed(1)} days — ${result.gapDays.toFixed(1)} days above the textile industry benchmark of 41 days.`;

  const cashLocked = (result.gapDays * 5) / 10; // Rough estimate: 5 lakhs daily revenue
  const cashText = isGood
    ? `Estimated Rs ${Math.abs(cashLocked).toFixed(1)} lakhs freed from working capital.`
    : `Estimated Rs ${cashLocked.toFixed(1)} lakhs locked in working capital.`;

  doc.setTextColor(51, 65, 85);
  const fullText = `${gapText} ${cashText}`;
  const lines = doc.splitTextToSize(fullText, 180);
  doc.setFontSize(9);
  doc.text(lines, 15, 87);
}

function drawRecommendationsSection(
  doc: jsPDF,
  recommendations: Layer1Candidate[]
): number {
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 95);
  doc.text('Top Recommendations', 10, 106);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Ranked by estimated cash-cycle impact. Maximum 5 actions.', 10, 112);

  let currentY = 118;
  const cardHeight = 62;
  const gapBetweenCards = 4;

  recommendations.forEach((rec) => {
    // Check if we need a new page
    if (currentY + cardHeight > 270) {
      doc.addPage();
      currentY = 10;
    }

    drawRecommendationCard(doc, rec, currentY);
    currentY += cardHeight + gapBetweenCards;
  });

  return currentY;
}

function drawRecommendationCard(doc: jsPDF, rec: Layer1Candidate, y: number): void {
  const cardX = 10;
  const cardWidth = 190;
  const cardHeight = 62;

  // Priority color indicator (left border)
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

  const [pr, pg, pb] = hexToRgb(priorityColors[rec.priority]);
  const [bgr, bgg, bgb] = hexToRgb(bgColors[rec.priority]);

  // Left border (3mm wide)
  doc.setFillColor(pr, pg, pb);
  doc.rect(cardX, y, 3, cardHeight, 'F');

  // Card background
  doc.setFillColor(bgr, bgg, bgb);
  doc.rect(cardX + 3, y, cardWidth - 3, cardHeight, 'F');

  // Card border
  const [br, bg, bb] = hexToRgb('#e5e7eb');
  doc.setDrawColor(br, bg, bb);
  doc.setLineWidth(0.3);
  doc.rect(cardX + 3, y, cardWidth - 3, cardHeight, 'S');

  let lineY = y + 5;

  // Row 1: Priority badge + dimension badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(pr, pg, pb);
  doc.text(`${rec.priority}`, cardX + 6, lineY);

  const [dsr, dsg, dsb] = hexToRgb('#64748b');
  doc.setTextColor(dsr, dsg, dsb);
  doc.setFont('helvetica', 'normal');
  doc.text(rec.dimension, cardX + 25, lineY);

  lineY += 5;

  // Row 2: Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const titleLines = doc.splitTextToSize(rec.title, 170);
  doc.text(titleLines[0], cardX + 6, lineY);
  lineY += 5;

  // Row 3: Explanation
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const [exr, exg, exb] = hexToRgb('#374151');
  doc.setTextColor(exr, exg, exb);
  const explainLines = doc.splitTextToSize(rec.explanation, 170);
  explainLines.slice(0, 2).forEach((line: string) => {
    doc.text(line, cardX + 6, lineY);
    lineY += 3.5;
  });

  lineY += 1;

  // Row 4: Action steps label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const [asr, asg, asb] = hexToRgb('#1e3a5f');
  doc.setTextColor(asr, asg, asb);
  doc.text('Action steps:', cardX + 6, lineY);
  lineY += 3.5;

  // Rows 5-7: Action steps (numbered)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(exr, exg, exb);
  rec.actionSteps.slice(0, 3).forEach((step, idx) => {
    const stepLines = doc.splitTextToSize(`${idx + 1}. ${step}`, 165);
    doc.text(stepLines[0], cardX + 6, lineY);
    lineY += 3.5;
  });

  lineY += 1;

  // Row 8: Estimated impact
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(asr, asg, asb);
  doc.text('Estimated impact:', cardX + 6, lineY);

  doc.setFont('helvetica', 'normal');
  const [impr, img, imb] = hexToRgb('#16a34a');
  doc.setTextColor(impr, img, imb);
  const impactText = `${rec.estimatedDaysReduction.toFixed(1)} days CCC reduction — approximately Rs ${rec.estimatedCashFreedLakhs.toFixed(1)} lakhs freed`;
  doc.text(impactText, cardX + 37, lineY);
}

function drawMethodologyPage(doc: jsPDF, result: CCCResult): void {
  // Header (smaller than page 1)
  const [r, g, b] = hexToRgb('#1e3a5f');
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Methodology & Data Notes', 15, 14);

  // Methodology table
  const definitions = [
    [
      'Cash Conversion Cycle (CCC)',
      'DIO + DSO − DPO. Lower CCC means cash returns to the business faster. Every day of improvement releases cash trapped in operations.',
    ],
    [
      'Days Inventory Outstanding (DIO)',
      'Average days inventory sits before sale. Calculated as (Avg Inventory ÷ COGS) × Days in period. Lower = faster inventory turnover.',
    ],
    [
      'Days Sales Outstanding (DSO)',
      'Average days to collect payment after sale. Calculated as (Avg AR ÷ Revenue) × Days in period. Lower = faster collections.',
    ],
    [
      'Days Payable Outstanding (DPO)',
      'Average days before paying suppliers. Calculated as (Avg AP ÷ COGS) × Days in period. Higher = more time to pay (working capital benefit).',
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
  let noteY = (doc as any).lastAutoTable.finalY + 6;
  if (result.dio.dataCompleteness < 0.8) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 38, 38);
    const noteText = `⚠ Data Completeness Warning: Only ${(result.dio.dataCompleteness * 100).toFixed(0)}% of expected fields were matched during parsing. DIO and CCC calculations may be incomplete.`;
    const noteLines = doc.splitTextToSize(noteText, 170);
    doc.text(noteLines, 15, noteY);
    noteY += noteLines.length * 4;
  }
}

function drawFooter(doc: jsPDF, generatedDate: string, pageNum: number, totalPages: number): void { // totalPages used in template literal below
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
  doc.text(`Generated by FabricCash · fabriccash.in · For internal planning only · ${generatedDate}`, 15, y + 2);

  // Page numbers (right)
  doc.text(`Page ${pageNum} of ${totalPages}`, 195, y + 2, { align: 'right' });
}

function formatReportDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN');
}

