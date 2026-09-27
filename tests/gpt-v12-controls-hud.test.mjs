import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../game3d.html',import.meta.url),'utf8');
const game=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');

test('모바일 점프는 회피 스와이프가 아니라 독립 버튼 — 회피 지연 금지',()=>{
  assert.match(game,/data-jump/);
  assert.match(html,/\.abtn--jump/);
  assert.match(game,/else if\(t\.hasAttribute\('data-jump'\)\) jumpIn\('pad'\)/);
  assert.ok(!game.includes("MOBILE?'회피 버튼 위로':'I'"));
});

test('점프 입력은 검수·온라인용 tw:input 이벤트를 같이 발행하고 PC I도 같은 경로',()=>{
  assert.match(game,/CustomEvent\('tw:input'/);
  assert.match(game,/detail:\{ type:type, source:source\|\|'ui' \}/);
  assert.match(game,/e\.code==='KeyI'\) jumpIn\('keyboard'\)/);
});

test('점프 HUD: 0.8초 쿨 표시, 공중 공격·가드 눌림 표시 차단, 최초 jumpOnly 큐',()=>{
  assert.match(game,/s2\.player\.jumpCd/);
  assert.match(game,/R\.jump&&R\.jump\.cooldown/);
  assert.match(game,/is-jumping/);
  assert.match(html,/\.actions\.is-jumping \[data-atk\],\.actions\.is-jumping \[data-guard\]/);
  assert.match(game,/classList\.add\('is-cue'\)/);
  assert.match(game,/MOBILE\?'점프 버튼':'I'/);
});

test('v09 후속 가독성: 사거리 원 0.06\/0.10, 훈련장 +0.03; 모바일 카운터 배너 회피',()=>{
  assert.match(game,/TEACH\?0\.13:0\.10/);
  assert.match(game,/TEACH\?0\.09:0\.06/);
  assert.match(game,/by<0\.22\?'72%':''/);
});
