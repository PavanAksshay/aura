import type { LucideIcon } from "lucide-react";

import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

export interface MetricItem {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent?: string;
}

export function MetricStrip({
  items,
  className,
}: {
  items: MetricItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-y-3.5 border-y border-border/60 py-3 sm:gap-x-6 lg:gap-x-8",
        className,
      )}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center text-muted-foreground/90">
                <Icon className={cn("size-4 sm:size-5 stroke-[1.6]", item.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="font-mono text-lg sm:text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {typeof item.value === "number" ? (
                    <NumberTicker value={item.value} />
                  ) : (
                    item.value
                  )}
                </p>
              </div>
            </div>
            {idx < items.length - 1 && (
              <span
                aria-hidden
                className="hidden size-1.5 rounded-full bg-muted-foreground/30 sm:inline-block"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
