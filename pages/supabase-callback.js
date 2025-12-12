// pages/supabase-callback.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Bezig met inloggen...');

  useEffect(() => {
    async function handleCallback() {
      try {
        const url = new URL(window.location.href);

        // 1) PKCE flow: ?code=...
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) {
            console.error('exchangeCodeForSession error:', error);
            setMessage('Inloggen mislukt (code). Vraag een nieuwe inloglink aan.');
            return;
          }
          router.replace('/dashboard');
          return;
        }

        // 2) Implicit flow: #access_token=...&refresh_token=...
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;

        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            console.error('setSession error:', error);
            setMessage('Inloggen mislukt (token). Vraag een nieuwe inloglink aan.');
            return;
          }
          router.replace('/dashboard');
          return;
        }

        setMessage('Geen login-code of tokens gevonden in de URL. Vraag een nieuwe inloglink aan.');
      } catch (err) {
        console.error('Callback unknown error:', err);
        setMessage('Onbekende fout bij het inloggen.');
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
    </div>
  );
}
