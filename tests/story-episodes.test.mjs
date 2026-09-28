import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Part 1 story fights (tools/story/build_story_episodes.py, docs/design/150). The novel is the source of truth:
// every line the fight puts on screen must be the novel's own words.
const data = JSON.parse(fs.readFileSync('ue/HwanghonCombatUE/Content/Data/story_episodes.json', 'utf8'));
const strip = (s) => s.replace(/\*\*/g, '');
const novel = strip(fs.readFileSync('docs/story/source/제1부_통합본_EP01-28.md', 'utf8'))
  + strip(fs.readFileSync('docs/story/source/황혼_1부_소설판_제01화_마감본.txt', 'utf8'));
const battles = Object.entries(data.episodes).flatMap(([ep, e]) => (e.battles || []).map((b) => [ep, b]));

test('all 28 episodes, each chaining to the next world', () => {
  const eps = Object.keys(data.episodes);
  assert.equal(eps.length, 28);
  eps.forEach((ep, i) => {
    const e = data.episodes[ep];
    assert.match(e.world, new RegExp(`^/Game/Hwanghon/Story/${ep}/`), ep);
    assert.equal(e.next_world, i === 27 ? '' : data.episodes[eps[i + 1]].world, ep);
  });
});

test('every on-screen line is in the novel', () => {
  for (const [ep, b] of battles) {
    const lines = { ...b.callouts, ...(b.recover_line ? { recover_line: b.recover_line } : {}) };
    for (const [beat, text] of Object.entries(lines))
      for (const part of text.split(/(?<=[.!?])\s+/).filter(Boolean))
        assert.ok(novel.includes(part), `${ep} ${b.first_scene} ${beat}: «${part}» is not in the novel`);
  }
});

test('every scripted fight is playable by its own grammar', () => {
  let scripted = 0;
  for (const [ep, b] of battles) {
    if (!b.script) continue;
    scripted++;
    const where = `${ep} ${b.first_scene}`;
    const { steps, patterns } = b.script;
    assert.ok(steps.length > 0, where);
    const last = steps.at(-1);
    // the fight must end: a decisive kill/end in the last step, or the text's own ending
    const ends = (last.open && ['kill', 'end'].includes(last.then ?? 'kill') && (last.needs ?? 1) > 0)
      || ['kill', 'end'].includes(last.advance_then) || b.script.end_after_s > 0;
    assert.ok(ends, `${where}: the last step never ends the fight`);
    for (const s of steps) {
      if (s.open?.startsWith('pattern:'))
        assert.ok(patterns.some((p) => p.ko === s.open.slice(8) || p.clip === s.open.slice(8)), `${where} ${s.id}: unknown move`);
      if (s.opener) assert.ok(b.party.includes(s.opener), `${where} ${s.id}: opener not in the party`);
      if (s.open && (s.needs ?? 1) > 0) assert.ok(s.open_s >= 0.8 * (s.needs ?? 1) + 0.6, `${where} ${s.id}: opening too short`);
      if (!s.open) assert.ok(s.advance_after_s >= 0, `${where} ${s.id}: a step with no opening must move on by itself`);
    }
    // the novel's outcome decides whether the body dies
    const kills = steps.some((s) => s.then === 'kill' || (s.open && s.then === undefined) || s.advance_then === 'kill');
    assert.equal(kills, ['kill', 'win', 'defend', 'destroyed'].includes(b.result), `${where}: result ${b.result} vs kill`);
  }
  assert.equal(scripted, 33);
});

test('only the fights where Ain takes a crystal in the text recover one', () => {
  const recover = battles.filter(([, b]) => b.recover === 'crystal').map(([, b]) => b.first_scene);
  assert.deepEqual(recover, ['EP01_SC016', 'EP03_SC015', 'EP10_SC005']);
});
