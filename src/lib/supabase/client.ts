import { createBrowserClient } from "@supabase/ssr";

import { dbConfig } from "@/db/config";

/** Browser client. Uses the anon key, so every query is subject to RLS. */
export function createClient() {
  return createBrowserClient(dbConfig.supabaseUrl, dbConfig.supabaseAnonKey);
}
