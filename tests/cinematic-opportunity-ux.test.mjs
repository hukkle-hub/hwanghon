import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../game3d.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../js/game3d.js',import.meta.url),'utf8');

test('v06 marker and world-space execution opportunity styling exist',()=>{
  assert.match(html,/CINEMATIC OPPORTUNITY UX v06/);
  assert.match(html,/\.exp-interact\.is-exec\{width:72px/);
  assert.match(html,/\.exp-interact\.is-exec::after\{content:'처형'/);
  assert.match(html,/html\.mobile \.exp-interact\.is-exec::before\{content:'✦'/);
  assert.match(html,/cinema-l2 \.exp-interact\.is-exec/);
  assert.match(html,/cinema-l3 \.exp-interact\.is-exec/);
});

test('execution prompt is projected from boss world space and clamped to the viewport',()=>{
  assert.match(js,/function placeExecutePrompt\(\)/);
  assert.match(js,/bossHitPos\('core'\)\.clone\(\)/);
  assert.match(js,/p\.project\(cam\)/);
  assert.match(js,/Math\.max\(pad,Math\.min\(box\.width-pad,x\)\)/);
  assert.match(js,/placeExecutePrompt\(\)/);
  assert.doesNotMatch(js,/textContent='F · 처형'/);
});

test('execution still uses existing combat authority and input',()=>{
  assert.match(js,/function executeReady\(\)/);
  assert.match(js,/s\.enemy\.executable/);
  assert.match(js,/battle\.input\('execute'\)/);
  assert.match(js,/function tryExecute\(\)/);
});

test('counter follow-up opportunity has a radial timer and one-time help per kind',()=>{
  assert.match(js,/open__ring[^\n]+pathLength="100"/);
  assert.match(html,/open__ring circle\{[^}]*stroke-dasharray:100/);
  assert.match(html,/@keyframes openRing\{from\{stroke-dashoffset:0\}to\{stroke-dashoffset:100\}\}/);
  assert.match(js,/OPEN_TXT=\{ break:\['파괴'/);
  assert.match(js,/grab:\['제압'/);
  assert.match(js,/seenKey='opening-'\+kind/);
  assert.match(js,/if\(!seen\[seenKey\]\)/);
  assert.match(js,/else if\(t\.hasAttribute\('data-open'\)\) openingIn\(\)/);
});

test('downed help no longer exposes a raw F-key instruction',()=>{
  assert.doesNotMatch(js,/격추![^\n]+<b>F<\/b>/);
  assert.match(js,/무너진 적에게 접근하면 <b>처형<\/b>할 수 있다/);
});
