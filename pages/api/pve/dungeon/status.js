// pages/api/pve/dungeon/status.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE // server key
  );

  // auth user uit bearer token
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user } = {}, error: authErr } = await supa.auth.getUser(auth);
  if (authErr || !user) return res.status(401).json({ error: 'auth' });
  const uid = user.id;

  // config
  const { data: cfg, error: cfgErr } =
    await supa.from('pve_dungeon_config').select('*').limit(1).single();
  if (cfgErr || !cfg) return res.status(500).json({ error: 'config' });

  const day = cfg.daily_seed;

  // state (dag)
  const { data: state } =
    await supa.from('pve_dungeon_state').select('*')
      .eq('user_id', uid).eq('day', day).maybeSingle();

  res.json({
    day,
    active: cfg.active,
    limits: {
      free: cfg.free_runs_per_day,
      ad_runs: cfg.ad_run_refresh_max,
      rerolls: cfg.ad_loot_reroll_max
    },
    used: {
      runs: state?.runs_used ?? 0,
      ad_runs: state?.ad_runs_used ?? 0,
      rerolls: state?.rerolls_used ?? 0
    }
  });
}
