'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/auth/supabase'
import type { User } from '@supabase/supabase-js'

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b transition-all ${
        isScrolled
          ? 'border-slate-200 bg-white/95 shadow-sm backdrop-blur'
          : 'border-transparent bg-white/80 backdrop-blur'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              FC
            </div>
            <span>FabricCash</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#how-it-works" className="text-sm font-medium text-slate-700 hover:text-primary">
              How it works
            </a>

            {user ? (
              <>
                <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="text-sm text-slate-700">
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
                Login
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={isOpen}
          >
            <span className="block h-0.5 w-6 bg-current" />
            <span className="mt-1.5 block h-0.5 w-6 bg-current" />
            <span className="mt-1.5 block h-0.5 w-6 bg-current" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-x-0 top-14 z-50 border-t border-slate-200 bg-white p-4 shadow-lg md:hidden">
          <div className="flex flex-col gap-4">
            <a
              href="#how-it-works"
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50"
            >
              How it works
            </a>

            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-3 py-3 font-semibold text-primary hover:bg-slate-50"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    handleSignOut()
                    setIsOpen(false)
                  }}
                  className="rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-3 py-3 font-semibold text-primary hover:bg-slate-50"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
