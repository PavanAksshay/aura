"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Loader2,
  ChevronDown,
  ShieldAlert,
  Clock,
  GitFork,
} from "lucide-react";

import { crossReferenceGuidelines } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { CrossReferenceAnalysis, DiagnosticMatch } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DiagnosticGuidelinesPanel({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CrossReferenceAnalysis | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    try {
      const data = await crossReferenceGuidelines(sessionId);
      setAnalysis(data);
      if (data.matches.length > 0) {
        setExpandedId(data.matches[0]?.framework_id ?? null);
        toast.success("Diagnostic cross-reference completed.");
      } else {
        toast.info("No matching diagnostic guidelines found.");
      }
    } catch (err) {
      toast.error(
        "Could not cross-reference guidelines",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              Clinical Guidelines Reference (DSM-5-TR / ICD-11)
            </h3>
            <Badge tone="primary">Local RAG</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cross-reference documented symptoms and interventions against standard diagnostic frameworks.
          </p>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={loading}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Cross-referencing…
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              {analysis ? "Re-analyze Criteria" : "Cross-Reference Guidelines"}
            </>
          )}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-4"
          >
            {analysis.clinical_summary && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground">
                <span className="font-bold text-primary mr-1.5">Clinical Insight:</span>
                {analysis.clinical_summary}
              </div>
            )}

            <div className="space-y-3">
              {analysis.matches.map((m: DiagnosticMatch) => {
                const isOpen = expandedId === m.framework_id;
                return (
                  <div
                    key={m.framework_id}
                    className="overflow-hidden rounded-lg border border-border bg-card transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : m.framework_id)}
                      className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-foreground">
                            {m.title}
                          </span>
                          <span className="rounded-xs border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            DSM-5: {m.dsm5_code}
                          </span>
                          <span className="rounded-xs border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            ICD-11: {m.icd11_code}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Badge
                          tone={
                            m.confidence === "high"
                              ? "primary"
                              : m.confidence === "moderate"
                                ? "amber"
                                : "muted"
                          }
                        >
                          {m.confidence} match
                        </Badge>
                        <ChevronDown
                          className={`size-4 text-muted-foreground transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border/70 bg-muted/20 p-4 space-y-3.5 text-xs">
                        {/* Met Criteria */}
                        <div>
                          <p className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            Supported Criteria (Documented in Session)
                          </p>
                          <ul className="mt-2 space-y-2">
                            {m.met_criteria.map((c, i) => (
                              <li
                                key={i}
                                className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5"
                              >
                                <p className="font-medium text-foreground">{c.criterion}</p>
                                {c.evidence_quote && (
                                  <p className="mt-1 text-[11px] italic text-muted-foreground">
                                    “{c.evidence_quote}”
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Unmet / Pending Criteria */}
                        {m.unmet_or_pending_criteria.length > 0 && (
                          <div>
                            <p className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-amber-600 dark:text-amber-400">
                              <Clock className="size-3.5" />
                              Unmet or Pending Verification
                            </p>
                            <ul className="mt-1.5 list-disc list-inside space-y-1 text-muted-foreground">
                              {m.unmet_or_pending_criteria.map((u, i) => (
                                <li key={i}>{u}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Differentials & Rule-Outs */}
                        {m.differential_considerations && (
                          <div className="rounded-md border border-border bg-card p-3">
                            <p className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-foreground">
                              <GitFork className="size-3.5 text-primary" />
                              Differential Considerations & Rule-Outs
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              {m.differential_considerations}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
