/* 구운 캐릭터 에셋의 두 결함 — 디렉터가 확대해서 짚어 준 것들 (docs/design/33 §4).
   1) 아인·카인의 idle·run 에서 오른팔이 몸을 가로질러 왼쪽으로 넘어간다
      → 메뉴에서 늘 «오른팔 없음», 무기는 «왼손 옆에 떠 있음»
   2) 캐릭터 GLB 가 metalness=1·roughness=1(glTF 규격 기본값)로 나와
      피부까지 순수 금속으로 그려진다 → «얼굴 일그러짐»
   굽는 쪽(tools/3d/)이 고쳐지면 보정막은 아무 일도 하지 않아야 한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinBind,repairAinClips} from '../js/ain-bind-repair.js';

/* 브라우저 스크립트(IIFE)를 그대로 평가해 globalThis 에 올린다 — 브라우저·node 가 같은 파일을 쓴다 */
async function loadShim(path){ new Function(await readFile(path,'utf8'))(); }
await loadShim('js/pose-fix.js');
await loadShim('js/mat-fix.js');
const {TW_POSE,TW_MATFIX}=globalThis;
assert.ok(TW_POSE&&TW_MATFIX,'보정막이 globalThis 에 올라온다');

async function load(char){
  const b=await readFile(`art/3d/${char}_anim.glb`), l=new GLTFLoader();
  l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
  return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
}
const strip=n=>n.replace(/^mixamorig:?/,'');
function handX(root, mixer, clip){
  if(clip){ mixer.stopAllAction(); mixer.clipAction(clip).reset().play(); mixer.setTime(0); }
  root.updateMatrixWorld(true);
  let v=null; root.traverse(o=>{ if(o.isBone&&strip(o.name)==='RightHand'){ const p=new T.Vector3(); o.getWorldPosition(p); v=p.x; } });
  return v;
}
const clipsOf=g=>Object.fromEntries(g.animations.map(c=>[c.name,c]));

test('아인: idle·run 의 오른팔이 몸을 가로지른다 — 보정막이 되돌린다',async t=>{
 const g=await load('ain'), before=clipsOf(g), mixer=new T.AnimationMixer(g.scene);
 const rest=handX(g.scene,mixer,null);
 assert.ok(rest<0,'바인드에서 오른손은 -x 쪽 ('+rest.toFixed(3)+')');
 assert.ok(handX(g.scene,mixer,before.idle)>0,'고치기 전 idle 은 반대쪽에 있다');
 assert.ok(handX(g.scene,mixer,before.run)>0,'고치기 전 run 도 반대쪽');
 assert.ok(handX(g.scene,mixer,before.walk)<0,'walk 는 원래 정상 — 기준으로 쓴다');

 const rep=TW_POSE.repair(T,g);
 /* 깨진 것만 고친다 — idle2 는 원래 멀쩡해서 목록에 없다 */
 assert.deepEqual(rep.fixed.sort(),['idle','run'],'고친 목록');
 rep.checked.forEach(c=>{ if(c.rest*c.x<0) assert.ok(rep.fixed.includes(c.clip), c.clip+' 은 뒤집혀 있었으니 고쳐야 한다'); });
 /* 함정: 클립을 갈아 끼워도 «이미 만들어진» AnimationAction 은 옛 트랙을 붙들고 있다.
    그래서 보정은 반드시 믹서보다 먼저 돌아야 한다 (viewer·game3d 둘 다 그 순서다). */
 const after=clipsOf(g), fresh=new T.AnimationMixer(g.scene);
 for(const n of rep.fixed) assert.ok(handX(g.scene,fresh,after[n])<0, n+' 이 오른쪽으로 돌아왔다');
 assert.ok(handX(g.scene,fresh,after.walk)<0,'기준 클립은 그대로');
});

test('카인도 같은 결함 — 류·세라는 멀쩡하니 건드리지 않는다',async t=>{
 const kain=await load('kain');
 assert.ok(TW_POSE.repair(T,kain).fixed.length>0,'카인은 고칠 것이 있다');
 for(const ch of ['ryu','sera']){
  const g=await load(ch), rep=TW_POSE.repair(T,g);
  assert.deepEqual(rep.fixed,[],ch+' 는 멀쩡하다 — 보정막이 손대면 안 된다');
  assert.ok(rep.checked.length>0, ch+' 도 검사는 했다');
 }
});

test('보정막은 두 번 돌려도 같은 결과다 (게임은 GPT 의 바인드 교정과 함께 돈다)',async t=>{
 const g=await load('ain'), mixer=new T.AnimationMixer(g.scene);
 TW_POSE.repair(T,g);
 const once=handX(g.scene,mixer,clipsOf(g).idle);
 const second=TW_POSE.repair(T,g);
 assert.deepEqual(second.fixed,[],'이미 고쳤으면 다시 고칠 것이 없다');
 assert.equal(handX(g.scene,mixer,clipsOf(g).idle), once);

 /* game3d 의 순서: 보정막 → repairAinClips(repairAinBind) */
 g.animations=repairAinClips(g.animations, repairAinBind(g.scene));
 const mixer2=new T.AnimationMixer(g.scene);
 assert.ok(handX(g.scene,mixer2,clipsOf(g).idle)<0,'두 교정을 겹쳐도 오른팔은 오른쪽에 남는다');
 assert.ok(handX(g.scene,mixer2,clipsOf(g).run)<0);
});

test('캐릭터 재질이 순수 금속으로 구워져 나온다 — 피부로 되돌린다',async t=>{
 const g=await load('ain'); const mats=[];
 g.scene.traverse(o=>{ if(o.isMesh||o.isSkinnedMesh) mats.push(o.material); });
 assert.ok(mats.length>0);
 assert.ok(mats.every(m=>m.metalness===1&&m.roughness===1),'구워진 그대로는 metal 1 / rough 1');

 const r=TW_MATFIX.repair(T,g.scene);
 assert.equal(r.materials,mats.length,'전부 고쳤다');
 assert.ok(mats.every(m=>m.metalness===0),'피부·천은 금속이 아니다');
 assert.ok(mats.every(m=>m.roughness>0.5&&m.roughness<1));

 const again=TW_MATFIX.repair(T,g.scene);
 assert.equal(again.materials,0,'두 번째에는 고칠 것이 없다');
 assert.equal(again.skipped,mats.length,'일부러 금속으로 만든 재질은 건드리지 않는다');
});
