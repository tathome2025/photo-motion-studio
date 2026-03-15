import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function assertSupabaseAdmin() {
  const client = getSupabaseAdmin();

  if (!client) {
    throw new Error(
      "Supabase env 未設定。請先提供 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY。",
    );
  }

  return client;
}
