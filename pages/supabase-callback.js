// pages/supabase-callback.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Bezig met inloggen...');

  useEffect(() => {
    async function run() {
      try {
        // 1) Pak de code uit de URL: /supabase-callback?code=xxxx
        const code = new URLSearchParams(window.location.search).get('code');

        if (!code) {
          setMessage('Geen code gevonden in de URL. Vraag een nieuwe inloglink aan.');
          return;
        }

        // 2) Wissel code om voor een sessie
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('exchangeCodeForSession error', error);
          setMessage('Inloggen mislukt. Vraag een nieuwe inloglink aan.');
          return;
        }

        if (!data?.session) {
          setMessage('Geen sessie gevonden. Vraag een nieuwe inloglink aan.');
          return;
        }

        // 3) Succes -> door naar dashboard
        router.replace('/dashboard');
      } catch (err) {
        console.error('Callback crash', err);
        setMessage('Onbekende fout bij het inloggen.');
      }
    }

    run();
  }, [router]);

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
    </div>
  );
}
