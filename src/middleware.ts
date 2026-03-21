import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/server/jwt";

const PROTECTED_PATHS = ["/session", "/dashboard"];
const AUTH_PATHS = ["/login", "/signup"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectToLogin(req: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (isProtected(pathname)) {
    if (!token) {
      return redirectToLogin(req, pathname);
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return redirectToLogin(req, pathname);
    }
  }

  if (isAuthPath(pathname) && token) {
    const payload = await verifyToken(token);
    if (payload) {
      return NextResponse.redirect(new URL("/session", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/session/:path*", "/dashboard/:path*", "/login/:path*", "/signup/:path*"],
};
