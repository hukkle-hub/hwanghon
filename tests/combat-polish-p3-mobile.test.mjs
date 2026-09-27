import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const g=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');

test('모바일 auto/medium 환경 소품은 shadow pass를 만들지 않고 high는 허용',()=>{
  assert.match(g,/o\.castShadow=!MOBILE\|\|SET\.quality==='high'/);
  /* 캐릭터·보스 그림자는 이번 패스에서 그대로 둔다. */
  assert.match(g,/boss\.model\.traverse\(function\(o\)\{ if\(o\.isMesh\)\{ o\.castShadow=true/);
  assert.match(g,/ain\.model\.traverse\(function\(o\)\{ if\(o\.isMesh\)\{ o\.castShadow=true/);
});

test('모바일 스킬 순간광은 매번 PointLight를 scene에 추가하지 않는다',()=>{
  const i=g.indexOf('function fxLight(color, power, life)');
  assert.ok(i>0);
  const block=g.slice(i,i+900);
  assert.match(block,/if\(MOBILE\) return \{ position:new THREE\.Vector3\(\) \}/);
  assert.ok(block.indexOf('if(MOBILE)')<block.indexOf('new THREE.PointLight'));
});

test('desktop에서는 기존 순간 PointLight 연출을 보존',()=>{
  assert.match(g,/var l=new THREE\.PointLight\(color, 0, 7\.5\)/);
  assert.match(g,/FX\.push\(f\); return l/);
});
