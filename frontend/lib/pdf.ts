/**
 * Client-side PDF export for session artifacts (transcript / summary).
 * Every document is titled "<Session title> - <Patient name>" per the product
 * spec, with a kind + date subtitle. Pure jsPDF text layout — no fonts or
 * assets to fetch, so it works fully offline.
 */

import { jsPDF } from "jspdf";

export interface PdfSection {
  heading?: string;
  body: string;
}

function slug(s: string): string {
  return (
    s
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "session"
  );
}

export function buildSessionTitle(
  sessionTitle: string,
  patientName: string | null,
): string {
  return `${sessionTitle || "Untitled session"} - ${patientName ?? "Unattributed"}`;
}

export function downloadSessionPdf(opts: {
  sessionTitle: string;
  patientName: string | null;
  kind: string; // "Transcript" | "Summary"
  dateISO: string;
  sections: PdfSection[];
}): void {
  const { sessionTitle, patientName, kind, dateISO, sections } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title — "Session title - Patient name"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 40, 45);
  const titleLines = doc.splitTextToSize(
    buildSessionTitle(sessionTitle, patientName),
    maxW,
  );
  doc.text(titleLines, margin, y);
  y += titleLines.length * 22 + 2;

  // Subtitle — kind · date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(120, 130, 135);
  doc.text(`${kind} · ${new Date(dateISO).toLocaleString()}`, margin, y);
  y += 16;
  doc.setDrawColor(205, 214, 210);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  for (const section of sections) {
    if (section.heading) {
      ensure(26);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(40, 90, 80);
      doc.text(section.heading, margin, y);
      y += 18;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(35, 45, 50);
    const lines = doc.splitTextToSize(section.body?.trim() || "—", maxW);
    for (const line of lines) {
      ensure(16);
      doc.text(line, margin, y);
      y += 15;
    }
    y += 12;
  }

  doc.save(`${slug(sessionTitle)}-${slug(kind)}.pdf`);
}
