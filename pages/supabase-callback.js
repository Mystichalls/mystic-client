// pages/supabase-callback.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Bezig met inloggen...');

  useEffect(() => {
    const run = async () => {
      try {
        const code = new URL(window.location.href).searchParams.get('code');

        if (!code) {
          setMessage('Geen code gevonden in de URL. Vraag een nieuwe inloglink aan.');
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('exchangeCodeForSession error', error);
          setMessage('Inloggen mislukt. Vraag een nieuwe inloglink aan.');
          return;
        }

        // extra check: sessie aanwezig?
        const { data } = await supabase.auth.getSession();
        if (!data?.session) {
          setMessage('Geen sessie gevonden. Vraag een nieuwe inloglink aan.');
          return;
        }

        router.replace('/dashboard');
      } catch (err) {
        console.error(err);
        setMessage('Onbekende fout bij het inloggen.');
      }
    };

    run();
  }, [router]);

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
    </div>
  );
}
