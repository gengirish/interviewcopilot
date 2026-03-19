import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "interviewcopilot",
    timestamp: new Date().toISOString(),
  });
}
