"use client";

import { useActionState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveItem, type SaveState } from "./actions";

export function ItemForm({ slug, item }: { slug: string; item?: { id: string; title: string; body: string } }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, form) => {
    const res = await saveItem(prev, form);
    if (!item && res.ok) ref.current?.reset();
    return res;
  }, {});
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Input name="title" defaultValue={item?.title} placeholder="כותרת, למשל: מחירון, שאלות נפוצות, שעות פעילות" required className="h-12 rounded-2xl text-[17px] font-medium" />
      <Textarea name="body" defaultValue={item?.body} rows={item ? 6 : 4} placeholder="כל מה שהסוכנים צריכים לדעת על הנושא" className="rounded-2xl text-[16px] leading-relaxed" />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
          {pending ? "שומר…" : item ? "שמירה" : "הוספה"}
        </button>
        {state.error && <p className="text-[14px] text-destructive">{state.error}</p>}
        {state.ok && <p className="text-[14px] text-success">{state.ok}</p>}
      </div>
    </form>
  );
}
