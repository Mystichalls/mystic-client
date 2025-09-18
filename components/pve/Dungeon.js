// components/pve/Dungeon.js
import { track } from '../../lib/telemetry';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { E } from '../../lib/events';


export default function Dungeon({ onAfterSave }) {
  const [flash, setFlash] = useState(null); // { type: 'ok'|'err', msg: string }
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(null);
  const [boss, setBoss] = useState(null);
  const [token, setToken] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // ==== auth session ophalen ====
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
  }, []);
// --- LOG: dungeon_open precies 1x zodra er een sessie is ---

const openedOnce = useRef(false);

useEffect(() => {
  if (session && !openedOnce.current) {
    openedOnce.current = true;
    track(E.DUNGEON_OPEN);

  }
}, [session]);

  // flash auto-hide
  useEffect(() => {
    if (!flash) return;
    const tmo = setTimeout(() => setFlash(null), 1500);
    return () => clearTimeout(tmo);
  }, [flash]);

// Log wanneer de session beschikbaar is
useEffect(() => {
  if (session) {
    track('dungeon_open'); // evt. andere events hier later
  }
}, [session]);


  // ==== status ophalen (robuust) ====
  async function getStatus() {
    if (!session) return;
    const r = await fetch('/api/pve/dungeon/status', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Dungeon status error:', data);
      setStatus({
        day: '-',
        active: false,
        limits: { free: 0, ad_runs: 0, rerolls: 0 },
        used:   { runs: 0, ad_runs: 0, rerolls: 0 },
        error: data?.error || 'unknown'
      });
      return;
    }
    setStatus(data);
  }

  useEffect(() => {
    if (!session) return;
    // telemetry: open scherm
    t('dungeon_open');
    getStatus();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==== helper om API te bellen ====
  async function call(path, body) {
    const r = await fetch(`/api/pve/dungeon/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`
      },
      body: JSON.stringify(body || {})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw data;
    return data;
  }

  // ==== acties ====
async function onStart() {
  setLoading(true);
  try {
    const r = await call('start');
    setBoss(r.boss);
    setToken(r.token);
    setResult(null);

    // ✅ Telemetry: start gelukt
 track(E.DUNGEON_RUN_START, {
  windowId: status?.window_id ?? null, // laten staan als je 'status' hebt
  tokenUsed: !!r?.token,
  boss: r?.boss ?? null,
});

  } catch (e) {
    // ❌ Telemetry: start-run fout
    track(E.DUNGEON_RUN_ERROR, { message: String(e?.message || e) });

    console.error(e);
  } finally {
    setLoading(false);
  }
}

// === acties ===
async function onResolve() {
  setLoading(true);
  try {
    const r = await call('resolve', { token });

    // ✅ telemetry: uitkomst van de run
  if (r.win) {
  track(E.DUNGEON_WIN);
  track(E.DUNGEON_LOOT_GRANTED, { drop: r.drop });
} else {
  track(E.DUNGEON_LOSE);
}


    setResult(r);

    // ✅ telemetry: run succesvol afgerond/gesaved
    track(E.DUNGEON_RUN_END, {
      windowId: status?.window_id ?? null, // laat staan als je 'status' hebt; anders kun je deze regel weghalen
      boss,                                 // huidige boss uit state
      tokenUsed: !!token,                   // of er een token gebruikt is
      win: !!r.win                          // uitkomst
    });
  } catch (e) {
    // ❌ telemetry: afronden/resolve fout
    track('dungeon_run_end_error', { message: String(e?.message || e) });
    console.error(e);
  } finally {
    setLoading(false);
    getStatus();
  }
}


  // 2e run claimen via advertentie
  async function onSecondRunAd() {
    // telemetry
    track(E.DUNGEON_SECOND_RUN_AD);


    setLoading(true);
    try {
      await call('ad-run'); // verhoogt ad_runs_used
      await getStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Reroll echt aan advertentie koppelen
  async function onReroll() {
    if (!result?.win) return;

    // telemetry: reroll aangevraagd
    t('E.DUNGEON_REROLL_REQUEST');

    setLoading(true);
    try {
      await call('ad-reroll', { token });        // ad “bekeken” markeren
      const r = await call('reroll', { token }); // daarna pas echte reroll
      setResult(prev => ({ ...prev, drop: r.final })); // vervangt loot

      // telemetry: reroll afgerond, nieuwe drop
      t('E.DUNGEON_REROLL_DONE', { drop: r.final });
    } catch (e) {
      console.error(e); // toont bv. { error: 'ad_required' } als ad-step mist
    } finally {
      setLoading(false);
      getStatus();
    }
  }

  // DEV reset (vandaag) – alleen zichtbaar in development
  async function onDevReset() {
    setLoading(true);
    try {
      await call('dev-reset');
      setBoss(null);
      setToken(null);
      setResult(null);
      await getStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function onClaim() {
    if (!result?.win) return;

    // telemetry
    t('dungeon_loot_taken', { drop: result?.drop });

    setLoading(true);
    try {
      await call('claim', { token });
      // wallet/saldo in parent verversen (als meegegeven)
      onAfterSave?.();
      setFlash({ type: 'ok', msg: 'Loot geclaimed!' });

      // UI opruimen
      setBoss(null);
      setToken(null);
      setResult(null);
      await getStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // simpele telemetry helper
  async function t(event, props) {
    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ event, props }),
      });
    } catch {
      /* stilhouden */
    }
  }

  // ==== render guards ====
  if (!session) return <div className="p-4">Log in om de Dungeon te spelen.</div>;
  if (!status)  return <div className="p-4">Dungeon laden…</div>;

  // ==== afgeleide waarden voor UI ====
  const limits    = status.limits || { free: 0, ad_runs: 0, rerolls: 0 };
  const used      = status.used   || { runs: 0, ad_runs: 0, rerolls: 0 };
  const totalRuns = limits.free + Math.min(used.ad_runs, limits.ad_runs);
  const runsLeft  = Math.max(0, totalRuns - used.runs);

  // ==== render ====
  return (
    <div className="p-4 border rounded-xl space-y-3">
      {/* Flash message */}
      {flash && (
        <div className={`mt-1 text-sm ${flash.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
          {flash.msg}
        </div>
      )}

      <h3 className="text-xl font-semibold">Dungeon</h3>

      <div className="text-sm opacity-70">Dag: {status.day}</div>
      {status.error && (
        <div className="text-sm text-red-600">Status error: {status.error}</div>
      )}

      {/* GEEN boss actief → start- en ad-knoppen */}
      {!boss && (
        <div>
          {/* teller */}
          <div>
            Runs vandaag: {used.runs}/{limits.free + Math.min(used.ad_runs, limits.ad_runs)}
          </div>

          {/* start-knop */}
          <button
            className="mt-2 px-3 py-2 rounded bg-black text-white disabled:opacity-40"
            onClick={onStart}
            disabled={runsLeft <= 0 || loading}
          >
            {loading ? 'Bezig…' : 'Start Run'}
          </button>

          {/* tweede run via advertentie */}
          {runsLeft <= 0 && used.ad_runs < limits.ad_runs && (
            <button
              className="ml-2 px-3 py-2 rounded border"
              onClick={onSecondRunAd}
              disabled={loading}
            >
              Watch Ad for second run
            </button>
          )}

          {/* (optioneel) dev-reset knop */}
          {process.env.NODE_ENV !== 'production' && (
            <button
              className="ml-2 px-3 py-2 rounded border"
              onClick={onDevReset}
              disabled={loading}
              title="Alle dungeon-data van vandaag resetten (alleen dev)"
            >
              DEV reset (today)
            </button>
          )}
        </div>
      )}

      {/* boss zichtbaar → resolve-knop */}
      {boss && !result && (
        <div>
          <div>Boss: <b>{boss.name}</b> — HP {boss.hp} / ATK {boss.atk}</div>
          <button className="mt-2 px-3 py-2 rounded bg-black text-white" onClick={onResolve}>
            Fight & Resolve
          </button>
        </div>
      )}

      {/* resultaat */}
      {result && (
        <div>
          {result.win ? (
            <>
              <div>
                🎉 Loot: <b>{result.drop.name}</b> × {result.drop.qty}{' '}
                <span className="opacity-60">[{result.drop.tier}]</span>
              </div>

              <div className="mt-2 space-x-2">
                <button
                  className="px-3 py-2 rounded bg-black text-white disabled:opacity-40"
                  onClick={onClaim}
                  disabled={loading}
                >
                  Take Loot
                </button>

                <button
                  className="px-3 py-2 rounded border"
                  onClick={onReroll}
                  disabled={loading}
                >
                  Reroll (Ad)
                </button>
              </div>
            </>
          ) : (
            <div>Defeat.</div>
          )}
        </div>
      )}
    </div>
  );
}

