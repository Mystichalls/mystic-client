// pages/api/auth/callback.js
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res });

  // Belangrijk: auth-helpers verwacht de VOLLEDIGE req.url (met querystring),
  // zodat hij code + flow cookies correct kan verwerken.
  const { error } = await supabase.auth.exchangeCodeForSession(req.url);

  if (error) {
    console.error('exchangeCodeForSession error:', error);
    return res.redirect('/login?error=auth');
  }

  return res.redirect('/dashboard');
}
