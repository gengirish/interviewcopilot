import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    if (file.type === "text/plain") {
      const text = await file.text();
      return NextResponse.json({ text });
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
