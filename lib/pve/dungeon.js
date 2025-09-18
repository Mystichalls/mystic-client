// lib/pve/dungeon.js
import crypto from 'crypto';

export function seededRng(seedStr) {
  let seed = crypto.createHash('sha256').update(seedStr).digest().readUInt32LE(0);
  return () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) / 0xFFFFFFFF);
  };
}

export function pickLoot(lootRows, _pityOn, rng) {
  // Geen pity. Gewoon base weights.
  const rows = Array.isArray(lootRows) ? lootRows : [];
  if (!rows.length) return { row: { loot_id: 0, name: 'Nothing', type: 'none', tier: 'low', min_qty:1, max_qty:1 }, qty: 1 };

  const weights = rows.map(r => Number(r.weight_base));
  const total = weights.reduce((a,b)=>a+b,0);
  let roll = rng() * total, acc = 0, idx = 0;
  for (; idx < weights.length; idx++) { acc += weights[idx]; if (roll <= acc) break; }
  const row = rows[Math.min(idx, rows.length - 1)];
  const qty = row.min_qty + Math.floor(rng() * (row.max_qty - row.min_qty + 1));
  return { row, qty };
}
