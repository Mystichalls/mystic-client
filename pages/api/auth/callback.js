// pages/api/auth/callback.js
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res });

  // Dit zet de sessie + cookies op basis van de code in de URL
  const { error } = await supabase.auth.exchangeCodeForSession(req.url);

  if (error) {
    console.error('exchangeCodeForSession error:', error.message);
    return res.redirect('/login?error=auth');
  }

  return res.redirect('/dashboard');
}
