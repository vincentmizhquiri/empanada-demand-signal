function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const env = {
  supabase: {
    url: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
}
