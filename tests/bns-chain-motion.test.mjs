import test from 'node:test';
import assert from 'node:assert/strict';
import {AIN_BNS_CHAIN,transitionFor,CINEMA_STYLE} from '../js/character-cinema.js';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinBind,repairAinClips} from '../js/ain-bind-repair.js';
test('아인 2타는 1·3타보다 준비 비율이 작다',()=>{
  assert.ok(AIN_BNS_CHAIN.attack2.prep<AIN_BNS_CHAIN.attack1.prep);
  assert.ok(AIN_BNS_CHAIN.attack2.prep<AIN_BNS_CHAIN.attack3.prep);
});

test('아인 3타는 기본 3타 중 body drive와 follow가 가장 크다',()=>{
  assert.ok(AIN_BNS_CHAIN.attack3.drive>AIN_BNS_CHAIN.attack2.drive);
  assert.ok(CINEMA_STYLE.ain.attack.attack3.follow>CINEMA_STYLE.ain.attack.attack2.follow);
  assert.ok(CINEMA_STYLE.ain.attack.attack3.snap>CINEMA_STYLE.ain.attack.attack2.snap);
});

test('2타는 반대 방향, 3타는 다시 원방향으로 연결',()=>{
  assert.equal(AIN_BNS_CHAIN.attack1.side,1);
  assert.equal(AIN_BNS_CHAIN.attack2.side,-1);
  assert.equal(AIN_BNS_CHAIN.attack3.side,1);
});

test('아인 기본 공격 visual blend는 50ms, finisher는 85ms',()=>{
  assert.equal(transitionFor('ain','attack1').in,.050);
  assert.equal(transitionFor('ain','attack3').in,.050);
  assert.equal(transitionFor('ain','smash').in,.085);
});

test('presentation 계층만 바꾸고 combat timing 상수는 이 모듈에 없다',()=>{
  assert.equal('hitAt' in AIN_BNS_CHAIN.attack1,false);
  assert.equal('duration' in AIN_BNS_CHAIN.attack1,false);
});

/* 연계 무공 문법 (문서 120) — 아인·카인 평1 → 평2 → 평3 이 «중립 없이» 이어지고, 평2 는 되감기가 짧은 역방향이며,
   접점 ±0.15 s 동안 디딘 발이 미끄러지지 않는다. 게임과 같은 클립 구간(clipSpan)을 잰다.
   가슴 방향 = Spine2 의 세계 수직축 회전(쉬는 자세 대비), 골반 = Hips. */

const ctx={window:{}};
for(const f of ['world','dungeons']) vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const M=ctx.window.TW_DUNGEONS.RULES.motion;
const spanOf=(ch,c)=>((M.clipSpanByChar||{})[ch]||{})[c]??(M.clipSpan||{})[c]??1;
const hitOf=(ch,c)=>((M.clipContactsByChar||{})[ch]||{})[c]??M.clipContacts[c];

async function rig(ch){
  const b=fs.readFileSync(`art/3d/${ch}_anim.glb`),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  /* game3d 와 같이 GLB animations[i].extras 를 클립 userData 로 옮긴다 — 발 고정 클립(extras.source 에 footlock)의 골반 XZ 를 지우지 않게 */
  const adefs=g.parser?.json?.animations||[];g.animations.forEach((c,i)=>{if(adefs[i]?.extras)c.userData=Object.assign(c.userData||{},adefs[i].extras);});
  const clips=ch==='ain'?repairAinClips(g.animations,repairAinBind(g.scene)):g.animations;
  const B={};g.scene.traverse(o=>{if(o.isBone)B[o.name.replace(/^mixamorig:?/,'')]=o;});
  g.scene.updateMatrixWorld(true);const rest={};for(const n of ['Hips','Spine2'])rest[n]=B[n].getWorldQuaternion(new T.Quaternion());
  const mixer=new T.AnimationMixer(g.scene);
  const pose=(name,u)=>{const c=clips.find(x=>x.name===name),a=mixer.clipAction(c);mixer.stopAllAction();a.reset().play();a.paused=true;a.time=c.duration*u;mixer.update(0);g.scene.updateMatrixWorld(true);return c;};
  const yaw=n=>{const q=B[n].getWorldQuaternion(new T.Quaternion()).multiply(rest[n].clone().invert()),v=new T.Vector3(0,0,1).applyQuaternion(q);return Math.atan2(v.x,v.z)*180/Math.PI;};
  const foot=n=>B[n].getWorldPosition(new T.Vector3());
  return {clips,pose,yaw,foot};
}
const wrap=d=>{while(d>180)d-=360;while(d<-180)d+=360;return d;};

for(const ch of ['ain','kain']){
  test(`${ch}: 평1 끝 → 평2 시작 가슴 차이 10° 안, 평2 끝 → 평3 시작 30° 안 (중립으로 돌아가지 않는다)`,async()=>{
    const R=await rig(ch);
    R.pose('attack1',spanOf(ch,'attack1'));const e1=R.yaw('Spine2');
    R.pose('attack2',0);const s2=R.yaw('Spine2');
    R.pose('attack2',spanOf(ch,'attack2'));const e2=R.yaw('Spine2');
    R.pose('attack3',0);const s3=R.yaw('Spine2');
    /* 잰 값: 아인 −53→−54°, 카인 −46→−53° · 평2 끝 +11° → 평3 시작 아인 −17°·카인 −9° */
    assert.ok(Math.abs(wrap(s2-e1))<=10,`${ch} 평1 끝 ${e1.toFixed(0)}° → 평2 시작 ${s2.toFixed(0)}°`);
    assert.ok(Math.abs(wrap(s3-e2))<=30,`${ch} 평2 끝 ${e2.toFixed(0)}° → 평3 시작 ${s3.toFixed(0)}°`);
  });
  test(`${ch}: 평2 는 역방향 — 되감기 10° 안, 접점까지 가슴이 평1 과 반대로 60° 넘게 돈다`,async()=>{
    const R=await rig(ch),hit=hitOf(ch,'attack2');
    R.pose('attack2',0);const s=R.yaw('Spine2');let back=0;
    for(let u=0;u<=hit;u+=.01){R.pose('attack2',u);back=Math.min(back,wrap(R.yaw('Spine2')-s));}
    R.pose('attack2',hit+.08);const after=wrap(R.yaw('Spine2')-s);
    /* 평1 은 가슴을 음(−)으로 감으며 끝난다 — 평2 는 양(+)으로 친다. 잰 값: 되감기 1~2°, 접점 뒤 +100° 안팎 */
    assert.ok(back>=-10,`${ch} 되감기 ${back.toFixed(0)}°`);
    assert.ok(after>=60,`${ch} 평2 휘두름 ${after.toFixed(0)}°`);
  });
  test(`${ch}: 평2 접점 ±0.15 s 동안 디딘 발(왼발) 미끄러짐 2 cm 안`,async()=>{
    const R=await rig(ch),hit=hitOf(ch,'attack2'),c=R.pose('attack2',hit),at=R.foot('LeftFoot');let worst=0;
    for(let t=-.15;t<=.15+1e-9;t+=1/60){R.pose('attack2',Math.max(0,Math.min(1,hit+t/c.duration)));const p=R.foot('LeftFoot');worst=Math.max(worst,Math.hypot(p.x-at.x,p.z-at.z));}
    assert.ok(worst<=.02,`${ch} 왼발 ${(worst*100).toFixed(1)} cm`);
  });
}
