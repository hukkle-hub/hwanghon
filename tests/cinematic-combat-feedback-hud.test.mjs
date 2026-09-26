import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../game3d.html',import.meta.url),'utf8');
test('v05 combat feedback hierarchy exists',()=>{
  assert.match(html,/CINEMATIC COMBAT FEEDBACK HUD v05/);
  assert.match(html,/@keyframes riseV5/);
  assert.match(html,/counter__v\{font-size:32px/);
  assert.match(html,/combo b\{font-size:29px/);
  assert.match(html,/stline\{border:0;border-left:1px/);
});
test('damage clutter guard preserves important feedback and caps count',()=>{
  assert.match(html,/피해 숫자 클러터 가드/);
  assert.match(html,/cap=mobile\?6:9/);
  for(const k of ['crit','counter','taken','deflect']) assert.ok(html.includes("classList.contains('"+k+"')"),k);
});
test('cinematic hierarchy suppresses low-priority numbers but not combat logic',()=>{
  assert.match(html,/cinema-l1 \.dmgnum:not\(\.counter\):not\(\.crit\):not\(\.taken\):not\(\.deflect\)/);
  assert.match(html,/cinema-l2 \.dmgnum,.cinema-hud-v1\.cinema-l3 \.dmgnum\{opacity:0!important\}/);
});
