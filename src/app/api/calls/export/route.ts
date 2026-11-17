import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyFilters, parseFilters } from "@/lib/calls/queries";
import { RESULTS, directionLabel, duration, outcomeLabel, statusLabel, type CallResult } from "@/components/calls/format";

const MAX_ROWS = 5000;

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The calls list as CSV (Excel opens it with Hebrew intact), with the same filters as the screen.
 * Portal: ?slug=<client> (members only). Admin: optional ?client=<id>.
 */
export async function GET(req: Request) {
  const access = await getAccess();
  if (!access) return new NextResponse(null, { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  let clientId: string | undefined;
  if (sp.slug) {
    const member = access.clients.find((c) => c.slug === sp.slug);
    if (!member) return new NextResponse(null, { status: 404 });
    clientId = member.id;
  } else {
    if (!access.isAdmin) return new NextResponse(null, { status: 404 });
    if (sp.client && /^[0-9a-f-]{36}$/i.test(sp.client)) clientId = sp.client;
  }
  let q = createAdminClient()
    .from("calls")
    .select("started_at, direction, external_number, agent_number, duration_secs, status, outcome, result, result_note, summary, agents(name), clients(name)")
    .order("started_at", { ascending: false })
    .limit(MAX_ROWS);
  if (clientId) q = q.eq("client_id", clientId);
  q = applyFilters(q, parseFilters(sp));
  const { data, error } = await q;
  if (error) return new NextResponse(null, { status: 500 });

  const head = ["תאריך", "שעה", ...(clientId ? [] : ["לקוח"]), "סוכן", "כיוון", "מספר", "מספר הסוכן", "משך", "מצב", "תוצאה", "פירוט", "סיכום"];
  const rows = (data ?? []).map((r) => {
    const at = new Date(r.started_at as string);
    const tz = { timeZone: "Asia/Jerusalem" } as const;
    const st = statusLabel[r.status as string] ?? outcomeLabel[r.outcome as keyof typeof outcomeLabel] ?? outcomeLabel.unknown;
    return [
      at.toLocaleDateString("he-IL", tz),
      at.toLocaleTimeString("he-IL", { ...tz, hour: "2-digit", minute: "2-digit" }),
      ...(clientId ? [] : [(r.clients as unknown as { name: string } | null)?.name ?? ""]),
      (r.agents as unknown as { name: string } | null)?.name ?? "",
      directionLabel[r.direction as keyof typeof directionLabel] ?? r.direction,
      r.external_number,
      r.agent_number,
      duration(r.duration_secs as number),
      st.label,
      r.result ? RESULTS[r.result as CallResult] : "",
      r.result_note,
      r.summary,
    ];
  });
  const csv = "﻿" + [head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calls-${day}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
