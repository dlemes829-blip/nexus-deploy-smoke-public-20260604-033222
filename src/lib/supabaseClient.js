import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseReady ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function saveActivity(event, metadata = {}) {
  if (!supabase) return { demo: true, event, metadata };
  return supabase.from("create_tiny_static_landing_page_called_nexus_dep_activity").insert({
    event,
    metadata,
  });
}
