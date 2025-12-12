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
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error(error);
          setMessage('Inloggen mislukt. Vraag een nieuwe inloglink aan.');
          return;
        }

        if (!data.session) {
          setMessage('Geen sessie gevonden. Vraag een nieuwe inloglink aan.');
          return;
        }

        router.replace('/dashboard');
      } catch (e) {
        console.error(e);
        setMessage('Onbekende fout bij het inloggen.');
      }
    })();
  }, [router]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{message}</p>
    </div>
  );
}