// lib/supabaseServer.js
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

/**
 * Maakt een Supabase server client met toegang tot cookies/headers.
 * Gebruik in getServerSideProps (pages/).
 */
export function getServerClient(ctx) {
  return createServerSupabaseClient(ctx);
}
