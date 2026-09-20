import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRelayBoss} from '../js/relay-boss.js';
import {createPumpBoss} from '../js/pump-boss.js';
import {createRootBoss} from '../js/root-boss.js';
import {createHaulerBoss} from '../js/hauler-boss.js';
import {createWardBoss} from '../js/ward-boss.js';
import * as T from '../vendor/three/three.module.js';

const ctx={window:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,
  document:{dispatchEvent(){}},CustomEvent:function(){}};
vm.createContext(ctx);
for(const n of ['world','items','save','dungeons','dungeon','dungeon-content'])
  vm.runInContext(fs.readFileSync(new URL('../js/'+n+'.js',import.meta.url),'utf8'),ctx,{filename:n});
const ARENAS=ctx.window.TW_DUNGEONS.ARENAS;
const rigs={relay:createRelayBoss,pump:createPumpBoss,root:createRootBoss,
  hauler:createHaulerBoss,ward:createWardBoss};

/* boss-motion.js sampleBossAttack 은 hitFrac 을 기준으로 클립을 양쪽으로 늘린다:
   예고 구간이 [0, hitFrac], 후딜 구간이 [hitFrac, 1] 에 대응한다.
   즉 hitFrac 은 «이 클립의 치는 자세가 몇 %에 있는가» 를 말하는 약속이다.
   그 약속이 틀리면 팔이 아직 오는 중에 피해가 뜨거나, 다 휘두른 뒤에 뜬다.

   이 리그들은 선형 키프레임이라 «최고속» 으로는 잴 수 없다 (구간 안에서 속도가 일정하다).
   보이는 접점은 «치는 자세에 도달하는 순간» 이다. */
function contactFrac(clip){
  let best=null;
  for(const tr of clip.tracks){
    const t=tr.times,v=tr.values;
    if(v.length!==t.length)continue;                       // 스칼라 트랙만
    const v0=v[0],span=v[v.length-1]-v0;
    if(Math.abs(span)>=Math.PI*1.8){                       // 제자리 한 바퀴 — 되돌아오지 않는다
      const half=v0+span/2;let at=t[t.length-1];
      for(let i=1;i<v.length;i++){const a=v[i-1],b=v[i];
        if((a-half)*(b-half)<=0&&a!==b){at=t[i-1]+(t[i]-t[i-1])*(half-a)/(b-a);break;}}
      if(!best||Math.abs(span)>best.swing)best={swing:Math.abs(span),at,name:tr.name};
      continue;
    }
    let wi=0,wv=0;                                          // 되감는 극값 = 윈드업
    for(let i=0;i<v.length;i++){const d=v[i]-v0;if(Math.abs(d)>Math.abs(wv)){wv=d;wi=i;}}
    if(!wv)continue;
    let si=-1,sv=0;                                         // 그 뒤 반대쪽 극값 = 도달
    for(let i=wi+1;i<v.length;i++){const d=v[i]-v0;
      if(Math.sign(d)!==Math.sign(wv)&&Math.abs(d)>Math.abs(sv)){sv=d;si=i;}}
    const swing=si>=0?Math.abs(wv)+Math.abs(sv):Math.abs(wv);
    if(!best||swing>best.swing)best={swing,at:si>=0?t[si]:t[wi],name:tr.name};
  }
  return best?best.at/clip.duration:null;
}

test('모든 절차 보스의 hitFrac 이 실제 «치는 자세에 도달하는 순간» 과 맞는다',()=>{
 const off=[];
 let checked=0;
 for(const [id,A] of Object.entries(ARENAS)){
  if(!A.atk||!A.procedural||!rigs[A.procedural])continue;
  const asset=rigs[A.procedural]();
  for(const [icon,spec] of Object.entries(A.atk)){
   const clip=asset.animations.find(c=>c.name===spec.clip);
   assert.ok(clip,id+':'+spec.clip+' 클립이 리그에 없다');
   const f=contactFrac(clip);
   if(f===null)continue;
   checked++;
   const d=f-spec.hitFrac;
   if(Math.abs(d)>0.06)off.push(id+'.'+icon+' ('+spec.clip+') 도달 '+f.toFixed(3)+
     ' vs hitFrac '+spec.hitFrac+' → '+(d>=0?'+':'')+d.toFixed(3));
  }
 }
 assert.ok(checked>=24,'검사한 클립이 너무 적다: '+checked);
 assert.deepEqual(off,[],'접점이 어긋난 클립:\n  '+off.join('\n  '));
});

test('보스가 쓰러질 때 바닥을 뚫고 들어가지 않는다',()=>{
 /* 쓰러짐(down)은 매 전투마다 보이고 처형이 거기서 나온다. 사망은 전투의 마무리다.
    골반을 바닥 아래로 내리면 리그가 통째로 지면을 뚫는다 — 게임에서는 1.22배로 보인다.
    쉬는 자세의 바닥을 기준으로, 클립이 그보다 얼마나 더 파고드는지를 잰다. */
 const LIMIT=0.32;                       /* 주저앉는 만큼은 허용, 가라앉으면 실패 */
 const deep=[];
 for(const [name,make] of Object.entries(rigs)){
  const a=make(),mixer=new T.AnimationMixer(a.scene);
  const floor=o=>{o.geometry.computeBoundingBox();
    return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).min.y;};
  a.scene.updateMatrixWorld(true);
  let rest=Infinity;
  a.scene.traverse(o=>{if(o.isMesh)rest=Math.min(rest,floor(o));});
  assert.ok(Number.isFinite(rest),name+' 메시가 없다');
  for(const clip of a.animations){
   mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
   let low=Infinity;
   for(let i=0;i<=30;i++){action.time=clip.duration*i/30;mixer.update(0);a.scene.updateMatrixWorld(true);
    a.scene.traverse(o=>{if(o.isMesh)low=Math.min(low,floor(o));});}
   const sink=rest-low;
   if(sink>LIMIT)deep.push(name+'.'+clip.name+' 이 '+sink.toFixed(2)+'m 더 파고든다');
  }
  mixer.stopAllAction();
 }
 assert.deepEqual(deep,[],'바닥을 뚫는 클립:\n  '+deep.join('\n  '));
});
