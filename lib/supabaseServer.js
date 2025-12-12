// lib/supabaseServer.js
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export function getServerClient(ctx) {
  return createPagesServerClient(ctx, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
