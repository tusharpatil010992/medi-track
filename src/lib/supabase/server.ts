import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

import { dbConfig } from "@/db/config";

/**
 * Server client bound to the request's auth cookies.
 *
 * Uses the anon key, so RLS applies. This is the default client for Server
 * Components and Server Actions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(dbConfig.supabaseUrl, dbConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Session refresh is handled by
          // middleware (src/middleware.ts), so ignoring this is safe.
        }
      },
    },
  });
}
