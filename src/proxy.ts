import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";
import { safeInternalPath } from "@/lib/safe-redirect";

const PUBLIC_PATHS = ["/", "/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Deny-by-default: any non-public route requires Supabase Auth.
  // Admin role is enforced in (dashboard)/layout + requireAdmin() on actions.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const next = safeInternalPath(pathname);
    if (next) {
      url.searchParams.set("next", next);
    } else {
      url.search = "";
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
