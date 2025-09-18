// pages/api/pve/dungeon/ad-run.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  const auth = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user } = {} } = await supa.auth.getUser(auth);
  if (!user) return res.status(401).end();

  const { data: cfg } = await supa
    .from('pve_dungeon_config')
    .select('*').limit(1).single();

  const day = cfg.daily_seed;

  // huidige state ophalen (of defaults)
  const { data: st0 } = await supa
    .from('pve_dungeon_state')
    .select('*')
    .eq('user_id', user.id)
    .eq('day', day)
    .maybeSingle();

  const runsUsed   = st0?.runs_used ?? 0;
  const adRunsUsed = st0?.ad_runs_used ?? 0;

  if (adRunsUsed >= cfg.ad_run_refresh_max) {
    return res.status(400).json({ error: 'ad_runs_limit' });
  }

  // +1 ad run registreren
  const { data: st1, error } = await supa
    .from('pve_dungeon_state')
    .upsert({
      user_id: user.id,
      day,
      runs_used: runsUsed,
      ad_runs_used: adRunsUsed + 1,
      rerolls_used: st0?.rerolls_used ?? 0,
      last_result_tier: st0?.last_result_tier ?? null,
      streak_low_tier_days: st0?.streak_low_tier_days ?? 0
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error });

  // nieuwe limieten teruggeven (handig voor UI)
  res.json({
    ok: true,
    limits: { free: cfg.free_runs_per_day, ad_runs: cfg.ad_run_refresh_max },
    used:   { runs: st1.runs_used, ad_runs: st1.ad_runs_used }
  });
}
