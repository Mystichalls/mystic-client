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
        const url = window.location.href;

        // Belangrijk: dit zet de Supabase-sessie op basis van de code in de URL
        const { error } = await supabase.auth.exchangeCodeForSession(url);

        if (error) {
          console.error('exchangeCodeForSession error', error);
          setMessage(
            'Er ging iets mis bij het inloggen. Vraag een nieuwe inloglink aan.'
          );
          return;
        }

        // Klaar -> door naar dashboard
        router.replace('/dashboard');
      } catch (err) {
        console.error('Onbekende fout in callback', err);
        setMessage('Onbekende fout bij het inloggen.');
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
    </div>
  );
}

