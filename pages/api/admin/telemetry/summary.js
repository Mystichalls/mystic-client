// pages/api/admin/telemetry/summary.js
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE; // service role key (server-side)
const ADM = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).end(); // alleen GET

    if (!url || !key) {
      return res.status(500).json({ error: 'missing_supabase_env' });
    }

    // ===== Auth: user ophalen uit meegegeven Bearer =====
    const bearer = req.headers.authorization?.replace('Bearer ', '') || '';
    const supa = createClient(url, key);

    const { data: userData, error: userErr } = await supa.auth.getUser(bearer);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'no_user' });
    }
    const email = (userData.user.email || '').toLowerCase();
    if (!ADM.includes(email)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // ===== Query params =====
    const { from, to, format } = req.query;

    const event =
      typeof req.query.event === 'string' ? req.query.event.trim() : '';

    const user_id =
      typeof req.query.user_id === 'string' ? req.query.user_id.trim() : '';

    // ===== Range normaliseren =====
    const toDate = to ? new Date(to) : new Date(); // default nu
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 24 * 60 * 60 * 1000); // default 24h terug

    const fromISO = fromDate.toISOString();
    const toISO = toDate.toISOString();

    // ===== Eén helper om overal dezelfde filters toe te passen =====
    function applyFilters(q) {
      if (fromISO) q = q.gte('created_at', fromISO);
      if (toISO) q = q.lte('created_at', toISO);
      if (event) q = q.eq('event', event);
      if (user_id) q = q.eq('user_id', user_id); // nieuw
      return q;
    }

    // ===== Data lezen (recent) =====
    let q = supa.from('pve_telemetry').select('created_at,event,props');
    q = applyFilters(q);

    const { data: rows, error: qErr } = await q
      .order('created_at', { ascending: false })
      .limit(10000); // simpele cap

    if (qErr) {
      return res.status(500).json({ error: qErr.message });
    }

    // ===== Counts per event =====
    const countsMap = new Map();
    for (const r of rows) {
      countsMap.set(r.event, (countsMap.get(r.event) || 0) + 1);
    }
    const counts = Array.from(countsMap.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);

    // ===== Timeseries per dag =====
    const dayKey = (iso) => iso.slice(0, 10); // YYYY-MM-DD
    const seriesMap = new Map();
    for (const r of rows) {
      const k = dayKey(r.created_at);
      seriesMap.set(k, (seriesMap.get(k) || 0) + 1);
    }
    const series = Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // ===== CSV export =====
    if (format === 'csv') {
      const header = 'timestamp,event,props_json\n';
      const body = rows
        .map((r) => {
          const pj = JSON.stringify(r.props ?? {});
          const safe = pj.replace(/"/g, '""');
          return `"${r.created_at}","${r.event}","${safe}"`;
        })
        .join('\n');
      const csv = header + body;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const suffixUser = user_id ? `_user_${String(user_id).slice(0, 8)}` : '';
      const fname = `telemetry_${fromISO.slice(0, 10)}_${toISO.slice(0, 10)}${suffixUser}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      return res.status(200).send(csv);
    }

    // ===== JSON response =====
    const recent = rows.map((r) => ({
      ts: r.created_at,
      event: r.event,
      props: r.props || {},
    }));

    return res.status(200).json({
      ok: true,
      from: fromISO,
      to: toISO,
      total: rows.length,
      counts,
      recent,
      series,
    });
  } catch (e) {
    console.error('summary error', e);
    return res.status(500).json({ error: 'server_error' });
  }
}
