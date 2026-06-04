import { createBrowserClient, createServerClient } from '@supabase/ssr'

// ── Browser client (use in React components and client-side code) ──────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Server client (use in Route Handlers and Server Components) ────────────
export async function createServerClientInstance() {
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — safe to ignore
          }
        },
      },
    }
  )
}

// ── Helper: get current user server-side ──────────────────────────────────
export async function getCurrentUser() {
  const supabase = await createServerClientInstance()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}
