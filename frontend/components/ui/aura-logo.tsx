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
      className={cn("size-6 text-foreground", className)}
    >
      <circle cx="16" cy="16" r="4" fill="currentColor" />
      <path
        d="M16 5.5a10.5 10.5 0 0 1 10.5 10.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M16 26.5A10.5 10.5 0 0 1 5.5 16"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function AuraWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <AuraMark className="size-6" />
      <span className="font-sans text-lg font-bold leading-none tracking-tight text-foreground lowercase">
        aura
      </span>
    </span>
  );
}
