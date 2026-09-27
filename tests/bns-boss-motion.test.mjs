/* 보스 모션 문법 (문서 120) — 피격 위계·방향, 경직 순서, 패턴별 회복 자세, 대기 호흡.
   모두 authored clip 위에 얹는 덧셈이라 판정 시계·히트박스는 건드리지 않는다 (combat.js 무변경). */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {BOSS_PROFILES,createBossBehavior} from '../js/boss-motion.js';

function dummy(){
  const g=new T.Group(),names=new Set(['Hips','Spine','Spine1','Spine2','Head','LeftArm','RightArm']);
  const P=BOSS_PROFILES.tutorial;for(const rows of [P.idle,P.settle,...Object.values(P.prep),...Object.values(P.settleBy||{})])for(const t of rows)names.add(t[0]);
  for(const n of names){const o=new T.Group();o.name=n;g.add(o);}return g;
}
/* 몸 전체가 쉬는 자세에서 얼마나 벗어났나 — 각 마디 회전각 + 골반 이동(1 cm ≈ 1°) */
function deviation(v){let s=0;for(const [n,o] of Object.entries(v.nodes)){s+=o.quaternion.angleTo(new T.Quaternion())*57.3;if(n==='Hips')s+=o.position.length()*100;}return s;}
function peakOf(kind,side=1){const v=createBossBehavior(dummy(),'tutorial');v.react(kind,1,null,side);let best=0;
  for(let i=0;i<40;i++){v.restore();v.apply({state:'attack'},0,1/60);best=Math.max(best,deviation(v));}v.restore();return best;}

test('피격 위계: 평타 < 마무리 < 스매시 < 카운터(튕김 < 밀침 < 맞부딪침) < 경직 < 파괴',()=>{
  const order=['hit','finish','smash','deflect','repel','clash','stagger','break'],v=order.map(k=>peakOf(k));
  for(let i=1;i<order.length;i++)assert.ok(v[i]>v[i-1],`${order[i-1]} ${v[i-1].toFixed(1)} < ${order[i]} ${v[i].toFixed(1)}`);
});

test('반동 방향은 맞은 쪽의 반대 — side 를 뒤집으면 옆 기울기도 뒤집힌다, 공격 상태는 그대로 둔다',()=>{
  const lean=side=>{const v=createBossBehavior(dummy(),'tutorial');v.react('smash',1,null,side);for(let i=0;i<4;i++){v.restore();v.apply({state:'attack'},0,1/60);}
    const e=new T.Euler().setFromQuaternion(v.nodes.Spine.quaternion);v.restore();return e.z;};
  const l=lean(1),r=lean(-1);assert.ok(Math.sign(l)===-Math.sign(r)&&Math.abs(l)>.01,`좌 ${l.toFixed(3)} 우 ${r.toFixed(3)}`);
});

test('반동 정점은 세기와 상관없이 접점 뒤 0.06 s(4 프레임) — 접점·정지·반동이 한 사건으로 붙는다',()=>{
  for(const k of ['hit','smash','clash','break']){const v=createBossBehavior(dummy(),'tutorial');v.react(k);let best=0,at=0;
    for(let i=1;i<=30;i++){v.restore();v.apply({state:'attack'},0,1/60);const d=deviation(v);if(d>best){best=d;at=i;}}v.restore();
    assert.ok(at>=3&&at<=5,`${k} 정점 ${at} 프레임`);}
});

test('경직 = 충격 → 균형 잃음 → 발 다시 딛기 → 낮춤: 옆 휘청이 먼저 커지고, 골반은 나중에 가장 낮다',()=>{
  const v=createBossBehavior(dummy(),'tutorial'),rows=[];
  for(let i=0;i<=48;i++){v.restore();v.apply({state:'stagger'},0,1/60);rows.push({t:i/60,z:Math.abs(new T.Euler().setFromQuaternion(v.nodes.Spine.quaternion).z),y:v.nodes.Hips.position.y,x:Math.abs(v.nodes.Hips.position.x)});}
  v.restore();
  const zPeak=rows.reduce((a,b)=>b.z>a.z?b:a),yLow=rows.reduce((a,b)=>b.y<a.y?b:a),xPeak=rows.reduce((a,b)=>b.x>a.x?b:a);
  assert.ok(zPeak.t<xPeak.t&&xPeak.t<yLow.t,`휘청 ${zPeak.t.toFixed(2)} s → 딛기 ${xPeak.t.toFixed(2)} s → 낮춤 ${yLow.t.toFixed(2)} s`);
  assert.ok(yLow.y<-.05,`낮춤 ${yLow.y.toFixed(3)}`);
});

test('회복 자세가 패턴마다 다르다 — 내려찍기는 가장 깊게, 회전은 비틀림이 풀린다',()=>{
  const at=(icon)=>{const v=createBossBehavior(dummy(),'tutorial');v.restore();v.apply({state:'recover',patIcon:icon,recovery:.82,recoveryDur:1},0,0);
    const r={y:v.nodes.Hips.position.y,twist:new T.Euler().setFromQuaternion(v.nodes.Spine.quaternion,'YXZ').y};v.restore();return r;};
  const slam=at('slam'),charge=at('charge'),spin=at('spin'),other=at('hookR');
  assert.ok(slam.y<charge.y&&slam.y<other.y,`내려찍기 ${slam.y.toFixed(3)} · 돌진 ${charge.y.toFixed(3)} · 기본 ${other.y.toFixed(3)}`);
  assert.ok(Math.abs(spin.twist)>.05&&Math.abs(other.twist)<.01,`회전 비틀림 ${spin.twist.toFixed(3)}`);
});

test('대기는 숨(0.3 Hz)·체중 옮김(0.2 Hz)이 따로 있다 — 1 Hz 까딱임만이 아니다',()=>{
  const P=BOSS_PROFILES.tutorial.idle;
  assert.ok(P.some(t=>/Spine/.test(t[0])&&t[4]===.3),'숨');
  assert.ok(P.some(t=>t[0]==='Hips'&&t[4]===.2),'체중 옮김');
});
