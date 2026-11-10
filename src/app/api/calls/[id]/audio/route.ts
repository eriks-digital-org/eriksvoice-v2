import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { conversationAudio } from "@/lib/voice/elevenlabs";

/** The call recording, for an admin or a member of the call's business only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const access = await getAccess();
  if (!access) return new NextResponse(null, { status: 401 });
  const { data: call } = await createAdminClient()
    .from("calls")
    .select("client_id, provider_conversation_id, has_audio")
    .eq("id", id)
    .maybeSingle();
  if (!call || !call.has_audio) return new NextResponse(null, { status: 404 });
  if (!access.isAdmin && !access.clients.some((c) => c.id === call.client_id)) return new NextResponse(null, { status: 404 });
  try {
    const upstream = await conversationAudio(call.provider_conversation_id);
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
