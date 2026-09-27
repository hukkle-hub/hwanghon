/* Static catalog bridge for the future UE full-game layer.
 * Run: node tools/ue/export-game-content.mjs [output.json]
 * Author content in js/*, never in the generated JSON. No save, DOM, renderer,
 * network or combat runtime is loaded. This does not implement a UE game loop.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT_SOURCE_FILES = Object.freeze([
  'js/world.js', 'js/items.js', 'js/dungeons.js', 'js/dungeon.js',
  'js/dungeon-content.js', 'js/story.js'
]);
const clone = value => JSON.parse(JSON.stringify(value));
const check = (condition, message) => { if (!condition) throw new Error(message); };

function loadSources() {
  const state = {cleared: new Set(), flags: new Set(), reads: []};
  // Browser storage is represented only by ephemeral read-only test state.
  // If a data file starts requiring real browser APIs, fail instead of stubbing
  // away the behavior or exporting an incomplete catalog.
  const storage = {getItem(key) {
    check(key.startsWith('tw:arena:'), `Unexpected storage read: ${key}`);
    const arena = key.slice('tw:arena:'.length);
    state.reads.push(arena);
    return state.cleared.has(arena) ? '{"cleared":true}' : null;
  }};
  const window = {TW_SAVE: {flag(key, value) {
    check(value === undefined, `Unexpected save write: ${key}`);
    return state.flags.has(key);
  }}};
  const context = vm.createContext({window, localStorage: storage}, {
    codeGeneration: {strings: false, wasm: false}
  });
  vm.runInContext('Math.random = () => { throw new Error("Randomness in static content"); };', context);
  const sources = CONTENT_SOURCE_FILES.map(file => {
    // Normalize only line endings so Windows and Linux generate identical bytes.
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n?/g, '\n');
    vm.runInContext(source, context, {filename: file, timeout: 2000});
    return {file, sha256: createHash('sha256').update(source).digest('hex')};
  });
  return {window, state, sources};
}

function quantityRange(value) {
  if (Number.isSafeInteger(value) && value >= 0) return {min: value, max: value};
  const match = typeof value === 'string' && /^(\d+)~(\d+)$/.exec(value);
  check(match, `Unsupported reward quantity: ${value}`);
  const min = Number(match[1]), max = Number(match[2]);
  check(Number.isSafeInteger(min) && Number.isSafeInteger(max) && min <= max,
    `Invalid reward range: ${value}`);
  return {min, max};
}

function questRoute(quest, story, levels, arenas, state) {
  const chapter = story.routeForQuest(quest.id);
  check(chapter, `Quest has no story route: ${quest.id}`);
  const dungeonMatches = Object.values(levels).filter(level => level.arena === chapter.arena);
  check(dungeonMatches.length === 1, `Ambiguous dungeon route: ${quest.id}`);
  const arenaIds = Object.keys(arenas).sort();
  check(arenaIds.includes(chapter.arena), `Unknown quest arena: ${chapter.arena}`);
  // QUEST_REQUIRED is private in story.js. Observe its public read-only API,
  // rather than copying that map or parsing JavaScript with regular expressions.
  state.cleared.clear(); state.flags.clear(); state.reads = [];
  story.questState(quest.id);
  const required = [...new Set(state.reads.filter(id => id !== chapter.arena))].sort();
  required.forEach(id => check(arenaIds.includes(id), `Unknown prerequisite: ${id}`));
  // Verify the observed conjunction against every current clear-state combination.
  // A future more complex condition must get an explicit schema change.
  check(arenaIds.length <= 12, 'Prerequisite truth table needs a larger-schema strategy');
  for (let bits = 0; bits < 2 ** arenaIds.length; bits++) {
    state.cleared = new Set(arenaIds.filter((id, index) => bits & (1 << index)));
    const expected = state.cleared.has(chapter.arena) ? 'cleared'
      : required.every(id => state.cleared.has(id)) ? 'available' : 'locked';
    check(story.questState(quest.id) === expected, `Unsupported prerequisite rule: ${quest.id}`);
  }
  state.flags.add(`claim_${quest.id}`);
  check(story.questState(quest.id) === 'claimed', `Unsupported claim flag: ${quest.id}`);
  state.cleared.clear(); state.flags.clear();
  return {
    chapterId: chapter.id, arenaId: chapter.arena, dungeonId: dungeonMatches[0].id,
    prerequisiteArenaIds: required, prerequisiteMode: 'all', claimFlag: `claim_${quest.id}`,
    // questState gives already-claimed/already-cleared states priority over locks.
    statePriority: ['claimed', 'cleared', 'prerequisites', 'available']
  };
}

export function buildGameContentExport() {
  const {window, state, sources} = loadSources();
  const W = window.TW_WORLD, I = window.TW_ITEMS, D = window.TW_DUNGEONS;
  const L = window.TW_LEVELS, S = window.TW_STORY;
  const items = [...I.EQUIP, ...I.MATERIAL, ...I.CONSUMABLE];
  const itemIds = new Set(items.map(item => item.id));
  check(itemIds.size === items.length, 'Duplicate item IDs');
  const assertItem = id => check(itemIds.has(id), `Unknown item reference: ${id}`);
  const quests = Array.from(W.QUESTS, quest => {
    (quest.loot || []).forEach(assertItem);
    Object.values(quest.drops || {}).flat().forEach(assertItem);
    if (quest.firstClear) assertItem(quest.firstClear);
    const claimRewards = [['gold', quest.reward], ...(quest.rewards || [])].map(([id, value]) => {
      if (id !== 'gold' && id !== 'exp') assertItem(id);
      return {id, kind: id === 'gold' ? 'currency' : id === 'exp' ? 'experience' : 'item', ...quantityRange(value)};
    });
    return {id: quest.id, source: clone(quest),
      route: questRoute(quest, S, L, D.ARENAS, state), claimRewards};
  });
  for (const recipe of I.RECIPE) {
    assertItem(recipe.result);
    recipe.mats.forEach(([id]) => assertItem(id));
  }
  I.SHOP.forEach(({id}) => assertItem(id));
  const out = {
    schema: 'hwanghon.game-content/1',
    sources,
    lineage: {
      characters: 'js/world.js TW_WORLD.CHARS; design-sheet character templates',
      quests: 'js/world.js TW_WORLD.QUESTS; route and prerequisite truth table from js/story.js TW_STORY',
      claimRewards: 'js/world.js QUESTS.reward/rewards, interpreted as js/story.js claim does; inclusive integer ranges',
      items: 'js/items.js TW_ITEMS static catalogs; no PLAYER/save snapshot',
      dungeons: 'js/dungeon.js TW_LEVELS, extended by js/dungeon-content.js',
      arenas: 'js/dungeons.js TW_DUNGEONS.ARENAS, extended by js/dungeon-content.js',
      skills: 'js/dungeons.js TW_DUNGEONS.SKILLS',
      story: 'js/story.js TW_STORY.CHAPTERS/NPC',
      hashes: 'SHA-256 of UTF-8 source text with CRLF/CR normalized to LF'
    },
    units: {
      policy: 'Source values are preserved, without UE centimeter conversion.',
      time: 'Numeric tele/window/gap/recovery/duration/period/warning/active/timeLimit fields: seconds; quest and recipe time strings: HH:MM:SS.',
      levelDistance: 'cell, player reach/radius/rollLen, AI distances, zones and attackMotion distances: source 2D level pixels.',
      levelSpeed: 'player.speed and ai.speed: source 2D level pixels per second.',
      grid: 'cx/cy: zero-based grid cells; rows: collision-grid strings.',
      angles: 'player.cone: radians.',
      health: 'hp/hpMax/dmg: HP; expedition and arena stageFx hazard damage: fraction of maximum HP.',
      percentages: 'Character crit/critDmg/aspd/mspd and enhancement rate: percentage points; multipliers and hitFrac remain source ratios.',
      economy: 'gold/reward/cost/price/buy/sell: gold; exp/xp: experience points; min/max: inclusive integer counts.',
      modelSpace: 'parts3d positions, radii and render scale remain source model-local values; no universal conversion is implied.'
    },
    limitations: [
      'Static content export only; no UE maps, runtime state machine, assets, UI or save-system implementation.',
      'Character levels/stats and item qty/enh/dur are source catalog templates, not a new-game or player-save snapshot.',
      'HTML-bearing descriptions and web art/model paths remain original strings; UE presentation must adapt them.',
      'src:sheet and src:fill annotations are preserved; fill data is not upgraded to confirmed design data.',
      'claimRewards covers office quest claims only. Arena rewards, firstClear, drops and loot stay in their original fields and are not combined.',
      'Combat common RULES remain in the existing combat_rules.json export; raw arena/skill data here is not an additional combat implementation.'
    ],
    characters: clone(W.CHARS), partyOrder: clone(W.PARTY_ORDER),
    questBossSummaries: clone(W.BOSSES), quests,
    items: {catalog: clone(items), rarity: clone(I.RARITY), types: clone(I.TYPE), slots: clone(I.SLOT),
      recipes: clone(I.RECIPE), enhancement: clone(I.ENHANCE), shop: clone(I.SHOP),
      craftSlots: clone(I.CRAFT_SLOTS), craftEffects: clone(I.CRAFT_FX),
      usableBy: Object.fromEntries(items.map(item => [item.id, Object.keys(W.CHARS).filter(id => I.usableBy(item.id, id))]))},
    dungeons: clone(L), arenas: clone(D.ARENAS), skills: clone(D.SKILLS),
    story: {chapters: clone(S.CHAPTERS), npcs: clone(S.NPC)}
  };
  return out;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function serializeGameContentExport(data = buildGameContentExport()) {
  return JSON.stringify(canonical(data), null, 2) + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2] || path.join(ROOT, 'ue/HwanghonCombatUE/Content/Data/game_content.json'));
  const data = buildGameContentExport();
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, serializeGameContentExport(data), 'utf8');
  console.log(`wrote ${path.relative(ROOT, output)}: ${data.quests.length} quests, ${data.items.catalog.length} items, ${Object.keys(data.dungeons).length} dungeons`);
}
