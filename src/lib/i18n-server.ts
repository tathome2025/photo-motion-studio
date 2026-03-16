import { cookies } from "next/headers";

import { LOCALE_COOKIE_NAME, normalizeLocale } from "@/lib/i18n";

export async function getServerLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}
