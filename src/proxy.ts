import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

/** Paths anyone may open without signing in. */
const PUBLIC = [/^\/$/, /^\/login$/, /^\/forgot-password$/, /^\/set-password$/, /^\/auth\//, /^\/api\/public\//];

/**
 * Keeps the Supabase session fresh on every request and sends signed-out visitors
 * of a private page (admin panel or a client portal) to /login.
 * Who may see which page is checked again in the pages themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC.some((re) => re.test(pathname));
  if (!isSupabaseConfigured) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();

  // A temporary password: nothing but choosing a permanent one until it is done.
  const mustChange = Boolean((data?.claims?.app_metadata as { must_change_password?: boolean } | undefined)?.must_change_password);
  if (mustChange && !/^\/(set-password$|auth\/|api\/|login$)/.test(pathname)) {
    const redirect = NextResponse.redirect(new URL("/set-password", request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  if (!data?.claims && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and files with an extension (landing assets, images).
    "/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
