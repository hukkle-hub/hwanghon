import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../game3d.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../js/game3d.js',import.meta.url),'utf8');

test('mobile cascade hotfix beats legacy guide rule and fixes impossible selector order',()=>{
  assert.match(html,/html\.mobile \.cinema-hud-v1 \.guide\{[^}]*bottom:max\(5px/);
  assert.doesNotMatch(html,/\.cinema-hud-v1 html\.mobile/);
  assert.doesNotMatch(html,/\.cinema-hud-v1 html\.touch/);
});

test('mobile counter banner is moved above boss core and reduced',()=>{
  assert.match(html,/html\.mobile \.cinema-hud-v1 \.counter\{[^}]*top:12%!important/);
  assert.match(html,/html\.mobile \.cinema-hud-v1 \.counter__v\{font-size:22px/);
});

test('lock and part HUD are compact while preserving existing controls',()=>{
  assert.match(html,/CINEMATIC TARGET \/ LOCK UX v07/);
  assert.match(html,/\.cinema-hud-v1 \.target-cycle\{[^}]*left:50%/s);
  assert.match(html,/\.cinema-hud-v1 \.lockon\{[^}]*width:34px/s);
  assert.match(js,/function cycleTarget\(\)/);
  assert.match(js,/battle\.input\('target'/);
  assert.match(js,/function setLock\(v\)/);
  assert.match(js,/b\.setAttribute\('aria-pressed', String\(lockOn\)\)/);
  assert.doesNotMatch(js,/textContent='T · 락온/);
  assert.doesNotMatch(js,/textContent='조준 · '/);
  assert.doesNotMatch(js,/Q · 탭하여 전환/);
});

test('document numbers 105-108 are unique and sequential for HUD passes',()=>{
  for(const p of ['105-cinematic-l2-l3-hud.md','106-combat-feedback-hud.md','107-cinematic-opportunity-ux.md','108-cinematic-target-lock-ux.md'])
    assert.ok(fs.existsSync(new URL('../docs/design/'+p,import.meta.url)),p);
  assert.ok(!fs.existsSync(new URL('../docs/design/105-combat-feedback-hud.md',import.meta.url)));
  assert.ok(!fs.existsSync(new URL('../docs/design/106-cinematic-opportunity-ux.md',import.meta.url)));
});
