import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const trail=await readFile(new URL('../js/weapon-trail.js',import.meta.url),'utf8');
const boss=await readFile(new URL('../js/boss-motion.js',import.meta.url),'utf8');
const game=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');

test('플레이어 낫 궤적은 0.3초 판 잔상이 아니라 짧은 시간 기반 리본',()=>{
  assert.match(trail,/trailLifetime\(power\).*0\.17.*0\.11/);
  assert.match(trail,/MAX_SEG=0\.22/);
  assert.match(trail,/Math\.ceil\(prev\.t\.distanceTo\(t\)\/MAX_SEG\)/);
  assert.ok(!trail.includes("this.hold=(BIG()&&this.power>=1.5)?0.30:0.16"));
});

test('리본은 자루부터 채우지 않고 날 바깥 구간만 사용',()=>{
  assert.match(trail,/INNER=\[0\.76,0\.70\]/);
  assert.match(trail,/OUTER=\[1\.03,1\.08\]/);
  assert.match(trail,/this\._write\(this\.layers\[0\], INNER\[0\], OUTER\[0\]/);
});

test('일반 명중도 보스 공격을 끊지 않는 additive reaction을 항상 받는다',()=>{
  assert.match(boss,/function react\(kind,strength=1,duration,side=1\)/);
  /* 문서 120: 위계를 평타 < 마무리 < 스매시 < 카운터 < 경직·파괴로 나눴다 — 평타 .42 → .34, 마무리·스매시는 따로 */
  assert.match(boss,/hit:\[\.34,\.18\],finish:\[\.50,\.24\],smash:\[\.64,\.30\]/);
  assert.match(boss,/\.30\*reaction\.side/);
  assert.match(game,/boss\.behavior\?\.react\(e\.kind==='smash'\?'smash':hitHeavy\?'finish':'hit',1,null,hitSide\)/);
});

test('일반 hit 전체 빨강 플래시는 제거하고 큰 명중만 짧게 남긴다',()=>{
  assert.ok(!game.includes('boss.anim.flash=0.12'));
  assert.match(game,/boss\.anim\.flash=hitHeavy\?0\.055:0/);
  assert.match(game,/FLASHC=new THREE\.Color\(0x2a180f\)/);
});

test('d01 암부 가독성: 노출·환경광·캐릭터 fill을 올리고 붉은 역광은 줄인다',()=>{
  assert.match(game,/exp:0\.92, hemi:0\.50, player:1\.15/);
  assert.match(game,/moonI:0\.68/);
  assert.match(game,/rimLights\[1\]\.intensity=1\.8/);
  assert.match(game,/DirectionalLight\(0xffdfcf, 1\.6\)/);
});
