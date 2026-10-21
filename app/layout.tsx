import type { Metadata, Viewport } from "next";
import {
  Instrument_Serif,
  Inter_Tight,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import "./styles/landing.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: true,
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const title = "GhostInTheCodebase — See what the AI builds";
const description =
  "A black-box recorder and time-travel autopsy for AI coding agents. Ghost records every turn, blames the exact prompt that caused a regression, and rolls the file back in one click.";

const siteUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  title: {
    default: title,
    template: "%s — GhostInTheCodebase",
  },
  description,
  applicationName: "GhostInTheCodebase",
  keywords: [
    "AI coding agents",
    "regression attribution",
    "time-travel debugging",
    "code autopsy",
    "TestSprite",
    "developer tools",
  ],
  authors: [{ name: "GhostInTheCodebase" }],
  category: "developer tools",
  openGraph: {
    type: "website",
    title,
    description,
    siteName: "GhostInTheCodebase",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#05060A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}.preloader{display:none!important}`}</style>
        </noscript>
      </body>
    </html>
  );
}
