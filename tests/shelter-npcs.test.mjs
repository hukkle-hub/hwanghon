import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Gangnam bunker hub NPCs (tools/story/build_shelter_npcs.py, docs/design/152): the hub speaks the novel's lines.
const data = JSON.parse(fs.readFileSync('ue/HwanghonCombatUE/Content/Data/shelter_npcs.json', 'utf8'));
const novel = fs.readFileSync(data.novel, 'utf8').replace(/\*\*/g, '').split('\n');

test('every hub line is the novel, on the line it cites', () => {
  for (const [id, n] of Object.entries(data.npcs)) {
    assert.ok(n.lines.length > 0, id);
    for (const l of n.lines) assert.ok(novel[Number(l.src.slice(1)) - 1].includes(l.text), `${id} ${l.src}: «${l.text}»`);
  }
});

test('the seven station NPCs of the plugin, Han named as the smith he is', () => {
  assert.deepEqual(Object.keys(data.npcs).sort(), ['DrJin', 'Duho', 'HanJangin', 'Matteo', 'OJeonggil', 'Suhui', 'Yujin']);
  assert.equal(data.npcs.HanJangin.name, '한');
  assert.equal(data.npcs.HanJangin.role, '장인');
  assert.equal(data.npcs.HanJangin.alive_flag, 'SF_NPC_HanJanginAlive');
  const flags = JSON.parse(fs.readFileSync('ue/HwanghonCombatUE/Content/Data/part1_saveflags.json', 'utf8'));
  assert.equal(flags.episodes.EP18.SF_NPC_HanJanginAlive, 'false');
});
