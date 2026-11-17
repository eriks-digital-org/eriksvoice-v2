import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { rateOk } from "@/lib/security/rate";

export interface Problem {
  clientId: string;
  clientName: string;
  what: string;
  detail: string;
  link: string;
}

const STUCK_MINUTES = 15;

/** Everything that is broken right now, per client (for the health screen). */
export async function currentProblems(): Promise<{ problems: Problem[]; overdueRuns: number }> {
  const db = createAdminClient();
  const overdue = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [{ data: clients }, { data: agents }, { data: numbers }, { data: conns }, { data: runs }, { count: overdueRuns }] = await Promise.all([
    db.from("clients").select("id, name"),
    db.from("agents").select("client_id, name, sync_error").eq("sync_status", "failed"),
    db.from("phone_numbers").select("client_id, e164, route_error").not("route_error", "is", null),
    db.from("connections").select("client_id, kind").eq("status", "error"),
    db.from("automation_runs").select("client_id, last_error, automations(name)").eq("status", "failed").gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(50),
    db.from("automation_runs").select("id", { count: "exact", head: true }).eq("status", "queued").lt("run_at", overdue),
  ]);
  const name = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));
  const p = (clientId: string, what: string, detail: string, tab = ""): Problem => ({
    clientId,
    clientName: name.get(clientId) ?? "",
    what,
    detail: (detail ?? "").slice(0, 300),
    link: `/admin/clients/${clientId}${tab}`,
  });
  const problems: Problem[] = [
    ...(agents ?? []).map((a) => p(a.client_id, `הסנכרון של "${a.name}" נכשל`, a.sync_error ?? "")),
    ...(numbers ?? []).map((n) => p(n.client_id, `המספר ${n.e164} לא מנותב`, n.route_error ?? "")),
    ...(conns ?? []).map((c) => p(c.client_id, `החיבור ${c.kind} מנותק`, "")),
    ...(runs ?? []).map((r) =>
      p(r.client_id, `אוטומציה נכשלה: ${(r.automations as unknown as { name: string } | null)?.name ?? ""}`, r.last_error ?? "", ""),
    ),
  ];
  return { problems, overdueRuns: overdueRuns ?? 0 };
}

/**
 * Daily anomaly check (from the minute cron, 08:00 Israel time). One admin notification per
 * client per kind per day: no calls for 3 days, many failed calls, a disconnected connection,
 * and automations that keep failing.
 */
export async function checkAnomalies(): Promise<number> {
  const db = createAdminClient();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const since3d = new Date(Date.now() - 3 * 86400_000).toISOString();
  const since1d = new Date(Date.now() - 86400_000).toISOString();
  const [{ data: clients }, { data: active }, { data: recent }, { data: calls1d }, { data: conns }, { data: failedRuns }] = await Promise.all([
    db.from("clients").select("id, name, created_at").eq("status", "active"),
    db.from("agents").select("client_id").eq("status", "active"),
    db.from("calls").select("client_id").gte("started_at", since3d),
    db.from("calls").select("client_id, status, direction").gte("started_at", since1d),
    db.from("connections").select("client_id, kind").eq("status", "error"),
    db.from("automation_runs").select("client_id").eq("status", "failed").gte("created_at", since1d),
  ]);
  const withAgents = new Set((active ?? []).map((a) => a.client_id as string));
  const called = new Set((recent ?? []).map((c) => c.client_id as string));
  let sent = 0;
  const alert = async (c: { id: string; name: string }, kind: string, title: string, body: string) => {
    if (!(await rateOk(`anomaly:${c.id}:${kind}:${day}`, 1, 86400))) return;
    await notify({ clientId: null, kind: "anomaly", title: `${c.name}: ${title}`, body, link: `/admin/clients/${c.id}`, email: true });
    sent++;
  };
  for (const c of (clients ?? []) as { id: string; name: string; created_at: string }[]) {
    if (!withAgents.has(c.id)) continue;
    if (!called.has(c.id) && c.created_at < since3d) await alert(c, "no_calls", "אין שיחות כבר 3 ימים", "לבדוק שהמספר מנותב והסוכן פעיל.");
    const mine = (calls1d ?? []).filter((x) => x.client_id === c.id && x.direction === "outbound");
    // Technical failures only ("no answer" is normal for outbound).
    const bad = mine.filter((x) => x.status === "failed").length;
    if (mine.length >= 10 && bad / mine.length >= 0.5)
      await alert(c, "failed_calls", `${Math.round((bad / mine.length) * 100)}% מהשיחות היוצאות לא יצאו (תקלה) ב־24 השעות האחרונות`, `${bad} מתוך ${mine.length} שיחות.`);
    const broken = (conns ?? []).filter((x) => x.client_id === c.id).map((x) => x.kind);
    if (broken.length) await alert(c, "connection", "חיבור מנותק", broken.join(", "));
    const fails = (failedRuns ?? []).filter((x) => x.client_id === c.id).length;
    if (fails >= 3) await alert(c, "automations", `${fails} אוטומציות נכשלו ב־24 השעות האחרונות`, "הפירוט במסך האוטומציות של הלקוח.");
  }
  return sent;
}
