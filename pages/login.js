// pages/login.js
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  async function onSignIn(e) {
    e.preventDefault();
    setMsg('Bezig…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);
    location.href = '/dashboard';
  }

  async function onMagicLink(e) {
    e.preventDefault();
    setMsg('Magic link verstuurd…');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'http://localhost:3000/dashboard' },
    });
    if (error) setMsg(error.message);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Inloggen</h1>
      <form onSubmit={onSignIn} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
        <label>E-mail</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        <label>Wachtwoord</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" />
        <button type="submit">Inloggen</button>
        <button onClick={onMagicLink} type="button">Stuur magic link</button>
        <div style={{ color: '#c00' }}>{msg}</div>
      </form>
    </div>
  );
}
