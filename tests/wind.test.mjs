/* 바람 — 머리카락·옷자락이 흔들린다. 던전마다 다른 공기 (docs/design/33 §5).
   흔들림은 눈으로만 확인하면 «흔들리는 것 같다» 로 끝난다.
   여기서는 굳기 가중치 aFlex 를 직접 세어서 «머리카락과 옷자락에만, 충분히» 붙었는지 본다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';

async function loadShim(p){ new Function(await readFile(p,'utf8'))(); }
await loadShim('js/wind.js');
const {TW_WIND}=globalThis, PROF=TW_WIND.PROFILE;
assert.ok(TW_WIND,'바람이 globalThis 에 올라온다');

async function load(char){
  const b=await readFile(`art/3d/${char}_anim.glb`), l=new GLTFLoader();
  l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
  return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
}
const CHARS=['ain','kain','ryu','sera'];
const strip=n=>n.replace(/^mixamorig:?/,'');

test('네 캐릭터 모두 머리카락·옷자락이 «눈에 보일 만큼» 흔들린다',async()=>{
 /* 정점 «개수» 만 세면 속는다 — 처음 판이 그랬다. 3백 개가 넘게 걸렸지만
    최대 자유도가 0.095 여서 머리카락이 3mm 움직였고, 화면에선 아무 일도 없었다.
    그래서 여기서는 개수와 «세기» 를 함께 못박는다. */
 for(const c of CHARS){
  const g=await load(c); TW_WIND.prepare(T,g.scene);
  let hips=null, head=null;
  g.scene.updateMatrixWorld(true);
  g.scene.traverse(o=>{ if(!o.isBone) return; const n=strip(o.name);
   if(n==='Hips') hips=o.getWorldPosition(new T.Vector3());
   if(n==='Head') head=o.getWorldPosition(new T.Vector3()); });
  const hair=[], cloth=[]; let rigid=0;
  g.scene.traverse(o=>{
   const a=o.isSkinnedMesh&&o.geometry.getAttribute('aFlex'); if(!a) return;
   const p=o.geometry.attributes.position;
   for(let i=0;i<a.count;i++){ const f=a.getX(i); if(f<=0.02){ rigid++; continue; }
     (p.getY(i)>hips.y?hair:cloth).push(f); } });
  const max=v=>Math.max(...v);
  assert.ok(hair.length>=400,`${c}: 머리카락 ${hair.length} 정점`);
  assert.ok(cloth.length>=1000,`${c}: 옷자락 ${cloth.length} 정점`);
  /* 자유도가 아니라 «몇 cm 움직이나» 로 못박는다 — 화면에서 보이는 건 그것뿐이다.
     강풍(고가) 돌풍 정점 기준. 머리는 짧은 머리라 옷자락보다 훨씬 작게 움직인다. */
  const peak=PROF.road.amp*PROF.road.gust[1], cm=f=>f*peak*100;
  assert.ok(cm(max(hair))>2.5,`${c}: 강풍에서 머리칼 끝 ${cm(max(hair)).toFixed(1)}cm`);
  assert.ok(cm(max(hair))<6.0,`${c}: 머리칼이 ${cm(max(hair)).toFixed(1)}cm — 두피에서 떨어진다`);
  assert.ok(cm(max(cloth))>7.0,`${c}: 강풍에서 옷자락 끝 ${cm(max(cloth)).toFixed(1)}cm`);
  assert.ok(max(cloth)>max(hair)*2,`${c}: 옷자락이 머리칼보다 크게 일렁인다`);
  assert.ok(rigid>hair.length+cloth.length,`${c}: 몸통·팔은 굳어 있다 (고정 ${rigid})`);
 }
});

test('얼굴은 절대 움직이지 않는다 — 디렉터가 짚은 «얼굴 일그러짐» 의 재발 방지',async()=>{
 /* 머리 껍질을 통째로 기울이는 방식이라, 얼굴을 빼지 않으면 이목구비가 밀린다.
    앞쪽(발끝 방향) 원뿔 안, 정수리 아래는 자유도가 0 이어야 한다. */
 for(const c of CHARS){
  const g=await load(c); TW_WIND.prepare(T,g.scene);
  g.scene.updateMatrixWorld(true);
  let head=null,toe=null,foot=null;
  g.scene.traverse(o=>{ if(!o.isBone) return; const n=strip(o.name);
   if(n==='Head') head=o.getWorldPosition(new T.Vector3());
   if(n==='LeftToeBase') toe=o.getWorldPosition(new T.Vector3());
   if(n==='LeftFoot') foot=o.getWorldPosition(new T.Vector3()); });
  const fz=(toe&&foot&&toe.z-foot.z<0)?-1:1;
  /* 앞뒤는 «머리에 붙은 정점» 의 무게중심 기준 — 관절 기준으로 재면 세라는
     머리통이 목보다 6cm 앞에 있어 뒤통수까지 «앞» 이 된다 */
  let crown=-Infinity, hz=0, hn=0;
  g.scene.traverse(o=>{ if(!o.isSkinnedMesh||!o.geometry.getAttribute('aFlex')) return;
   const p=o.geometry.attributes.position, si=o.geometry.attributes.skinIndex, sw=o.geometry.attributes.skinWeight, bo=o.skeleton.bones;
   for(let i=0;i<p.count;i++){ crown=Math.max(crown,p.getY(i));
    let bi=0,bw=-1; for(let k=0;k<4;k++){ const w=sw.getComponent(i,k); if(w>bw){ bw=w; bi=si.getComponent(i,k); } }
    if(strip(bo[bi].name)==='Head'){ hz+=p.getZ(i); hn++; } } });
  hz=hn?hz/hn:head.z;
  let face=0, worst=0;
  g.scene.traverse(o=>{
   const a=o.isSkinnedMesh&&o.geometry.getAttribute('aFlex'); if(!a) return;
   const p=o.geometry.attributes.position;
   for(let i=0;i<a.count;i++){
    const y=p.getY(i), z=p.getZ(i), r=Math.hypot(p.getX(i)-head.x,y-head.y,z-head.z);
    if(r>0.22) continue;                          /* 머리 둘레 안쪽만 본다 */
    if((z-hz)*fz < 0.045) continue;                /* 무게중심보다 확실히 앞쪽인 것만 */
    if(y > head.y+(crown-head.y)*0.72) continue;  /* 이마 위 앞머리는 흔들려도 된다 */
    face++; worst=Math.max(worst,a.getX(i)); } });
  assert.ok(face>30,`${c}: 얼굴 정점을 ${face}개 찾았다 (검사가 헛돌지 않는다)`);
  assert.ok(worst<0.02,`${c}: 얼굴 최대 자유도 ${worst.toFixed(4)} — 굳어 있어야 한다`);
 }
});

test('던전마다 다른 공기 — 세기·방향·돌풍이 겹치지 않는다',async()=>{
 const ids=Object.keys(TW_WIND.PROFILE);
 assert.ok(ids.length>=7,'던전 7곳의 공기가 정의되어 있다');
 const seen=new Set();
 for(const id of ids){ const p=TW_WIND.PROFILE[id];
  assert.ok(p.name&&p.amp>0&&p.freq>0,id+': 이름·세기·주기가 있다');
  const key=[p.amp,p.freq,p.dir[0],p.dir[1]].join('/');
  assert.ok(!seen.has(key),id+': 다른 던전과 같은 바람이 아니다'); seen.add(key);
 }
 /* 고가의 강풍이 가장 세고, 봉쇄 병동이 가장 잔잔하다 — 던전 성격이 수치로 드러난다 */
 const amps=ids.map(i=>[i,TW_WIND.PROFILE[i].amp]).sort((a,b)=>b[1]-a[1]);
 assert.equal(amps[0][0],'road');
 assert.equal(amps[amps.length-1][0],'ward');
 assert.equal(TW_WIND.profile('없는던전').name, TW_WIND.DEFAULT.name,'모르는 던전은 기본 공기');
});

test('바람은 캐릭터가 돌아도 제 방향을 지킨다',async()=>{
 const g=await load('ain'); TW_WIND.prepare(T,g.scene);
 const h=TW_WIND.bind(T,g.scene,TW_WIND.profile('road'));
 assert.ok(h.bound>0,'재질이 바람에 묶였다');
 const root=new T.Object3D(); root.add(g.scene);
 root.updateMatrixWorld(true); h.update(0.016,root);
 const a=h.uniforms.uWind.value.clone();
 root.rotation.y=Math.PI/2; root.updateMatrixWorld(true); h.update(0,root);
 const b=h.uniforms.uWind.value.clone();
 assert.ok(a.distanceTo(b)>1e-4,'물체 공간 벡터는 회전에 따라 달라진다');
 assert.ok(Math.abs(a.length()-b.length())<1e-6,'세기는 그대로 — 방향만 돌아간다');
});

test('돌풍은 주기마다 부풀었다 가라앉는다',async()=>{
 const g=await load('sera'); TW_WIND.prepare(T,g.scene);
 const prof=TW_WIND.profile('marsh'), h=TW_WIND.bind(T,g.scene,prof);
 const o=new T.Object3D(); o.add(g.scene); o.updateMatrixWorld(true);
 let lo=Infinity, hi=0;
 for(let i=0;i<Math.ceil(prof.gust[0]/0.05);i++){ h.update(0.05,o);
   const L=h.uniforms.uWind.value.length(); lo=Math.min(lo,L); hi=Math.max(hi,L); }
 assert.ok(hi/lo>1.5,`한 주기 안에서 세기가 ${(hi/lo).toFixed(1)}배 오르내린다`);
 assert.ok(hi<=prof.amp*prof.gust[1]+1e-6,'최대치는 돌풍 배율을 넘지 않는다');
});

test('흔들 것이 없는 물체는 건드리지 않는다',async()=>{
 const g=new T.Group(), m=new T.Mesh(new T.BoxGeometry(1,1,1), new T.MeshStandardMaterial());
 g.add(m); const before=m.material;
 const made=TW_WIND.prepare(T,g);
 assert.equal(made,0,'스킨 없는 물체는 준비 대상이 아니다');
 assert.equal(TW_WIND.bind(T,g,TW_WIND.profile('road')).bound,0,'묶을 재질도 없다');
 assert.equal(m.material,before,'재질을 복제하지 않는다');
});
