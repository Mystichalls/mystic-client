// pages/api/pve/dungeon/reroll.js
import { createClient } from '@supabase/supabase-js';
import { seededRng, pickLoot } from '@/lib/pve/dungeon';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  const auth = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user } = {} } = await supa.auth.getUser(auth);
  if (!user) return res.status(401).end();

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'no_token' });

  const [uidTok, day, runIndexStr] =
    Buffer.from(token, 'base64').toString('utf8').split(':');
  if (uidTok !== user.id) return res.status(403).json({ error: 'token_mismatch' });
  const runIndex = parseInt(runIndexStr, 10);

  // --- hier checken we run status + ad vlag ---
  const { data: run } = await supa
    .from('pve_dungeon_runs')
    .select('*')
    .eq('user_id', user.id)
    .eq('day', day)
    .eq('run_index', runIndex)
    .single();

  if ((run?.rerolls_used ?? 0) >= 1) {
    return res.status(400).json({ error: 'reroll_limit_run' });
  }
  if (!run?.result_drop_id) {
    return res.status(400).json({ error: 'no_drop_yet' }); // eerst win + drop nodig
  }
  if (!run?.ad_reroll_ready) {
    return res.status(400).json({ error: 'ad_required' }); // ad nog niet “gezien”
  }
if (run?.claimed) {
  return res.status(400).json({ error: 'already_claimed' });
}

  // --- loot opnieuw rollen (vervangend) ---
  const { data: lootRows } = await supa
    .from('pve_dungeon_loot_table')
    .select('*')
    .eq('is_active', true);

  const rng = seededRng(`${user.id}-${day}-reroll-${runIndex}`);
  const pick = pickLoot(lootRows, false, rng);

  const { data: ins, error } = await supa
    .from('pve_dungeon_drops')
    .insert({
      user_id: user.id,
      day,
      loot_id: pick.row.loot_id,
      qty: pick.qty,
      tier: pick.row.tier,
      was_reroll: true
    })
    .select('drop_id')
    .single();

  if (error) return res.status(500).json({ error });

  // --- vlag terug uit + reroll tellen + nieuwe drop koppelen ---
  await supa
    .from('pve_dungeon_runs')
    .update({
      rerolls_used: (run?.rerolls_used ?? 0) + 1,
      result_drop_id: ins.drop_id,
      ad_reroll_ready: false
    })
    .eq('user_id', user.id)
    .eq('day', day)
    .eq('run_index', runIndex);

  res.json({
    final: {
      loot_id: pick.row.loot_id,
      name: pick.row.name,
      type: pick.row.type,
      tier: pick.row.tier,
      qty: pick.qty
    }
  });
}
