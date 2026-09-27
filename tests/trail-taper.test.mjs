/* 문서 121 §2 — 곧고 빠른 궤적(스매시 내려찍기)이 몸통 너비의 «판» 으로 읽히지 않게:
   꼬리로 갈수록 날끝 선 쪽으로 가늘어지고 흐려지며, 폭 방향으로는 날끝이 가장 밝다. */
import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';import{WeaponTrail}from'../js/weapon-trail.js';

function straightSwing(){
  const scene=new T.Scene(),weapon=new T.Group();weapon.add(new T.Mesh(new T.BoxGeometry(.05,1,.05).translate(0,.5,0)));scene.add(weapon);
  const trail=new WeaponTrail(scene);trail.set(1.5,0xE8D0A0);trail.tick(0,weapon,false);   /* 첫 tick 이 무기를 등록한다(바뀌면 점을 비운다) */
  /* 한 줄로 떨어지는 10 점, 모두 같은 나이(= 빠른 동작) — 예전엔 균일하게 밝은 판이었다 */
  for(let i=0;i<10;i++){weapon.position.set(0,2-i*.2,0);trail._push(weapon);}
  trail.tick(0,weapon,false);
  return {trail,m:trail.layers[0]};
}
const P=(m,i)=>new T.Vector3().fromArray(m.geometry.attributes.position.array,i*3);
const L=(m,i)=>{const c=m.geometry.attributes.color.array;return (c[i*3]+c[i*3+1]+c[i*3+2])/3;};

test('trail taper: 머리는 넓고 꼬리는 머리의 1/3 이하로 가늘다',()=>{
  const {trail,m}=straightSwing();try{
    const n=trail.pts.length,head=P(m,0).distanceTo(P(m,1)),tail=P(m,(n-1)*2).distanceTo(P(m,(n-1)*2+1));
    assert.ok(n>=10);assert.ok(tail<head/3,`tail ${tail.toFixed(3)} vs head ${head.toFixed(3)}`);
  }finally{trail.dispose();}
});
test('trail taper: 꼬리 밝기는 머리의 5 % 이하 (선형색 — 화면 sRGB 로는 약 25 %)',()=>{
  const {trail,m}=straightSwing();try{
    const n=trail.pts.length;assert.ok(L(m,(n-1)*2+1)<=L(m,1)*.05);
  }finally{trail.dispose();}
});
test('trail taper: 폭 방향으로 날끝 가장자리가 안쪽보다 밝다 (예전엔 거꾸로)',()=>{
  const {trail,m}=straightSwing();try{
    assert.ok(L(m,1)>0);assert.ok(L(m,0)<=L(m,1)*.05,`inner ${L(m,0)} vs tip ${L(m,1)}`);
  }finally{trail.dispose();}
});
