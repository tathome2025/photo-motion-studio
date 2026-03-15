import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} | Photo To Motion`,
  description:
    "Batch convert photos into Kling-generated motion clips, arrange them on a timeline, and export a clean final video.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">
      <body className={`${sans.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
