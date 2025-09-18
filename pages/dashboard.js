// pages/dashboard.js
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// PvE tabs
import Tower from '../components/pve/Tower';
import Towns from '../components/pve/Towns';
import Road from '../components/pve/Road';
import Dungeon from '../components/pve/Dungeon';

/* ==== Admin helper (lees uit env, client-side) ==== */
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const isAdmin = (email) => ADMIN_EMAILS.includes((email || '').toLowerCase());

export default function Dashboard() {
  // === Auth & Profile ===
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  // === Wallet (coins/dust) ===
  const [wallet, setWallet] = useState({ coins: 0, dust: 0 });
  const [walletLoading, setWalletLoading] = useState(false);

  // === Tabs ===
  const tabs = ['Tower', 'Towns', 'Dungeon', 'Road'];
  const [tab, setTab] = useState('Tower');

  // ---- Auth bootstrap ----
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      // ✓ Haal sessie op (crasht niet als je bent uitgelogd)
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;
      if (error) console.error('auth.getSession error:', error);

      // Geen sessie → rustig stoppen
      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Wel sessie → user zetten en data laden
      const u = session.user;
      setUser(u);

      await Promise.all([loadProfile(u.id), loadWallet(u.id)]);

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ---- Profile loader ----
  async function loadProfile(uid) {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', uid)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('loadProfile error:', error);
    }
    setProfile(data ?? null);
    setUsername(data?.username ?? '');
  }

  async function onLogout() {
    await supabase.auth.signOut();
    // terug naar de homepage (of /login, wat jij wilt)
    window.location.href = '/';
  }

  // ---- Profile save ----
  async function saveUsername() {
    if (!user?.id) return;

    const up = {
      id: user.id,
      username: username?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(up);
    if (error) {
      alert('Fout bij opslaan username: ' + error.message);
    } else {
      alert('Username opgeslagen.');
      await loadProfile(user.id);
    }
  }

  // ---- Wallet ----
  async function loadWallet(uid) {
    if (!uid) return;
    setWalletLoading(true);
    const { data, error } = await supabase
      .from('v_wallet')
      .select('coins,dust')
      .eq('user_id', uid)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Wallet load error:', error);
    }
    setWallet({
      coins: data?.coins ?? 0,
      dust: data?.dust ?? 0,
    });
    setWalletLoading(false);
  }

  const refreshWallet = () => user?.id && loadWallet(user.id);

  /* ---- AUTH GUARDS (één keer) ---- */
  if (loading) {
    return <div style={{ padding: 16 }}>Laden…</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Mystic Halls — Dashboard</h1>
        <p>Je bent niet ingelogd.</p>
        <button onClick={() => (window.location.href = '/login')}>Inloggen</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <h1>Mystic Halls — Dashboard</h1>

      <div style={{ marginBottom: 12 }}>
        Welkom, <strong>{profile?.username || '(geen username)'}</strong>{' '}
        <em>{user.email}</em>
        {isAdmin(user?.email) && (
          <>
            {' · '}
            <a href="/admin/telemetry" style={{ textDecoration: 'underline' }}>
              Telemetry
            </a>
          </>
        )}

        {/* Uitlog-knop */}
        <button
          onClick={onLogout}
          style={{
            marginLeft: 8,
            padding: '2px 8px',
            border: '1px solid #ddd',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Uitloggen
        </button>

        <div
          style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <strong>Saldo:</strong>
          <span>💰 {walletLoading ? '…' : wallet.coins} coins</span>
          <span>✨ {walletLoading ? '…' : wallet.dust} dust</span>
          <button onClick={refreshWallet}>Ververs</button>
        </div>
      </div>

      {/* Username aanpassen */}
      <div style={{ margin: '8px 0' }}>
        <label>Username:&nbsp;</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: 200 }}
        />
        &nbsp;
        <button onClick={saveUsername}>Opslaan</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 10px',
              background: tab === t ? '#ddd' : '#f2f2f2',
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* PvE panes */}
      <div style={{ marginTop: 8 }}>
        {tab === 'Tower' && <Tower user={user} />}
        {tab === 'Towns' && <Towns user={user} />}
        {tab === 'Road' && <Road user={user} />}
        {tab === 'Dungeon' && <Dungeon onAfterSave={refreshWallet} />}
      </div>
    </div>
  );
}

