# Agent 6 — Supabase Auth + Save Results

## Context
- Agents 2, 3, 4, 5 are complete
- The upload → parse → CCC calculate → recommendations → result panel flow is working
- This agent adds the final layer: authentication and persisting results to the database
- Users can already USE the app anonymously. This agent lets them SAVE their results.
- The Prisma schema already has `Company` and `CCCSnapshot` models from Agent 1

---

## Files to Implement or Modify

```
/lib/auth/supabase.ts                    ← implement (empty file exists)
/components/landing/SignUpModal.tsx      ← create
/app/api/snapshots/save/route.ts         ← create
/app/login/page.tsx                      ← create
/components/landing/Navbar.tsx           ← modify (add auth state)
/app/layout.tsx                          ← modify (add toast provider)
```

---

## Prerequisites — Run These First

```bash
# 1. Install Supabase SSR package
npm install @supabase/ssr @supabase/supabase-js

# 2. Install toast library
npm install sonner

# 3. Verify Prisma schema has CCCSnapshot model
npx prisma studio
# Check that Company and CCCSnapshot tables exist
# If migration hasn't run: npx prisma migrate dev --name init
```

---

## Step 1 — Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Get both values from:
**Supabase Dashboard → your project → Settings → API**

These are safe to prefix with `NEXT_PUBLIC_` — they are the public anon key,
not the service role key. Never add the service role key to `.env.local`.

---

## Step 2 — `/lib/auth/supabase.ts`

Create two Supabase clients — one for the browser, one for the server.
This follows the official `@supabase/ssr` pattern for Next.js App Router.

```typescript
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Browser client (use in React components and client-side code) ──────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Server client (use in Route Handlers and Server Components) ────────────
export async function createServerClientInstance() {
  const cookieStore = await cookies()
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
```

---

## Step 3 — Prisma Schema Verification

Open `/prisma/schema.prisma` and confirm these two models exist exactly as shown.
If they are missing or different, update the schema and run `npx prisma migrate dev --name add_ccc_snapshot`.

```prisma
model Company {
  id           String        @id @default(cuid())
  name         String
  city         String?
  fabricTypes  String[]      // e.g. ["cotton_knit", "polyester_blend"]
  supabaseUid  String        @unique  // links to Supabase auth user
  createdAt    DateTime      @default(now())
  snapshots    CCCSnapshot[]
}

model CCCSnapshot {
  id             String   @id @default(cuid())
  companyId      String
  company        Company  @relation(fields: [companyId], references: [id])

  // CCC metric values
  dio            Float
  dso            Float
  dpo            Float
  ccc            Float
  benchmarkCCC   Float
  gapDays        Float

  // Context
  periodDays     Int
  dataCompleteness Float   @default(1.0)

  // Recommendations stored as JSON
  recommendations Json     // stores the full Recommendation[] array

  calculatedAt   DateTime
  createdAt      DateTime @default(now())

  @@index([companyId, createdAt])
}
```

After any schema change:
```bash
npx prisma migrate dev --name add_ccc_snapshot
npx prisma generate
```

---

## Step 4 — `/app/api/snapshots/save/route.ts`

This route receives the CCC result and company details, creates or finds the Company
record, and saves a CCCSnapshot row.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/supabase'

// ── Validation schema ──────────────────────────────────────────────────────
const SaveRequestSchema = z.object({
  company: z.object({
    name: z.string().min(1).max(100),
    city: z.string().optional(),
    fabricTypes: z.array(z.string()).default([]),
  }),
  cccResult: z.object({
    dio: z.object({ value: z.number(), benchmark: z.number(), gapDays: z.number(), trendDelta: z.number(), dataCompleteness: z.number() }),
    dso: z.object({ value: z.number(), benchmark: z.number(), gapDays: z.number(), trendDelta: z.number(), dataCompleteness: z.number() }),
    dpo: z.object({ value: z.number(), benchmark: z.number(), gapDays: z.number(), trendDelta: z.number(), dataCompleteness: z.number() }),
    ccc: z.number(),
    benchmarkCCC: z.number(),
    gapDays: z.number(),
    periodDays: z.number(),
    calculatedAt: z.string(),
  }),
  recommendations: z.array(z.object({
    id: z.string(),
    dimension: z.enum(['DIO', 'DSO', 'DPO']),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    title: z.string(),
    explanation: z.string(),
    actionSteps: z.array(z.string()),
    estimatedDaysReduction: z.number(),
    estimatedCashFreedLakhs: z.number(),
  })),
})

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Verify the user is authenticated
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorised — please sign in first' },
      { status: 401 }
    )
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SaveRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { company, cccResult, recommendations } = parsed.data

  try {
    // 3. Upsert Company record (create on first save, update on subsequent saves)
    const companyRecord = await prisma.company.upsert({
      where: { supabaseUid: user.id },
      update: {
        name: company.name,
        city: company.city ?? null,
        fabricTypes: company.fabricTypes,
      },
      create: {
        supabaseUid: user.id,
        name: company.name,
        city: company.city ?? null,
        fabricTypes: company.fabricTypes,
      },
    })

    // 4. Save the CCCSnapshot
    const snapshot = await prisma.cCCSnapshot.create({
      data: {
        companyId: companyRecord.id,
        dio: cccResult.dio.value,
        dso: cccResult.dso.value,
        dpo: cccResult.dpo.value,
        ccc: cccResult.ccc,
        benchmarkCCC: cccResult.benchmarkCCC,
        gapDays: cccResult.gapDays,
        periodDays: cccResult.periodDays,
        dataCompleteness: Math.min(
          cccResult.dio.dataCompleteness,
          cccResult.dso.dataCompleteness,
          cccResult.dpo.dataCompleteness
        ),
        recommendations: recommendations as any,
        calculatedAt: new Date(cccResult.calculatedAt),
      },
    })

    return NextResponse.json({
      success: true,
      snapshotId: snapshot.id,
      companyId: companyRecord.id,
    })

  } catch (error) {
    console.error('[snapshots/save] Database error:', error)
    return NextResponse.json(
      { error: 'Failed to save results — please try again' },
      { status: 500 }
    )
  }
}
```

---

## Step 5 — `/components/landing/SignUpModal.tsx`

This modal appears when the user clicks "Save my results" in the ResultPanel.
It handles both sign-up (new users) and sign-in (returning users) in one form.

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/auth/supabase'
import { toast } from 'sonner'
import type { CCCResult, Recommendation } from '@/lib/ccc-engine/types'

interface SignUpModalProps {
  isOpen: boolean
  onClose: () => void
  cccResult: CCCResult
  recommendations: Recommendation[]
}

const FABRIC_TYPES = [
  { id: 'cotton_knit',        label: 'Cotton knit' },
  { id: 'polyester_blend',    label: 'Polyester blend' },
  { id: 'technical_textiles', label: 'Technical textiles' },
  { id: 'yarn',               label: 'Yarn' },
  { id: 'fabric_trading',     label: 'Fabric trading' },
  { id: 'garments',           label: 'Garments' },
]

export default function SignUpModal({ isOpen, onClose, cccResult, recommendations }: SignUpModalProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    companyName: '',
    city: '',
    fabricTypes: [] as string[],
  })

  const supabase = createClient()

  if (!isOpen) return null

  function toggleFabricType(id: string) {
    setForm(prev => ({
      ...prev,
      fabricTypes: prev.fabricTypes.includes(id)
        ? prev.fabricTypes.filter(f => f !== id)
        : [...prev.fabricTypes, id],
    }))
  }

  async function saveSnapshot() {
    const res = await fetch('/api/snapshots/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: {
          name: form.companyName,
          city: form.city,
          fabricTypes: form.fabricTypes,
        },
        cccResult,
        recommendations,
      }),
    })
    if (!res.ok) throw new Error('Failed to save snapshot')
  }

  async function handleSignUp() {
    if (!form.companyName.trim()) {
      toast.error('Please enter your company name')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (error) throw error

      await saveSnapshot()

      toast.success('Results saved! Check your email to verify your account.')
      onClose()
    } catch (err: any) {
      toast.error(err.message ?? 'Sign up failed — please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) throw error

      await saveSnapshot()

      toast.success('Results saved successfully!')
      onClose()
    } catch (err: any) {
      toast.error(err.message ?? 'Login failed — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal panel */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 mx-4">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
          aria-label="Close"
        >
          ×
        </button>

        {/* Header */}
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {mode === 'signup' ? 'Save your CCC results' : 'Welcome back'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'signup'
            ? 'Free forever. No credit card needed.'
            : 'Sign in to save your results to your account.'}
        </p>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="you@yourmill.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Password */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            placeholder="Min 8 characters"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Sign-up only fields */}
        {mode === 'signup' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
                placeholder="e.g. Shree Textiles Pvt Ltd"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                placeholder="e.g. Surat"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What do you deal in? (select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {FABRIC_TYPES.map(ft => (
                  <button
                    key={ft.id}
                    type="button"
                    onClick={() => toggleFabricType(ft.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.fabricTypes.includes(ft.id)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Submit button */}
        <button
          onClick={mode === 'signup' ? handleSignUp : handleLogin}
          disabled={loading || !form.email || !form.password}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? 'Saving...'
            : mode === 'signup'
            ? 'Create account & save results'
            : 'Sign in & save results'}
        </button>

        {/* Mode toggle */}
        <p className="text-center text-sm text-gray-500 mt-4">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-indigo-600 hover:underline">
                Sign in
              </button>
            </>
          ) : (
            <>New here?{' '}
              <button onClick={() => setMode('signup')} className="text-indigo-600 hover:underline">
                Create account
              </button>
            </>
          )}
        </p>

        {/* Privacy note */}
        <p className="text-xs text-gray-400 text-center mt-3">
          We store only your CCC metrics — not your raw invoice data.
        </p>
      </div>
    </div>
  )
}
```

---

## Step 6 — `/app/login/page.tsx`

Simple login page for returning users who navigate directly to `/login`.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/auth/supabase'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      toast.success('Signed in successfully')
      router.push('/')
    } catch (err: any) {
      toast.error(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Sign in to FabricCash</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          No account?{' '}
          <a href="/" className="text-indigo-600 hover:underline">
            Go to homepage to upload and sign up
          </a>
        </p>
      </div>
    </div>
  )
}
```

---

## Step 7 — Update `/components/landing/Navbar.tsx`

Add auth state detection. Show "Dashboard" link when signed in, "Login" when not.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/auth/supabase'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    // Listen for auth changes (sign in / sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <a href="/" className="flex items-center gap-2 font-semibold text-gray-900">
          <span>🧵</span>
          <span>FabricCash</span>
        </a>

        {/* Links */}
        <div className="flex items-center gap-6 text-sm">
          <a href="#how-it-works" className="text-gray-600 hover:text-gray-900">
            How it works
          </a>

          {user ? (
            <>
              <a
                href="/dashboard"
                className="text-indigo-600 font-medium hover:text-indigo-700"
              >
                Dashboard
              </a>
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <a
              href="/login"
              className="text-gray-600 hover:text-gray-900"
            >
              Login
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
```

---

## Step 8 — Update `/app/layout.tsx`

Add the `Toaster` component from Sonner so toast notifications render correctly.

Find the existing `layout.tsx` and add the Toaster:

```tsx
import { Toaster } from 'sonner'

// Inside the <body> tag, add after {children}:
<Toaster
  position="bottom-right"
  toastOptions={{
    style: { fontFamily: 'inherit' },
  }}
/>
```

Full layout should look like:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
```

---

## Step 9 — Wire "Save my results" Button in ResultPanel

In `/components/landing/ResultPanel.tsx`, find the "Save my results" button and
wire it to open the `SignUpModal`. The ResultPanel needs to:

1. Accept `cccResult` and `recommendations` as props (it should already have these)
2. Track `isModalOpen` state
3. Render `SignUpModal` at the bottom

```tsx
// Add to ResultPanel imports
import { useState } from 'react'
import SignUpModal from './SignUpModal'

// Add inside the component
const [isModalOpen, setIsModalOpen] = useState(false)

// The "Save my results" button — find it and update onClick:
<button
  onClick={() => setIsModalOpen(true)}
  className="..."
>
  Save my results
</button>

// Add at the bottom of the ResultPanel JSX, before closing tag:
<SignUpModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  cccResult={cccResult}
  recommendations={recommendations}
/>
```

---

## Verification Checklist

Run these checks in order before marking Agent 6 complete.

### Check 1 — Supabase client initialises without error
Open browser console on `localhost:3000`. There should be no errors about
missing Supabase environment variables. If you see:
```
Error: supabaseUrl is required
```
Your `.env.local` is missing `NEXT_PUBLIC_SUPABASE_URL`. Stop and fix this first.

---

### Check 2 — Sign up flow works end-to-end
1. Complete an upload (drop 3 files, see CCC result)
2. Click "Save my results"
3. Modal should open — fill in all fields
4. Click "Create account & save results"
5. Expected: toast appears saying "Results saved! Check your email to verify your account."
6. Check Supabase Dashboard → Authentication → Users — your email should appear
7. Check Supabase Dashboard → Table Editor → CCCSnapshot — one row should appear

---

### Check 3 — Save route returns correct response
Use Thunder Client or curl:
```bash
# This should return 401 (no auth token)
curl -X POST http://localhost:3000/api/snapshots/save \
  -H "Content-Type: application/json" \
  -d '{"company": {"name": "Test"}, "cccResult": {}, "recommendations": []}'

# Expected:
# { "error": "Unauthorised — please sign in first" }
```

---

### Check 4 — Navbar shows correct state
- When signed out: Navbar shows "Login" link
- After signing in via modal: Navbar updates to show "Dashboard" link
  (may require a page refresh if auth state listener isn't triggering)
- After clicking "Sign out": Navbar reverts to "Login"

---

### Check 5 — Login page works
Navigate to `localhost:3000/login`. Enter credentials from Check 2.
Should redirect to `/` after successful sign-in.

---

### Check 6 — Toast renders correctly
Toasts should appear in the bottom-right corner. If they don't appear at all,
confirm `<Toaster />` is present in `layout.tsx`.

---

## What NOT to Build in This Agent

- ❌ Dashboard page (`/dashboard`) — that is post-MVP
- ❌ Password reset flow — post-MVP
- ❌ Email templates — Supabase default emails are fine for now
- ❌ OAuth (Google sign-in) — post-MVP
- ❌ Any changes to the CCC engine or parser — those are locked

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `supabaseUrl is required` | Missing env vars | Add both `NEXT_PUBLIC_SUPABASE_*` to `.env.local` and restart dev server |
| `Invalid login credentials` | Wrong email/password | Check Supabase Dashboard → Auth → Users for the account |
| `Email not confirmed` | Supabase requires email verification | For dev: disable "Confirm email" in Supabase Dashboard → Auth → Settings |
| `relation "CCCSnapshot" does not exist` | Migration not run | Run `npx prisma migrate dev` |
| `Cannot find module '@/lib/auth/supabase'` | Path alias not set | Confirm `tsconfig.json` has `"@/*": ["./*"]` in paths |
| Toast not showing | Toaster not in layout | Add `<Toaster />` to `app/layout.tsx` |

---

## Quick Fix for Local Development — Disable Email Confirmation

Supabase requires email verification by default, which breaks the local dev flow
(no email server). Disable it for development:

**Supabase Dashboard → your project → Authentication → Settings → Email Auth →
turn off "Confirm email"**

Re-enable this before deploying to production.

---

## Rules

- Never store raw invoice data — only the aggregated CCCSnapshot metrics
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client components (only use anon key)
- The modal must not block the result panel — user can close it and still see results
- All auth errors must show as toast messages — never as page redirects or blank screens
- TypeScript strict mode is on — no `any` except where Prisma JSON fields require it
