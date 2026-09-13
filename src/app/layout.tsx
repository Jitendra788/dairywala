import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Noto_Sans_Devanagari } from "next/font/google";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const sans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const hindi = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DudhSetu",
  description: "Milk collection, billing and dairy management",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="hi"
      className={`${sans.variable} ${display.variable} ${hindi.variable} h-full overflow-hidden antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden font-sans" suppressHydrationWarning>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
