import { NextResponse } from "next/server";
import { ingestConversation, verifySignature } from "@/lib/calls/ingest";
import type { ProviderConversation } from "@/lib/voice/elevenlabs";

/**
 * Post-call webhook from ElevenLabs (set once in ElevenLabs → Agents → Settings → Webhooks,
 * with the secret in ELEVENLABS_WEBHOOK_SECRET). Stores the call with its transcript and summary.
 */
export async function POST(req: Request) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifySignature(req.headers.get("elevenlabs-signature"), raw, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let event: { type?: string; data?: ProviderConversation };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (event.type !== "post_call_transcription" || !event.data?.conversation_id) return NextResponse.json({ ok: true });
  try {
    const stored = await ingestConversation(event.data);
    return NextResponse.json({ ok: true, stored });
  } catch (e) {
    console.error("call webhook", e);
    return NextResponse.json({ error: "store failed" }, { status: 500 });
  }
}
