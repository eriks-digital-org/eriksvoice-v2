import { NextResponse } from "next/server";
import { runDialer } from "@/lib/dialer/run";
import { runAutomations } from "@/lib/automations/engine";
import { runCallbacks } from "@/lib/calls/callback";
import { getSecret } from "@/lib/providers/secrets";

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
  const [dialer, automations, callbacks] = await Promise.all([
    runDialer(),
    runAutomations(),
    runCallbacks().catch((e) => {
      console.error("callbacks", e);
      return { placed: 0 };
    }),
  ]);
  return NextResponse.json({ dialer, automations, callbacks });
}
