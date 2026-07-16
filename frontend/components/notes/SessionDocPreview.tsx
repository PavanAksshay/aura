"use client";

/**
 * "Preview, then download as PDF" for a session's transcript or summary.
 * Clicking the trigger opens a drawer with a formatted preview; from there the
 * clinician downloads a PDF titled "<Session title> - <Patient name>".
 *
 * Summary uses the structured SOAP note (the clinical summary of the session);
 * Transcript uses the raw, speaker-labelled text.
 */

import { useState } from "react";
import { Download, FileText, ScrollText } from "lucide-react";

import type { SoapNote } from "@/lib/types";
import { buildSessionTitle, downloadSessionPdf, type PdfSection } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

type Kind = "Transcript" | "Summary";

const SOAP_LABELS: [keyof SoapNote, string][] = [
  ["subjective", "Subjective"],
  ["objective", "Objective"],
  ["assessment", "Assessment"],
  ["plan", "Plan"],
];

function sectionsFor(
  kind: Kind,
  transcript: string | null,
  soap: SoapNote | null,
): PdfSection[] {
  if (kind === "Transcript") {
    return [{ body: transcript ?? "No transcript available." }];
  }
  if (!soap) return [{ body: "No summary available." }];
  return SOAP_LABELS.map(([key, heading]) => ({ heading, body: soap[key] }));
}

export function SessionDocPreview({
  kind,
  sessionTitle,
  patientName,
  dateISO,
  transcript = null,
  soap = null,
}: {
  kind: Kind;
  sessionTitle: string;
  patientName: string | null;
  dateISO: string;
  transcript?: string | null;
  soap?: SoapNote | null;
}) {
  const [open, setOpen] = useState(false);
  const sections = sectionsFor(kind, transcript, soap);
  const Icon = kind === "Transcript" ? ScrollText : FileText;

  function handleDownload() {
    downloadSessionPdf({ sessionTitle, patientName, kind, dateISO, sections });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Icon />
        {kind}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-xl">
          <SheetTitle>{buildSessionTitle(sessionTitle, patientName)}</SheetTitle>
          <SheetDescription>
            {kind} · {new Date(dateISO).toLocaleString()}
          </SheetDescription>

          <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
            {kind === "Transcript" ? (
              <p className="whitespace-pre-wrap rounded-xl bg-foreground/[0.03] p-4 text-sm leading-relaxed text-foreground/85">
                {sections[0]?.body}
              </p>
            ) : (
              sections.map((s) => (
                <div key={s.heading} className="rounded-xl bg-foreground/[0.03] p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">
                    {s.heading}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/85">
                    {s.body?.trim() || "—"}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 flex justify-end border-t border-border pt-4">
            <Button onClick={handleDownload}>
              <Download />
              Download PDF
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
