import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {runRate, groundSpeed, RUN_RATE_MIN, RUN_RATE_MAX} from '../js/locomotion.js';

/* 달리기가 미끄러지면 안 된다.
   제자리 클립이므로 «클립이 낼 수 있는 지면 속도» = 보폭 × 두 걸음 × 초당 사이클.
   그게 엔진의 이동 속도와 같아야 발이 땅을 딛는 것처럼 보인다.
   고치기 전: 2.64 vs 4.60 m/s — 이동의 43%가 스케이트였다 (docs/design/54). */
const SCALE=50;                                     /* px per m — js/game3d.js */
const FPS=120;
/* 런타임은 모델을 CHAR_SCALE 배로 키워 쓴다 — 보폭도 그만큼 커진다.
   이 값을 빼먹으면 시험이 «게임이 쓰지 않는 보폭» 을 재게 된다. */
function charScale(){
  const m=fs.readFileSync('js/game3d.js','utf8').match(/var CHAR_SCALE\s*=\s*([\d.]+)/);
  assert.ok(m, 'js/game3d.js 에 CHAR_SCALE 이 있어야 한다');
  return parseFloat(m[1]);
}

function engineSpeed(){
  const ctx={window:{}}; vm.createContext(ctx);
  for(const n of ['world','items','dungeons','dungeon','dungeon-content'])
    vm.runInContext(fs.readFileSync('js/'+n+'.js','utf8'), ctx, {filename:n});
  return ctx.window.TW_LEVELS.d01.player.speed/SCALE;
}

async function strideOf(file){
  const b=await readFile(file), l=new GLTFLoader();
  l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const root=g.scene; root.updateMatrixWorld(true);
  const bone={}; root.traverse(o=>{ if(o.isBone) bone[o.name.replace(/^mixamorig:?/,'')]=o; });
  const clip=g.animations.find(c=>c.name==='run');
  assert.ok(clip, file+' 에 run 클립이 없다');
  const mixer=new T.AnimationMixer(root), act=mixer.clipAction(clip);
  act.reset(); act.setLoop(T.LoopRepeat, Infinity); act.play();
  const N=Math.round(clip.duration*FPS), L=[], R=[];
  for(let i=0;i<=N;i++){
    mixer.setTime((i/FPS)%clip.duration); root.updateMatrixWorld(true);
    const h=bone.Hips.getWorldPosition(new T.Vector3());
    L.push(bone.LeftFoot.getWorldPosition(new T.Vector3()).sub(h));
    R.push(bone.RightFoot.getWorldPosition(new T.Vector3()).sub(h));
  }
  act.stop();
  const span=(arr,k)=>{ let mn=1e9,mx=-1e9; for(const v of arr){ mn=Math.min(mn,v[k]); mx=Math.max(mx,v[k]); } return mx-mn; };
  const k=span(L,'x')>span(L,'z')?'x':'z';           /* 진행축 = 분산이 큰 쪽 */
  return {stride:(span(L,k)+span(R,k))/2*charScale(), dur:clip.duration};
}

test('달리기가 미끄러지지 않는다 — 네 캐릭터 모두', async () => {
  /* 런타임(js/game3d.js measureRunRate)이 쓰는 것과 «같은 식» 으로 검사한다.
     위험한 건 식이 아니라 상·하한에 걸리는 경우다 — 걸리면 그만큼 미끄러진다. */
  const speed=engineSpeed(), bad=[];
  for(const c of ['ain','kain','ryu','sera']){
    const {stride,dur}=await strideOf('art/3d/'+c+'_anim.glb');
    const r=runRate(stride,dur,speed), ground=groundSpeed(stride,dur,r);
    if(r<=RUN_RATE_MIN+1e-6||r>=RUN_RATE_MAX-1e-6)
      bad.push(c+': 배속 '+r.toFixed(2)+' 가 상·하한('+RUN_RATE_MIN+'~'+RUN_RATE_MAX+')에 걸렸다 — 보폭 '+stride.toFixed(2)+'m');
    else if(Math.abs(ground-speed)>0.05)
      bad.push(c+': 지면 '+ground.toFixed(2)+' vs 엔진 '+speed.toFixed(2)+' m/s');
  }
  assert.deepEqual(bad, [], '\n'+bad.join('\n'));
});

test('보폭이 걷기 수준으로 다시 줄어들지 않는다', async () => {
  const {stride}=await strideOf('art/3d/ain_anim.glb');
  assert.ok(stride>1.15, '보폭 '+stride.toFixed(2)+' m — 이 아래면 달리기로 안 보인다 (고치기 전 1.09)');
  assert.ok(stride<1.9, '보폭 '+stride.toFixed(2)+' m — 이 위는 이 리그가 쭈그려야 나온다');
});
