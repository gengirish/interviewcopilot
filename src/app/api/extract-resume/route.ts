import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["text/plain", "application/pdf"]);

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      const text = await file.text();
      return NextResponse.json({ text: text.slice(0, 4000) });
    }

    // PDF — use pdf-parse
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    return NextResponse.json({ text: parsed.text.slice(0, 4000) });
  } catch (err) {
    return NextResponse.json({ text: "", error: "Could not parse file" }, { status: 500 });
  }
}
