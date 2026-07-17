import { cn } from "@/lib/utils";

/**
 * Aura brand mark: three concentric arcs suggesting sound waves / an aura,
 * drawn with the brand gradient. SVG so it scales and themes cleanly.
 */
export function AuraMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-8", className)}
    >
      <defs>
        {/* userSpaceOnUse: these coords are in the 32-unit viewBox. Without it
            they read as bounding-box fractions (0–1), so the mark sits at the
            first stop and renders flat teal instead of the brand gradient. */}
        <linearGradient
          id="aura-g"
          gradientUnits="userSpaceOnUse"
          x1="4"
          y1="28"
          x2="28"
          y2="4"
        >
          <stop offset="0%" stopColor="var(--aurora-teal)" />
          <stop offset="55%" stopColor="var(--aurora-cyan)" />
          <stop offset="100%" stopColor="var(--aurora-violet)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="4" fill="url(#aura-g)" />
      <path
        d="M16 5.5a10.5 10.5 0 0 1 10.5 10.5"
        stroke="url(#aura-g)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M16 26.5A10.5 10.5 0 0 1 5.5 16"
        stroke="url(#aura-g)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function AuraWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AuraMark className="size-8" />
      <span className="text-gradient font-display text-[1.7rem] font-bold leading-none tracking-[-0.03em] lowercase">
        aura
      </span>
    </span>
  );
}
