// pages/api/pve/dungeon/start.js
import { createClient } from '@supabase/supabase-js';
import { seededRng } from '@/lib/pve/dungeon';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

  const auth = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user } = {}, error: authErr } = await supa.auth.getUser(auth);
  if (authErr || !user) return res.status(401).json({ error: 'auth' });
  const uid = user.id;

  // Config ophalen
  const { data: cfg, error: cfgErr } = await supa.from('pve_dungeon_config').select('*').limit(1).single();
  if (cfgErr || !cfg) return res.status(500).json({ error: 'config' });
  const day = cfg.daily_seed;

  // Huidige state (voor runs teller)
  const { data: st0 } = await supa.from('pve_dungeon_state').select('*').eq('user_id', uid).eq('day', day).maybeSingle();
  const runsUsed = st0?.runs_used ?? 0;
  const adRunsUsed = st0?.ad_runs_used ?? 0;

  // Limiet check (1 free + eventueel 1 ad-run)
  const limit = cfg.free_runs_per_day + Math.min(adRunsUsed, cfg.ad_run_refresh_max);
  if (runsUsed >= limit) return res.status(400).json({ error: 'run_limit' });

  // Volgende run-index
  const nextRunIndex = runsUsed + 1;

  // State bijwerken
  await supa.from('pve_dungeon_state').upsert({
    user_id: uid, day,
    runs_used: nextRunIndex,
    ad_runs_used: adRunsUsed,
    rerolls_used: st0?.rerolls_used ?? 0,
    last_result_tier: st0?.last_result_tier ?? null,
    streak_low_tier_days: st0?.streak_low_tier_days ?? 0
  });

  // Log voor deze run (voor "max 1 reroll per run")
  await supa.from('pve_dungeon_runs').upsert({
    user_id: uid, day, run_index: nextRunIndex, rerolls_used: 0
  });

  // Boss genereren (gewoon een seed, simple)
  const rng = seededRng(`${day}-boss`);
  const boss = {
    name: 'Seeded Warden',
    hp: Math.floor(cfg.base_hp * (1 + rng() * 0.4)),
    atk: Math.floor(cfg.base_atk * (1 + rng() * 0.4)),
    seed: day
  };

  // Token met uid+day+runIndex (nodig voor resolve)
  const token = Buffer.from(`${uid}:${day}:${nextRunIndex}`).toString('base64');

  // Telemetry kan je client-side loggen; hier alleen response
  res.json({ ok: true, boss, token, run_index: nextRunIndex });
}
