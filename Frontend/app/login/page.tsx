"use client"

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/auth/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient()
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result?.error) throw result.error
      setMessage('Signed in. Your dashboard is ready.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-primary">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              FC
            </div>
            FabricCash
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-6 text-2xl font-bold text-slate-950">Login to Your Account</h1>

          {message && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input-field"
                placeholder="hello@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input-field"
                placeholder="Your password"
              />
            </label>

            <button type="submit" disabled={isLoading} className="btn-primary min-h-11 w-full">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-slate-600">
            Do not have an account?{' '}
            <Link href="/" className="font-medium text-primary hover:underline">
              Get started free
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
