import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CCCResult, CompanyContext, Recommendation } from '@/lib/ccc-engine/types';

export function generateCCCReport(
  result: CCCResult,
  context: CompanyContext = {
    fabricTypes: [],
    buyerTypes: [],
    month: new Date().getMonth() + 1,
    revenueRange: 'unknown',
    dataSource: 'Excel/Tally export',
  }
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generatedDate = new Date(result.generatedAt).toLocaleDateString('en-IN');

  drawHeader(doc, context, generatedDate);
  drawMetricCards(doc, result);
  drawBenchmarkBanner(doc, result);
  drawRecommendations(doc, result.recommendations ?? []);
  drawWarnings(doc, result.warnings);
  drawFooter(doc, generatedDate);

  doc.addPage();
  drawMethodology(doc);
  drawFooter(doc, generatedDate);

  doc.save(`FabricCash_CCC_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

function drawHeader(doc: jsPDF, context: CompanyContext, generatedDate: string): void {
  doc.setFillColor(27, 58, 107);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('FabricCash', 16, 15);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Cash Conversion Cycle Report', 16, 23);

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(10);
  doc.text(`Company: ${context.companyName || 'Guest Analysis'}`, 16, 44);
  doc.text(`City: ${context.city || 'Not provided'}`, 16, 51);
  doc.text(`Data source: ${context.dataSource || 'Excel/Tally export'}`, 112, 44);
  doc.text(`Analysis date: ${generatedDate}`, 112, 51);
}

function drawMetricCards(doc: jsPDF, result: CCCResult): void {
  const cards = [
    { label: 'DIO', value: result.dio.value, benchmark: result.dio.benchmark, x: 16, y: 62 },
    { label: 'DSO', value: result.dso.value, benchmark: result.dso.benchmark, x: 108, y: 62 },
    { label: 'DPO', value: result.dpo.value, benchmark: result.dpo.benchmark, x: 16, y: 94 },
    { label: 'CCC', value: result.ccc, benchmark: result.benchmarkCCC, x: 108, y: 94 },
  ];

  cards.forEach((card) => {
    const gap = card.value - card.benchmark;
    const good = card.label === 'DPO' ? gap >= 0 : gap <= 0;
    doc.setDrawColor(good ? 22 : 220, good ? 163 : 38, good ? 74 : 38);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(card.x, card.y, 82, 24, 2, 2, 'FD');
    doc.setTextColor(75, 85, 99);
    doc.setFontSize(8);
    doc.text(card.label, card.x + 6, card.y + 7);
    doc.setTextColor(good ? 22 : 185, good ? 101 : 28, good ? 52 : 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`${card.value.toFixed(1)} days`, card.x + 6, card.y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Benchmark: ${card.benchmark} days`, card.x + 45, card.y + 16);
  });
}

function drawBenchmarkBanner(doc: jsPDF, result: CCCResult): void {
  const good = result.gapDays <= 0;
  doc.setFillColor(good ? 240 : 254, good ? 253 : 242, good ? 244 : 242);
  doc.setDrawColor(good ? 22 : 220, good ? 163 : 38, good ? 74 : 38);
  doc.roundedRect(16, 128, 178, 26, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(good ? 21 : 153, good ? 128 : 27, good ? 61 : 27);
  doc.text(`Your CCC is ${result.ccc.toFixed(1)} days`, 22, 138);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.text(
    `Industry benchmark: ${result.benchmarkCCC} days. Gap: ${formatSigned(result.gapDays)} days. Estimated working capital locked: Rs ${result.estimatedCashLockedLakhs.toFixed(1)} lakhs.`,
    22,
    147,
    { maxWidth: 164 }
  );
}

function drawRecommendations(doc: jsPDF, recommendations: Recommendation[]): void {
  autoTable(doc, {
    startY: 164,
    head: [['Priority', 'Metric', 'Recommendation', 'Impact']],
    body: recommendations.map((recommendation) => [
      recommendation.priority,
      recommendation.dimension,
      `${recommendation.title}\n${recommendation.actionSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
      `${recommendation.estimatedDaysReduction.toFixed(1)} days\nRs ${recommendation.estimatedCashFreedLakhs.toFixed(1)}L`,
    ]),
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [27, 58, 107], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 102 },
      3: { cellWidth: 30 },
    },
    margin: { left: 16, right: 16 },
  });
}

function drawWarnings(doc: jsPDF, warnings: string[]): void {
  if (warnings.length === 0) return;

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 238;
  const y = Math.min(finalY + 8, 258);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text('Data notes', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text(warnings.slice(0, 3).join(' '), 16, y + 6, { maxWidth: 178 });
}

function drawMethodology(doc: jsPDF): void {
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Methodology', 16, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    'Cash Conversion Cycle (CCC) = Days Inventory Outstanding (DIO) + Days Sales Outstanding (DSO) - Days Payable Outstanding (DPO). Lower CCC usually means cash returns to the business faster.',
    16,
    38,
    { maxWidth: 178 }
  );

  const definitions = [
    ['DIO', 'How many days inventory typically sits before becoming sales.'],
    ['DSO', 'How many days customers typically take to pay invoices.'],
    ['DPO', 'How many days the business takes to pay suppliers.'],
    ['Benchmarks', 'Textile benchmarks are directional planning references and should be reviewed with your accountant or finance team.'],
  ];

  autoTable(doc, {
    startY: 62,
    head: [['Metric', 'Plain-language definition']],
    body: definitions,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [27, 58, 107] },
    margin: { left: 16, right: 16 },
  });

  doc.setFontSize(9);
  doc.text(
    'This report is for internal planning purposes only. It uses the uploaded accounting exports and the fields detected by the browser-side parser.',
    16,
    126,
    { maxWidth: 178 }
  );
}

function drawFooter(doc: jsPDF, generatedDate: string): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated by FabricCash - fabriccash.in - Analysis date: ${generatedDate} - Internal planning only`,
    16,
    287
  );
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}
