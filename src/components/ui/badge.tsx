import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full border-0 px-3 py-0.5 text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40",
  {
    variants: {
      variant: {
        default: "bg-info-soft text-info",
        secondary: "bg-tint text-ink-muted",
        destructive: "bg-destructive-soft text-destructive",
        outline: "bg-card text-ink ring-1 ring-inset ring-[rgba(84,62,170,.16)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
