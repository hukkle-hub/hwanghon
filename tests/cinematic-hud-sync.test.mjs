import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../game3d.html',import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../js/game3d.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../js/ui.js',import.meta.url),'utf8');

test('HUD bridge initializes cinematic display mode from shared settings',()=>{
  assert.match(html,/104(·105)? — HUD ↔ Cinematic Director bridge/);   /* v04 가 같은 주석을 «104·105» 로 바꾼다 */
  assert.match(html,/function mode\(m\)/);
  assert.match(html,/localStorage\.getItem\('tw:settings'\)/);
  assert.match(html,/setMode:mode/);
});

test('game settings drive both director and HUD from one cine value',()=>{
  assert.match(game,/cine:'normal'/);
  assert.match(game,/CINE\.mode=SET\.cine\|\|'normal'/);
  assert.match(game,/TW_CINEMATIC_HUD\.setMode\(SET\.cine\|\|'normal'\)/);
});

test('settings UI exposes the four cinematic intensity modes',()=>{
  assert.match(ui,/시네마틱 연출/);
  assert.match(ui,/data-seg=\"cine\"/);
  for(const mode of ['cinema','normal','minimal','off']) assert.match(ui,new RegExp(mode));
  assert.match(ui,/data-cine/);
});

test('HUD contract remains event-only and does not own combat resolution',()=>{
  assert.match(html,/addEventListener\('tw:cinematic'/);
  assert.match(html,/addEventListener\('tw:cinematic:end'/);
  for(const forbidden of ['damage=','invuln=','velocity=']) assert.ok(!html.includes(forbidden));
});
