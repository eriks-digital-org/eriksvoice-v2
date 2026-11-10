import { Hammer } from "lucide-react";
import { PageHeader, Panel } from "@/components/ds/primitives";

/** A screen that is part of phase 1 but not built yet. */
export function ComingSoon({ title, soft, description, items }: { title: string; soft?: string; description: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={title} soft={soft} description={description} />
      <Panel>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#ece6fe,#e2f8f1)] text-violet">
            <Hammer className="size-6" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[20px] font-medium text-ink">המסך הזה בבנייה</h2>
            <p className="mt-1 text-[16px] text-ink-muted">מה יהיה כאן:</p>
            <ul className="mt-3 list-disc space-y-1.5 ps-5 text-[16px] text-ink">
              {items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}
