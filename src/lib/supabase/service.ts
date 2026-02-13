import "server-only"
import { createClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"

export const supabaseAdmin = createClient(
  env.supabase.url(),
  env.supabase.serviceRoleKey(),
  { auth: { persistSession: false } }
)
