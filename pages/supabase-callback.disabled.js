// pages/supabase-callback.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Bezig met inloggen...');

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        // DEBUG: laat exact zien wat we binnenkrijgen
        console.log('[supabase-callback] href:', window.location.href);
        console.log('[supabase-callback] search:', window.location.search);
        console.log('[supabase-callback] hash:', window.location.hash);

        // Dit handelt zowel ?code= (PKCE) als #access_token= (implicit) af
        const { data, error } = await supabase.auth.getSessionFromUrl({
          storeSession: true,
        });

        console.log('[supabase-callback] data:', data);
        if (error) {
          console.error('[supabase-callback] getSessionFromUrl error:', error);
          if (!mounted) return;
          setMessage('Inloggen mislukt. Vraag een nieuwe inloglink aan.');
          return;
        }

        if (!data?.session) {
          if (!mounted) return;
          setMessage('Geen sessie gevonden in de callback URL. Vraag een nieuwe inloglink aan.');
          return;
        }

        // Succes: door naar dashboard
        router.replace('/dashboard');
      } catch (err) {
        console.error('[supabase-callback] unknown error:', err);
        if (!mounted) return;
        setMessage('Onbekende fout bij het inloggen.');
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
      <p style={{ marginTop: 12, opacity: 0.7 }}>
        (Open DevTools → Console om debug te zien)
      </p>
    </div>
  );
}
