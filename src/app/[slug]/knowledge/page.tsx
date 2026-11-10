import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeRow } from "@/lib/data/types";
import { ItemForm } from "./ItemForm";
import { deleteItem } from "./actions";

export const metadata: Metadata = { title: "מידע על העסק" };

export default async function KnowledgePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { client } = await requireMember(slug);
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_items")
    .select("id, client_id, kind, title, body, all_agents, updated_at")
    .eq("client_id", client.id)
    .order("created_at");
  const items = (data ?? []) as KnowledgeRow[];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="מידע על העסק"
        description="מה שהסוכנים יודעים על העסק: שירותים, מחירים, שאלות ותשובות, תסריטים והנחיות. כל שינוי עולה לסוכנים מיד."
      />
      <Panel title="פריט חדש">
        <ItemForm slug={slug} />
      </Panel>
      {items.map((item) => (
        <Panel
          key={item.id}
          action={
            <form action={deleteItem}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={item.id} />
              <button aria-label={`מחיקת ${item.title}`} className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-destructive-soft hover:text-destructive">
                <Trash2 className="size-5" />
              </button>
            </form>
          }
          title={item.title}
        >
          <ItemForm slug={slug} item={item} />
        </Panel>
      ))}
    </div>
  );
}
