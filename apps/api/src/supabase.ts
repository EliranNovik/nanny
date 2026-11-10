import { createClient, type RealtimeClientOptions } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  realtime: {
    transport: ws as unknown as RealtimeClientOptions["transport"],
  },
});

