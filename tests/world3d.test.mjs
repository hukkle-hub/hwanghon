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
  assert.match(w, /for \(const o of net \? \[\.\.\.doms, \.\.\.fbs\] : \[\.\.\.doms, \.\.\.fbs\.filter\(f => f\.ai\)\]\)/, '온라인에서 필드 보스를 못 때린다');
});

test('3D 필드 하늘: 바깥만 장면 색(env.sky)으로 노을 돔 · 정적 합치기와 카메라 막이에서 뺀다', () => {
  const w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8');
  assert.match(w, /if \(env\.sky && env\.sky\.top && env\.sky\.horizon\)/, '실내(하늘 정보 없음)에도 하늘을 그린다');
  assert.match(w, /mergeStatic\(scene, \{ skip: o => o\.name === 'sky' \}\)/, '하늘 돔이 카메라 막이 상자가 된다');
  assert.match(w, /window\.__sky\.position\.copy\(cam\.position\)/, '하늘이 카메라를 안 따라간다 — 멀리 가면 돔 밖으로 나간다');
});

test('2D 필드 가벼운 모델(휴대폰 기본)도 정식과 같은 쥠 층 — 끼워진 속성은 라이브러리가 떼어 내므로 LOD 로 건너뛰지 않는다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8');
  assert.match(src, /const handGrip=id!=='ain'\?gripHands\(root,id\):null;/, '쥔 손 모프가 빠졌다 — 칼을 손가락 펴고 든다');
  assert.match(src, /if\(id==='ain'\)\{ const fix=repairAinBind\(root\); anims=repairAinClips\(g\.animations,fix\); \}/, '아인 바인드·클립 교정이 빠졌다 — 낫을 지팡이처럼 든다');
});

test('가벼운 모델(LOD)은 정점 속성이 한 버퍼에 끼워져(interleaved) 있다 — 손 모프·아인 바인드 교정이 먼저 떼어 내야 뼈 번호가 안 섞인다', async () => {
  const { subdivideHands, separateAttributes } = await import('../js/hand-grip.js');
  /* gltf-transform 이 쓰는 모양 그대로: 한 정점 = 위치(f32×3) + 뼈 번호(u16×4) + 무게(f32×4) 를 한 버퍼에. three 는 같은 버퍼 위에 형식별 보기를 만든다 */
  const grid = new THREE.PlaneGeometry(0.06, 0.06, 2, 2), n = grid.attributes.position.count, STRIDE = 36, buf = new ArrayBuffer(n * STRIDE), f32 = new Float32Array(buf), u16 = new Uint16Array(buf);
  for (let i = 0; i < n; i++) { f32.set([grid.attributes.position.getX(i), grid.attributes.position.getY(i), 0], i * 9); u16.set([2, 0, 0, 0], i * 18 + 6); f32.set([1, 0, 0, 0], i * 9 + 5); }
  const G = new THREE.BufferGeometry(), fb = new THREE.InterleavedBuffer(f32, 9), ub = new THREE.InterleavedBuffer(u16, 18);
  G.setAttribute('position', new THREE.InterleavedBufferAttribute(fb, 3, 0)); G.setAttribute('skinIndex', new THREE.InterleavedBufferAttribute(ub, 4, 6)); G.setAttribute('skinWeight', new THREE.InterleavedBufferAttribute(fb, 4, 5));
  G.setIndex(grid.index.clone());
  assert.equal(G.attributes.skinIndex.array.length, n * 18, '시험 전제: 끼워진 속성의 .array 는 버퍼 전체');
  const out = subdivideHands(G, [{ bi: 2, M: new THREE.Matrix4(), K: new THREE.Vector3(0, -1, 0), f: new THREE.Vector3(0, 1, 0) }]);
  const si = out.attributes.skinIndex; assert.ok(out.attributes.position.count > n, '손 영역이 안 나뉘었다 — 시험이 아무것도 안 잰다');
  assert.equal(si.array.length, si.count * 4, '뼈 번호 배열 길이가 정점 수와 안 맞는다 — 버퍼 전체를 읽었다');
  let bad = 0; for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) { const v = si.getComponent(i, k), w = out.attributes.skinWeight.getComponent(i, k); if (w > 0 && v !== 2) bad++; }
  assert.equal(bad, 0, '나뉜 손의 뼈 번호가 다른 속성 값으로 섞였다 — 휴대폰 카인에서 없는 뼈를 가리켜 그리기가 멈췄다');
  const H = separateAttributes(new THREE.BufferGeometry().setAttribute('skinIndex', new THREE.InterleavedBufferAttribute(ub, 4, 6)));
  assert.deepEqual([...H.attributes.skinIndex.array.slice(0, 4)], [2, 0, 0, 0]); assert.equal(H.attributes.skinIndex.isInterleavedBufferAttribute, undefined);
  for (const [f, re] of [['js/hand-grip.js', /separateAttributes\(G0\);   \/\/ 가벼운 모델/], ['js/ain-bind-repair.js', /mesh\.geometry=separateAttributes\(mesh\.geometry\.clone\(\)\)/]])
    assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), re, f + ' 가 끼워진 속성을 그대로 읽는다');
  const w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8');
  assert.match(w, /const LOD = q\.has\('lod'\) \? q\.get\('lod'\) === '1' : MOBILE;/, '3D 필드가 휴대폰에서 정식 모델(최대 7 MB)을 받는다');
  assert.match(w, /loader\.load\(lodUrl\(u\)/, 'LOD 주소 바꾸기가 로더에 안 걸렸다');
});

test('3D 필드 노바 방: 보스 둘레(반경 10 m) 결정은 무릎 높이 — 위에서 보는 굽기와 달리 3D 에선 5 m 결정 숲이 보스를 가리고 카메라를 등에 붙였다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/mmo/env-indoor.js'), 'utf8');
  assert.match(src, /if \(zone\.view3d && o\.center && Math\.hypot\(s - \(r\.s0 \+ r\.s1\) \/ 2, t - \(r\.t0 \+ r\.t1\) \/ 2\) < \(o\.clear3d \|\| 10\)\) h = Math\.min\(h, 0\.9\);/, '보스 둘레 결정이 그대로 — 노바가 안 보인다');
  /* 굽기(view3d 아님)는 그대로여야 한다: 난수 순서가 바뀌면 굽기 그림과 막이(map.json)가 어긋난다 */
  assert.match(src, /spot\(r, o\), p = FROM\(s, t\); let h = \(o\.h \|\| 1\.2\) \* \(0\.5 \+ R\(\)\);/, '결정 높이 난수 순서가 바뀌었다');
});

test('실내 천장은 카메라 막이 — 두께 0.12 m 라 «키 1.2 m 넘는 것» 에서 빠져 멀리 당긴 카메라가 천장 위로 나가 윗면만 찍었다', () => {
  const scene = new THREE.Scene(), m = new THREE.Mesh(new THREE.BoxGeometry(20, 0.12, 20), new THREE.MeshStandardMaterial()); m.position.y = 5.06; m.userData.camBlock = true; scene.add(m);
  const thin = new THREE.Mesh(new THREE.BoxGeometry(20, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0x123456 })); thin.position.set(100, 5.06, 0); scene.add(thin);
  const r = mergeStatic(scene);
  assert.equal(r.camBoxes.length, 1, '천장(camBlock)이 막이가 아니다 — 또는 표시 없는 얇은 판까지 막이가 됐다');
  const at = new THREE.Vector3(0, 1.45, 0), want = new THREE.Vector3(6, 8.2, 0), d = firstHit(r.camBoxes, at, want);
  assert.ok(d < at.distanceTo(want) && at.clone().add(want.clone().sub(at).setLength(d)).y < 5, '카메라가 천장 위로 나간다');
  for (const f of ['js/mmo/env-indoor.js', 'js/mmo/env-dungeon.js']) assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), /userData\.camBlock = true/, f + ' 천장에 camBlock 표시가 없다');
});

test('3D 필드 혼자 연습 클레이브: 서버 전투 모듈 그대로 — 틱·view·반격창·셔터 · 맞은 결과(회피 읽기)', () => {
  const w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8');
  assert.match(w, /const COMBAT = await loadCjs\('server\/field-boss-combat\.cjs'\)/, '클레이브 AI 를 브라우저용으로 다시 쓰면 서버와 갈라진다');
  assert.match(w, /COMBAT\.tick\(fieldLocal, ai, gameNow\); collide\(ai, 0\.5\); const v = COMBAT\.view\(ai\); if \(v\) applyBossAction\(o, v, gameNow\);/, '혼자 연습 클레이브가 서 있기만 한다');
  assert.match(w, /counter = ai\.combat \? COMBAT\.tryCounter\(ai, gameNow\) : false/, '반격창 판정이 없다');
  assert.match(w, /\* \(counter \? 1\.65 : 1\)/, '반격 배율이 서버(1.65)와 다르다');
  assert.match(w, /COMBAT\.damageShutter\(ai, P, \{ character: ME \}, n, counter, gameNow\)/, '셔터 부위 파괴가 없다');
  assert.match(w, /if \(o\.combat\) COMBAT\.notePlayerResult\(o, p\.id, false\)/, '맞은 결과를 보스가 못 읽는다 (서버 bossStrike 와 다름)');
  assert.match(w, /net \? \[\.\.\.doms, \.\.\.fbs\] : \[\.\.\.doms, \.\.\.fbs\.filter\(f => f\.ai\)\]/, '혼자 연습에서 클레이브를 칠 수 없다');
  assert.match(w, /if \(!o\.ai\) o\.ai = \{ id: b\.id, zone: ZONE, x: b\.x, z: b\.z, yaw: 0, h: b\.h \|\| 3, alive: true, hp: CLAVE_HP, max: CLAVE_HP \};/, '나머지 필드 보스를 혼자 연습에서 칠 수 없다 (2D 필드는 된다)');
  assert.match(w, /if \(t\.fx\) hideBossMotion\(t\); else if \(t\.dom\) hideDominator\(t\);/, 'AI 없는 필드 보스를 쓰러뜨리면 지배형 숨기기가 터진다');
  assert.match(w, /if \(!ai\.combat\) continue;\n    COMBAT\.tick\(/, 'AI 없는 필드 보스까지 클레이브 틱을 돈다');
});

test('2D 필드 혼자 연습: 지배형·클레이브가 반격한다 — 서버 모듈 그대로, 결과는 온라인과 같은 통로(selfPacket · apply*Action)', () => {
  const m = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8');
  assert.match(m, /Promise\.all\(\[loadCjs\('server\/field-dominator\.cjs'\),loadCjs\('server\/field-boss-combat\.cjs'\)\]\)/, '혼자 연습 보스 AI 를 서버 모듈로 안 돌린다');
  assert.match(m, /M\.tick\(offField,ai,now\); collide\(ai,0\.5\); const v=M\.view\(ai\);/, '혼자 연습에서 보스가 서 있기만 한다');
  assert.match(m, /function bossFrame\(dt\)\{\n  offTick\(\);/, '프레임마다 혼자 연습 틱을 안 돈다');
  assert.match(m, /offSelf\(\[seq,amount,o\.id,hit\.skill,kind,hit\.beat,now\]\)/, '내 피격이 온라인과 같은 hurt 묶음(selfPacket)으로 안 간다');
  assert.match(m, /me\.dodgeAt=bossNow\(\); if\(!net\) OFF\.P\.dodgeUntil=me\.dodgeAt\+520;/, '혼자 연습 회피 무적이 없다 (서버 DODGE_TIME 520)');
  assert.match(m, /\*mult\*w\*\(counter\?1\.65:1\)/, '혼자 연습 반격 배율이 서버(1.65)와 다르다');
  assert.match(m, /OFF\.COMBAT\.damageShutter\(ai,OFF\.P,\{character:MY\},n,counter,now\)/, '혼자 연습 셔터 파괴가 없다');
  const srv = fs.readFileSync(path.join(ROOT, 'server/field.cjs'), 'utf8');
  assert.match(srv, /DODGE_TIME=520/, '서버 회피 시간이 바뀌었다 — mmo.html 혼자 연습 값도 같이 바꿔라');
});

test('필드 완벽 회피: 누른 뒤 0.14초 안(솔로 dodge.perfect 와 같음)에 피한 것만 · 온라인은 전달 여유 · 2D·3D 둘 다 연결', async () => {
  const { isPerfect, PERFECT_MS, NET_SLACK } = await import('../js/mmo/perfect-dodge.js');
  const src = fs.readFileSync(path.join(ROOT, 'js/dungeons.js'), 'utf8'), solo = /dodge:\s*\{[^}]*perfect:([\d.]+)/.exec(src);
  assert.ok(solo, '솔로 dodge.perfect 를 못 찾았다'); assert.equal(PERFECT_MS, Math.round(+solo[1] * 1000), '필드 완벽 회피 시간이 솔로와 다르다');
  assert.equal(isPerfect(1000, 1100), true); assert.equal(isPerfect(1000, 1000 + PERFECT_MS + 1), false, '늦은 회피를 완벽으로 친다');
  assert.equal(isPerfect(1000, 990), false, '맞은 뒤에 누른 회피를 완벽으로 친다'); assert.equal(isPerfect(undefined, 1000), false, '회피를 안 눌렀는데 완벽');
  assert.equal(isPerfect(1000, 1000 + PERFECT_MS + NET_SLACK - 1, true), true, '온라인 전달 여유가 없다'); assert.equal(isPerfect(1000, 1000 + PERFECT_MS + NET_SLACK - 1, false), false);
  const m = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8'), w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8');
  assert.match(m, /isPerfect\(me\.dodgeAt,h\[6\],!!net\)/, '2D 필드: 서버 hurt 시각(h[6])으로 완벽 회피를 안 가린다');
  assert.match(m, /me\.dodgeAt=bossNow\(\)/, '2D 필드: 회피 누른 시각을 서버 시계로 안 잰다');
  assert.match(w, /if \(kind === 'evade'\) evadeFx\(h\[6\], true\);/, '3D 필드 온라인: 완벽 회피가 없다');
  assert.match(w, /if \(now < p\.invulnUntil \|\| now < p\.dodgeUntil\) \{ evadeFx\(now, false\);/, '3D 필드 혼자 연습: 완벽 회피가 없다');
});

test('완벽 회피 잔상: 영웅 userData 에 순환 참조(2D 필드 sil)가 있어도 복제가 안 터지고 userData 는 그대로 돌아온다', async () => {
  globalThis.requestAnimationFrame ??= () => 0;
  const { ghostSnap } = await import('../js/mmo/perfect-dodge.js');
  const scene = new THREE.Scene(), root = new THREE.Group(), bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  root.add(bone); root.add(mesh); mesh.bind(new THREE.Skeleton([bone])); scene.add(root);
  const sil = { object: null }; sil.object = { object: sil }; root.userData.sil = sil; mesh.userData.keep = 7;
  const h = ghostSnap(scene, root, 0x7fb8ff, 0.4, 900);
  assert.ok(h && scene.children.includes(h), '잔상이 장면에 안 들어갔다');
  assert.equal(root.userData.sil, sil, '원본 userData 를 잃었다'); assert.equal(mesh.userData.keep, 7);
});

test('3D 필드 휴대폰: 카메라 먼 면 = 안개 끝 + 10 m (다 묻힌 것은 안 그린다) · 하늘 돔은 그 안으로', () => {
  const w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8');
  assert.match(w, /if \(MOBILE && q\.get\('far'\) !== '0'\) \{ cam\.far = scene\.fog\.far \+ 10; cam\.updateProjectionMatrix\(\); if \(window\.__sky\) window\.__sky\.scale\.setScalar\(\(cam\.far - 5\) \/ 480\); \}/, '휴대폰이 안개 밖 600 m 까지 그린다 (남태령 823 그리기)');
  const i = w.indexOf("if (INDOOR) { scene.fog.near = 16; scene.fog.far = 70; }"), j = w.indexOf('cam.far = scene.fog.far + 10');
  assert.ok(i > 0 && j > i, '먼 면을 실내 안개(70 m)를 정하기 전에 잡았다');
});

test('3D 필드 미니맵: 2D 필드와 같은 개관 그림·같은 좌표식 · 방향 화살표 · 사냥터 이름 띠', () => {
  const w = fs.readFileSync(path.join(ROOT, 'world3d.html'), 'utf8'), m = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8');
  assert.match(m, /const miniPos=\(x,z\)=>\{ const u=x, v=-z\*Math\.sin\(meta\.pitch\); return \[ \(u-OV\.u0\)\/\(OV\.u1-OV\.u0\)\*100, \(OV\.v1-v\)\/\(OV\.v1-OV\.v0\)\*100 \]; \};/, '2D 미니맵 좌표식이 바뀌었다 — 3D 도 같이 고쳐라');
  assert.match(w, /const miniPos = \(x, z\) => \[\(x - OV\.u0\) \/ \(OV\.u1 - OV\.u0\) \* 100, \(OV\.v1 \+ z \* SINP\) \/ \(OV\.v1 - OV\.v0\) \* 100\];/, '3D 미니맵 좌표식이 2D 와 다르다');
  /* 방향: 앞 (sin yaw, cos yaw) → 그림에서 x 오른쪽, z 아래(내려다보는 각만큼 눌림). CSS rotate 는 위에서 시계 방향 */
  assert.match(w, /Math\.atan2\(Math\.sin\(me\.yaw\), -Math\.cos\(me\.yaw\) \* SINP\)/, '화살표 방향식');
  const ang = yaw => Math.atan2(Math.sin(yaw), -Math.cos(yaw) * 0.82);
  assert.ok(Math.abs(ang(Math.PI) - 0) < 1e-9, '−z(그림 위)를 보면 화살표가 위'); assert.ok(Math.abs(ang(Math.PI / 2) - Math.PI / 2) < 1e-9, '+x 를 보면 오른쪽');
  assert.match(w, /if \(frames % 3 === 0\) miniTick\(\); areaTick\(dt\);/, '미니맵·사냥터 띠를 안 돌린다');
  assert.match(w, /#mini\[hidden\]\{ display:none; \}/, '개관 그림 없는 지역(실내)에 빈 미니맵이 뜬다');
});
