import { cn } from "@/lib/utils";

/**
 * Glassmorphism vertical timeline (adapted from a 21st.dev component and
 * re-themed to Aura's sage/aurora palette). Generic + reusable: pass items,
 * each rendered as a glowing node beside a glass card. Used for the Memory
 * tab's Q&A history.
 */

export interface TimelineItem {
  id: string;
  /** Small eyebrow label (e.g. a time). */
  label: string;
  title: string;
  description?: string;
  active?: boolean;
  onSelect?: () => void;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="relative">
      {/* Vertical gradient line */}
      <div className="absolute left-[7px] top-1.5 h-[calc(100%-0.75rem)] w-px bg-linear-to-b from-aurora-cyan/60 via-aurora-teal/50 to-aurora-violet/50" />

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="animate-fade-in relative flex items-start gap-3.5">
            {/* Glowing node */}
            <span
              className={cn(
                "relative z-10 mt-1.5 size-4 shrink-0 rounded-full border-2 border-background",
                "bg-linear-to-r from-aurora-cyan to-aurora-violet shadow-[0_0_10px] shadow-primary/50",
                item.active && "ring-2 ring-primary/50",
              )}
            />
            {/* Glass card */}
            <button
              type="button"
              onClick={item.onSelect}
              className={cn(
                "glass-subtle flex-1 cursor-pointer rounded-xl p-3 text-left transition-all duration-200 hover:border-primary/30",
                item.active && "border-primary/40 bg-primary/8",
              )}
            >
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                {item.label}
              </span>
              <p className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground">
                {item.title}
              </p>
              {item.description && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
