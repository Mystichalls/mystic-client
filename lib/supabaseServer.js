// lib/supabaseServer.js
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export function getServerClient(ctx) {
  return createPagesServerClient(ctx);
}
