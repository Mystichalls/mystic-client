// pages/register.js
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error' | 'ok'
  const [message, setMessage] = useState('');

  async function handleRegister(e) {
    e.preventDefault();
    setMessage('');

    if (pw1.length < 6) {
      setStatus('error');
      setMessage('Wachtwoord moet minimaal 6 tekens zijn.');
      return;
    }

    if (pw1 !== pw2) {
      setStatus('error');
      setMessage('Wachtwoorden komen niet overeen.');
      return;
    }

    setStatus('loading');

    // Na e-mail confirm willen we later auto-login via callback.
    // Voor nu zetten we hem alvast klaar (stap 3 maken we dit echt werkend).
    const emailRedirectTo = `${window.location.origin}/login`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw1,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      setStatus('error');
      setMessage(error.message || 'Registreren mislukt.');
      return;
    }

    // Belangrijk: ook als de user nog niet confirmed is, kan er al een user object terugkomen.
    setStatus('ok');
    setMessage(
      'Account aangemaakt! Je kunt nu inloggen. (Je krijgt ook een e-mail om je adres te bevestigen.)'
    );

    setEmail('');
    setPw1('');
    setPw2('');
  }

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1 style={{ marginBottom: 12 }}>Mystic Halls — Registreren</h1>

      <form onSubmit={handleRegister}>
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
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Herhaal wachtwoord</label>
          <input
            type="password"
            required
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          style={{ padding: '8px 16px' }}
        >
          {status === 'loading' ? 'Bezig…' : 'Registreren'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 12, color: status === 'error' ? 'crimson' : 'inherit' }}>
          {message}
        </p>
      )}

      <p style={{ marginTop: 12 }}>
        Heb je al een account? <a href="/login">Ga naar login</a>
      </p>
    </div>
  );
}
