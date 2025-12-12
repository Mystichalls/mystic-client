// pages/supabase-callback.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState('Bezig met inloggen…');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (!code) {
        setMsg('Geen code gevonden in de URL. Vraag een nieuwe inloglink aan.');
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('exchangeCodeForSession error:', error);
        setMsg('Inloggen mislukt: ' + (error.message || 'Onbekende fout'));
        return;
      }

      // Extra check: heb je echt een sessie?
      if (!data?.session) {
        setMsg('Geen sessie teruggekregen. Vraag een nieuwe inloglink aan.');
        return;
      }

      setMsg('Gelukt! Doorsturen…');
      router.replace('/dashboard');
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
