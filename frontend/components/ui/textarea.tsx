import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/60",
        "focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-glow",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
