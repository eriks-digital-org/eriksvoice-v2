import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[110px] w-full rounded-[18px] border-2 border-transparent bg-tint px-4 py-3 text-[16px] leading-relaxed text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:border-[#cbbcf8] focus-visible:bg-card disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
