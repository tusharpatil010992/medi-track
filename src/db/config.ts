/**
 * Universal database configuration.
 *
 * One config object for every environment (development / staging / production).
 * Values come from environment variables; nothing is hardcoded per-environment.
 */

export const dbConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",

  /**
   * Server-only. Next.js strips non-NEXT_PUBLIC_ variables from client bundles,
   * so this resolves to "" in the browser. Read it through
   * `createAdminClient()` (src/lib/supabase/admin.ts), never directly.
   */
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  /**
   * Reserved for future direct-Postgres access. supabase-js talks to PostgREST
   * over HTTP and does not hold a TCP pool, so these are not consumed today.
   */
  pool: {
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 20),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT ?? 30000),
  },

  queryTimeoutMs: Number(process.env.DB_QUERY_TIMEOUT ?? 30000),
  environment: process.env.NODE_ENV,
  enforceRLS: process.env.ENFORCE_RLS !== "false",
  enableQueryLogging: process.env.DB_LOG_QUERIES === "true",
} as const;

/** Returns the list of misconfigured variables. Empty array means valid. */
export function validateDbConfig(): string[] {
  const errors: string[] = [];

  if (!dbConfig.supabaseUrl) errors.push("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!dbConfig.supabaseAnonKey) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  if (!dbConfig.enforceRLS) errors.push("ENFORCE_RLS must never be disabled — RLS is mandatory");

  return errors;
}
