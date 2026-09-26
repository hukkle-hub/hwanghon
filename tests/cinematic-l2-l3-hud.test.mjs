import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../game3d.html',import.meta.url),'utf8');
test('L2/L3 cinematic frame DOM exists',()=>{
  assert.match(html,/class="cine-matte"/);
  assert.match(html,/class="cine-caption"/);
  assert.match(html,/id="cine-cap-k"/);
});
test('execute and ult suppress chrome while poise break keeps readable boss state',()=>{
  assert.match(html,/data-cinema-id=\\?"execute\\?"/);
  assert.match(html,/data-cinema-id=\\?"ult\\?"/);
  assert.match(html,/data-cinema-id=\\?"poiseBreak\\?"/);
  assert.match(html,/poiseBreak[^}]*bosshp|poiseBreak[\s\S]{0,500}bosshp/);
});
test('L3 captions support boss intro, phase, victory and optional event copy',()=>{
  assert.match(html,/bossIntro/);
  assert.match(html,/victory/);
  assert.match(html,/detail\.phase/);
  assert.match(html,/detail\.title/);
  assert.match(html,/detail\.subtitle/);
});
test('minimal mode suppresses cinematic mattes and captions',()=>{
  assert.match(html,/data-cinema-hud=\\?"minimal\\?"[^}]*\.cine-matte/);
  assert.match(html,/data-cinema-hud=\\?"minimal\\?"[^}]*\.cine-caption/);
});
