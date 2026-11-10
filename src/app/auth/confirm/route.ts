import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where links in emails land: an invitation, a password reset, an email change.
 * Accepts both forms Supabase sends (?code=… or ?token_hash=…&type=…), opens the
 * session, and continues to `next` (by default: choose a password).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const rawNext = url.searchParams.get("next") ?? "/set-password";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/set-password";
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  return NextResponse.redirect(new URL(ok ? next : "/login?error=link-expired", request.url));
}
