import { NextRequest, NextResponse } from "next/server";
import { attachClearedSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "?error=uninstalled";
  const response = NextResponse.redirect(url);
  attachClearedSessionCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
