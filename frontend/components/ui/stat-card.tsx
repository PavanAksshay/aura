import type { LucideIcon } from "lucide-react";

import { NumberTicker } from "@/components/ui/number-ticker";

/**
 * Number-forward stat: the value leads in large gradient display type, with the
 * icon as a faint watermark in the corner and the label beneath. Shared across
 * the dashboard, patients, and profile so every stat surface reads the same.
 * Numeric values count up on first view (NumberTicker).
 */
export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-card border border-border rounded-md p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon aria-hidden className="size-4 text-muted-foreground shrink-0" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {typeof value === "number" ? <NumberTicker value={value} /> : value}
      </p>
    </div>
  );
}
