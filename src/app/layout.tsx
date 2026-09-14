import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { DM_Sans, Fraunces, Noto_Sans_Devanagari } from "next/font/google";
import { AuthGate } from "@/components/auth-gate";
import { DEFAULT_LANG, LANG_KEY } from "@/lib/i18n/dict";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#187a48",
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
  appleWebApp: {
    capable: true,
    title: "DudhSetu",
    statusBarStyle: "default",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const saved = (await cookies()).get(LANG_KEY)?.value;
  const lang = saved === "hi" ? "hi" : DEFAULT_LANG;
  return (
    <html
      lang={lang}
      className={`${sans.variable} ${display.variable} ${hindi.variable} h-full overflow-hidden antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden font-sans" suppressHydrationWarning>
        <AuthGate>{children}</AuthGate>
        <div id="ds-pop" />
      </body>
    </html>
  );
}
