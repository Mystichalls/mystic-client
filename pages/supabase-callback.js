// pages/supabase-callback.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Bezig met inloggen...');

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // 1) PKCE code flow (?code=...)
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('exchangeCodeForSession error:', error);
            setMessage('Inloggen mislukt. Vraag een nieuwe inloglink aan.');
            return;
          }
          router.replace('/dashboard');
          return;
        }

        // 2) Implicit flow (#access_token=...&refresh_token=...)
        const hash = new URLSearchParams(url.hash.replace('#', ''));
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            console.error('setSession error:', error);
            setMessage('Inloggen mislukt. Vraag een nieuwe inloglink aan.');
            return;
          }
          router.replace('/dashboard');
          return;
        }

        // 3) Niks gevonden
        setMessage('Geen login-data gevonden in de URL. Vraag een nieuwe inloglink aan.');
      } catch (e) {
        console.error(e);
        setMessage('Onbekende fout bij het inloggen.');
      }
    })();
  }, [router]);

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
    </div>
  );
}
