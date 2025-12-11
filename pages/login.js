// pages/login.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { getServerClient } from '../lib/supabaseServer';

// Als je al ingelogd bent, direct naar het dashboard
export async function getServerSideProps(ctx) {
  const supa = getServerClient(ctx);

  const {
    data: { session },
  } = await supa.auth.getSession();

  if (session) {
    return {
      redirect: { destination: '/dashboard', permanent: false },
    };
  }

  return { props: {} };
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'sent' | 'error'
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email) return;

    setStatus('loading');
    setMessage('');

    try {
      // Waar de magic link naartoe terugkomt
      const redirectTo = `${window.location.origin}/supabase-callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setStatus('error');
        setMessage(error.message || 'Er ging iets mis bij het versturen.');
        return;
      }

      setStatus('sent');
      setMessage(
        'We hebben een inloglink naar je e-mail gestuurd. Klik op de link om in te loggen.'
      );
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Onbekende fout bij het inloggen.');
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 400 }}>
      <h1 style={{ marginBottom: 12 }}>Mystic Halls — Login</h1>
      <p style={{ marginBottom: 16 }}>
        Vul je e-mail in en we sturen je een inloglink.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="email"
            style={{ display: 'block', marginBottom: 4 }}
          >
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading' || !email}
          style={{ padding: '8px 16px' }}
        >
          {status === 'loading' ? 'Bezig…' : 'Stuur inloglink'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
    </div>
  );
}
