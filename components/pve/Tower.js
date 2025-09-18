// components/pve/Tower.js
import { track } from '../../lib/telemetry';
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { E } from '../../lib/events';


function computeWindow(cfg, now = new Date()) {
  const windowMs = (cfg?.window_hours ?? 48) * 60 * 60 * 1000
  const offsetMs = (cfg?.towns_offset_hours ?? 0) * 60 * 60 * 1000
  const t = now.getTime()
  const startMs = Math.floor((t - offsetMs) / windowMs) * windowMs + offsetMs
  const endMs = startMs + windowMs
  return { start: new Date(startMs), end: new Date(endMs) }
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)) }
const fmt = (v) => (v ? new Date(v).toLocaleString() : '—')

export default function Tower() {
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [runs, setRuns] = useState([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [saving,   setSaving]   = useState(false)

  const [win, setWin] = useState(null)           // huidig window {start,end}
  const [bestNow, setBestNow] = useState(null)   // beste run (view)
  const [pointsNow, setPointsNow] = useState(null)     // punten huidig window
  const [recentPoints, setRecentPoints] = useState([]) // laatste 5 windows
  const [seasonTotal, setSeasonTotal] = useState(null) // totaal in actief seizoen

  // test-run inputs
  const [levels, setLevels]   = useState(12)
  const [livesEnd, setLivesEnd] = useState(21)
  const [resets, setResets]   = useState(1)
  const [token, setToken]     = useState(false)
// log wanneer Tower opent (1x bij mount)
useEffect(() => {
  track(E.TOWER_OPEN);
}, []);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      // 1) Config
      const { data: cfgData, error: cfgErr } = await supabase
        .from('pve_tower_config')
        .select(`
          life_start, bonus_l5, bonus_l10, bonus_l15, bonus_l20, max_bonus,
          window_hours, towns_offset_hours, base_runs_per_window, allow_token_extra_run,
          max_resets_per_run, max_resets_per_level, points_rule
        `)
        .eq('is_active', true)
        .maybeSingle()

      if (!mounted) return
      if (cfgErr) setError(cfgErr.message)
      else {
        setCfg(cfgData)
        const w = computeWindow(cfgData, new Date())
        setWin(w)
        await loadBestForWindow(w)
        await loadPointsForWindow(w)
        await loadRecentPoints()
        await loadSeasonTotal()
      }
      setLoading(false)

      // 2) losse runs
      await loadRuns()
    })()
    return () => { mounted = false }
  }, [])

  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  async function loadRuns() {
    setRunsLoading(true)
    const user = await getUser()
    if (!user) { setRuns([]); setRunsLoading(false); return }
    const { data, error } = await supabase
      .from('pve_tower_runs')
      .select('id, run_at, window_start, window_end, levels_cleared, score_points, lives_end, resets_used, token_used')
      .order('run_at', { ascending: false })
      .limit(10)
    if (error) { console.warn(error); setRuns([]) } else { setRuns(data || []) }
    setRunsLoading(false)
  }

  async function loadBestForWindow(w) {
    const user = await getUser()
    if (!user || !w) { setBestNow(null); return }
    const { data, error } = await supabase
      .from('pve_tower_best_runs')
      .select('run_id, user_id, window_start, window_end, run_at, levels_cleared, score_points, lives_end, resets_used, token_used')
      .eq('user_id', user.id)
      .eq('window_start', w.start.toISOString())
      .maybeSingle()
    if (error) { console.warn(error); setBestNow(null) } else { setBestNow(data ?? null) }
  }

  async function loadPointsForWindow(w) {
    const user = await getUser()
    if (!user || !w) { setPointsNow(null); return }
    const { data, error } = await supabase
      .from('pve_tower_window_points')
      .select('points, tiebreak_lives, run_at, window_start, window_end, run_id')
      .eq('user_id', user.id)
      .eq('window_start', w.start.toISOString())
      .maybeSingle()
    if (error) { console.warn(error); setPointsNow(null) } else { setPointsNow(data ?? null) }
  }

  async function loadRecentPoints() {
    const user = await getUser()
    if (!user) { setRecentPoints([]); return }
    const { data, error } = await supabase
      .from('pve_tower_window_points')
      .select('window_start, window_end, points')
      .eq('user_id', user.id)
      .order('window_start', { ascending: false })
      .limit(5)
    if (error) { console.warn(error); setRecentPoints([]) } else { setRecentPoints(data || []) }
  }

  async function loadSeasonTotal() {
    const user = await getUser()
    if (!user) { setSeasonTotal(null); return }
    const { data, error } = await supabase
      .from('pve_tower_season_totals')
      .select('season_no, points_total, start_at, end_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) { console.warn(error); setSeasonTotal(null) } else { setSeasonTotal(data ?? null) }
  }

  async function logTestRun() {
    const user = await getUser()
    if (!user) return alert('Log eerst in op /dashboard (bovenaan).')
    if (!cfg)  return alert('Config nog niet geladen.')

    const { start, end } = computeWindow(cfg, new Date())
    const livesMax = (cfg.life_start ?? 20) + (cfg.max_bonus ?? 5)
    const resetsMax = (cfg.max_resets_per_run ?? 3)
    const L  = clamp(levels, 0, 20)
    const LE = clamp(livesEnd, 0, livesMax)
    const R  = clamp(resets, 0, resetsMax)
    const score = L * 10 // tijdelijk

    setSaving(true)
    const payload = {
      user_id: user.id,
      window_start: start.toISOString(),
      window_end: end.toISOString(),
      levels_cleared: L,
      score_points: score,
      lives_end: LE,
      resets_used: R,
      token_used: !!token,
      notes: 'test-run ui'
    }
    const { error } = await supabase.from('pve_tower_runs').insert([payload])
    setSaving(false)
    if (error) return alert(`Fout bij opslaan: ${error.message}`)

    await loadRuns()
    await loadBestForWindow({ start, end })
    await loadPointsForWindow({ start, end })
    await loadRecentPoints()
    await loadSeasonTotal()
    alert('Run opgeslagen!')
  }

  if (loading) return <div><h2>Tower</h2><p>laden…</p></div>
  if (error)   return <div><h2>Tower</h2><p style={{color:'red'}}>Error: {error}</p></div>
  if (!cfg)    return <div><h2>Tower</h2><p>Geen config gevonden.</p></div>

  const livesMax = (cfg.life_start ?? 20) + (cfg.max_bonus ?? 5)
  const resetsMax = (cfg.max_resets_per_run ?? 3)

  return (
    <div>
      <h2>Tower</h2>
      <ul>
        <li>Start levens: <b>{cfg.life_start}</b></li>
        <li>Bonussen: L5 +{cfg.bonus_l5}, L10 +{cfg.bonus_l10}, L15 +{cfg.bonus_l15}, L20 +{cfg.bonus_l20} (max +{cfg.max_bonus})</li>
        <li>Window: <b>{cfg.window_hours}u</b> (Towns offset {cfg.towns_offset_hours}u)</li>
        <li>Runs per window: <b>{cfg.base_runs_per_window}</b> {cfg.allow_token_extra_run ? '(+ token run)' : ''}</li>
        <li>Resets: max {cfg.max_resets_per_run} per run, {cfg.max_resets_per_level} per level</li>
        <li>Puntenregel: {cfg.points_rule} — <i>tijdelijk:</i> punten = levels × 10</li>
      </ul>

      {win && <p style={{ marginTop: 8 }}>Huidig window: <b>{fmt(win.start)}</b> t/m <b>{fmt(win.end)}</b></p>}

      {/* Test-run form */}
      <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 6 }}>
        <h3>Log test run</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>Levels (0–20):</label>
          <input type="number" value={levels} onChange={e=>setLevels(parseInt(e.target.value))} min={0} max={20} style={{ width: 80 }} />
          <label>Lives end (0–{livesMax}):</label>
          <input type="number" value={livesEnd} onChange={e=>setLivesEnd(parseInt(e.target.value))} min={0} max={livesMax} style={{ width: 80 }} />
          <label>Resets (0–{resetsMax}):</label>
          <input type="number" value={resets} onChange={e=>setResets(parseInt(e.target.value))} min={0} max={resetsMax} style={{ width: 80 }} />
          <label><input type="checkbox" checked={token} onChange={e=>setToken(e.target.checked)} /> Token gebruikt</label>
          <button onClick={logTestRun} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
        </div>
        <p style={{ marginTop: 6 }}>Voorbeeldscore: <b>{clamp(levels, 0, 20) * 10}</b> punten.</p>
      </div>

      {bestNow && (
        <div style={{ marginTop: 16 }}>
          <h3>Beste run in huidig window (server-side)</h3>
          <p>
            {fmt(bestNow.run_at)} — levels: <b>{bestNow.levels_cleared}</b>, score: <b>{bestNow.score_points}</b>, lives_end: <b>{bestNow.lives_end}</b>{bestNow.token_used ? ' (token)' : ''}
          </p>
        </div>
      )}

      {pointsNow && (
        <div style={{ marginTop: 16 }}>
          <h3>Jouw punten in dit window</h3>
          <p>
            <b>{pointsNow.points}</b> pts
            {typeof pointsNow.tiebreak_lives === 'number' ? <> — tiebreak lives: <b>{pointsNow.tiebreak_lives}</b></> : null}
            <br />
            (run: {fmt(pointsNow.run_at)})
          </p>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <h3>Laatste 5 windows (punten)</h3>
        {recentPoints.length === 0 ? (
          <p>Nog geen window-punten.</p>
        ) : (
          <ul>
            {recentPoints.map((w) => (
              <li key={w.window_start}>
                {fmt(w.window_start)} → {fmt(w.window_end)} — <b>{w.points}</b> pts
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* NIEUW: seizoenspunten */}
      {seasonTotal && (
        <div style={{ marginTop: 16 }}>
          <h3>Seizoenspunten (Tower)</h3>
          <p>
            Season {seasonTotal.season_no}: <b>{seasonTotal.points_total}</b> pts<br/>
            Periode: {fmt(seasonTotal.start_at)} → {fmt(seasonTotal.end_at)}
          </p>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <h3>Jouw laatste runs (10)</h3>
        {runsLoading ? (
          <p>laden…</p>
        ) : runs.length === 0 ? (
          <p>Nog geen runs gevonden.</p>
        ) : (
          <ul>
            {runs.map(r => (
              <li key={r.id}>
                {fmt(r.run_at)} — levels: <b>{r.levels_cleared}</b>, score: <b>{r.score_points}</b>, lives_end: <b>{r.lives_end}</b>, resets: {r.resets_used}{r.token_used ? ' (token)' : ''} | window: {fmt(r.window_start)} → {fmt(r.window_end)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
