// /pages/api/telemetry.js
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE; // service role key (server only!)
const ADM = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

// Server client (met service role) om RLS te mogen passeren als dat nodig is.
const supa = createClient(url, key);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    if (!url || !key) {
      return res.status(500).json({ ok: false, error: 'missing_supabase_env' });
    }

    // ===== Auth: user uit Bearer token =====
    const bearer =
      req.headers.authorization?.replace('Bearer ', '') || req.headers.authorization || '';
    if (!bearer) {
      return res.status(401).json({ ok: false, error: 'no_bearer_token' });
    }

    const auth = supa.auth;
    const { data: userData, error: userErr } = await auth.getUser(bearer);
    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: 'invalid_token' });
    }
    const user = userData.user;
    const email = (user.email || '').toLowerCase();

    // ===== payload =====
    const { event, props } = req.body || {};
    if (!event || typeof event !== 'string') {
      return res.status(400).json({ ok: false, error: 'missing_event' });
    }

    // ===== Optioneel: baseline anti-spam (max 10 props-keys) =====
    let safeProps = {};
    if (props && typeof props === 'object') {
      const entries = Object.entries(props).slice(0, 10);
      for (const [k, v] of entries) {
        // alleen JSON-safe, platte waardes of kleine objecten/arrays
        try {
          JSON.stringify(v);
          safeProps[k] = v;
        } catch (_) {
          // sla onser. prop over
        }
      }
    }

    // ===== Schrijf weg =====
    const row = {
      user_id: user.id,
      email,
      event,
      props: safeProps,
    };

    const { error: insErr } = await supa.from('pve_telemetry').insert(row);
    if (insErr) {
      console.error('[telemetry] insert error:', insErr);
      return res.status(500).json({ ok: false, error: 'insert_failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[telemetry] api error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
