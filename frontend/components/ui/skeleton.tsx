import { cn } from "@/lib/utils";

/** Shimmer placeholder used by route-level loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("animate-shimmer rounded-xl", className)} />
  );
}
