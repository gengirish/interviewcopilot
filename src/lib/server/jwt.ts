import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE_NAME = "auth-token";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "development") {
    return "dev-secret-change-in-production";
  }
  throw new Error("AUTH_SECRET must be set in production");
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
