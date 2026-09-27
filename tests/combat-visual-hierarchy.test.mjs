import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync(new URL('../js/game3d.js',import.meta.url),'utf8');

test('v09 shrinks world targeting markers without changing target input',()=>{
  assert.match(js,/RingGeometry\(0\.18,0\.23,32\)/);
  assert.match(js,/\(tg\?0\.38:0\.22\)\*BOSS_SCALE/);
  assert.match(js,/h\.material\.opacity=tg\?0\.34:\(TEACH\?0\.10:0\.045\)/);
  assert.match(js,/battle\.input\('target', pid\)/);
});
test('floor telegraph becomes edge-led',()=>{
  assert.match(js,/opacity:0\.055/); assert.match(js,/opacity:0\.11/); assert.match(js,/opacity:0\.48/);
});
test('L1 dim reads active beat tier instead of nonexistent out.tier',()=>{
  assert.match(js,/CINE\.out\.active&&CINE_BEATS\[CINE\.out\.active\]/);
  assert.doesNotMatch(js,/CINE\.out\.tier==='L1'/);
});
test('reach ring is subdued',()=>{
  assert.match(js,/TEACH\?0\.13:0\.10/); assert.match(js,/TEACH\?0\.09:0\.06/);   /* GPT v12 조작·HUD: 사정거리 링 살짝 더 보이게(0.08→0.10, 0.035→0.06) */
});
