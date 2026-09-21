import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/combat-quality.js';
import {sampleAction} from '../js/combat-motion.js';

/* 궁극기 클립은 smash 를 빌려 쓴다 (ain-bind-repair). 클립 자체는 0.708 초로
   구워져 있지만 — smash 원본은 2.417 초다 — 전투에서는 그 길이가 쓰이지 않는다.
   판정이 있는 기술(mult>0)은 «timed» 로 재생되어, game3d.js 가 매 프레임
   sampleAction 으로 클립 시각을 행동 시간에 다시 매핑한다.

   그래서 «궁극기는 스매시 3.41 배속(=2.417/0.708)» 은 틀린 계산이다.
   플레이어가 보는 배속은 행동 시간이 정한다: 2.417 / RULES.ult.duration.
   이 테스트가 그 계약을 못박는다 — 클립 길이를 바꿔도 전투 배속은 안 바뀌고,
   바꾸려면 행동 시간을 바꿔야 한다는 것. docs/design/59-clip-sheet.md §4 */
const CLIP=0.708, SRC=2.417;
const CASES=[{name:'기본 아레나',dur:1.20,hit:0.55,rate:2.01},
             {name:'보스 오버라이드',dur:1.62,hit:0.80,rate:1.49}];

test('궁극기 클립은 행동 시간 전체에 걸쳐 재생된다 — 클립 길이가 아니라', () => {
  for(const c of CASES){
    const a={clip:'ult',kind:'ult',duration:c.dur,hitAt:c.hit,elapsed:0,clipHit:0.50};
    a.elapsed=0;      assert.equal(sampleAction(a,CLIP), 0, c.name+' 시작');
    a.elapsed=c.dur;  assert.ok(Math.abs(sampleAction(a,CLIP)-CLIP)<1e-6, c.name+' 끝에서 클립을 다 쓴다');
    /* 배속은 소스 길이 ÷ 행동 시간이다. 클립의 0.708 초는 끼어들지 않는다. */
    assert.ok(Math.abs(SRC/c.dur-c.rate)<0.01, c.name+' 배속 '+(SRC/c.dur).toFixed(2));
  }
});

test('행동 시간을 늘려도 판정 프레임의 자세는 그대로다', () => {
  /* 49 번에서 맞춘 접점 정렬이 행동 시간에 의존하지 않는다는 것 —
     즉 배속을 늦추는 것만으로 접점이 깨지지 않는다. */
  for(const c of CASES){
    const a={clip:'ult',kind:'ult',duration:c.dur,hitAt:c.hit,elapsed:c.hit,clipHit:0.50};
    assert.ok(Math.abs(sampleAction(a,CLIP)-CLIP*0.50)<1e-6,
      c.name+' 판정 순간 클립 시각 = 접점 '+(CLIP*0.5).toFixed(3));
  }
});
