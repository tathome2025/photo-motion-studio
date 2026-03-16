import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { LanguageSwitcher } from "@/components/language-switcher";
import { APP_NAME } from "@/lib/constants";
import { getServerLocale } from "@/lib/i18n-server";
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
    "Batch convert photos into motion clips, arrange them on a timeline, and export a clean final video.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale === "en" ? "en" : "zh-HK"}>
      <body className={`${sans.variable} ${mono.variable}`}>
        <div className="mx-auto flex w-full max-w-7xl justify-end px-6 pt-5 md:px-10">
          <LanguageSwitcher locale={locale} />
        </div>
        {children}
      </body>
    </html>
  );
}
