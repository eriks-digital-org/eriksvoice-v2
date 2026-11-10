import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ds/primitives";
import { BuilderForm } from "@/components/automations/BuilderForm";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_SPEC, type AutomationSpec } from "@/lib/automations/catalog";
import { saveAutomationAction } from "../actions";

export const metadata: Metadata = { title: "אוטומציה" };

/** /<slug>/automations/new (optionally ?template=…) or /<slug>/automations/<id>. */
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ template?: string; apply?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { client } = await requireMember(slug);
  const db = await createClient();
  const { data: agents } = await db.from("agents").select("id, name").eq("client_id", client.id).eq("status", "active").order("created_at");

  let spec: AutomationSpec = EMPTY_SPEC;
  let name = "";
  const hidden: Record<string, string> = { slug };
  let note: string | null = null;

  if (id === "new") {
    if (sp.template && /^[0-9a-f-]{36}$/i.test(sp.template)) {
      const { data: t } = await db.from("automation_templates").select("id, name, spec, version").eq("id", sp.template).maybeSingle();
      if (t) {
        spec = t.spec as AutomationSpec;
        name = t.name;
        hidden.template_id = t.id;
        hidden.template_version = String(t.version);
      }
    }
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const { data: a } = await db.from("automations").select("id, name, spec, template_id, template_version").eq("id", id).eq("client_id", client.id).maybeSingle();
    if (!a) notFound();
    spec = a.spec as AutomationSpec;
    name = a.name;
    hidden.id = a.id;
    if (a.template_id) {
      const { data: t } = await db.from("automation_templates").select("spec, version").eq("id", a.template_id).maybeSingle();
      if (t && a.template_version && t.version > a.template_version) {
        if (sp.apply === "1") {
          // Take the template's new version, but keep the client's own agent choice.
          spec = { ...(t.spec as AutomationSpec), agent_id: spec.agent_id ?? null };
          hidden.template_version = String(t.version);
          note = "הטופס מציג את הגרסה החדשה של התבנית. שומרים כדי להחיל אותה.";
        } else {
          note = `יש גרסה חדשה לתבנית. <a href="?apply=1">להציג אותה</a>`;
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={id === "new" ? "אוטומציה חדשה" : name} description="כאשר משהו קורה ← מתי ← מה עושים." />
      {note && (
        <p className="rounded-2xl bg-tint p-4 text-[15px] text-ink">
          {note.includes("<a") ? (
            <>
              יש גרסה חדשה לתבנית.{" "}
              <a href="?apply=1" className="font-medium text-violet underline">
                להציג אותה
              </a>
            </>
          ) : (
            note
          )}
        </p>
      )}
      <div className="surface p-[22px] sm:p-8">
        <BuilderForm action={saveAutomationAction} hidden={hidden} initial={spec} name={name} agents={agents ?? []} />
      </div>
    </div>
  );
}
