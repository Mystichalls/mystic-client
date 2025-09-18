// pages/api/pve/dungeon/ad-reroll.js
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

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'no_token' });

  // token = uid:day:runIndex  (komt uit /start)
  const [uidTok, day, runIndexStr] = Buffer.from(token, 'base64').toString('utf8').split(':');
  if (uidTok !== user.id) return res.status(403).json({ error: 'token_mismatch' });
  const runIndex = parseInt(runIndexStr, 10);

  // Je mag alleen een ad klaarzetten als:
  // - je deze run al een win + drop had (result_drop_id is niet null)
  // - je nog géén reroll gebruikt hebt op deze run
  const { data: run } = await supa.from('pve_dungeon_runs')
    .select('*')
    .eq('user_id', user.id).eq('day', day).eq('run_index', runIndex)
    .single();

  if (!run?.result_drop_id) {
    return res.status(400).json({ error: 'no_drop_yet' });
  }
  if ((run?.rerolls_used ?? 0) >= 1) {
    return res.status(400).json({ error: 'reroll_limit_run' });
  }

  const { error } = await supa.from('pve_dungeon_runs')
    .update({ ad_reroll_ready: true })
    .eq('user_id', user.id).eq('day', day).eq('run_index', runIndex);

  if (error) return res.status(500).json({ error });

  // hier zou je je echte ad-SDK callback aanroepen; wij simuleren m alleen
  return res.json({ ok: true });
}
