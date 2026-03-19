import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/session", "/dashboard"];
const AUTH_PATHS = ["/login", "/signup"];
const AUTH_COOKIE_NAME = "auth-token";

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (isProtected(pathname) && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath(pathname) && token) {
    return NextResponse.redirect(new URL("/session", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/session/:path*", "/dashboard/:path*", "/login/:path*", "/signup/:path*"],
};
