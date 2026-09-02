import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/api/oauth",
  "/api/webhooks",
  "/api/inngest",
  "/oauth",
  "/webhooks",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get("mbs_session")?.value);

  if (!hasSession) {
    if (pathname.startsWith("/api/tenants")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/setup/:path*",
    "/settings/:path*",
    "/reports/:path*",
    "/billing",
    "/billing/:path*",
    "/api/tenants/:path*",
  ],
};
