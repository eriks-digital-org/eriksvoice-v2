"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl text-[16px] font-medium cursor-pointer transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(.2,.7,.1,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#cbbcf8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Black CTA from the landing: the first icon sits on a cyan tile; no icon gets a cyan dot.
        default:
          "bg-cta text-white shadow-[0_14px_30px_-18px_rgba(0,0,0,.6)] hover:bg-[#1b1b22] ps-5 pe-2 [&>svg:first-child]:box-content [&>svg:first-child]:rounded-[11px] [&>svg:first-child]:bg-cta-dot [&>svg:first-child]:p-[7px] [&>svg:first-child]:text-black [&>svg:first-child]:order-last [&:not(:has(>svg))]:pe-5 [&:not(:has(>svg))]:after:size-2 [&:not(:has(>svg))]:after:rounded-full [&:not(:has(>svg))]:after:bg-cta-dot [&:not(:has(>svg))]:after:content-['']",
        destructive:
          "bg-destructive-soft text-destructive hover:bg-[#ffd6e6] [&_svg]:text-destructive",
        outline:
          "border border-[rgba(84,62,170,.16)] bg-card text-ink shadow-[0_10px_28px_-22px_rgba(60,40,140,.5)] hover:bg-tint",
        secondary: "bg-tint text-ink hover:bg-accent [&_svg]:text-violet",
        ghost: "text-ink-muted hover:bg-tint hover:text-ink",
        link: "text-violet underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-5",
        sm: "min-h-12 rounded-[14px] px-4 text-[15px] [&>svg:first-child]:p-[6px]",
        lg: "min-h-14 px-6 text-[18px] rounded-[18px] [&>svg:first-child]:size-5 [&>svg:first-child]:p-[10px] [&>svg:first-child]:rounded-[13px]",
        icon: "size-12 rounded-full p-0 [&>svg:first-child]:order-none [&>svg:first-child]:bg-transparent [&>svg:first-child]:p-0 [&>svg:first-child]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
