// pages/login.js
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error | success
  const [message, setMessage] = useState('');

  // 🔐 Login met e-mail + wachtwoord
  async function handleLogin(e) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus('error');
      setMessage(error.message || 'Inloggen mislukt.');
      return;
    }

    // Succes → dashboard
    window.location.href = '/dashboard';
  }

  // ✉️ Magic link login (bestaande accounts)
  async function handleMagicLink() {
    if (!email) {
      setStatus('error');
      setMessage('Vul eerst je e-mailadres in.');
      return;
    }

    setStatus('loading');
    setMessage('');

    const redirectTo = `${window.location.origin}/api/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setStatus('error');
      setMessage(error.message || 'Kon geen inloglink sturen.');
      return;
    }

    setStatus('success');
    setMessage(
      'We hebben een inloglink naar je e-mail gestuurd. Klik op de link om in te loggen.'
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1 style={{ marginBottom: 12 }}>Mystic Halls — Login</h1>

      {/* LOGIN MET WACHTWOORD */}
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Wachtwoord</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          style={{ padding: '8px 16px', marginRight: 8 }}
        >
          {status === 'loading' ? 'Bezig…' : 'Inloggen'}
        </button>
      </form>

      {/* MAGIC LINK */}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={handleMagicLink}
          disabled={status === 'loading'}
          style={{ padding: '8px 16px' }}
        >
          Inloggen via e-mail link
        </button>
      </div>

      {/* MELDINGEN */}
      {message && (
        <p
          style={{
            marginTop: 12,
            color: status === 'error' ? 'crimson' : 'green',
          }}
        >
          {message}
        </p>
      )}

      {/* REGISTRATIE */}
      <p style={{ marginTop: 20 }}>
        Nog geen account? <a href="/register">Registreer hier</a>
      </p>
    </div>
  );
}
