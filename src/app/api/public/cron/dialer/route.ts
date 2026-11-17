import { NextResponse } from "next/server";
import { runDialer } from "@/lib/dialer/run";
import { runAutomations } from "@/lib/automations/engine";
import { runCallbacks } from "@/lib/calls/callback";
import { getSecret } from "@/lib/providers/secrets";
import { backfillAll } from "@/lib/calls/ingest";
import { israelNow } from "@/lib/time";
import { checkAnomalies } from "@/lib/health/checks";

export const maxDuration = 60;

/**
 * Called every minute by the database scheduler (pg_cron + pg_net, see the dialer_schedule
 * migration) with "Authorization: Bearer <ev_cron_secret from Vault>".
 */
export async function GET(req: Request) {
  const secret = (await getSecret("cron_secret")) ?? process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const now = israelNow();
  const [dialer, automations, callbacks, backfilled, anomalies] = await Promise.all([
    runDialer(),
    runAutomations(),
    runCallbacks().catch((e) => {
      console.error("callbacks", e);
      return { placed: 0 };
    }),
    // Once an hour: calls the post-call webhook missed (it also fires their automations).
    now.minute % 60 === 7
      ? backfillAll(started + 40_000).catch((e) => {
          console.error("backfill", e);
          return 0;
        })
      : Promise.resolve(0),
    // Once a day at 08:00: anomalies to the admin (no calls for 3 days, failures, disconnections).
    now.minute === 8 * 60
      ? checkAnomalies().catch((e) => {
          console.error("anomalies", e);
          return 0;
        })
      : Promise.resolve(0),
  ]);
  return NextResponse.json({ dialer, automations, callbacks, backfilled, anomalies });
}
