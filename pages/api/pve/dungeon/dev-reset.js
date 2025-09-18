// pages/api/pve/dungeon/dev-reset.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Veiligheid: niet in productie toestaan
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'forbidden_in_production' });
  }

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  // auth user
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user } = {} } = await supa.auth.getUser(auth);
  if (!user) return res.status(401).end();

  // huidige "dag" uit config
  const { data: cfg } = await supa
    .from('pve_dungeon_config')
    .select('daily_seed')
    .single();
  const day = cfg.daily_seed;

  // alles van vandaag voor deze user leegmaken
  const delRuns = await supa
    .from('pve_dungeon_runs')
    .delete()
    .eq('user_id', user.id)
    .eq('day', day);

  const delDrops = await supa
    .from('pve_dungeon_drops')
    .delete()
    .eq('user_id', user.id)
    .eq('day', day);

  // state resetten
  const { data: st } = await supa
    .from('pve_dungeon_state')
    .upsert({
      user_id: user.id,
      day,
      runs_used: 0,
      ad_runs_used: 0,
      rerolls_used: 0,
      last_result_tier: null,
      streak_low_tier_days: 0
    })
    .select()
    .single();

  return res.json({
    ok: true,
    day,
    deleted: {
      runs: delRuns?.count ?? null,
      drops: delDrops?.count ?? null
    },
    state: st
  });
}
