import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { dbConfig } from "@/db/config";

/**
 * Service-role client. BYPASSES RLS.
 *
 * Only for operations the anon key genuinely cannot perform:
 *  - creating auth users (clinic ADMIN provisioning, clinic staff creation)
 *  - writing the first clinic + clinic_config rows during provisioning
 *
 * Every caller must have already authorised the acting user. Because RLS is
 * bypassed here, application-level checks are the only boundary left.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never run in the browser");
  }

  if (!dbConfig.supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createSupabaseClient(dbConfig.supabaseUrl, dbConfig.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
