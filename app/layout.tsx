import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GhostInTheCodebase — Code Autopsy & Time-Travel Debugger",
  description:
    "See what the AI builds. Know when it breaks it. A 3D code city plus a time-travel autopsy for AI coding-agent sessions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen selection:bg-accent/30">{children}</body>
    </html>
  );
}
