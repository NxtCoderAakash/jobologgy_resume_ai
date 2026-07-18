import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "Jobologyy AI — Tailor your résumé to any job",
  description:
    "Upload your CV and a job description. Get an ATS-optimized résumé, a before/after score, and a report explaining every improvement.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
