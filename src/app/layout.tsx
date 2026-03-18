import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewCopilot — Real-Time AI Interview Assistant",
  description: "Get instant AI-powered answers during live interviews. Upload your resume, start your session, and ace every question. Built for AI/ML/tech roles.",
  keywords: ["interview assistant","AI interview","job interview help","real-time answers","tech interview"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#030014" }}>{children}</body>
    </html>
  );
}
