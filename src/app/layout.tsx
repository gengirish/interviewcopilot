import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InfinityHire Copilot — AI Interview Intelligence",
  description: "AI copilot for faster, smarter, and fairer interview decisions. Get real-time interview support, insights, and activation-driven analytics.",
  keywords: ["interview assistant","AI interview","job interview help","real-time answers","tech interview"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#030014" }}>{children}</body>
    </html>
  );
}
