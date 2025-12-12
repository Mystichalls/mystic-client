// pages/supabase-callback.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    const handleCallback = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.search
      );

      if (error) {
        console.error(error);
        router.replace('/login');
        return;
      }

      // succes → dashboard
      router.replace('/dashboard');
    };

    handleCallback();
  }, [router]);

  return <p>Bezig met inloggen…</p>;
}
