'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b transition-all ${
        isScrolled
          ? 'border-edge bg-surface/80 shadow-sm backdrop-blur-sm'
          : 'border-transparent bg-surface/80 backdrop-blur-sm'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-ink">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[#2563EB] text-xs font-bold text-white">
              F
            </div>
            <span className="text-[13px] font-semibold text-ink">FabricCash</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/#how-it-works" className="text-[11px] font-medium text-body hover:text-[#2563EB]">
              How it works
            </Link>
            <Link href="/dashboard" className="text-[11px] font-medium text-body hover:text-[#2563EB]">
              Dashboard
            </Link>
            <ThemeToggle />
            <Link href="/" className="rounded-md bg-[#2563EB] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90">
              Try free →
            </Link>
          </div>

        </div>
      </div>
    </nav>
  )
}
