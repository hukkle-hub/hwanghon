/* 기술표형 보스의 화면 (문서 222) — 서버 기술표를 그대로 읽어 클립 시각·준비 동작·번개·어둠을 그린다. 바닥 예고는 없다 (문서 224) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as THREE from '../vendor/three/three.module.js';
import { addWindRig } from '../js/mmo/windup.js';
import { setupKitMotion, applyKitAction, prepareKitMotion, updateKitMotion, hideKitMotion } from '../js/mmo/kit-motion.js';
import { SAFE } from '../js/mmo/env-rules.js';
const KIT = createRequire(import.meta.url)('../server/field-boss-kit.cjs');

function boss(id) { const scene = new THREE.Scene(), root = new THREE.Group(), model = new THREE.Group(); root.add(model); scene.add(root);
  const tr = n => new THREE.NumberKeyframeTrack('.position[x]', [0, n], [0, 1]), clips = Object.values(KIT.KITS[id].skills).map(s => new THREE.AnimationClip(s.clip, s.clip === 'atk_s09frenzy' ? 4.03 : 5.23, [tr(4)]));
  clips.push(new THREE.AnimationClip('idle', .83, [tr(.83)]), new THREE.AnimationClip('walk', .83, [tr(.83)]), new THREE.AnimationClip('death', 2.1, [tr(2.1)]));
  const o = { b: { id }, root, model }; setupKitMotion(o, { animations: clips }, model, scene, KIT.KITS[id]); o.h = 2; addWindRig(THREE, o); return o; }
const act = (o, skill, extra = {}) => ({ id: o.b.id, ai: 'kit', x: 0, z: 0, yaw: 0, motion: 'skill', skill, seq: 7, startedAt: 1000, endsAt: 9000, fromX: 0, fromZ: 0, shift: 0, counterOpen: 0, counterClose: 0, ...extra });

test('reaction clips use server time, replay repeated hits and hold down until getup', () => {
 const scene=new THREE.Scene(),root=new THREE.Group(),model=new THREE.Group(),bone=new THREE.Bone();bone.name='ReactionBone';model.add(bone);root.add(model);scene.add(root);
 const clip=(name,to)=>new THREE.AnimationClip(name,1,[new THREE.VectorKeyframeTrack('ReactionBone.position',[0,1],[0,0,0,to,0,0])]);
 const names=['stagger','hit','cancel','dodge','down','getup'];
 const kit={skills:{},idleClip:'custom_idle',reactionClips:{cancel:'custom_cancel'}};
 const gl={animations:[clip('custom_idle',0),...names.map((n,i)=>clip(n==='cancel'?'custom_cancel':n,i+1))]};
 const o={b:{id:'reaction-test'},root,model};setupKitMotion(o,gl,model,scene,kit);
 let seq=0;
 for(const motion of names){
  const a={motion,seq:++seq,startedAt:1000,x:0,z:0,yaw:0};applyKitAction(o,a,1500);
  prepareKitMotion(o,1500);o.mixer.update(.2);
  assert.equal(o.kfx.clip.getClip().name,motion==='cancel'?'custom_cancel':motion);
  assert.ok(Math.abs(bone.position.x-(names.indexOf(motion)+1)*.5)<1e-6,'evaluated mesh rig must match late snapshot');
  prepareKitMotion(o,9000);o.mixer.update(.2);
  assert.ok(Math.abs(bone.position.x-(names.indexOf(motion)+1))<1e-6,'reaction end holds, no loop to idle');
 }
 applyKitAction(o,{motion:'stagger',seq:++seq,startedAt:10000,x:0,z:0,yaw:0},10000);prepareKitMotion(o,10500);o.mixer.update(.2);
 applyKitAction(o,{motion:'stagger',seq:++seq,startedAt:10500,x:0,z:0,yaw:0},10500);prepareKitMotion(o,10600);o.mixer.update(.2);
 assert.ok(Math.abs(bone.position.x-.1)<1e-6,'second hit restarts instead of staying clamped or fading itself out');
 const current=o.netAct;applyKitAction(o,{...current,seq:seq-1,motion:'down'},10650);assert.equal(o.netAct,current);
 o.stage={dying:true};const time=o.kfx.clip.time;prepareKitMotion(o,12000);assert.equal(o.kfx.clip.time,time,'death owns the pose');
});

test('missing reaction falls back to configured idle without inventing a clip',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),model=new THREE.Group();root.add(model);scene.add(root);
 const idle=new THREE.AnimationClip('custom_idle',1,[]),o={b:{id:'reaction-test'},root,model};
 setupKitMotion(o,{animations:[idle]},model,scene,{skills:{missing:{clip:'absent',hits:[]}},idleClip:'custom_idle'});
 applyKitAction(o,{motion:'skill',skill:'missing',seq:1,startedAt:0},0);assert.equal(o.kfx.clip.paused,true);
 applyKitAction(o,{motion:'down',seq:2,startedAt:0},0);prepareKitMotion(o,500);
 assert.equal(o.kfx.clip.getClip().name,'custom_idle');assert.equal(o.kfx.clip.paused,false);
 assert.equal(o.kacts.down,undefined,'fallback is not an implemented knockdown');
});

test('countered dive recovers from its current height without a one-frame teleport',()=>{
 const o=boss('celestial2'),a=act(o,'dive');applyKitAction(o,a,1000);updateKitMotion(o,.016,2500);
 const y=o.model.position.y;assert.ok(Math.abs(y+3.4)<1e-9);
 applyKitAction(o,{...a,seq:8,motion:'stagger',startedAt:2500},2500);updateKitMotion(o,.016,2500);assert.equal(o.model.position.y,y);
 updateKitMotion(o,.016,2640);assert.ok(Math.abs(o.model.position.y-y/2)<1e-6);
 updateKitMotion(o,.016,2780);assert.equal(o.model.position.y,0);assert.equal(o.kfx.liftReturn,null);
 hideKitMotion(o);assert.equal(o.kfx.liftReturn,null);
});

test('stale snapshots cannot undo stagger or death; explicit hide permits the new lifecycle',()=>{
 const o=boss('shadowfang');const s=act(o,'thrust');applyKitAction(o,s,1000);
 applyKitAction(o,{...s,motion:'stagger',seq:8},2200);applyKitAction(o,s,2300);assert.equal(o.netAct.motion,'stagger');
 o.stage={dying:{t:0}};applyKitAction(o,{...s,seq:9},2400);assert.equal(o.netAct.motion,'stagger');
 o.stage.dying=null;hideKitMotion(o);applyKitAction(o,{...s,seq:1},4000);assert.equal(o.netAct.seq,1);
});
test('mid-skill join does not replay past impact effects; the next current beat still fires once',()=>{
 const o=boss('subject09');applyKitAction(o,act(o,'frenzy'),3000);
 let e=updateKitMotion(o,.016,3400);assert.equal(e.impact,undefined,'old 550/850/1950/2200 impacts are expired or light');
 assert.ok(o.kfx.ringPool.every(r=>!r.active));
 e=updateKitMotion(o,.016,3500);assert.equal(e.impact,true,'current final hit');
 e=updateKitMotion(o,.016,3516);assert.equal(e.impact,undefined,'no duplicate');
 const old=boss('arsenal');applyKitAction(old,act(old,'battery'),9000);e=updateKitMotion(old,.016,9000);assert.equal(e.impact,undefined);
});

/* 바닥 예고가 없다 = 기술 도중 장면에 보이는 메시가 하나도 없다 (몸은 Group 뿐인 가짜) */
const shown = scene => { let n = 0; scene.traverse(m => { if (m.isMesh && m.visible && m.material && m.material.opacity > 0) n++; }); return n; };

test('리듬 깨기: 멈춤(1.1 s) 뒤 클립은 shift 만큼 멈춤 자세를 붙들고, 준비 동작(감기)도 그만큼 밀린다', () => {
  const o = boss('subject09'); applyKitAction(o, act(o, 'frenzy', { shift: 400 }), 1000); const a = o.kacts.atk_s09frenzy;
  prepareKitMotion(o, 1000 + 1300); assert.ok(Math.abs(a.time - 1.1) < 1e-6, '1.3 s 인데 1.1 s 자세 ' + a.time);
  prepareKitMotion(o, 1000 + 2000); assert.ok(Math.abs(a.time - 1.6) < 1e-6);
  updateKitMotion(o, .016, 1000 + 1900); const late = o.wind.g.rotation.y;
  const b = boss('subject09'); applyKitAction(b, act(b, 'frenzy', { shift: 0 }), 1000); updateKitMotion(b, .016, 1000 + 1900); const full = b.wind.g.rotation.y;
  assert.ok(full > .4, '안 밀리면 1.9 s 에 다 감겼다 ' + full); assert.ok(late < full - .1, '밀리면 아직 감는 중 ' + late);
  assert.ok(o.kfx.telling, '박자는 센다(기합음)');
});

test('방전 폭우: 대상 자리 원은 없다 — 하늘이 어두워지고 젖힘 준비 뒤 판정 순간 번개만 · 새 박자마다 소리 이벤트', () => {
  const o = boss('subject09'), scene = o.root.parent, marks = [[5, 6], [7, 8]]; applyKitAction(o, act(o, 'storm', { marks }), 1000);
  let ev = updateKitMotion(o, .016, 1000 + 900); assert.ok(o.wind.g.rotation.x < -.15, '젖힌다 ' + o.wind.g.rotation.x); assert.equal(shown(scene), 0, '바닥에 아무것도');
  ev = updateKitMotion(o, .016, 1000 + 1700); assert.equal(shown(scene), 0, '표식 없음'); assert.ok(ev.tele, '새 표식 소리');
  ev = updateKitMotion(o, .016, 1000 + 2810); assert.ok(ev.impact); assert.deepEqual(ev.bolt, [5, 6]); assert.ok(o.kfx.bolts.some(b => b.m.visible && b.m.position.x === 5), '번개(공격 자체)는 그린다');
  assert.ok(o.kfx.dim > .5, '하늘이 어둡다 ' + o.kfx.dim); hideKitMotion(o); assert.equal(o.kfx.dim, 0); assert.equal(o.wind.g.rotation.x, 0, '숨기면 몸 틀도 제자리');
});

test('기술표형 보스 전부: 어떤 기술의 어떤 순간에도 바닥 예고 메시가 없다 · 판정 전에는 몸 틀이 움직인다', () => {
  for (const id of Object.keys(KIT.KITS)) for (const [name, sk] of Object.entries(KIT.KITS[id].skills)) {
    if (['leviathan', 'aegis', 'celestial2', 'arsenal', 'nova'].includes(id)) continue; // mechanical clips/volumes are tested below, not humanoid squash
    const o = boss(id), scene = o.root.parent; applyKitAction(o, act(o, name, { marks: [[3, 3]] }), 1000); let moved = 0;
    for (let t = 0; t < sk.duration; t += 50) { updateKitMotion(o, .016, 1000 + t); const g = o.wind.g; if (t < sk.hits[0].at) moved = Math.max(moved, Math.abs(g.rotation.x) + Math.abs(g.rotation.y) + Math.abs(1 - g.scale.y)); assert.equal(g.position.y, 0, `${id}.${name}: 틀을 내리면 발이 묻힌다`);
      for (const b of [...o.kfx.bolts, ...o.kfx.ringPool]) b.m.visible = false;   /* 번개·충격파는 판정 «뒤» 의 공격 그 자체 */
      assert.equal(shown(scene), 0, `${id}.${name} ${t} ms 에 바닥 표시`); }
    assert.ok(moved > .05, `${id}.${name}: 첫 판정 전 준비 동작이 없다 ${moved}`); }
});

test('기계형 5종: 몸을 눌러 늘리지 않고 포구/코어만 예열 · 고정 몸 방향 유지 · 숨김 즉시 효과 제거', () => {
  for (const id of ['leviathan', 'aegis', 'celestial2', 'arsenal', 'nova']) {
    const o = boss(id), name = Object.keys(KIT.KITS[id].skills)[0];
    applyKitAction(o, act(o, name, { yaw: 1.2 }), 1000); updateKitMotion(o, .05, 1500);
    assert.deepEqual(o.wind.g.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(o.wind.g.rotation.toArray().slice(0, 3), [0, 0, 0]);
    if (KIT.KITS[id].stationary) assert.equal(o.root.rotation.y, 0);
    assert.ok(o.kfx.attackFX.group.children.some(m => m.visible), id + ' has no charge');
    for (const m of o.kfx.attackFX.group.children.filter(m => m.visible)) assert.ok(m.position.y > .3, id + ' floor warning');
    hideKitMotion(o); assert.ok(o.kfx.attackFX.group.children.every(m => !m.visible));
  }
});

test('셀레스티얼: 원래 비행 높이 3.4m를 빼고 착지한 뒤 원 높이로 복귀', () => {
  const o = boss('celestial2'); o.root.position.y = o.b.fly = 3.4;
  applyKitAction(o, act(o, 'dive'), 1000); updateKitMotion(o, .05, 2500);
  assert.ok(Math.abs(o.root.position.y + o.model.position.y) < 1e-6);
  const beam = o.kfx.attackFX.pool[0].beam;
  assert.equal(beam.geometry.parameters.openEnded, true, 'closed beam cap must not fill the target camera');
  assert.ok(beam.material.opacity <= .22, 'impact preserves target visibility');
  assert.ok(Math.abs(beam.position.y - (o.h * .55 + .65) / 2) < 1e-6, 'attack origin follows grounded body, not original flight height');
  updateKitMotion(o, .05, 4800); assert.equal(o.model.position.y, 0);
});

test('고정 사출: 서버가 잠근 표적에 예열 결정 → 타격 · 현재 플레이어 위치로 이동하지 않는다', () => {
  const o = boss('arsenal'); applyKitAction(o, act(o, 'suppression', { marks: [[8, 6]] }), 1000);
  updateKitMotion(o, .05, 2000); const shard = o.kfx.attackFX.pool[0].shard;
  assert.ok(shard.visible); assert.equal(shard.position.x, 8); assert.equal(shard.position.z, 6); assert.ok(shard.position.y > 1);
  updateKitMotion(o, .05, 3300); assert.ok(o.kfx.attackFX.pool[0].wave.visible);
  assert.ok(o.kfx.bolts.every(b => !b.m.visible), 'dedicated artillery must not also draw lightning');
  assert.ok(o.kfx.ringPool.every(b => !b.m.visible), 'dedicated volumes must not draw an unrelated circular hit');
  o.stage = { dying: true }; updateKitMotion(o, .05, 3320); assert.ok(o.kfx.attackFX.group.children.every(m => !m.visible));
});

test('섀도우 팽: 번개 풀을 만들지 않는다 (atTarget 판정이 없는 보스) · 떠오름은 몸만 올린다', () => {
  const o = boss('shadowfang'); assert.equal(o.kfx.bolts.length, 0); applyKitAction(o, act(o, 'flurry'), 1000); updateKitMotion(o, .016, 1000 + 2600);
  assert.ok(Math.abs(o.model.position.y - 2.4) < 1e-6); assert.equal(o.root.position.y, 0, '판정 자리(root)는 땅에');
});

test('정 장관: 대기·처치는 전용 클립 · 등 뒤 베기는 감았다가(0.12~0.45 s) 판정 뒤 제자리', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), model = new THREE.Group(); root.add(model); scene.add(root);
  const tr = n => new THREE.NumberKeyframeTrack('.position[x]', [0, n], [0, 1]), names = ['idle', 'walk', 'death', 'idle_jeong', 'death_jeong', ...Object.values(KIT.KITS.jeong.skills).map(s => s.clip)];
  const o = { b: { id: 'jeong' }, root, model, h: 2 }; setupKitMotion(o, { animations: names.map(n => new THREE.AnimationClip(n, 1.5, [tr(1.5)])) }, model, scene, KIT.KITS.jeong); addWindRig(THREE, o);
  assert.equal(o.kfx.clip.getClip().name, 'idle_jeong'); assert.equal(o.deathClip.name, 'death_jeong'); assert.equal(o.kfx.warning, undefined, '예고판 자체가 없다');
  applyKitAction(o, act(o, 'back', { yaw: .4 }), 1000); updateKitMotion(o, .016, 1000 + 400); assert.ok(o.wind.g.rotation.y > .3, '감는다 ' + o.wind.g.rotation.y);
  updateKitMotion(o, .016, 1000 + 900); assert.equal(o.wind.g.rotation.y, 0, '터진 뒤 제자리');
});

test('정지 모델 다섯: 클립이 하나도 없어도 기술표가 붙고(준비 동작·가슴 빛·낙뢰) 오류 없이 돈다 · 노바 고리 안쪽은 env-rules SAFE.r 과 같다', () => {
  for (const id of ['leviathan', 'aegis', 'celestial2', 'arsenal', 'nova']) {
    const scene = new THREE.Scene(), root = new THREE.Group(), model = new THREE.Group(); root.add(model); scene.add(root);
    const o = { b: { id }, root, model, h: 4 }; setupKitMotion(o, { animations: [] }, model, scene, KIT.KITS[id]); addWindRig(THREE, o);
    assert.equal(o.kfx.clip, null, id + ': 클립 없음'); assert.equal(o.deathClip, null);
    for (const [name, sk] of Object.entries(KIT.KITS[id].skills)) { applyKitAction(o, act(o, name, { marks: [[3, 3]] }), 1000); 
      for (let t = 0; t < sk.duration; t += 100) { prepareKitMotion(o, 1000 + t); updateKitMotion(o, .016, 1000 + t); }
      hideKitMotion(o); } }   /* 준비 동작·효과 모양은 GPT 가지 시험(static-boss 쪽)이 본다 — 여기는 클립 없이도 안 터지는가만 */
  for (const h of KIT.KITS.nova.skills.orbit.hits) { assert.equal(h.shape, 'annulus'); assert.equal(h.inner, SAFE.r, '노바 고리 안쪽 = 안전지대 반지름'); }
});
