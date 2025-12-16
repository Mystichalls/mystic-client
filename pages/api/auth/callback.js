// pages/api/auth/callback.js
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res });

  // Zet sessie + cookies op basis van de URL (code zit in req.url)
  const { error } = await supabase.auth.exchangeCodeForSession(req.url);

  if (error) {
    console.error('exchangeCodeForSession error:', error.message);
    return res.redirect('/login?error=auth_callback');
  }

  // Na verify automatisch naar dashboard (later kan dit /shop worden)
  return res.redirect('/dashboard');
}
