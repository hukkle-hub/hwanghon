import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const Q=require('../js/combat-quality.js');

test('접점 위계는 light < crit < finish < smash < counter',()=>{
  const a=Q.feedback({kind:'attack'});
  const c=Q.feedback({kind:'attack',crit:true});
  const f=Q.feedback({kind:'attack',finish:true});
  const s=Q.feedback({kind:'smash'});
  const k=Q.feedback({kind:'counter',perfect:true});
  assert.deepEqual([a.tier,c.tier,f.tier,s.tier,k.tier],['light','crit','finish','smash','counter']);
  assert.ok(a.size<c.size&&c.size<f.size&&f.size<s.size&&s.size<k.size);
  assert.ok(a.duration<c.duration&&c.duration<f.duration&&f.duration<s.duration&&s.duration<=k.duration);
});

test('재질은 타격 크기/판정이 아니라 색 언어만 바꾼다',()=>{
  const straw=Q.feedback({kind:'attack',finish:true,material:'straw'});
  const metal=Q.feedback({kind:'attack',finish:true,material:'metal'});
  const core=Q.feedback({kind:'attack',finish:true,material:'core'});
  assert.equal(straw.size,metal.size);assert.equal(metal.size,core.size);
  assert.equal(straw.duration,metal.duration);assert.notEqual(straw.color,metal.color);assert.notEqual(core.color,metal.color);
});

test('기존 전투 품질 계약 — 일반 접점은 완벽 카운터의 절반보다 작다',()=>{
  const a=Q.feedback({kind:'attack'}),b=Q.feedback({kind:'counter',perfect:true});
  assert.ok(a.size<b.size/2);assert.ok(a.duration<b.duration);assert.ok(b.size<1.2);
});

test('게임 화면은 combo 3타를 finish로 넘기고 재질 2차효과는 finish/smash에만',async()=>{
  const g=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');
  assert.match(g,/finish:cmbH>=3/);
  assert.match(g,/tier:feedback\.tier/);
  assert.match(g,/feedback\.tier==='finish'\|\|feedback\.tier==='smash'/);
});

test('오디오는 tier와 material 두 축으로 피치/게인/필터를 나눈다',async()=>{
  const s=await readFile(new URL('../js/sfx.js',import.meta.url),'utf8');
  assert.match(s,/light:\.40,crit:\.46,finish:\.52,smash:\.58,counter:\.62/);
  assert.match(s,/light:1\.04,crit:\.99,finish:\.95,smash:\.90,counter:\.88/);
  assert.match(s,/material==='metal'\?9000:detail\.material==='core'\?4300:2900/);
});
