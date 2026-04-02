import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import {
  consumeRateLimitToken,
  rateLimitKeyForRequest,
} from "@/lib/server/rate-limit";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["text/plain", "application/pdf"]);

/** Max characters returned to the client (resume snippet for prompts). */
const MAX_RESPONSE_TEXT_CHARS = 4000;
/** Cap raw extracted text length (txt/pdf) before slicing to response (abuse / memory guard). */
const MAX_EXTRACTED_SOURCE_CHARS = 500_000;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;

function jsonTooManyRequests(retryAfterSeconds: number): NextResponse {
  const res = NextResponse.json(
    {
      error: "Too many requests. Please wait before uploading again.",
      code: "rate_limited",
      retryAfterSeconds,
    },
    { status: 429 }
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}

function clipExtractedText(raw: string): string {
  const capped =
    raw.length > MAX_EXTRACTED_SOURCE_CHARS
      ? raw.slice(0, MAX_EXTRACTED_SOURCE_CHARS)
      : raw;
  return capped.slice(0, MAX_RESPONSE_TEXT_CHARS);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = rateLimitKeyForRequest({
    namespace: "extract-resume",
    userId: user.id,
    req,
  });
  const rl = consumeRateLimitToken({
    key: rlKey,
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
  });
  if (!rl.allowed) {
    return jsonTooManyRequests(rl.retryAfterSeconds);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!SUPPORTED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a .txt or .pdf file." },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Keep it under 5MB." },
        { status: 400 }
      );
    }

    if (file.type === "text/plain") {
      let text: string;
      try {
        text = await file.text();
      } catch {
        return NextResponse.json(
          { text: "", error: "Could not read file" },
          { status: 400 }
        );
      }
      return NextResponse.json({ text: clipExtractedText(text) });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return NextResponse.json(
        { text: "", error: "Could not read file" },
        { status: 400 }
      );
    }

    let pdfParse: (typeof import("pdf-parse"))["default"];
    try {
      pdfParse = (await import("pdf-parse")).default;
    } catch {
      return NextResponse.json(
        { text: "", error: "PDF parser unavailable" },
        { status: 500 }
      );
    }

    let parsed: { text?: unknown };
    try {
      parsed = await pdfParse(buffer);
    } catch {
      return NextResponse.json(
        { text: "", error: "Could not parse PDF" },
        { status: 422 }
      );
    }

    const rawText =
      typeof parsed.text === "string" ? parsed.text : "";
    return NextResponse.json({ text: clipExtractedText(rawText) });
  } catch {
    return NextResponse.json(
      { text: "", error: "Could not parse file" },
      { status: 500 }
    );
  }
}
