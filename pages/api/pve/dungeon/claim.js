// pages/api/pve/dungeon/claim.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  // auth
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user } = {} } = await supa.auth.getUser(auth);
  if (!user) return res.status(401).end();

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'no_token' });

  const [uidTok, day, runIndexStr] =
    Buffer.from(token, 'base64').toString('utf8').split(':');
  if (uidTok !== user.id) return res.status(403).json({ error: 'token_mismatch' });
  const runIndex = parseInt(runIndexStr, 10);

  // run ophalen
  const { data: run } = await supa
    .from('pve_dungeon_runs')
    .select('*')
    .eq('user_id', user.id).eq('day', day).eq('run_index', runIndex)
    .single();

  if (!run?.result_drop_id) return res.status(400).json({ error: 'no_drop_yet' });
  if (run?.claimed)        return res.status(400).json({ error: 'already_claimed' });

  // drop + loot info ophalen
  const { data: drop } = await supa
    .from('pve_dungeon_drops')
    .select('*')
    .eq('drop_id', run.result_drop_id)
    .single();

  if (!drop) return res.status(404).json({ error: 'drop_not_found' });

  const { data: lootRow } = await supa
    .from('pve_dungeon_loot_table')
    .select('*')
    .eq('loot_id', drop.loot_id)
    .single();

  if (!lootRow) return res.status(404).json({ error: 'loot_not_found' });

  // wallet bijwerken (coins/dust); andere types laten we (nu) alleen als log bestaan
  let wallet = null;
  if (lootRow.type === 'coins' || lootRow.type === 'dust') {
    const { data: cur } = await supa
      .from('currencies')
      .select('coins, dust')
      .eq('user_id', user.id)
      .maybeSingle();

    const coins = cur?.coins ?? 0;
    const dust  = cur?.dust ?? 0;

    const next = {
      user_id: user.id,
      coins: lootRow.type === 'coins' ? coins + drop.qty : coins,
      dust:  lootRow.type === 'dust'  ? dust  + drop.qty : dust
    };

    // upsert/insert/update (best-effort, 2 stappen is prima voor dev)
    if (cur) {
      await supa.from('currencies').update(next).eq('user_id', user.id);
    } else {
      await supa.from('currencies').insert(next);
    }
    wallet = next;
  }

  // run markeren als geclaimed + ad vlag uit
  await supa.from('pve_dungeon_runs')
    .update({ claimed: true, ad_reroll_ready: false })
    .eq('user_id', user.id).eq('day', day).eq('run_index', runIndex);

  return res.json({
    ok: true,
    applied: { type: lootRow.type, qty: drop.qty, name: lootRow.name, tier: lootRow.tier },
    wallet
  });
}
