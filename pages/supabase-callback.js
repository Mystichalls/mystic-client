// pages/supabase-callback.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Bezig met inloggen...');

  useEffect(() => {
    async function checkSession() {
      try {
        // Supabase zou de sessie automatisch moeten hebben gezet
        // op basis van de tokens in de URL van de magic link.
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('getSession error', error);
          setMessage(
            'Er ging iets mis bij het inloggen. Vraag een nieuwe inloglink aan.'
          );
          return;
        }

        if (data.session) {
          // Ingelogd -> naar dashboard
          router.replace('/dashboard');
        } else {
          // Geen sessie gevonden
          setMessage(
            'Geen actieve sessie gevonden. Vraag een nieuwe inloglink aan.'
          );
        }
      } catch (err) {
        console.error('Onbekende fout in callback', err);
        setMessage('Onbekende fout bij het inloggen.');
      }
    }

    checkSession();
  }, [router]);

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
    </div>
  );
}
