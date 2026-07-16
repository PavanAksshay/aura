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
    <div className="glass card-lift relative h-full overflow-hidden rounded-2xl p-5">
      <Icon
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-2 size-16 text-primary/10"
      />
      <p className="text-gradient font-display text-[2.6rem] font-bold leading-none tabular-nums">
        {typeof value === "number" ? <NumberTicker value={value} /> : value}
      </p>
      <p className="mt-2 text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
