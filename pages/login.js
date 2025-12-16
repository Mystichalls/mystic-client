// pages/login.js
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [message, setMessage] = useState('');

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

    // Succes -> naar dashboard
    window.location.href = '/dashboard';
  }

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1 style={{ marginBottom: 12 }}>Mystic Halls — Login</h1>

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
          style={{ padding: '8px 16px' }}
        >
          {status === 'loading' ? 'Bezig…' : 'Inloggen'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 12, color: status === 'error' ? 'crimson' : 'inherit' }}>
          {message}
        </p>
      )}
    </div>
  );
}
