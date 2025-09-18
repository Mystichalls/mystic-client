// /lib/events.js
export const E = Object.freeze({
  // Dungeon lifecycle
  DUNGEON_OPEN:            'dungeon_open',
  DUNGEON_RUN_START:       'dungeon_run_start',
  DUNGEON_WIN:             'dungeon_win',
  DUNGEON_LOSE:            'dungeon_lose',
  DUNGEON_RUN_END:         'dungeon_run_end',

  // Loot & reroll
  DUNGEON_LOOT_GRANTED:    'dungeon_loot_granted',
  DUNGEON_LOOT_TAKEN:      'dungeon_loot_taken',
  DUNGEON_REROLL_REQUEST:  'dungeon_reroll_request',
  DUNGEON_REROLL_DONE:     'dungeon_reroll_done',

  // Ad / second run
  DUNGEON_SECOND_RUN_AD:   'dungeon_second_run_ad',

  // Screens open
  ROAD_OPEN:               'road_open',
  TOWNS_OPEN:              'towns_open',
  TOWER_OPEN:              'tower_open',
});
