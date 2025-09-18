// components/pve/Towns.js
import { track } from '../../lib/telemetry';
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { E } from '../../lib/events';


function computeTownsWindow(cfg, now = new Date()) {
  const windowMs = (cfg?.rotation_hours ?? 48) * 60 * 60 * 1000
  const t = now.getTime()
  const startMs = Math.floor(t / windowMs) * windowMs
  const endMs = startMs + windowMs
  return { start: new Date(startMs), end: new Date(endMs) }
}
const fmt   = (v) => (v ? new Date(v).toLocaleString() : '—')
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))

export default function Towns() {
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [runs, setRuns] = useState([])
  const [saving, setSaving] = useState(false)
  const [win, setWin] = useState(null)
  const [bestNow, setBestNow] = useState(null)

  const [seasonTotal, setSeasonTotal] = useState(null) // 👈 NIEUW

  // demo-inputs
  const [town, setTown] = useState('warrior')
  const [minibosses, setMinibosses] = useState(2)            // coins only
  const [difficulty, setDifficulty] = useState('easy')       // easy|medium|hard
  const [bossAttempted, setBossAttempted] = useState(true)
  const [bossDefeated,  setBossDefeated]  = useState(false)
  // aantal eerdere retries vóór deze run (0 = meteen win)
  const [adResets, setAdResets] = useState(0)
// log wanneer Towns opent (1x bij mount)
useEffect(() => {
  track(E.TOWNS_OPEN);
}, []);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from('pve_towns_config')
        .select(`
          rotation_hours, towns, miniboss_count, boss_count, difficulty_pattern,
          miniboss_reward_coins, boss_reward_easy, boss_reward_medium, boss_reward_hard,
          allow_ad_reset, penalty_start_percent, penalty_step_percent, penalty_min_percent
        `)
        .eq('is_active', true)
        .maybeSingle()

      if (!mounted) return
      if (error) setError(error.message)
      else {
        setCfg(data)
        const w = computeTownsWindow(data, new Date())
        setWin(w)
        await loadRuns()
        await loadBestForWindow(w)
        await loadSeasonTotal()            // 👈 NIEUW
      }
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  async function loadRuns() {
    const user = await getUser()
    if (!user) { setRuns([]); return }
    const { data, error } = await supabase
      .from('pve_towns_runs')
      .select('id, run_at, window_start, town, minibosses_defeated, boss_attempted, boss_defeated, boss_difficulty, ad_resets_used, reward_coins, division_points, points_penalty_percent')
      .order('run_at', { ascending: false })
      .limit(10)
    if (error) { console.warn(error); setRuns([]) } else { setRuns(data || []) }
  }

  async function loadBestForWindow(w) {
    const user = await getUser()
    if (!user || !w) { setBestNow(null); return }
    const { data, error } = await supabase
      .from('pve_towns_best_runs')
      .select('run_id, run_at, window_start, window_end, town, boss_difficulty, minibosses_defeated, boss_attempted, boss_defeated, ad_resets_used, reward_coins, division_points, points_penalty_percent, reward_notes')
      .eq('user_id', user.id)
      .eq('window_start', w.start.toISOString())
      .maybeSingle()
    if (error) { console.warn(error); setBestNow(null) } else { setBestNow(data ?? null) }
  }

  async function loadSeasonTotal() {     // 👈 NIEUW
    const user = await getUser()
    if (!user) { setSeasonTotal(null); return }
    const { data, error } = await supabase
      .from('pve_towns_season_totals')
      .select('season_no, start_at, end_at, wins_count_total, wins_count_included, points_total_capped, points_total_uncapped')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) { console.warn(error); setSeasonTotal(null) } else { setSeasonTotal(data ?? null) }
  }

  // Coins: minibosses + boss (NO penalty)
  function baseBossReward() {
    if (!cfg || !bossDefeated) return 0
    if (difficulty === 'easy')   return cfg.boss_reward_easy   ?? 300
    if (difficulty === 'medium') return cfg.boss_reward_medium ?? 500
    return cfg.boss_reward_hard ?? 800
  }
  function computeCoins() {
    if (!cfg) return 0
    const minis = clamp(minibosses, 0, 4) * (cfg.miniboss_reward_coins ?? 100)
    const boss  = baseBossReward()
    return minis + boss
  }

  // Penalty % op divisiepunten
  function penaltyPercent(n = adResets) {
    if (!cfg) return 100
    const start = cfg.penalty_start_percent ?? 100
    const step  = cfg.penalty_step_percent  ?? 10
    const min   = cfg.penalty_min_percent   ?? 20
    const k     = clamp(n, 0, 999)
    return Math.max(min, start - k * step)
  }

  // Division points: ALLEEN boss; penalty als er 1+ retries waren vóór deze (winnende) run
  function computeDivisionPoints() {
    if (!bossDefeated) return 0
    const base = baseBossReward()
    const pct  = adResets > 0 ? penaltyPercent(adResets) : 100
    return Math.floor(base * (pct / 100))
  }

  async function logDemoTownRun() {
    const user = await getUser()
    if (!user) return alert('Log eerst in op /dashboard (bovenaan).')
    if (!cfg)  return alert('Config nog niet geladen.')

    const { start, end } = computeTownsWindow(cfg, new Date())
    const m   = clamp(minibosses, 0, 4)
    const ar  = clamp(adResets, 0, 999)
    const coins  = computeCoins()
    const points = computeDivisionPoints()
    const pct    = bossDefeated && ar > 0 ? penaltyPercent(ar) : 100

    setSaving(true)
    const payload = {
      user_id: user.id,
      window_start: start.toISOString(),
      window_end: end.toISOString(),
      town,
      minibosses_defeated: m,
      boss_attempted: !!bossAttempted,
      boss_defeated: !!bossDefeated,
      boss_difficulty: bossAttempted ? difficulty : null,
      ad_resets_used: ar,                  // # eerdere retries vóór deze run
      reward_coins: coins,                 // nooit gestraft
      division_points: points,             // alleen boss, penalty bij eerdere retries
      points_penalty_percent: pct,
      reward_notes: bossDefeated ? (ar > 0 ? `penalty ${pct}% (op divisiepunten)` : 'no penalty') : 'no boss kill'
    }

    const { error } = await supabase.from('pve_towns_runs').insert([payload])
    setSaving(false)
    if (error) return alert(`Fout bij opslaan: ${error.message}`)

    await loadRuns()
    await loadBestForWindow({ start, end })
    await loadSeasonTotal()               // 👈 NIEUW (na opslaan updaten)
    alert('Towns-run opgeslagen!')
  }

  if (loading) return (<div><h2>Towns</h2><p>laden…</p></div>)
  if (error)   return (<div><h2>Towns</h2><p style={{color:'red'}}>Error: {error}</p></div>)
  if (!cfg)    return (<div><h2>Towns</h2><p>Geen config gevonden.</p></div>)

  const penaltyInfo = `${cfg.penalty_start_percent}% → -${cfg.penalty_step_percent}% … → min ${cfg.penalty_min_percent}%`
  const previewPct = bossDefeated && adResets > 0 ? penaltyPercent(adResets) : 100

  return (
    <div>
      <h2>Towns</h2>
      <ul>
        <li>Rotatie: elke <b>{cfg.rotation_hours}u</b></li>
        <li>Towns: <b>{(cfg.towns || []).join(', ')}</b></li>
        <li>Structuur: <b>{cfg.miniboss_count}</b> minibosses + <b>{cfg.boss_count}</b> boss</li>
        <li>Moeilijkheidspatroon: <b>{cfg.difficulty_pattern}</b></li>
        <li>Rewards: miniboss <b>{cfg.miniboss_reward_coins} coins</b>; boss <b>E {cfg.boss_reward_easy}</b> / <b>M {cfg.boss_reward_medium}</b> / <b>H {cfg.boss_reward_hard}</b></li>
        <li>Ad-reset: {cfg.allow_ad_reset ? `aan (penalty op PUNTEN: ${penaltyInfo})` : 'uit'}</li>
      </ul>

      {win && <p style={{ marginTop:8 }}>Huidig 48u-window: <b>{fmt(win.start)}</b> → <b>{fmt(win.end)}</b></p>}

      {/* demo form */}
      <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 6 }}>
        <h3>Log demo Towns-run</h3>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <label>Town:</label>
          <select value={town} onChange={e=>setTown(e.target.value)}>
            <option value="warrior">warrior</option>
            <option value="mage">mage</option>
            <option value="rogue">rogue</option>
            <option value="ranger">ranger</option>
            <option value="priest">priest</option>
          </select>

          <label>Minibosses (0–4):</label>
          <input type="number" min={0} max={4} value={minibosses} onChange={e=>setMinibosses(parseInt(e.target.value))} style={{ width: 70 }} />

          <label><input type="checkbox" checked={bossAttempted} onChange={e=>setBossAttempted(e.target.checked)} /> Boss geprobeerd</label>
          <label><input type="checkbox" checked={bossDefeated}  onChange={e=>setBossDefeated(e.target.checked)}  /> Boss verslagen</label>

          <label>Boss difficulty:</label>
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} disabled={!bossAttempted}>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>

          <label>Ad resets (aantal eerdere retries vóór deze run):</label>
          <input type="number" min={0} value={adResets} onChange={e=>setAdResets(parseInt(e.target.value))} style={{ width: 80 }} />

          <button onClick={logDemoTownRun} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
        </div>
        <p style={{ marginTop:6 }}>
          Coins (geen penalty): <b>{computeCoins()}</b> &nbsp;|&nbsp;
          Divisiepunten (alleen boss, {bossDefeated && adResets>0 ? `penalty ${previewPct}%` : 'geen penalty'}): <b>{computeDivisionPoints()}</b>
        </p>
      </div>

      {/* beste run in huidig window */}
      {bestNow && (
        <div style={{ marginTop: 16 }}>
          <h3>Beste run in huidig window (server-side)</h3>
          <p>
            {fmt(bestNow.run_at)} — <b>{bestNow.town}</b>; points: <b>{bestNow.division_points}</b> (penalty {bestNow.points_penalty_percent}%); coins: <b>{bestNow.reward_coins}</b>; minibosses: <b>{bestNow.minibosses_defeated}</b>; boss: {bestNow.boss_attempted ? (bestNow.boss_defeated ? <b>win</b> : 'loss') : 'n/a'}{bestNow.boss_difficulty ? ` (${bestNow.boss_difficulty})` : ''}.
          </p>
        </div>
      )}

      {/* 👇 NIEUW: Seizoenspunten (cap 56 wins) */}
      {seasonTotal && (
        <div style={{ marginTop: 16 }}>
          <h3>Seizoenspunten (Towns)</h3>
          <p>
            Season {seasonTotal.season_no}: <b>{seasonTotal.points_total_capped}</b> pts (cap 56 wins)<br/>
            Meegeteld: <b>{seasonTotal.wins_count_included}</b> / {seasonTotal.wins_count_total} wins<br/>
            Periode: {fmt(seasonTotal.start_at)} → {fmt(seasonTotal.end_at)}
          </p>
        </div>
      )}

      <div style={{ marginTop:16 }}>
        <h3>Jouw laatste Towns-runs (10)</h3>
        {runs.length === 0 ? (
          <p>Nog geen runs gevonden.</p>
        ) : (
          <ul>
            {runs.map(r => (
              <li key={r.id}>
                {fmt(r.run_at)} — {r.town};
                minibosses: <b>{r.minibosses_defeated}</b>;
                boss: {r.boss_attempted ? (r.boss_defeated ? <b>win</b> : 'loss') : 'n/a'}{r.boss_difficulty ? ` (${r.boss_difficulty})` : ''};
                ad-resets: {r.ad_resets_used};
                coins: <b>{r.reward_coins}</b>;
                punten: <b>{r.division_points}</b> (penalty {r.points_penalty_percent}%)
                {' '}| window: {fmt(r.window_start)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
