import { NextResponse } from "next/server";
import { runDialer } from "@/lib/dialer/run";

export const maxDuration = 60;

/** Vercel Cron, every minute (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runDialer());
}
