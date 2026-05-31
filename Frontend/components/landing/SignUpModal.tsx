'use client';

import { FormEvent, ReactNode, useState } from 'react';
import { CCCResult } from '@/lib/ccc-engine/types';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/auth/supabase';

const FABRIC_TYPES = [
  'Cotton knit',
  'Polyester blend',
  'Technical textiles',
  'Yarn',
  'Fabric trading',
];

interface SignUpModalProps {
  result: CCCResult;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function SignUpModal({ result, onClose, onSaved }: SignUpModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [fabricTypes, setFabricTypes] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password || !companyName || !city) {
      setError('Email, password, company name, and city are required.');
      return;
    }

    setIsSaving(true);

    try {
      const company = { email, companyName, city, fabricTypes };
      let userId = `local-${Date.now()}`;
      let accessToken: string | null = null;

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseBrowserClient();
        const signUpResult = await supabase?.auth.signUp({
          email,
          password,
          options: {
            data: {
              company_name: companyName,
              city,
              fabric_types: fabricTypes,
            },
          },
        });

        if (signUpResult?.error) throw signUpResult.error;
        userId = signUpResult?.data.user?.id ?? userId;
        accessToken = signUpResult?.data.session?.access_token ?? null;

        if (!accessToken) {
          throw new Error(
            'Supabase did not return a session. Confirm the email, log in, then save the result again.'
          );
        }
      }

      await saveSnapshot({ userId, accessToken, ...company, result });
      onSaved(
        isSupabaseConfigured()
          ? 'Results saved. You can track your CCC over time.'
          : 'Results saved in this browser for local testing.'
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your results.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFabricType = (fabricType: string) => {
    setFabricTypes((current) =>
      current.includes(fabricType)
        ? current.filter((item) => item !== fabricType)
        : [...current, fabricType]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-results-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 id="save-results-title" className="text-2xl font-bold text-slate-950">
              Save Your Results
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Store the CCC summary and recommendations, not your raw invoice data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input-field"
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input-field"
                placeholder="Minimum 6 characters"
              />
            </Field>
            <Field label="Company Name">
              <input
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="input-field"
                placeholder="Fabric mill name"
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="input-field"
                placeholder="Surat"
              />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">Fabric Types</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FABRIC_TYPES.map((fabricType) => (
                <label key={fabricType} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={fabricTypes.includes(fabricType)}
                    onChange={() => toggleFabricType(fabricType)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  {fabricType}
                </label>
              ))}
            </div>
          </div>

          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            We store only aggregated metrics: DIO, DSO, DPO, CCC, benchmark gaps, and recommendations.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={onClose} className="btn-secondary min-h-11 flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary min-h-11 flex-1">
              {isSaving ? 'Saving...' : 'Save Results'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
    </label>
  );
}

async function saveSnapshot(payload: {
  userId: string;
  accessToken: string | null;
  email: string;
  companyName: string;
  city: string;
  fabricTypes: string[];
  result: CCCResult;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    const existing = JSON.parse(localStorage.getItem('fabriccash:snapshots') ?? '[]') as unknown[];
    localStorage.setItem(
      'fabriccash:snapshots',
      JSON.stringify([
        {
          id: `local-${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...payload,
        },
        ...existing,
      ])
    );
    return;
  }

  const response = await fetch('/api/snapshots/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Server could not save the snapshot.');
  }
}
