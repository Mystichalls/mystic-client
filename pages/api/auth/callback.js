// pages/api/auth/callback.js
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res });

  const code = req.query.code;
  if (!code) return res.redirect('/login?error=missing_code');

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('exchangeCodeForSession error:', error.message);
    return res.redirect('/login?error=auth');
  }

  return res.redirect('/dashboard');
}
