// pages/admin/telemetry.js
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getServerClient } from '../../lib/supabaseServer';

export async function getServerSideProps(ctx) {
  const supa = getServerClient(ctx);

  // 1) check sessie
  const {
    data: { session },
    error,
  } = await supa.auth.getSession();

  if (!session || error) {
    return {
      redirect: { destination: '/login', permanent: false },
    };
  }

  // 2) check admin (server-side env!)
  //    Voorbeeld: ADMIN_EMAILS="info@mystichalls.com, admin@voorbeeld.nl"
  const adminList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const email = (session.user.email || '').toLowerCase();

  if (!adminList.includes(email)) {
    // geen admin → terug naar dashboard
    return {
      redirect: { destination: '/dashboard', permanent: false },
    };
  }

  // 3) optioneel props meegeven
  return {
    props: {
      userEmail: session.user.email ?? null,
      isAdmin: true,
    },
  };
}

/** Kleine helper voor datetime-local -> ISO */
function toISO(dtLocal) {
  try {
    if (!dtLocal) return '';
    const d = new Date(dtLocal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString();
  } catch {
    return '';
  }
}

/** Standaard range: laatste 7 dagen (yyyy-mm-ddTHH:mm voor <input type="datetime-local">) */
function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 7);

  const toLocal = new Date(to.getTime() - to.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const fromLocal = new Date(from.getTime() - from.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return { fromLocal, toLocal };
}

/** Eenvoudige mini-barchart zonder dependencies */
function MiniChart({ series, width = 480, height = 80, pad = 6 }) {
  if (!Array.isArray(series) || series.length === 0) return null;

  const max = Math.max(...series.map((d) => d.count), 1);
  const bw = (width - pad * 2) / series.length;

  return (
    <svg width={width} height={height} style={{ border: '1px solid #eee', background: '#fafafa' }}>
      {series.map((d, i) => {
        const h = (d.count / max) * (height - pad * 2);
        const x = pad + i * bw;
        const y = height - pad - h;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={Math.max(1, bw - 1)} height={h} />
          </g>
        );
      })}
      {/* labels (alleen als er niet te veel bars zijn) */}
      {series.length <= 30 &&
        series.map((d, i) => {
          const x = pad + i * bw + bw / 2;
          return (
            <text key={`lbl-${d.date}`} x={x} y={height - 2} fontSize="9" textAnchor="middle">
              {d.date?.slice(5) /* MM-DD */}
            </text>
          );
        })}
    </svg>
  );
}

/**
 * Admin Telemetry – date-range + Refresh/Reset + CSV Export + mini chart
 * Werkt samen met /api/admin/telemetry/summary (optie A).
 * - Query params: ?from=...&to=... (ISO)
 * - Server doet admin-check op e-mail.
 */
export default function TelemetryAdmin() {
  const [data, setData] = useState(null); // { ok, from, to, total, counts[], recent[], series[] }
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI state voor date-range inputs (datetime-local strings, bv "2025-09-10T12:34")
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // sessie cachen voor exportCsv()
  const [token, setToken] = useState('');
  const [event, setEvent] = useState(''); // '' = alle events

  // Eerste keer: zet default range (laatste 7 dagen) en laad
  useEffect(() => {
    const { fromLocal, toLocal } = getDefaultRange();
    setFrom((prev) => prev || fromLocal);
    setTo((prev) => prev || toLocal);
    // kleine delay zodat state staat vóór load
    setTimeout(load, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      // 1) sessie ophalen voor Bearer token
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        setErr('Niet ingelogd.');
        setLoading(false);
        return;
      }
      setToken(session.access_token || '');

      // 2) querystring opbouwen
      const qs = new URLSearchParams();
      const fISO = toISO(from);
      const tISO = toISO(to);
      if (fISO) qs.set('from', fISO);
      if (tISO) qs.set('to', tISO);
      if (event) qs.set('event', event);
      const url = '/api/admin/telemetry/summary' + (qs.toString() ? `?${qs}` : '');

      // 3) server aanroepen met Bearer token
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await r.json().catch(() => ({}));

      if (!r.ok || json?.ok === false) {
        setErr(json?.error || `Geen toegang (staat je e-mail op de adminlijst?)`);
        setData(null);
      } else {
        setData(json);
        setErr(null);
      }
    } catch (e) {
      setErr(e.message || 'Onbekende fout');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function onResetRange() {
    const { fromLocal, toLocal } = getDefaultRange();
    setFrom(fromLocal);
    setTo(toLocal);
    // direct herladen met nieuwe range
    setTimeout(load, 0);
  }

  async function exportCsv() {
    try {
      if (loading) return; // niet tijdens laden
      if (!token) throw new Error('Geen sessie token');

      const qs = new URLSearchParams();
      const fISO = toISO(from);
      const tISO = toISO(to);
      if (fISO) qs.set('from', fISO);
      if (tISO) qs.set('to', tISO);
      qs.set('format', 'csv');
      if (event) qs.set('event', event);

      const url = '/api/admin/telemetry/summary?' + qs.toString();
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('CSV export mislukt');

      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const df = (fISO || 'auto').replace(/[:T]/g, '').slice(0, 13);
      const dt = (tISO || 'nu').replace(/[:T]/g, '').slice(0, 13);
      a.download = `telemetry_${df}_${dt}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    } catch (e) {
      alert(e.message || 'Export fout');
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Laden…</div>;
  if (err) return <div style={{ padding: 16 }}>Error: {err}</div>;

  // Fallbacks: oude shapes vs nieuwe
  const total = data?.total ?? 0;
  const fromDisplay = data?.from || data?.range?.from || '';
  const toDisplay = data?.to || data?.range?.to || '';

  // counts kan array of object zijn (we ondersteunen beide)
  let countsRows = [];
  if (Array.isArray(data?.counts)) {
    countsRows = data.counts; // [{event,count}]
  } else if (data?.counts && typeof data.counts === 'object') {
    countsRows = Object.entries(data.counts).map(([event, count]) => ({ event, count }));
  }

  const recent = Array.isArray(data?.recent) ? data.recent : [];
  const recentTs = (r) => r.ts || r.created_at || '';

  // Beschikbare events voor dropdown
  const allEvents = countsRows.map((r) => r.event).sort();

  // Client-side filteren op event
  const recentFiltered = event ? recent.filter((r) => r.event === event) : recent;
  const countsRowsFiltered = event ? countsRows.filter((r) => r.event === event) : countsRows;
  const totalFiltered = event ? recentFiltered.length : total;

  return (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <h1 className="text-xl font-semibold">Telemetry — overzicht</h1>

      {/* Range + inputs + knoppen */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span>
          Range:{' '}
          {fromDisplay ? new Date(fromDisplay).toLocaleString() : '—'} →{' '}
          {toDisplay ? new Date(toDisplay).toLocaleString() : '—'}
          {'  '}•{' '}
          Totaal: {totalFiltered}
        </span>

        <div style={{ marginLeft: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <label>Van:</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <label>Tot:</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />

          <label style={{ marginLeft: 10 }}>Event:</label>
          <select value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">Alle events</option>
            {allEvents.map((evt) => (
              <option key={evt} value={evt}>
                {evt}
              </option>
            ))}
          </select>

          <button onClick={load} disabled={loading}>
            {loading ? 'Bezig…' : 'Refresh'}
          </button>
          <button onClick={onResetRange} disabled={loading}>
            Reset
          </button>
          <button onClick={exportCsv} style={{ marginLeft: 8 }} disabled={loading}>
            CSV export
          </button>
        </div>
      </div>

      {/* Mini chart */}
      {Array.isArray(data?.series) && data.series.length > 0 && (
        <div style={{ margin: '12px 0' }}>
          <div style={{ fontSize: 14, marginBottom: 4 }}>Events per dag</div>
          <MiniChart
            series={data.series}
            width={Math.min(12 * data.series.length + 24, 720)}
          />
        </div>
      )}

      {/* Aantallen per event */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontWeight: 600, margin: '8px 0' }}>Aantallen per event</h2>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="text-left pr-4" style={{ textAlign: 'left', paddingRight: 16 }}>
                Event
              </th>
              <th className="text-left pr-4" style={{ textAlign: 'left', paddingRight: 16 }}>
                #
              </th>
            </tr>
          </thead>
          <tbody>
            {countsRows.length === 0 && (
              <tr>
                <td colSpan={2}>—</td>
              </tr>
            )}
            {countsRowsFiltered.map(({ event, count }) => (
              <tr key={event}>
                <td className="pr-4" style={{ paddingRight: 16 }}>
                  {event}
                </td>
                <td className="pr-4" style={{ paddingRight: 16 }}>
                  {count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Laatste events */}
      <section>
        <h2 style={{ fontWeight: 600, margin: '8px 0' }}>Laatste events</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th className="text-left pr-4" style={{ textAlign: 'left', paddingRight: 16, width: 220 }}>
                Tijd
              </th>
              <th className="text-left pr-4" style={{ textAlign: 'left', paddingRight: 16, width: 220 }}>
                Event
              </th>
              <th className="text-left pr-4" style={{ textAlign: 'left', paddingRight: 16 }}>
                Props
              </th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td colSpan={3}>—</td>
              </tr>
            )}
            {recentFiltered.map((r, i) => (
              <tr key={i}>
                <td className="pr-4" style={{ paddingRight: 16 }}>
                  {recentTs(r)}
                </td>
                <td className="pr-4" style={{ paddingRight: 16 }}>
                  {r.event}
                </td>
                <td>
                  <code style={{ opacity: 0.8 }}>{JSON.stringify(r.props ?? {})}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
