"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WIDGETS } from "./home-widgets";

/** Saves which widgets this admin sees on the home page, in the order given. */
export async function saveWidgetsAction(form: FormData) {
  const access = await requireAdmin();
  const order = WIDGETS.map((w) => ({ key: w.key, on: form.get(`on_${w.key}`) === "on", pos: Number(form.get(`pos_${w.key}`)) || 99 }))
    .filter((w) => w.on)
    .sort((a, b) => a.pos - b.pos)
    .map((w) => w.key);
  await createAdminClient().from("profiles").update({ home_widgets: order }).eq("id", access.userId);
  revalidatePath("/admin");
}
