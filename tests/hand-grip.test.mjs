/* 쥔 손 모프 — 카인·류·세라 (docs/design/94). 실제 캐릭터 GLB 로.
   손가락을 쪼개고 감아도 (1) 틈이 없고 (2) 크게 늘어나지 않고 (3) 손잡이 속으로 들어가지 않고
   (4) 무기 그립·왼손 IK 가 주먹 구멍을 쓰는지 본다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {buildHandGrip,gripHands,thumbWeight} from '../js/hand-grip.js';
import {makeRigAdapter} from '../js/combat-motion.js';
import {clone as skClone} from '../vendor/three/SkeletonUtils.js';

globalThis.window=globalThis;
if(!globalThis.TW_LOOKS)vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));
const L=globalThis.TW_LOOKS;

async function load(ch){const b=fs.readFileSync(`art/3d/${ch}_anim.glb`);const l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const key=(P,i)=>[P.getX(i),P.getY(i),P.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
/* 같은 자리 정점을 합친 뒤 삼각형 하나에만 속한 모서리 길이 합 — T 자 이음(틈)이 생기면 늘어난다 */
function boundaryLen(G){const P=G.attributes.position,I=G.index,m=new Map();for(let t=0;t<I.count;t+=3){const ids=[I.getX(t),I.getX(t+1),I.getX(t+2)].map(i=>key(P,i));for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],e=a<b?a+'|'+b:b+'|'+a;m.set(e,(m.get(e)||0)+1);}}
  let len=0;for(const [e,c] of m)if(c===1){const [a,b]=e.split('|').map(s=>s.split(',').map(Number));len+=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])/1e5;}return len;}

test('hand grip morph: no cracks, no tearing stretch, fingers stay out of the handle (kain, ryu, sera)',async()=>{
  for(const ch of ['kain','ryu','sera']){
    const g=await load(ch),orig=new Map();g.scene.traverse(o=>{if(o.isSkinnedMesh)orig.set(o,o.geometry);});
    const api=buildHandGrip(g.scene,ch);
    assert.ok(api.grips.Right&&api.grips.Left&&api.targets.length,`${ch}: 양손 모프가 있어야 한다`);
    for(const t of api.targets){
      const G=t.mesh.geometry,P=G.attributes.position,I=G.index;
      const b0=boundaryLen(orig.get(t.mesh)),b1=boundaryLen(G);
      assert.ok(Math.abs(b1-b0)<=b0*1e-3,`${ch}: 쪼갠 뒤 열린 모서리 ${b0.toFixed(3)} → ${b1.toFixed(3)} (틈)`);
      for(const side of ['Right','Left']){
        const D=G.morphAttributes.position[t.index[side]].array,r=t.regions.find(x=>x.side===side),gp=api.grips[side];
        const moved=i=>D[i*3]||D[i*3+1]||D[i*3+2], pos=(i,amt)=>V(P.getX(i)+D[i*3]*amt,P.getY(i)+D[i*3+1]*amt,P.getZ(i)+D[i*3+2]*amt).applyMatrix4(r.M);
        let n=0,tear=0,ratio=0,thumbWorst=0;
        const isThumb=i=>thumbWeight(pos(i,0),gp)>0;
        for(let k=0;k<I.count;k+=3){const ids=[I.getX(k),I.getX(k+1),I.getX(k+2)];if(!ids.some(moved))continue;
          for(let e=0;e<3;e++){const a=ids[e],c=ids[(e+1)%3],l0=pos(a,0).distanceTo(pos(c,0)),l1=pos(a,1).distanceTo(pos(c,1));
            if(isThumb(a)||isThumb(c)){thumbWorst=Math.max(thumbWorst,l1-l0);continue;}
            if(l1-l0>.008)tear++;if(l0>1e-3)ratio=Math.max(ratio,l1/l0);}}
        /* 손가락: 늘어남 최대 1.2~3.9 배, 8 mm 넘게 늘어난 모서리 0 */
        assert.equal(tear,0,`${ch} ${side}: 8 mm 넘게 늘어난 손가락 모서리 ${tear}`);
        assert.ok(ratio<5,`${ch} ${side}: 모서리가 ${ratio.toFixed(1)} 배 늘어났다`);
        /* 엄지 마디: 두꺼운 엄지를 70° 쯤 꺾으면 마디 바깥 살이 늘어난다(실제 손도 그렇다). 잰 최대 0.5~1.7 cm — 2 cm 로 막는다 (docs/design/95) */
        assert.ok(thumbWorst<=.02,`${ch} ${side}: 엄지 마디가 ${(thumbWorst*100).toFixed(1)} cm 늘어났다`);
        /* 손잡이 속: 뿌리 1 cm 위 정점은 축에서 반지름의 절반 이상 (잰 최소 0.61 · 뿌리 주름은 손잡이가 손바닥을 누르는 자리라 뺀다) */
        const C=V(...gp.c),A=V(...gp.a),K=V(...gp.K),F=V(...gp.f);let worst=9;
        for(let i=0;i<P.count;i++){if(!moved(i))continue;const l0=pos(i,0);if(l0.clone().sub(K).dot(F)<.01)continue;
          const v=pos(i,1).sub(C);if(Math.abs(v.dot(A))>.06)continue;n++;worst=Math.min(worst,v.sub(A.clone().multiplyScalar(v.dot(A))).length()/gp.r);}
        assert.ok(n>200,`${ch} ${side}: 감긴 정점이 너무 적다 (${n})`);
        assert.ok(worst>=.5,`${ch} ${side}: 손가락이 손잡이 속 ${((1-worst)*100).toFixed(0)} % 까지 들어갔다`);
        /* 같은 자리(UV 이음매) 정점은 같이 움직여야 한다 */
        const seen=new Map();for(let i=0;i<P.count;i++){const k=key(P,i);if(seen.has(k)){const j=seen.get(k);assert.ok(Math.hypot(D[i*3]-D[j*3],D[i*3+1]-D[j*3+1],D[i*3+2]-D[j*3+2])<1e-6,`${ch} ${side}: 이음매가 벌어진다`);}else seen.set(k,i);}
      }
    }
  }
});
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

test('thumb folds across the front of the fist (all six hands)',async()=>{
  for(const ch of ['kain','ryu','sera']){
    const g=await load(ch),api=buildHandGrip(g.scene,ch);
    for(const side of ['Right','Left']){const gp=api.grips[side],th=gp.thumb;
      assert.ok(th,`${ch} ${side}: 엄지를 찾아야 한다`);
      /* 끝마디 방향이 손잡이 축(새끼 쪽)을 향해 누워야 한다: 바인드에서는 손가락 쪽(위)으로 서 있다 */
      const B=V(...th.B),tip0=V(...th.tip),tip1=tip0.clone().sub(B).applyQuaternion(new T.Quaternion(...th.rot)).add(B),a=V(...gp.a);
      const before=tip0.clone().sub(B).normalize().dot(a),after=tip1.clone().sub(B).normalize().dot(a);
      assert.ok(after<-.7&&after<before-.3,`${ch} ${side}: 엄지가 주먹 앞을 가로지르지 않는다 (${before.toFixed(2)} → ${after.toFixed(2)})`);
    }
  }
});

test('grip point = fist hole; right hand closed, Ryu left closed, Sera left open; clones share geometry',async()=>{
  const want={kain:0,ryu:1,sera:0};
  for(const ch of ['kain','ryu','sera']){
    const g=await load(ch),twin=skClone(g.scene),api=gripHands(g.scene,ch),bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
    for(const side of ['Right','Left']){const hand=bones[side+'Hand'];
      assert.ok(hand.userData.gripPoint&&hand.userData.gripPoint.distanceTo(V(...api.grips[side].c))<1e-9,`${ch} ${side}: 손 뼈에 주먹 구멍 자리`);
      assert.equal(L.palm(T,hand),hand.userData.gripPoint,`${ch} ${side}: TW_LOOKS.palm 은 주먹 구멍`);}
    const slot=L.anchor(T,bones.RightHandSlot);assert.ok(slot.position.distanceTo(bones.RightHand.userData.gripPoint)<1e-9,`${ch}: 무기는 주먹 구멍에`);
    for(const t of api.targets){assert.equal(t.mesh.morphTargetInfluences[t.index.Right],1);assert.equal(t.mesh.morphTargetInfluences[t.index.Left],want[ch],`${ch}: 왼손 기본 세기`);}
    /* 온라인 파티: 같은 원본을 나눠 쓰는 복제본은 쪼갠 지오메트리를 다시 만들지 않고 같이 쓴다(모프 세기는 따로) */
    const api2=gripHands(twin,ch);
    assert.equal(api2.targets.length,api.targets.length);
    api2.targets.forEach((t,i)=>{assert.equal(t.mesh.geometry,api.targets[i].mesh.geometry,`${ch}: 복제본 지오메트리 공유`);assert.notEqual(t.mesh.morphTargetInfluences,api.targets[i].mesh.morphTargetInfluences);});
  }
});

test('Kain two-hand IK: left fist hole on the greatsword axis, facing the blade, on the handle; releases on one-handed thrusts',async()=>{
  const g=await load('kain'),root=new T.Group(),m=g.scene;m.scale.setScalar(1.14);root.add(m);
  const bones={};m.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  const HG=gripHands(m,'kain'),slot=L.anchor(T,bones.RightHandSlot);slot.userData.hand2=L.WEAPON.w_kain_greatsword.hand2;
  const ad=makeRigAdapter(m,root,slot,{twoHand:true,handGrip:HG}),mixer=new T.AnimationMixer(m),left=bones.LeftHand;
  const settle=(clip,u)=>{const c=g.animations.find(a=>a.name===clip);mixer.stopAllAction();const act=mixer.clipAction(c);act.reset().play();act.time=c.duration*u;mixer.update(0);root.updateMatrixWorld(true);
    for(let i=0;i<60;i++){ad.restore();ad.apply({id:1,clip,kind:'attack',duration:c.duration,elapsed:c.duration*u,hitAt:c.duration*.42},false,clip==='guard',1/60);}root.updateMatrixWorld(true);};
  /* 공격1·2·3 접점 포함 — 몸통 비틀기로 왼어깨가 멀어져 전에는 왼주먹이 오른주먹과 3 cm 겹쳤다. 이제 쇄골을 내밀어 닿는다 (docs/design/96) */
  for(const [clip,u] of [['attack1',.35],['attack2',.45],['attack2',.6],['attack3',.35],['smash',.35],['smash',.6],['skill1',.35],['guard',.35],['ult',.35],['counter',.35]]){
    settle(clip,u);
    assert.ok(ad.diagnostics.twoHand>.99,`kain ${clip}: 두 손으로 잡아야 한다 (${ad.diagnostics.twoHand.toFixed(2)})`);
    const fist=left.userData.gripPoint.clone().applyMatrix4(left.matrixWorld),p=slot.getWorldPosition(V()),ax=V(0,1,0).applyQuaternion(slot.getWorldQuaternion(new T.Quaternion()));
    const d=fist.sub(p),along=d.dot(ax),off=d.clone().sub(ax.clone().multiplyScalar(along)).length();
    /* 잰 값 0.0 cm (전에는 손목 관절을 대서 15~17 cm) */
    assert.ok(off<=.02,`kain ${clip}: 왼손 주먹이 대검 축에서 ${(off*100).toFixed(1)} cm`);
    /* 손잡이 위: 오른손에서 칼날 쪽 11~20 cm (대검 손잡이 0.69~1.00, 오른손 0.75) — 폼멜 너머 허공을 쥐지 않는다 */
    /* 주먹 폭 10.8 cm — 두 주먹 중심이 그보다 가까우면 겹친다 */
    assert.ok(along>=.105&&along<=.205,`kain ${clip} u=${u}: 왼손이 손잡이 밖이거나 오른주먹과 겹침 (오른손에서 ${(along*100).toFixed(1)} cm)`);
    assert.ok(HG.amount.Left>.95,`kain ${clip}: 두 손 잡기 중 왼손을 쥐어야 한다 (${HG.amount.Left.toFixed(2)})`);
    /* 주먹 방향: 주먹 구멍 축(새끼→엄지)이 대검 축(칼날 쪽)과 5° 안 — 전에는 방향을 안 맞춰 손잡이가 주먹을 비스듬히 지났다 (docs/design/95) */
    const fa=left.userData.gripAxis.clone().applyQuaternion(left.getWorldQuaternion(new T.Quaternion()));
    assert.ok(fa.angleTo(ax)<5*Math.PI/180,`kain ${clip}: 왼손 주먹 방향이 대검 축과 ${(fa.angleTo(ax)*180/Math.PI).toFixed(0)}°`);
    /* 손목 비틀림(아래팔 대비): 잰 값 1~43°. 돌림만 맞추면 172° 까지 갔다(클립 자체도 최대 128°) */
    const rel=bones.LeftForeArm.getWorldQuaternion(new T.Quaternion()).invert().multiply(left.getWorldQuaternion(new T.Quaternion())),bx=left.position.clone().normalize(),p3=V(rel.x,rel.y,rel.z),pr=bx.multiplyScalar(p3.dot(bx));
    const tw=2*Math.acos(Math.min(1,Math.abs(new T.Quaternion(pr.x,pr.y,pr.z,rel.w).normalize().w)))*180/Math.PI;
    assert.ok(tw<=60,`kain ${clip}: 왼손목 비틀림 ${tw.toFixed(0)}°`);
  }
  /* 강철 회전(skill3) u=.55~.75 는 한 손으로 크게 돌린다 — 주먹 방향까지 맞추면 오른손을 22 cm 당겨도 7~9 cm 모자라 놓고 손을 편다 */
  for(let i=0;i<40;i++){ad.restore();ad.apply(null,false,false,1/60);}
  settle('skill3',.6);
  assert.ok(ad.diagnostics.twoHand<.02,`kain skill3: 못 닿으면 두 손 잡기를 놓아야 한다 (${ad.diagnostics.twoHand.toFixed(2)})`);
  assert.ok(HG.amount.Left<.05,`kain skill3: 놓으면 왼손을 편다 (${HG.amount.Left.toFixed(2)})`);
  /* 행동이 끝나면 왼손을 편다 */
  for(let i=0;i<40;i++){ad.restore();ad.apply(null,false,false,1/60);}
  assert.ok(HG.amount.Left<.05,`kain: 대기에서는 왼손을 편다 (${HG.amount.Left.toFixed(2)})`);
  /* 연속 재생(60 fps): 잡기 시작·놓기 도중(세기 < 1)도 두 주먹 중심이 10 cm 넘게 떨어져야 한다(주먹 폭 10.8, 잰 값 최소 10.6).
     멈춘 자세만 재면 공격2·스매시·스킬1·처형이 잡기 시작에서 9.6~10.1 cm 로 겹쳤던 것을 못 잡았다 (docs/design/96) */
  for(const clip of ['attack1','attack2','smash','skill1','exec']){const c=g.animations.find(a=>a.name===clip);
    for(let i=0;i<30;i++){ad.restore();ad.apply(null,false,false,1/60);}
    mixer.stopAllAction();const act=mixer.clipAction(c);act.reset().play();let worst=9,at=0;
    for(let t=0;t<c.duration;t+=1/60){act.time=t;mixer.update(0);ad.restore();ad.apply({id:1,clip,kind:'attack',duration:c.duration,elapsed:t,hitAt:c.duration*.42},false,false,1/60);root.updateMatrixWorld(true);
      if((ad.diagnostics.twoHand||0)<.05)continue;
      const dist=left.userData.gripPoint.clone().applyMatrix4(left.matrixWorld).distanceTo(slot.getWorldPosition(V()));if(dist<worst){worst=dist;at=t;}}
    assert.ok(worst>=.10,`kain ${clip}: ${at.toFixed(2)} 초에 두 주먹 중심 ${(worst*100).toFixed(1)} cm — 겹침`);}
});
