import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Validate environment variables
if (!supabaseUrl || supabaseUrl.includes("your-project-id")) {
  console.error(
    "❌ Missing or invalid VITE_SUPABASE_URL. Please update apps/web/.env with your actual Supabase URL",
  );
}

if (!supabaseAnonKey || supabaseAnonKey.includes("your-anon-key")) {
  console.error(
    "❌ Missing or invalid VITE_SUPABASE_ANON_KEY. Please update apps/web/.env with your actual Supabase anon key",
  );
}

// Create client even if env vars are missing (will fail gracefully on API calls)
/**
 * The browser lock throws as soon as another tab or a reload still holds it,
 * and a waiting queue can deadlock the session read. Run the auth work directly.
 */
async function authLock<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  return fn();
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Required so email confirmation / magic links can establish a session from the redirect URL.
      detectSessionInUrl: true,
      lock: authLock,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-client-info": "nanny-marketplace-web",
      },
    },
  },
);

let sharedSessionRequest: ReturnType<typeof supabase.auth.getSession> | null =
  null;

/** Deduplicates concurrent session reads so Supabase does not contend for its auth storage lock. */
export function getSupabaseSession() {
  if (!sharedSessionRequest) {
    sharedSessionRequest = supabase.auth.getSession().finally(() => {
      sharedSessionRequest = null;
    });
  }
  return sharedSessionRequest;
}
