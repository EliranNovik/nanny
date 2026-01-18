import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Validate environment variables
if (!supabaseUrl || supabaseUrl.includes("your-project-id")) {
  console.error(
    "❌ Missing or invalid VITE_SUPABASE_URL. Please update apps/web/.env with your actual Supabase URL"
  );
}

if (!supabaseAnonKey || supabaseAnonKey.includes("your-anon-key")) {
  console.error(
    "❌ Missing or invalid VITE_SUPABASE_ANON_KEY. Please update apps/web/.env with your actual Supabase anon key"
  );
}

// Create client even if env vars are missing (will fail gracefully on API calls)
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // Disable URL session detection to prevent hanging
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-client-info": "nanny-marketplace-web",
      },
    },
  }
);

