"use client"

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
    // Try to use existing session
    try {
      const sessionRes = await supabase.auth.getSession()
      const session = sessionRes?.data?.session ?? null

      if (session && session.user) {
        const payload = {
          userId: session.user.id,
          email: session.user.email ?? form.email,
          company: { name: form.companyName, city: form.city, fabricTypes: form.fabricTypes },
          cccResult: {
            dio: {
              value: cccResult.dio.value,
              benchmark: cccResult.dio.benchmark,
              gapDays: cccResult.dio.gapDays,
              trendDelta: cccResult.dio.trendDelta,
              dataCompleteness: cccResult.dio.dataCompleteness,
            },
            dso: {
              value: cccResult.dso.value,
              benchmark: cccResult.dso.benchmark,
              gapDays: cccResult.dso.gapDays,
              trendDelta: cccResult.dso.trendDelta,
              dataCompleteness: cccResult.dso.dataCompleteness,
            },
            dpo: {
              value: cccResult.dpo.value,
              benchmark: cccResult.dpo.benchmark,
              gapDays: cccResult.dpo.gapDays,
              trendDelta: cccResult.dpo.trendDelta,
              dataCompleteness: cccResult.dpo.dataCompleteness,
            },
            ccc: cccResult.ccc,
            benchmarkCCC: cccResult.benchmarkCCC,
            gapDays: cccResult.gapDays,
            periodDays: cccResult.periodDays,
            calculatedAt: cccResult.calculatedAt.toString(),
          },
          recommendations,
        }

        const res = await fetch('/api/snapshots/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? 'Failed to save snapshot')
        }

        return
      }
    } catch (err) {
      // ignore and fallback to local
    }

    const existing = JSON.parse(localStorage.getItem('fabriccash:snapshots') ?? '[]')
    localStorage.setItem(
      'fabriccash:snapshots',
      JSON.stringify([
        { id: `local-${Date.now()}`, createdAt: new Date().toISOString(), company: { name: form.companyName, city: form.city, fabricTypes: form.fabricTypes }, cccResult, recommendations },
        ...existing,
      ])
    )
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
