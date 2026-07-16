import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: every button gets pointer feedback, focus ring, press scale.
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-linear-120 from-aurora-cyan via-aurora-teal to-aurora-violet text-primary-foreground shadow-[0_8px_24px_-8px] shadow-primary/50 hover:brightness-110 hover:shadow-[0_10px_32px_-8px] hover:shadow-primary/60",
        secondary:
          "glass-subtle text-foreground hover:bg-foreground/8 hover:border-foreground/15",
        ghost:
          "text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
        outline:
          "border border-border bg-transparent text-foreground hover:border-primary/50 hover:text-primary",
        destructive:
          "bg-destructive/90 text-destructive-foreground hover:bg-destructive",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-xl px-7 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
