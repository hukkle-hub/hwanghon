/* 문서 121 §2 — 곧고 빠른 궤적(스매시 내려찍기)이 몸통 너비의 «판» 으로 읽히지 않게:
   꼬리로 갈수록 날끝 선 쪽으로 가늘어지고 흐려지며, 폭 방향으로는 날끝이 가장 밝다. */
import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';import{WeaponTrail}from'../js/weapon-trail.js';

function straightSwing(power=1.5){
  const scene=new T.Scene(),weapon=new T.Group();weapon.add(new T.Mesh(new T.BoxGeometry(.05,1,.05).translate(0,.5,0)));scene.add(weapon);
  const trail=new WeaponTrail(scene);trail.set(power,0xE8D0A0);trail.tick(0,weapon,false);   /* 첫 tick 이 무기를 등록한다(바뀌면 점을 비운다) */
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
test('trail taper: 폭 방향으로 날끝 가장자리가 안쪽보다 밝다 (예전엔 거꾸로) — 평타',()=>{
  const {trail,m}=straightSwing(1.0);try{
    assert.ok(L(m,1)>0);assert.ok(L(m,0)<=L(m,1)*.05,`inner ${L(m,0)} vs tip ${L(m,1)}`);
  }finally{trail.dispose();}
});
test('trail taper 기술별 차등: 세기가 클수록 꼬리(중간 점 밝기·끝 폭)가 밝고 넓다 (평타 < 스매시 < 카운터 < 처형)',()=>{
  const tail=pw=>{const {trail,m}=straightSwing(pw);try{const n=trail.pts.length,head=L(m,1),w0=P(m,0).distanceTo(P(m,1));
    const mid=Math.floor((n-1)/2);return {lum:L(m,mid*2+1)/head,width:P(m,(n-1)*2).distanceTo(P(m,(n-1)*2+1))/w0,edge:L(m,0)/head};}finally{trail.dispose();}};
  const r=[1.0,1.5,1.8,2.2].map(tail);
  for(let i=1;i<r.length;i++){assert.ok(r[i].lum>r[i-1].lum,`꼬리 밝기 ${i}`);assert.ok(r[i].width>r[i-1].width,`꼬리 폭 ${i}`);}
  /* 안쪽 가장자리: 평타·스매시는 0(스매시에 .09 만 줘도 sRGB .33 이라 머리 쪽이 판이 됐다), 카운터부터 켜지고 처형이 가장 밝되 날끝의 1/4 이하 */
  assert.ok(r[0].edge===0&&r[1].edge===0,'평타·스매시 안쪽 0');assert.ok(r[2].edge>0&&r[3].edge>r[2].edge&&r[3].edge<=.25,'카운터 < 처형 ≤ 1/4');
});
test('game3d: 접점 저항·튕김 뒤 궤적은 «그 행동의» 세기·색으로 되돌아간다 (예전엔 평타 1.0·하늘색)',async()=>{
  const {readFile}=await import('node:fs/promises');const g=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');
  assert.doesNotMatch(g,/trailSet\(1\.0, 0xBFD8E8\)/,'평타 값으로 되돌리는 곳이 없어야 한다');
  assert.equal((g.match(/schedule\(trailRestore,/g)||[]).length,2,'접점 저항·튕김 둘 다');
  assert.match(g,/trailStyleSet\(tsy\[0\], tsy\[1\]\)/);assert.match(g,/case 'skill': var k=SK\[e\.index\]; trailStyleSet\(/);
});
