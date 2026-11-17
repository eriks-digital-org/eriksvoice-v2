import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecret } from "@/lib/providers/secrets";
import { HANDLERS, contactPhone, type ToolBody } from "@/lib/calltools/handlers";
import { TOOLS_HEADER, TOOLS_SECRET } from "@/lib/calltools/provider";

export const maxDuration = 30;

/**
 * In-call tools: the voice provider calls https://eriksvoice.co.il/api/public/voice/tools/<name>
 * while the agent is talking, with the X-EriksVoice-Key secret. The business is the one that
 * owns the agent (from the provider's system variable), never something the model says.
 * Always answers 200 with { result } so the agent can tell the caller what happened.
 */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const handler = HANDLERS[name];
  if (!handler) return NextResponse.json({ error: "not found" }, { status: 404 });
  const secret = await getSecret(TOOLS_SECRET);
  const given = req.headers.get(TOOLS_HEADER) ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: ToolBody;
  try {
    body = (await req.json()) as ToolBody;
  } catch {
    return NextResponse.json({ result: "הבקשה לא הובנה." });
  }

  const db = createAdminClient();
  const { data: agent } = await db.from("agents").select("id, client_id, name, status").eq("provider_agent_id", String(body.agent_id ?? "")).maybeSingle();
  if (!agent) return NextResponse.json({ result: "הסוכן לא מוכר למערכת." });
  const [{ data: client }, { data: numbers }] = await Promise.all([
    db.from("clients").select("name, slug, status, call_tools, meeting_minutes, meeting_invite").eq("id", agent.client_id).single(),
    db.from("phone_numbers").select("e164").eq("client_id", agent.client_id),
  ]);
  if (!client || client.status === "paused") return NextResponse.json({ result: "השירות של העסק מושהה כרגע." });
  if (!((client.call_tools as string[] | null) ?? []).includes(name)) return NextResponse.json({ result: "הפעולה הזו לא פעילה לעסק." });

  const phone = contactPhone(String(body.caller ?? ""), String(body.called ?? ""), (numbers ?? []).map((n) => n.e164 as string));
  try {
    const answer = await handler({
      db,
      clientId: agent.client_id as string,
      client: { name: client.name as string, slug: client.slug as string, meeting_minutes: (client.meeting_minutes as number) ?? 30, meeting_invite: client.meeting_invite === true },
      agentId: agent.id as string,
      agentName: agent.name as string,
      phone,
      conversationId: String(body.conversation_id ?? "").slice(0, 100),
      body,
    });
    return NextResponse.json(answer);
  } catch (e) {
    console.error("call tool", name, e);
    return NextResponse.json({ result: "הפעולה לא הצליחה בגלל תקלה. אומרים ללקוח שהצוות יחזור אליו." });
  }
}
