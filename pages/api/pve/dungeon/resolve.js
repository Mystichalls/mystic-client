// pages/api/pve/dungeon/resolve.js
import { createClient } from '@supabase/supabase-js';
import { seededRng, pickLoot } from '@/lib/pve/dungeon';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user } = {} } = await supa.auth.getUser(auth);
  if (!user) return res.status(401).end();

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'no_token' });

  const [uidTok, day, runIndexStr] = Buffer.from(token, 'base64').toString('utf8').split(':');
  if (uidTok !== user.id) return res.status(403).json({ error: 'token_mismatch' });
  const runIndex = parseInt(runIndexStr, 10);

  const { data: cfg } = await supa.from('pve_dungeon_config').select('*').limit(1).single();
  if (!cfg || day !== cfg.daily_seed) return res.status(400).json({ error: 'stale_token' });

  // simpele win chance (~55%), geen pity, geen troost
  const rng = seededRng(`${user.id}-${day}-battle-${runIndex}`);
  const didWin = (rng() < 0.85);

  if (!didWin) {
    // alleen {win:false} terug, niets uitbetalen
    return res.json({ win: false });
  }

  // loot ophalen (alleen actieve)
  const { data: lootRows } = await supa.from('pve_dungeon_loot_table').select('*').eq('is_active', true);
  const rng2 = seededRng(`${user.id}-${day}-loot-${runIndex}`);
  const pick = pickLoot(lootRows, false, rng2); // pity=false

  // drop loggen
  const { data: ins, error } = await supa
    .from('pve_dungeon_drops')
    .insert({
      user_id: user.id, day,
      loot_id: pick.row.loot_id, qty: pick.qty, tier: pick.row.tier, was_reroll: false
    })
    .select('drop_id')
    .single();
  if (error) return res.status(500).json({ error });

  // koppel deze drop aan de run (voor reroll-limit per run)
  await supa.from('pve_dungeon_runs')
    .update({ result_drop_id: ins.drop_id })
    .eq('user_id', user.id).eq('day', day).eq('run_index', runIndex);

  // response naar client
  res.json({
    win: true,
    drop: { loot_id: pick.row.loot_id, name: pick.row.name, type: pick.row.type, tier: pick.row.tier, qty: pick.qty }
  });
}
