import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ds/primitives";
import { Field } from "@/components/ds/kit";
import { BuilderForm } from "@/components/automations/BuilderForm";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIES, EMPTY_SPEC, type AutomationSpec } from "@/lib/automations/catalog";
import { saveTemplateAction } from "../actions";

export const metadata: Metadata = { title: "תבנית אוטומציה" };

const cls = "h-12 w-full rounded-2xl border border-input bg-card px-3 text-[16px]";

/** /admin/automations/new or /admin/automations/<id>. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  type T = { id: string; name: string; title: string; saves: string; category: string; sort: number; hidden: boolean; spec: AutomationSpec };
  let t: T | null = null;
  if (id !== "new") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const { data } = await createAdminClient().from("automation_templates").select("id, name, title, saves, category, sort, hidden, spec").eq("id", id).maybeSingle<T>();
    if (!data) notFound();
    t = data;
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={t ? t.title || t.name : "תבנית חדשה"} description="מה הלקוח רואה בגלריה, ואיך האוטומציה עובדת. את הסוכן בוחר כל לקוח בעצמו." />
      <div className="surface p-[22px] sm:p-8">
        <BuilderForm action={saveTemplateAction} hidden={t ? { id: t.id } : {}} initial={t?.spec ?? EMPTY_SPEC} name={t?.name ?? ""} agents={[]}>
          <section className="grid gap-4 rounded-3xl bg-tint/60 p-4 sm:grid-cols-2 sm:p-5">
            <Field label="כותרת בגלריה" hint="משפט אחד, בשפה של הלקוח" className="sm:col-span-2">
              <input name="title" defaultValue={t?.title ?? ""} placeholder="ליד חדש מקבל שיחה תוך דקה" className={cls} />
            </Field>
            <Field label="מה זה חוסך" className="sm:col-span-2">
              <input name="saves" defaultValue={t?.saves ?? ""} placeholder="אף ליד לא מתקרר, בלי לשבת על הטלפון" className={cls} />
            </Field>
            <Field label="קטגוריה">
              <select name="category" defaultValue={t?.category ?? "leads"} className={cls}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="סדר" hint="מספר קטן מופיע קודם">
              <input name="sort" type="number" defaultValue={t?.sort ?? 0} className={cls} />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-[16px] text-ink sm:col-span-2">
              <input type="checkbox" name="hidden" defaultChecked={t?.hidden ?? false} className="size-5" />
              מוסתרת מהלקוחות
            </label>
          </section>
        </BuilderForm>
      </div>
    </div>
  );
}
