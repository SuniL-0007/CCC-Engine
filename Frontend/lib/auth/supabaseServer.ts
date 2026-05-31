import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function requireSupabaseUser(request: NextRequest, expectedUserId: string): Promise<void> {
  const token = getBearerToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('demo.supabase.co') || key.includes('demo')) {
    throw new AuthError('Supabase is not configured on the server.', 500);
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthError('Invalid Supabase session.', 401);
  }

  if (data.user.id !== expectedUserId) {
    throw new AuthError('Supabase session does not match requested user.', 403);
  }
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function getBearerToken(request: NextRequest): string {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new AuthError('Missing Supabase bearer token.', 401);
  }

  return match[1];
}
