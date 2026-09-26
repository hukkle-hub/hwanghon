import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../game3d.html', import.meta.url), 'utf8');
const doc = fs.readFileSync(new URL('../docs/design/103-cinematic-combat-hud.md', import.meta.url), 'utf8');

test('cinematic HUD v02 skin is enabled', () => {
  assert.match(html, /<body class="cinema-hud-v1"/);
  assert.match(html, /CINEMATIC COMBAT HUD v02/);
});

test('combat DOM contracts stay intact', () => {
  for (const id of ['game3d','bosshp','b-name','b-hp','b-stag','b-ph','bttimer','b-timer','btparty','combo','combo-n','guide','vitals','v-hp','v-hpv','v-st','v-stv','v-ult','v-ultv','stick','actions','counter','status'])
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
});

test('L1 L2 L3 visual state rules exist', () => {
  for (const cls of ['cinema-l1','cinema-l2','cinema-l3']) assert.ok(html.includes(cls), `missing ${cls}`);
  assert.match(html, /data-cinema-hud="minimal"/);
});

test('HUD listens to cinematic director event contract', () => {
  assert.match(html, /addEventListener\('tw:cinematic'/);
  assert.match(html, /addEventListener\('tw:cinematic:end'/);
  assert.match(html, /TW_CINEMATIC_HUD=/);
});

test('director contract is documented for Claude', () => {
  assert.match(doc, /deflect \/ repel \/ clash \/ perfectDodge/);
  assert.match(doc, /execute \/ ult/);
  assert.match(doc, /bossIntro \/ phase \/ victory/);
  assert.match(doc, /tw:cinematic:end/);
});

test('input controls remain game3d generated', () => {
  const js=fs.readFileSync(new URL('../js/game3d.js', import.meta.url),'utf8');
  assert.match(js,/el\.actions\.innerHTML=SK\.map/);
  for(const key of ['data-skill','data-dodge','data-guard','data-atk','data-ult']) assert.ok(js.includes(key),`missing ${key}`);
});
