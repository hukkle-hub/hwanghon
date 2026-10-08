/* 3D 필드 (문서 206) — 굽기 원본 장면을 실시간으로 쓸 때 필요한 두 부품: 정적 합치기 · 걷기 충돌.
   합치기는 «같은 재질 · 같은 칸» 끼리만, 카메라 막이 상자는 합치기 전에 모은다. 충돌은 2D 필드(mmo.html)와 같은 규칙. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
const { mergeStatic, firstHit } = await import('../js/mmo/static-merge.js');
const { createCollide } = await import('../js/mmo/field-collide.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const boxAt = (scene, mat, x, z, h = 1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, h, 1), mat); m.position.set(x, h / 2, z); scene.add(m); return m; };

test('정적 합치기: 같은 설정의 재질 · 같은 48 m 칸끼리 한 메시로, 칸이 다르면 따로 — 모양(정점 수)은 그대로', () => {
  const s = new THREE.Scene(), a = new THREE.MeshStandardMaterial({ color: 0x806040 }), a2 = new THREE.MeshStandardMaterial({ color: 0x806040 }), b = new THREE.MeshStandardMaterial({ color: 0x204060 });
  boxAt(s, a, 1, 1); boxAt(s, a2, 3, 1); boxAt(s, a, 5, 2);   /* 같은 값 재질 둘 → 하나로 */
  boxAt(s, a, 100, 1);                                          /* 다른 칸 */
  boxAt(s, b, 2, 2);                                            /* 다른 재질 혼자 */
  const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .3 }); boxAt(s, glass, 1, 5); boxAt(s, glass, 2, 5);
  const verts = o => o.geometry.attributes.position.count; let v0 = 0; s.traverse(o => { if (o.isMesh) v0 += verts(o); });
  const r = mergeStatic(s); let v1 = 0, meshes = []; s.traverse(o => { if (o.isMesh) { v1 += verts(o); meshes.push(o); } });
  assert.equal(r.before, 7); assert.equal(meshes.length, 4, '같은 칸 같은 재질 3 → 1, 유리 2 → 1, 다른 칸 1, 다른 재질 1');
  assert.equal(v1, v0, '합쳐도 정점 수는 같다');
  const big = meshes.find(m => m.name === 'merged' && !m.material.transparent); big.geometry.computeBoundingBox();
  assert.ok(Math.abs(big.geometry.boundingBox.max.x - 5.5) < 1e-6 && Math.abs(big.geometry.boundingBox.min.x - 0.5) < 1e-6, '월드 자리로 옮겨 합쳤다');
  assert.ok(r.dedup >= 1, '같은 값 재질을 하나로');
});

test('카메라 막이: 높이 1.2 m 넘는 것만 모으고, 머리→카메라 사이에 있으면 그 앞까지 당긴다', () => {
  const s = new THREE.Scene(), m = new THREE.MeshStandardMaterial();
  boxAt(s, m, 0, -3, 6); boxAt(s, m, 4, 0, 0.4);   /* 벽 · 낮은 턱 */
  const r = mergeStatic(s); assert.equal(r.camBoxes.length, 1, '낮은 턱은 카메라를 막지 않는다');
  const head = new THREE.Vector3(0, 1.5, 0);
  const d = firstHit(r.camBoxes, head, new THREE.Vector3(0, 2, -6)); assert.ok(d < 2.5 && d > 0.6, '벽 앞에서 멈춘다 ' + d);
  assert.equal(firstHit(r.camBoxes, head, new THREE.Vector3(0, 2, 5)), Infinity, '반대쪽은 막힘 없음');
});

test('걷기 충돌: 띠 밖으로 못 나가고, 상자·건물 윤곽 안으로 못 들어간다 — 2D 필드와 같은 규칙(같은 함수 본문)', () => {
  const C = createCollide({ road: { ang: 0.3 }, walk: { s0: -20, s1: 20, t0: -10, t1: 10 }, blockers: [{ x: 0, z: 0, hw: 2, hd: 1, rot: 0.4 }, { poly: [[8, -2], [12, -2], [12, 2], [8, 2]] }] });
  for (let i = 0; i < 400; i++) { const p = { x: (Math.random() - .5) * 60, z: (Math.random() - .5) * 60 }; C.collide(p); const [s, t] = C.toRoad(p.x, p.z);
    assert.ok(s >= -20 - 1e-6 && s <= 20 + 1e-6 && t >= -10 - 1e-6 && t <= 10 + 1e-6, '띠 밖');
    assert.ok(!(p.x > 8.01 && p.x < 11.99 && p.z > -1.99 && p.z < 1.99), '건물 윤곽 안 ' + JSON.stringify(p)); }
  const src = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8'), mod = fs.readFileSync(path.join(ROOT, 'js/mmo/field-collide.js'), 'utf8');
  const body = s => s.slice(s.indexOf('function polyPush('), s.indexOf('/* Ry(rot) 로 되돌림 */')).replace(/\s+/g, '');
  assert.equal(body(mod), body(src), '3D 필드의 충돌이 2D 필드(mmo.html)와 갈라졌다 — 한쪽만 고치면 같은 자리에서 다르게 막힌다');
});

test('3D 필드(world3d.html): 굽기와 같은 빌더 · 점광은 가까운 몇 개만 · 영웅은 레이드 아바타(양손 쥠)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8'), bake = fs.readFileSync(path.join(ROOT, 'tools/2d/bake-map.html'), 'utf8');
  const envs = s => (s.match(/const ENV_FILE=\s*\{[^}]+\}/) || s.match(/const ENV_FILE = \{[^}]+\}/))[0].replace(/\s+/g, '');
  assert.equal(envs(src), envs(bake), '굽기와 다른 장면 빌더를 쓴다');
  assert.match(src, /for \(const L of pointData\) L\.parent\.remove\(L\)/, '점광 수십 개를 그대로 두면 실시간에서 셰이더가 터진다');
  assert.match(src, /new Animated\(heroAsset, scene, true, false, weaponAsset, ME\)/, '영웅이 양손 쥠 리그 없이 서면 낫을 지팡이처럼 든다');
  assert.match(src, /hero\.rig\?\.restore\(\);[\s\S]{0,900}hero\.mixer\.update\(dt\); hero\.rig\?\.apply\(/, '리그는 믹서 앞에서 되돌리고 뒤에서 건다');
});

test('2D 필드(mmo.html) 무기 쥠: 영웅마다 솔로·레이드와 같은 보정층 — 아인 바인드·클립 교정(믹서 전) · 양손 쥠 리그 · 리그 순서', () => {
  const src = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8'), h = src.slice(src.indexOf('async function hero('), src.indexOf('function heroAnimate(') + 900);
  assert.match(h, /if\(id==='ain'\)\{ const fix=repairAinBind\(root\); anims=repairAinClips\(g\.animations,fix\); \}/, '아인 교정이 없다');
  assert.ok(h.indexOf('repairAinClips') < h.indexOf('new THREE.AnimationMixer(root)'), '클립 교정은 믹서보다 먼저 (이미 만든 액션은 옛 트랙을 붙든다)');
  assert.match(h, /clip=n=>anims\.find/, '믹서가 교정 전 클립을 쓴다');
  assert.match(h, /h\.rig=\(id==='ain'\?makeAinRigAdapter:makeRigAdapter\)\(root,root,slot,/, '양손 쥠 리그가 없다 — 낫을 지팡이처럼 든다');
  assert.match(src, /h\.armBlend\?\.restore\(\); h\.rig\?\.restore\(\); h\.mixer\.update\(dt\);[\s\S]{0,400}h\.rig\?\.apply\(action/, '리그는 믹서 앞에서 되돌리고 뒤에서 건다');
  assert.match(src, /heroAnimate\(h, h\.me\?dt\*feel\.rate\(h\):dt\)/);
});

test('3D 필드 지배형: 서버 AI 파일을 그대로 읽는다(브라우저 CommonJS 로더) · 회피·부활 값이 서버와 같다', async () => {
  /* 로더를 node 에서: fetch·location 을 파일 읽기로 바꿔 끼운다 */
  const saved = { fetch: globalThis.fetch, location: globalThis.location };
  globalThis.location = { href: 'http://x/world3d.html' };
  globalThis.fetch = async u => ({ text: async () => fs.readFileSync(path.join(ROOT, new URL(u).pathname), 'utf8') });
  try {
    const { loadCjs } = await import('../js/mmo/cjs-browser.js');
    const DOM = await loadCjs('server/field-dominator.cjs');
    const { createRequire } = await import('node:module'), real = createRequire(import.meta.url)('../server/field-dominator.cjs');
    assert.deepEqual(DOM.SKILLS, real.SKILLS, '브라우저로 읽은 AI 가 서버 것과 다르다');
    assert.equal(DOM.AGGRO, real.AGGRO); assert.equal(typeof DOM.tick, 'function');
    /* 실제로 돌린다: 가까이 서 있으면 예고 뒤 바닥 타격이 bossStrike 로 온다 */
    const P = { id: 'me', zone: 'z', x: 2, z: 0, dead: false }, hits = [], f = { players: new Map([['me', P]]), rng: () => 0.9, bossStrike: (o, p, h) => hits.push(h.skill) };
    const o = { id: 't2_dominator_f', x: 0, z: 0, zone: 'z', alive: true, yaw: Math.PI / 2 }; DOM.setup(o, 0);
    for (let t = 0; t < 4000; t += 50) DOM.tick(f, o, t);
    assert.ok(hits.length >= 1 && hits[0] === 'rend', '가까이 있는데 안 때렸다 ' + hits);
  } finally { globalThis.fetch = saved.fetch; globalThis.location = saved.location; }
  const srv = fs.readFileSync(path.join(ROOT, 'server/field.cjs'), 'utf8'), w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8');
  for (const k of ['DODGE_TIME', 'DODGE_GAP', 'RESPAWN_TIME', 'RESPAWN_GUARD']) {
    const a = +(new RegExp(k + '=(\\d+)').exec(srv) || [])[1], b = +(new RegExp(k + ' = (\\d+)').exec(w) || [])[1];
    assert.ok(a > 0 && a === b, k + ' 서버 ' + a + ' ≠ 3D 필드 ' + b); }
  assert.match(w, /const DOM = await loadCjs\('server\/field-dominator\.cjs'\)/, 'AI 를 따로 쓰면 서버와 갈라진다');
  assert.match(w, /if \(now < p\.invulnUntil \|\| now < p\.dodgeUntil\)[^\n]+return \{ evade: true \}/, '회피 무적 판정이 서버와 다르다');
});

test('3D 필드 온라인: 2D 필드와 같은 접속 규약·저장소 열쇠 · 서버 시계는 거꾸로 안 간다 · 타격은 서버로, 회피는 dodgeB', async () => {
  const net = fs.readFileSync(path.join(ROOT, 'js/mmo/field-net.js'), 'utf8'), mmo = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8'), w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8');
  for (const key of ["'tw:party-token:'", "type: 'hello'", "type: 'fieldJoin'", "type: 'character'"]) {
    assert.ok(net.includes(key), 'field-net 에 ' + key + ' 가 없다'); assert.ok(mmo.replace(/ /g, '').includes(key.replace(/ /g, '')), 'mmo.html 과 규약이 다르다: ' + key); }
  assert.match(net, /PARTY_DEFAULT = 'hwanghon-party\.onrender\.com'/); assert.match(mmo, /PARTY_DEFAULT='hwanghon-party\.onrender\.com'/);
  const { serverClock, partyServer } = await import('../js/mmo/field-net.js');
  const c = serverClock(), real = Date.now; let t = 1000; Date.now = () => t;
  try { c.sync(5000); const a = c.now(); c.sync(4000); t += 10; const b = c.now(); assert.ok(b >= a, '서버 시계가 거꾸로 갔다'); assert.equal(a, 5000, '가장 지연이 적은(큰) 표본을 고른다'); }
  finally { Date.now = real; }
  assert.deepEqual(partyServer(new URLSearchParams(''), { hostname: 'hukkle-hub.github.io', host: 'x', protocol: 'https:' }), { host: 'hwanghon-party.onrender.com', secure: true }, 'Pages 사본은 Render 파티 서버로');
  assert.match(w, /if \(net\) \{ net\.send\(\{ type: 'fieldHit', boss: t\.b\.id \}\); return; \}/, '온라인 타격을 브라우저가 판정한다');
  assert.match(w, /if \(net\) sendMove\('dodgeB'\)/, '온라인 회피를 서버에 안 알린다 — 무적이 안 열린다');
  assert.match(w, /if \(!net\) for \(const o of doms\)/, '온라인인데 브라우저 AI 가 돈다 — 서버 지배형과 두 개가 된다');
});

test('3D 필드 문: 가까이 가면 이동 단추 · 다음 지역 3D 로 · 도착은 그 문 앞 · 온라인이면 서버에 그 문으로 들어간다', () => {
  const w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8'), net = fs.readFileSync(path.join(ROOT, 'js/mmo/field-net.js'), 'utf8');
  assert.match(w, /ARRIVE = GATES\.find\(g => g\.id === q\.get\('gate'\)\)/, '넘어온 문을 안 읽는다');
  assert.match(w, /const sp = ARRIVE \? \{ x: ARRIVE\.x, z: ARRIVE\.z \}/, '넘어온 문 앞에서 시작하지 않는다');
  assert.match(w, /net && net\.send\(\{ type: 'fieldLeave' \}\)/, '떠날 때 방을 안 나간다 — 서버에 유령이 남는다');
  assert.match(w, /gate: ARRIVE && ARRIVE\.id/); assert.match(net, /type: 'fieldJoin', zone, gate: gate \|\| undefined/);
  assert.match(w, /#gatebtn\{[^}]*min-height:64px/, '휴대폰 단추가 64 px 보다 작다');
});

test('3D 필드 필드 보스: 2D 필드와 같은 몸 맞춤·같은 안무(boss-motion) · 온라인이면 서버 생사·동작 · 타격 대상', () => {
  const w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8');
  assert.match(w, /if \(\/\^clave2\?\$\/\.test\(b\.id\)\) \{ setupBossMotion\(o, gl, r, scene, 0\)/, '클레이브 안무가 없다');
  assert.match(w, /r\.position\.y - box\.min\.y/, '발을 바닥에 안 맞춘다 (보스가 묻혔던 일 — CLAUDE.md §1)');
  assert.match(w, /if \(o\.fx\) prepareBossMotion\(o, bn\); o\.mixer\.update\(dt\);/, '서버 시각 자세 준비는 믹서 평가보다 먼저');
  assert.match(w, /const f = fbs\.find\(x => x\.b\.id === a\.id\); if \(f && f\.fx\) applyBossAction\(f, a, sclock\.now\(\)\)/, '서버 보스 동작을 안 따른다');
  assert.match(w, /for \(const o of net \? \[\.\.\.doms, \.\.\.fbs\] : doms\)/, '온라인에서 필드 보스를 못 때린다');
});
