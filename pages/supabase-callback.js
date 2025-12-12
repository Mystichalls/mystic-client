// pages/supabase-callback.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState('Bezig met inloggen…');

  useEffect(() => {
    const run = async () => {
      try {
        // Dit pakt automatisch info uit ?query én uit #hash
        const { data, error } = await supabase.auth.getSessionFromUrl({
          storeSession: true,
        });

        if (error) {
          console.error('getSessionFromUrl error:', error);
          setMsg('Inloggen mislukt: ' + (error.message || 'Onbekende fout'));
          return;
        }

        if (!data?.session) {
          setMsg('Geen sessie gevonden in de URL. Vraag een nieuwe inloglink aan.');
          return;
        }

        setMsg('Gelukt! Doorsturen…');
        router.replace('/dashboard');
      } catch (e) {
        console.error('Callback unknown error:', e);
        setMsg('Onbekende fout: ' + (e?.message || e));
      }
    };

    run();
  }, [router]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Mystic Halls — Inloggen</h1>
      <p>{msg}</p>
    </div>
  );
}
