import { NextResponse } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, normalizeLocale } from "@/lib/i18n";

const payloadSchema = z.object({
  locale: z.string(),
});

export async function POST(request: Request) {
  const payload = payloadSchema.parse(await request.json());
  const locale = normalizeLocale(payload.locale);
  const response = NextResponse.json({ ok: true, locale });

  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return response;
}
