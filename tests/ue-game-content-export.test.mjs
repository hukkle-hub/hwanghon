import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildGameContentExport, serializeGameContentExport} from '../tools/ue/export-game-content.mjs';

const ROOT = new URL('../', import.meta.url);
const SAVED = new URL('../ue/HwanghonCombatUE/Content/Data/game_content.json', import.meta.url);
const SOURCE_FILES = ['js/world.js', 'js/items.js', 'js/dungeons.js', 'js/dungeon.js', 'js/dungeon-content.js', 'js/story.js'];
const plain = value => JSON.parse(JSON.stringify(value));

// Independent source fixture: state changes and claim effects exist only in memory.
// No real browser, save.js, DOM operation or file write is used here.
function sourceFixture() {
  const flags = new Map(), cleared = new Set(), grants = [];
  const window = {TW_SAVE: {
    flag(key, value) { if (value !== undefined) flags.set(key, value); return flags.get(key) || false; },
    addGold(n) { grants.push(['gold', n]); },
    addXp(n) { grants.push(['exp', n]); },
    addItem(id, n) { grants.push([id, n]); }
  }};
  const context = vm.createContext({window, localStorage: {getItem(key) {
    return cleared.has(key.replace('tw:arena:', '')) ? '{"cleared":true}' : null;
  }}});
  for (const file of SOURCE_FILES) vm.runInContext(fs.readFileSync(new URL(file, ROOT), 'utf8'), context, {filename: file});
  return {window, context, flags, cleared, grants};
}

test('UE game catalog preserves current world, items and all extended dungeon content', () => {
  const X = buildGameContentExport(), {window: W} = sourceFixture();
  assert.equal(X.schema, 'hwanghon.game-content/1');
  assert.deepEqual(X.characters, plain(W.TW_WORLD.CHARS));
  assert.deepEqual(X.partyOrder, plain(W.TW_WORLD.PARTY_ORDER));
  assert.deepEqual(X.questBossSummaries, plain(W.TW_WORLD.BOSSES));
  assert.deepEqual(X.quests.map(q => q.source), plain(W.TW_WORLD.QUESTS));
  assert.deepEqual(X.items.catalog, plain([...W.TW_ITEMS.EQUIP, ...W.TW_ITEMS.MATERIAL, ...W.TW_ITEMS.CONSUMABLE]));
  for (const [out, source] of Object.entries({rarity: 'RARITY', types: 'TYPE', slots: 'SLOT', recipes: 'RECIPE',
    enhancement: 'ENHANCE', shop: 'SHOP', craftSlots: 'CRAFT_SLOTS', craftEffects: 'CRAFT_FX'})) {
    assert.deepEqual(X.items[out], plain(W.TW_ITEMS[source]), out);
  }
  assert.deepEqual(X.dungeons, plain(W.TW_LEVELS));
  assert.deepEqual(X.arenas, plain(W.TW_DUNGEONS.ARENAS));
  assert.deepEqual(X.skills, plain(W.TW_DUNGEONS.SKILLS));
  assert.deepEqual(X.story.chapters, plain(W.TW_STORY.CHAPTERS));
  assert.deepEqual(X.story.npcs, plain(W.TW_STORY.NPC));
  assert.deepEqual(Object.keys(X.dungeons), ['d01', 'd02', 'd03', 'd04', 'd05', 'd06', 'd07']);
  assert.equal(X.quests.length, 6);
  assert.equal(X.items.catalog.length, 78);   // 50 + 필드 보스 고유 장비 28 (docs/design/188)
  assert.equal(X.story.chapters.length, 8);
  assert.equal(X.dungeons.d07.arena, 'ward');
  assert.ok(X.arenas.ward.stages.length > 0, 'dungeon-content extension must be loaded');
});

test('UE quest prerequisites preserve tutorial-to-hospital progression and claim precedence', () => {
  const X = buildGameContentExport(), fixture = sourceFixture();
  const expected = [
    ['q_marsh', 'ch2', 'd02', 'marsh', 'tutorial'],
    ['q_sewage', 'ch3', 'd03', 'sewage', 'marsh'],
    ['q_relay', 'ch4', 'd04', 'relay', 'sewage'],
    ['q_plant', 'ch5', 'd05', 'grove', 'relay'],
    ['q_road', 'ch6', 'd06', 'road', 'grove'],
    ['q_med', 'ch7', 'd07', 'ward', 'road']
  ];
  for (const [id, chapterId, dungeonId, arenaId, prerequisite] of expected) {
    const {route} = X.quests.find(q => q.id === id);
    assert.deepEqual(route, {chapterId, dungeonId, arenaId, prerequisiteArenaIds: [prerequisite],
      prerequisiteMode: 'all', claimFlag: `claim_${id}`,
      statePriority: ['claimed', 'cleared', 'prerequisites', 'available']});
    const state = () => fixture.window.TW_STORY.questState(id);
    fixture.cleared.clear(); fixture.flags.clear();
    assert.equal(state(), 'locked');
    fixture.cleared.add(prerequisite);
    assert.equal(state(), 'available');
    fixture.cleared.clear(); fixture.cleared.add(arenaId);
    assert.equal(state(), 'cleared', 'cleared state must survive a missing prerequisite record');
    fixture.cleared.clear(); fixture.flags.set(route.claimFlag, true);
    assert.equal(state(), 'claimed');
  }
});

test('UE normalized office rewards match actual story claim effects at both random endpoints', () => {
  const X = buildGameContentExport();
  for (const endpoint of ['min', 'max']) {
    const fixture = sourceFixture();
    vm.runInContext(`Math.random = () => ${endpoint === 'min' ? '0' : '(1 - Number.EPSILON)'};`, fixture.context);
    for (const quest of X.quests) {
      fixture.cleared.add(quest.route.arenaId);
      fixture.grants.length = 0;
      const expected = quest.claimRewards.map(reward => [reward.id, reward[endpoint]]);
      assert.deepEqual(plain(fixture.window.TW_STORY.claim(quest.id)), expected, `${quest.id} ${endpoint}`);
      assert.deepEqual(fixture.grants, expected, 'actual save effects, not only the return value');
      assert.equal(fixture.window.TW_STORY.claim(quest.id), null, 'claims remain one-time');
    }
  }
  const marsh = X.quests.find(q => q.id === 'q_marsh');
  assert.equal(marsh.claimRewards.find(r => r.id === 'm_alloy').min, 2100);
  assert.equal(X.arenas.marsh.rewards.items.find(([id]) => id === 'm_alloy')[1], 24,
    'quest payouts and arena payouts are separate source contracts');
});

test('UE catalog stable IDs resolve routes, rewards, recipes, shop and weapon restrictions', () => {
  const X = buildGameContentExport(), {window: W} = sourceFixture();
  const ids = new Set(X.items.catalog.map(item => item.id));
  assert.equal(ids.size, X.items.catalog.length);
  assert.equal(new Set(X.quests.map(q => q.id)).size, X.quests.length);
  assert.equal(new Set(X.items.recipes.map(r => r.id)).size, X.items.recipes.length);
  const item = id => assert.ok(ids.has(id), `missing item ${id}`);
  for (const quest of X.quests) {
    assert.equal(quest.id, quest.source.id);
    assert.equal(X.dungeons[quest.route.dungeonId].arena, quest.route.arenaId);
    for (const reward of quest.claimRewards) {
      if (reward.kind === 'item') item(reward.id);
      assert.ok(Number.isSafeInteger(reward.min) && reward.min >= 0 && reward.max >= reward.min);
    }
    quest.source.loot.forEach(item);
    Object.values(quest.source.drops).flat().forEach(item);
    item(quest.source.firstClear);
  }
  X.items.recipes.forEach(recipe => { item(recipe.result); recipe.mats.forEach(([id]) => item(id)); });
  X.items.shop.forEach(({id}) => item(id));
  for (const it of X.items.catalog) {
    for (const character of Object.keys(X.characters)) {
      assert.equal(X.items.usableBy[it.id].includes(character), W.TW_ITEMS.usableBy(it.id, character));
    }
  }
  assert.equal('PLAYER' in X.items, false, 'do not export a browser/player save snapshot');
});

test('UE source hashes and unit notes expose original lineage without inventing conversions', () => {
  const X = buildGameContentExport();
  assert.deepEqual(X.sources.map(source => source.file), SOURCE_FILES);
  for (const {file, sha256} of X.sources) {
    const bytes = fs.readFileSync(new URL(file, ROOT), 'utf8').replace(/\r\n?/g, '\n');
    assert.equal(sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  assert.match(X.units.levelDistance, /pixels/);
  assert.match(X.units.time, /seconds/);
  assert.match(X.units.health, /fraction/);
  assert.equal(X.dungeons.d01.cell, 64, 'level pixels must not silently turn into UE centimeters');
  assert.ok(X.limitations.some(text => text.includes('not a new-game')));
});

test('UE game content export is isolated and deterministic across calls and processes', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {configurable: true, get() { throw new Error('host window accessed'); }});
  try {
    const first = buildGameContentExport();
    const bytes = serializeGameContentExport(first);
    first.characters.ain.stats.hp = -1;
    assert.equal(serializeGameContentExport(), bytes, 'fresh source context per call');
    const child = spawnSync(process.execPath, ['--input-type=module', '-e',
      "import {serializeGameContentExport} from './tools/ue/export-game-content.mjs'; process.stdout.write(serializeGameContentExport());"],
    {cwd: ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, bytes);
  } finally {
    if (before) Object.defineProperty(globalThis, 'window', before);
    else delete globalThis.window;
  }
});

test('UE saved game_content.json matches deterministic current-source export after checkout newline normalization', () => {
  assert.equal(fs.readFileSync(SAVED, 'utf8').replace(/\r\n?/g, '\n'), serializeGameContentExport(),
    'Run node tools/ue/export-game-content.mjs after editing source content');
});
