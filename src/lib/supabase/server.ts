import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { env } from "@/lib/env"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(env.supabase.url(), env.supabase.anonKey(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })
}
