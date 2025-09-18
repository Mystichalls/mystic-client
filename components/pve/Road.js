import { track } from '../../lib/telemetry';
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { E } from '../../lib/events';

export default function Road() {
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
// log wanneer Road opent (1x bij mount)
useEffect(() => {
track(E.ROAD_OPEN);
}, []);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from('pve_road_config')
        .select(`
          levels_total, boss_levels,
          reward_per_level_coins, boss_bonus_coins,
          difficulty
        `)
        .eq('is_active', true)
        .maybeSingle()

      if (!mounted) return
      if (error) setError(error.message)
      else setCfg(data)
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  if (loading) return (
    <div>
      <h2>Road</h2>
      <p>laden…</p>
    </div>
  )

  if (error) return (
    <div>
      <h2>Road</h2>
      <p style={{ color: 'red' }}>Error: {error}</p>
    </div>
  )

  if (!cfg) return (
    <div>
      <h2>Road</h2>
      <p>Geen config gevonden.</p>
    </div>
  )

  return (
    <div>
      <h2>Road</h2>
      <ul>
        <li>Totaal levels: <b>{cfg.levels_total}</b></li>
        <li>Boss levels: <b>{(cfg.boss_levels || []).join(', ')}</b></li>
        <li>Beloning: <b>{cfg.reward_per_level_coins} coins/level</b> + boss bonus <b>{cfg.boss_bonus_coins} coins</b></li>
        <li>Curve: <b>{cfg.difficulty}</b></li>
      </ul>
    </div>
  )
}
