import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";
import { randomBytes, scrypt } from "crypto";

const scryptAsync = promisify(scrypt);
const SALT_LEN = 16;
const KEY_LEN = 64;
const COOKIE_NAME = "auth-token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const AUTH_COOKIE_NAME = COOKIE_NAME;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "development") {
    return "dev-secret-change-in-production";
  }
  throw new Error("AUTH_SECRET must be set in production");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return derived.toString("hex") === hash;
}

export async function signToken(payload: { sub: string; email: string }): Promise<string> {
  const secret = new TextEncoder().encode(getSecret());
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(getSecret());
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub as string;
    const email = payload.email as string;
    if (!sub || !email) return null;
    return { sub, email };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getUserFromRequest(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email };
}
