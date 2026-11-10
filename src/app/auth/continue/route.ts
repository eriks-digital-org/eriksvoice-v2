import { NextResponse, type NextRequest } from "next/server";
import { getAccess, homeFor, promoteListedAdmin } from "@/lib/auth";

/** After sign-in: make a listed admin an admin (first time only) and go to the right home. */
export async function GET(request: NextRequest) {
  let access = await getAccess();
  if (!access) return NextResponse.redirect(new URL("/login", request.url));

  if (!access.isAdmin && (await promoteListedAdmin(access.userId, access.email))) {
    access = { ...access, isAdmin: true };
  }
  const next = request.nextUrl.searchParams.get("next") ?? "";
  const home = homeFor(access);
  const target = next.startsWith("/") && !next.startsWith("//") && next !== "/login" ? next : home;
  return NextResponse.redirect(new URL(target ?? "/login?error=no-access", request.url));
}
