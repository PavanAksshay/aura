import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-input px-4 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/60",
        "focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-glow",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
