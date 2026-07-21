import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseEnv } from "@/lib/env";

// Next.js 16 renamed the middleware file convention to proxy. Same semantics.
//
// Two jobs, and only these two: refresh the Supabase session cookie so it does
// not expire mid-shift, and bounce logged-out requests to /login. Authorization
// proper lives in lib/auth.ts next to the data -- this runs on every prefetch
// and must stay cheap.

// /api/health is the UptimeRobot keep-alive and must answer without a session.
const PUBLIC_PATHS = ["/login", "/auth", "/api/health"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // This call is what refreshes an expiring token and writes the new cookie
  // through setAll above. Removing it logs everyone out an hour into a shift.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Must return this exact response object, not a fresh NextResponse.next().
  // The refreshed auth cookies were written onto it.
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization. Without the
    // negative match this would run on CSS and JS and redirect them to /login.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
