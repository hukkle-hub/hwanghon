/* 보스 무대 (문서 221) — 클레이브로 먼저 만든 연출 틀을 모든 필드 보스에 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as THREE from '../vendor/three/three.module.js';
import { BOSS_STAGES, stageOf, rimify, createBossStage } from '../js/mmo/boss-stage.js';
const require = createRequire(import.meta.url);

/* 가짜 DOM — 무대가 쓰는 만큼만 */
function fakeDoc() {
  const byId = {};
  const el = tag => { const e = { tag, children: [], style: {}, dataset: {}, hidden: false, innerHTML: '', textContent: '', _id: '',
    cls: new Set(), get id() { return this._id; }, set id(v) { this._id = v; byId[v] = this; },
    classList: { add: c => e.cls.add(c), remove: c => e.cls.delete(c), toggle: (c, on) => (on ? e.cls.add(c) : e.cls.delete(c)), contains: c => e.cls.has(c) },
    appendChild(c) { this.children.push(c); return c; }, getContext: () => null }; return e; };
  const doc = { head: el('head'), body: el('body'), createElement: el, getElementById: id => byId[id] || null };
  const hud = el('div'); hud.id = 'hud'; doc.body.appendChild(hud); return doc;
}
function fakeBoss(id = 'clave', o = {}) {
  const root = new THREE.Group(), model = new THREE.Group(); model.position.y = .3;
  model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial()));
  root.add(model); return { b: { id, name: '보스' + id, title: '칭호' + id }, root, model, h: 4.2, netAct: { motion: 'idle' }, ...o };
}
function rig(extra = {}) {
  const doc = fakeDoc(), played = [], cam = new THREE.PerspectiveCamera(60, 2, .1, 500), scene = new THREE.Scene(), me = new THREE.Vector3(0, 0, 40);
  cam.position.set(0, 3, 46); cam.lookAt(0, 1.5, 40);
  const S = createBossStage({ THREE, scene, cam, doc, player: () => me, sfx: () => ({ play: n => played.push(n), scene: n => played.push('scene:' + n) }), ...extra });
  const run = (sec, dt = 1 / 30) => { for (let t = 0; t < sec; t += dt) { S.tick(dt, 0); S.applyCamera(dt); } };
  return { doc, played, cam, scene, me, S, run };
}

test('설정: 지도에 있는 필드 보스 전부(모델 · 지배형)가 무대를 갖는다 — 이름·칭호는 지도 데이터가 정본', () => {
  const miss = [];
  for (const z of fs.readdirSync('maps/2d')) { let m; try { m = JSON.parse(fs.readFileSync(`maps/2d/${z}/map.json`, 'utf8')); } catch { continue; }
    for (const b of m.bosses || []) { if (!b.model && b.ai !== 'dominator') continue; const c = stageOf(b);
      if (!c) { miss.push(b.id); continue; }
      assert.equal(c.name, b.name, b.id); assert.equal(c.title, b.title || '', b.id);
      assert.ok(BOSS_STAGES[b.id] || (b.ai === 'dominator'), b.id + ' 는 색을 따로 정해야 한다 (기본값으로 흘러가지 않게)'); } }
  assert.deepEqual(miss, []);
});

test('설정: 등장 반경은 AI 공격 반경보다 크다 — 등장 장면 동안 멈춘 몸이 맞지 않게', () => {
  const claveAggro = require('../server/field-boss-combat.cjs').AGGRO;
  const domAggro = +/const AGGRO = (\d+)/.exec(fs.readFileSync('server/field-dominator.cjs', 'utf8'))[1];
  assert.ok(BOSS_STAGES.clave.introR === undefined ? 26 > claveAggro : BOSS_STAGES.clave.introR > claveAggro);
  assert.ok(stageOf({ id: 'clave', name: 'x' }).introR > claveAggro + 4, '클레이브 ' + claveAggro);
  assert.ok(stageOf({ id: 't2_x', ai: 'dominator', name: 'x' }).introR > domAggro + 4, '지배형 ' + domAggro);
  assert.equal(stageOf({ id: 't2_x', ai: 'dominator', name: 'x' }).introKey, 'dominator', '지배형 다섯은 등장 장면을 한 번만');
});

test('윤곽광: 재질을 복제하고(공유 몸 보호) 보간 법선으로 외곽만 · 반사는 요청한 보스만', () => {
  const m = fakeBoss(), src = m.model.children[0].material, env = new THREE.Texture();
  const uK = rimify(THREE, m.model, 0xffffff, .3, env, .55), mat = m.model.children[0].material;
  assert.notEqual(mat, src, '복제'); assert.equal(uK.value, .3); assert.equal(mat.envMap, env); assert.equal(mat.envMapIntensity, .55);
  const sh = { uniforms: {}, fragmentShader: '#include <common>\n#include <emissivemap_fragment>\n' }; mat.onBeforeCompile(sh);
  assert.match(sh.fragmentShader, /normalize\(vNormal\) \* faceDirection/, '법선지도 normal 이면 잔주름마다 빛나 «전기 철사» 가 됐다');
  assert.equal(sh.uniforms.uRimK, uK);
  const n = fakeBoss(); rimify(THREE, n.model, 0xffffff, .3); assert.equal(n.model.children[0].material.envMap, null, 'env 없으면 반사 없음');
});

test('등장: 반경 안 · 대기 중일 때 한 번 — 레터박스 · 몸 멈춤 · 카메라가 보스 앞으로 · 포효는 연출 시계 0.9초', () => {
  const { doc, played, cam, me, S, run } = rig(), o = fakeBoss();
  S.attach(o); assert.ok(o.stage);
  run(.2); assert.equal(S.shot, null, '40m: 아직');
  me.set(0, 0, 24); run(1 / 30); assert.equal(S.shot?.kind, 'intro'); assert.ok(S.locked); assert.ok(doc.body.cls.has('bossCine'));
  run(.6); assert.ok(!played.includes('phase'), '0.9초 전엔 포효 없음');
  run(.4); assert.ok(played.includes('phase'), '포효');
  run(.6); const d = Math.hypot(cam.position.x, cam.position.z); assert.ok(d < o.h * 2, '카메라가 보스 가까이 ' + d.toFixed(1));
  run(2.2); assert.equal(S.shot, null); assert.ok(!S.locked); assert.ok(!doc.body.cls.has('bossCine'));
  me.set(0, 0, 60); run(.1); me.set(0, 0, 20); run(.1); assert.equal(S.shot, null, '두 번 보여 주지 않는다');
  const p = fakeBoss('jeong', { netAct: { motion: 'skill' } }); S.attach(p); run(.1); assert.equal(S.shot, null, '싸우는 중(다른 사람이 끌고 있음)엔 등장 없음');
  const q = fakeBoss('nova', { netAct: undefined }); q.root.position.set(30, 0, 20); me.set(30, 0, 0); S.attach(q); run(.1); assert.equal(S.shot?.kind, 'intro', 'AI 없는 보스(netAct 없음)는 늘 대기');
});

test('이름표: 이름·칭호만 — 체력·페이즈는 보이지 않는다 (field-clave-combat 설계 규칙)', () => {
  const { doc, me, S, run } = rig(), o = fakeBoss(); S.attach(o); me.set(0, 0, 30); try { globalThis.sessionStorage = undefined; } catch {}
  o.stage && (o.stage.cfg = { ...o.stage.cfg, introR: 1 }); run(.1);
  const plate = doc.getElementById('bsPlate'); assert.ok(!plate.hidden); assert.match(plate.innerHTML, /보스clave/); assert.match(plate.innerHTML, /칭호clave/);
  assert.doesNotMatch(plate.innerHTML, /<i|phase|hp|%|\d/, plate.innerHTML);
  me.set(0, 0, 80); run(.1); assert.ok(plate.hidden, '멀어지면 숨는다');
});

test('사망: 쓰러지는 장면 → 4.9초 뒤 done · 모델 자리·기울기는 되돌린다 · 정지 모델은 기울며 주저앉는다', () => {
  const { played, me, S, run } = rig(), o = fakeBoss('arsenal', { netAct: undefined });
  S.attach(o); o.stage.cfg = { ...o.stage.cfg, introR: 0 }; me.set(0, 0, 10);
  let done = 0; S.death(o, () => done++); assert.equal(S.shot?.kind, 'death'); assert.ok(S.locked); assert.ok(played.includes('ult'));
  run(2); assert.ok(o.model.rotation.x > .2, '정지 모델: 앞으로 기운다 ' + o.model.rotation.x.toFixed(2)); assert.ok(o.model.position.y < .3);
  run(2.6); assert.equal(done, 0, '4.6초: 아직'); assert.ok(o.model.position.y < -1, '가라앉는 중');
  run(.5); assert.equal(done, 1); assert.equal(o.model.position.y, .3); assert.equal(o.model.rotation.x, 0);
  S.death(o, () => done++); run(5.2); assert.equal(done, 2, '다시 죽어도(다시 나온 뒤) 같은 길');
  let far = 0; const f = fakeBoss('leviathan'); f.root.position.set(200, 0, 0); S.attach(f); S.death(f, () => far++); assert.equal(S.shot, null, '멀면 카메라는 안 가져간다'); run(5.2); assert.equal(far, 1);
});

test('사망: 클립이 있으면 클립으로 — 클레이브(actions) · 지배형(dacts 는 무대가 돌린다)', () => {
  const { me, S } = rig(); me.set(0, 0, 10);
  const clip = new THREE.AnimationClip('death', 2.1, [new THREE.NumberKeyframeTrack('.position[y]', [0, 2.1], [0, -1])]);
  const o = fakeBoss('clave'); o.mixer = new THREE.AnimationMixer(o.model); o.actions = { death: o.mixer.clipAction(clip) }; S.attach(o); S.death(o, () => {});
  assert.ok(o.actions.death.isRunning()); assert.equal(o.actions.death.timeScale, .7); assert.equal(o.actions.death.loop, THREE.LoopOnce);
  const d = fakeBoss('t2_dominator_m', { b: { id: 't2_dominator_m', ai: 'dominator', name: '2급 지배형', title: '흑의' } }); d.dmix = new THREE.AnimationMixer(d.model); d.dacts = { death: d.dmix.clipAction(clip.clone()) };
  d.dom = { warn: { visible: true } }; S.attach(d); S.death(d, () => {}); assert.equal(d.dom.warn.visible, false, '바닥 예고는 바로 끈다'); assert.ok(d.dacts.death.isRunning());
  const t0 = d.dacts.death.time; S.tick(.1, 0); assert.ok(d.dacts.death.time > t0, '죽은 지배형은 월드 루프가 dmix 를 안 돌린다 → 무대가 돌린다');
});

test('카메라: 소품·벽에 막히면 그 앞까지 당긴다 (occlude)', () => {
  const { cam, me, S, run } = rig({ occlude: () => 1.5 }), o = fakeBoss(); S.attach(o); me.set(0, 0, 24); run(1.5);
  const look = new THREE.Vector3(0, o.h * .62, 0); assert.ok(cam.position.distanceTo(look) < 2.2, cam.position.distanceTo(look).toFixed(2));
});

test('연결: world3d 가 소리·환경맵을 싣고, 윤곽광은 예열 전에(필드 보스) · 물들인 뒤에(지배형), 연출 카메라는 placeCam 뒤에', () => {
  const w = fs.readFileSync('world3d.html', 'utf8'), src = fs.readFileSync('js/mmo/boss-stage.js', 'utf8');
  assert.match(w, /<script src="js\/sfx\.js"><\/script>/); assert.match(w, /<script src="js\/studio-env\.js"><\/script>/);
  assert.match(w, /rimify\(THREE, r, sc\.rim, sc\.rimK, sc\.env \? bossEnv\(\) : null, sc\.env\);[^\n]*\} await preCompile\(r\);/, '필드 보스: 예열 전에');
  assert.match(w, /setupDominator\(o, [^\n]*\n[^\n]*rimify\(THREE, r[^\n]*await preCompile\(r\); o\.root\.visible = true;/, '지배형: tint 복제 뒤에 · 다시 예열한 뒤 보인다');
  assert.match(w, /placeCam\(dt\);[\s\S]{0,400}STAGE\.applyCamera\(dt\);/);
  assert.match(w, /if \(STAGE && STAGE\.locked\) \{ STAGE\.skip\(\); return; \}/, '공격 단추 = 넘기기');
  assert.doesNotMatch(src, /setTimeout\s*\(/, '박자는 연출 시계로 — setTimeout 이면 느린 기기에서 카메라와 어긋난다');
});

test('사망: 떠 있던 보스는 땅으로 떨어지고(끝나면 제자리) · 긴 몸은 기울이지 않는다(꼬리가 하늘로 들린다)', () => {
  const { me, S, run } = rig(); me.set(0, 0, 10);
  const f = fakeBoss('celestial', { netAct: undefined }); f.root.position.y = 3.2; S.attach(f); S.death(f, () => {});
  run(1.2); assert.ok(f.root.position.y < .05, '떨어짐 ' + f.root.position.y.toFixed(2)); run(4); assert.equal(f.root.position.y, 3.2, '다시 나올 때 제자리');
  const L = fakeBoss('leviathan', { netAct: undefined }); L.model.children[0].geometry = new THREE.BoxGeometry(14, 3, 2); S.attach(L); assert.ok(L.stage.span > L.h, '길이 ' + L.stage.span);
  S.death(L, () => {}); run(2); assert.equal(L.model.rotation.x, 0, '긴 몸은 기울이지 않는다'); assert.ok(L.model.position.y < .3, '주저앉기는 한다');
});
