"use client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending: forced }: { children: React.ReactNode; pending?: boolean }) {
  const { pending } = useFormStatus();
  const busy = forced || pending;
  return (
    <button type="submit" className="cta-pill group !mt-2.5 h-16 w-full sm:h-[68px] sm:text-xl" disabled={busy}>
      {children}
      <span className="cta-dot group-hover:-rotate-90">
        {busy ? <Loader2 className="size-[22px] animate-spin" /> : <ArrowLeft className="size-[22px]" strokeWidth={2.2} />}
      </span>
    </button>
  );
}
