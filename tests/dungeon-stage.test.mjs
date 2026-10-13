/* 던전 배경 (문서 231 §2) — 3D 필드의 던전 물면 · 형광등 깜빡임 · 사진 벽·바닥 · 보스 방 빛 · 짙은 안개 */
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const R = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('던전 물면: map.json water.y 높이에 반투명 잔물결 판 — 2D 만 그리던 것을 3D 도 (지하상가 0.9 · 선로 1.15 · 터널 1.2) · 하늘 돔 없는 실내는 어두운 천장색을 비춘다 · 발 둘레 물결 고리', () => {
  const W = R('world3d.html');
  assert.match(W, /const DWATER = INDOOR && env\.water && env\.water\.y > 0 \?/);
  assert.match(W, /if \(!window\.__sky\) \{ WATER\.uTop\.value = new THREE\.Color\(0x161c20\);[^\n]*WATER\.uSun\.value = new THREE\.Vector3\(0, -1, 0\);/, '실내엔 해가 없다 — 해 반짝임 끔');
  assert.match(W, /waterMat\(THREE, \{ calm: true \}\); m\.transparent = true; m\.opacity = 0\.84; m\.depthWrite = false;/, '반투명 — 물 밑 다리가 비친다');
  assert.match(W, /w\.position\.set\(c\.x, env\.water\.y, c\.z\); w\.renderOrder = 2; w\.userData\.noCam = true;/);
  assert.match(W, /DWATER\.ring\.position\.set\(root\.position\.x, DWATER\.y \+ 0\.02, root\.position\.z\)/, '고리는 매 프레임 내 발을 따라간다');
  const Z = R('js/mmo/zones.js'); assert.match(Z, /gangnam_b2:[\s\S]*?indoor: \{ seed: 3, water: 1\.15/); assert.match(Z, /hangang_tunnel:[\s\S]*?indoor: \{ seed: 8, water: 1\.2/);
  assert.match(R('js/mmo/env-dungeon.js'), /water: \{ y: WATER \}/);
});

test('형광등 깜빡임: 원작 «3초 켜짐. 1초 꺼짐» — 꺼진 박자엔 반구광 0.35 · 가까운 점광 0.12 · 막대 어둡게, 켜지는 0.08~0.18초는 더듬는다 · 상태가 바뀔 때만 손댄다', () => {
  const W = R('world3d.html');
  assert.match(W, /const FLICK = INDOOR && env\.flicker \? \{ on: env\.flicker\.on \|\| 3, off: env\.flicker\.off \|\| 1, state: -1, tubes: \[\], hemi0: hemiL \? hemiL\.intensity : 0 \} : null;/);
  assert.match(W, /o\.material\.color\.getHex\(\) === 0xeaf8ff\) FLICK\.tubes\.push\(o\)/, '형광등 막대(토착 색 0xeaf8ff)를 모은다');
  assert.match(W, /const T = FLICK\.on \+ FLICK\.off, ph = \(gameNow \/ 1000\) % T, off = ph > FLICK\.on, stut = ph > 0\.08 && ph < 0\.18/);
  assert.match(W, /if \(st !== FLICK\.state\) \{ FLICK\.state = st; flickK = off \? 0\.12 : stut \? 0\.45 : 1; if \(hemiL\) hemiL\.intensity = FLICK\.hemi0 \* \(off \? 0\.35 : stut \? 0\.7 : 1\);/);
  assert.match(W, /L\.intensity = l\.intensity \* lampK \* flickK;/, '점광 풀이 깜빡임을 따른다');
  assert.match(R('js/mmo/zones.js'), /gangnam_b2:[\s\S]*?flicker: \{ on: 3, off: 1 \}/); assert.match(R('js/mmo/env-dungeon.js'), /flicker: \{ on: 3, off: 1 \}/);
});

test('사진 재질 (3D 만): 벽은 콘크리트 사진 × 테마색 2.1배, 벽 조각마다 UV 를 미터로(boxWorldUv) · 바닥은 콘크리트·아스팔트·자갈만 사진 · 지하상가 벽도', () => {
  const I = R('js/mmo/env-indoor.js'), D = R('js/mmo/env-dungeon.js'), P = R('js/mmo/ph-tex.js');
  assert.match(P, /export function boxWorldUv\(geo, w, h, d, rep = 3\.2\)/); assert.match(P, /const sz = \[\[d, h\], \[d, h\], \[w, d\], \[w, d\], \[w, h\], \[w, h\]\];/, 'BoxGeometry 면 순서 px nx py ny pz nz');
  assert.match(I, /const PHOTO = isView3d\(\) && FACADE_PHOTO\.on;/); assert.match(I, /mat\.userData && mat\.userData\.rep \? boxWorldUv\(new THREE\.BoxGeometry\(w, h, d\), w, h, d, mat\.userData\.rep\)/);
  assert.match(I, /phPair\(THREE, 'concrete_wall_006', \{ normalScale: 0\.9 \}\), roughness: 0\.92, color: new THREE\.Color\(th\.wall \|\| '#3e3c40'\)\.multiplyScalar\(2\.1\) \}\), \{ userData: \{ rep: 3\.2 \} \}\)/);
  assert.match(I, /const FLOOR_PH = \{ concrete: \['concrete_layers', 3\.4\], asphalt: \['asphalt_02', 4\], gravel: \['concrete_debris', 2\.6\] \};/);
  assert.match(D, /PHOTO && !cut \? boxWorldUv\(new THREE\.BoxGeometry\(seg \+ 0\.05, h, 0\.35\), seg \+ 0\.05, h, 0\.35\)/);
  /* boxWorldUv 가 실제로 미터 UV 를 만드나 — 4 × 3 × 0.36 벽, 반복 2: 앞면(pz) u 끝 = 2, v 끝 = 1.5 */
  const uv = new Float32Array(24 * 2); for (let f = 0; f < 6; f++) { const o = f * 8; uv.set([0, 1, 1, 1, 0, 0, 1, 0], o); }
  const geo = { attributes: { uv: { count: 24, array: uv, getX: i => uv[i * 2], getY: i => uv[i * 2 + 1], setXY(i, x, y) { uv[i * 2] = x; uv[i * 2 + 1] = y; }, needsUpdate: false } } };
  return import('../js/mmo/ph-tex.js').then(({ boxWorldUv }) => { boxWorldUv(geo, 4, 3, 0.36, 2); const pz = 4 * 4; assert.equal(uv[(pz + 1) * 2], 2, '앞면 u 끝 = 4 m / 2'); assert.equal(uv[(pz + 1) * 2 + 1], 1.5, '앞면 v 끝 = 3 m / 2'); assert.equal(+uv[(0 + 1) * 2].toFixed(2), 0.18, '옆면(px) u 끝 = 0.36 / 2'); });
});

test('보스 방 빛 · 짙은 안개: 보스 자리 위 천장 스포트(3D 만) · 침수 선로 [9,46] · 한강 터널 [8,42] · 지하상가 [12,56] — world3d 가 env.fogDist 를 읽는다', () => {
  const I = R('js/mmo/env-indoor.js'), W = R('world3d.html');
  assert.match(I, /if \(zone\.view3d\) for \(const b of bosses\) \{[\s\S]*?new THREE\.SpotLight\(0xcfe0ff, 90, H \* 2\.4, 0\.42, 0\.65, 1\.3\); sp\.position\.set\(b\.x, H - 0\.2, b\.z\); sp\.target\.position\.set\(b\.x, 0, b\.z\);/);
  assert.match(I, /fogDist: th\.fogDist \|\| null,/);
  assert.match(W, /if \(INDOOR\) \{ scene\.fog\.near = env\.fogDist \? env\.fogDist\[0\] : 16; scene\.fog\.far = env\.fogDist \? env\.fogDist\[1\] : 70; \}/);
  const Z = R('js/mmo/zones.js'); assert.match(Z, /gangnam_b2:[\s\S]*?fogDist: \[9, 46\]/); assert.match(Z, /hangang_tunnel:[\s\S]*?fogDist: \[8, 42\]/); assert.match(R('js/mmo/env-dungeon.js'), /fogDist: \[12, 56\]/);
});

test('천장에서 떨어지는 물 (침수 던전만): 비 줄기 재질을 드물게(uRain 0.14) · 물면 높이(uY)에 튀는 고리 · 카메라를 따라간다 · ?drip=0', () => {
  const W = R('world3d.html'), Rn = R('js/mmo/rain.js');
  assert.match(W, /const DRIP = DWATER && q\.get\('drip'\) !== '0' \? \(\(\) => \{ WX\.uRain\.value = 0\.14; const r = rainStreaks\(THREE, \{ n: MOBILE \? 90 : 140, box: \[18, 5\.5, 18\] \}\), sp = rainSplashes\(THREE, \{ n: MOBILE \? 40 : 70, box: 12 \}\);/);
  assert.match(W, /sp\.U\.uY\.value = DWATER\.y \+ 0\.02;/); assert.match(W, /if \(DRIP\) \{ cam\.getWorldDirection\(LEAF_F\); DRIP\.r\.follow\(cam\.position, LEAF_F\); DRIP\.sp\.follow\(cam\.position, LEAF_F\); \}/);
  assert.match(Rn, /uY: \{ value: 0\.1 \}/); assert.match(Rn, /vec3 wp = vec3\(xz\.x, uY, xz\.y\) \+ position \* sz;/, '튀는 높이는 uniform — 바깥 비는 그대로 0.1');
});

test('3D 꾸밈 키트 (문서 231 §5): 3D 전용 난수 R3 · 천장 덕트·배관·전선 · 죽은 형광등 22 % · 벽 얼룩 · 물때 띠 · 문틀(1.5~7.5 m 열림, 가운데 점으로 중복 제거) · 잔해 더미(막이) · 비상등 맥동 · 사진 천장', () => {
  const I = R('js/mmo/env-indoor.js'), W = R('world3d.html');
  assert.match(I, /const R3 = rng\(\(spec\.seed \|\| 1\) \* 7919 \+ 3\), OPENINGS = \[\]/, '공용 R 을 안 쓴다 — 2D 굽기·막이 자리가 어긋난다');
  assert.match(I, /if \(zone\.view3d && kind === 'fluo' && R3\(\) < 0\.22\) \{ const tb = box\(1\.4, 0\.06, 0\.14, darkM,[^\n]*tb\.rotation\.z = 0\.42; tb\.position\.y -= 0\.3; continue; \}/);
  assert.match(I, /if \(kind === 'red'\) L\.userData\.pulse = true;/); assert.match(W, /if \(INDOOR\) for \(const L of POOL\) \{ const src = L\.userData\.src; if \(src && src\.userData\.pulse\) L\.intensity = L\.userData\.base \* \(0\.55 \+ 0\.45 \* Math\.sin\(gameNow \/ 640 \+ L\.position\.x \* 0\.7\)\); \}/);
  assert.match(I, /if \(zone\.view3d && spec\.water\) \{ const q = FROM\(\(sA \+ sB\) \/ 2 - e\.n\[0\] \* 0\.01, \(tA \+ tB\) \/ 2 - e\.n\[1\] \* 0\.01\); box\(len, 0\.42, 0\.03, stainM, q\[0\], spec\.water \+ 0\.12, q\[1\], rot, false\); \}/, '물때 띠');
  assert.match(I, /if \(open\) \{ flush\(\); if \(zone\.view3d\) \{ const o = OPENINGS\.at\(-1\);/, '열린 변을 모은다');
  assert.match(I, /if \(w < 1\.5 \|\| w > 7\.5\) continue;[\s\S]*?if \(seen\.has\(key\)\) continue; seen\.add\(key\);/, '문틀 폭 · 중복');
  assert.match(I, /if \(H >= 3 && len >= 6 && r\.floor !== 'tile'\) \{/, '타일 바닥(사무실·연구소)엔 덕트 없음'); assert.match(I, /new THREE\.TubeGeometry\(cv, 10, 0\.014, 4, false\), wireM\)/);
  assert.match(I, /block\(q\[0\], q\[1\], sx \* 0\.45, sz \* 0\.45, 0\); rubble\+\+;/, '잔해 더미는 걷기를 막는다');
  assert.match(I, /ceilM = zone\.view3d && PHOTO \? Object\.assign\(new THREE\.MeshStandardMaterial\(\{ \.\.\.phPair\(THREE, 'concrete_layers'/);
  assert.match(I, /console\.info\('\[env-indoor 3D\]'/);
});

test('던전 입장 카드: 다른 지역에서 들어오면 실내도 카드 — 원작 회차 · 보스 이름 · 칭호 (도입 비행 장면은 여전히 바깥만)', () => {
  const W = R('world3d.html');
  assert.match(W, /let intro = TRAVEL && !INDOOR \?/); assert.match(W, /if \(TRAVEL\) \{ const rc = document\.getElementById\('regionCard'\), b0 = INDOOR && \(Z\.bosses \|\| \(Z\.field \|\| \{\}\)\.bosses \|\| \[\]\)\[0\];/);
  assert.match(W, /\(b0\.canon \|\| ''\) \+ ' · ' \+ b0\.name \+ ' — ' \+ b0\.title/);
});

test('헤드램프 (원작 «헤드램프의 좁은 시야»): 어두운 던전(반구광 ≤ 1.6 · 물 찬 곳)만 · 영웅 머리 자리에서 앞 9 m · ?lamp=0', () => {
  const W = R('world3d.html');
  assert.match(W, /const LAMP = INDOOR && q\.get\('lamp'\) !== '0' && \(\(hemiL && hemiL\.intensity <= 1\.6\) \|\| \(env\.water && env\.water\.y > 0\)\) \?/);
  assert.match(W, /new THREE\.SpotLight\(0xfff1dc, 70, 24, 0\.42, 0\.6, 1\.5\); L\.castShadow = false;/);
  assert.match(W, /if \(LAMP\) \{ const fx = Math\.sin\(me\.yaw\), fz = Math\.cos\(me\.yaw\); LAMP\.position\.set\(root\.position\.x - fx \* 0\.1, 1\.62, root\.position\.z - fz \* 0\.1\); LAMP\.target\.position\.set\(root\.position\.x \+ fx \* 9, 0\.9, root\.position\.z \+ fz \* 9\); \}/);
});

test('방별 소품 (3D 만): 깨진 유리 조각 · 부푼 벽지 · 격납고 천장 크레인 · 결정 빛 맥동 · lite 는 얼룩·전선 반', () => {
  const I = R('js/mmo/env-indoor.js'), Z = R('js/mmo/zones.js');
  assert.match(I, /glass\(r, o\) \{[^\n]*if \(!zone\.view3d\) return;/); assert.match(I, /wallpaper\(r, o\) \{[^\n]*if \(!zone\.view3d\) return;/); assert.match(I, /gantry\(r, o\) \{[^\n]*if \(!zone\.view3d\) return;/);
  assert.match(I, /L\.position\.set\(c\[0\], 3, c\[1\]\); L\.userData\.pulse = true; scene\.add\(L\);/, '결정 산 빛이 뛴다');
  assert.match(I, /d \+= CARD_TIER\.lite \? 18 : 9\)/); assert.match(I, /d \+= \(CARD_TIER\.lite \? 14 : 7\) \+ R3\(\) \* 6\)/);
  assert.match(Z, /namsan_tower:[\s\S]*?\{ k: 'glass', n: 60 \}, \{ k: 'wallpaper', n: 8 \}/); assert.match(Z, /gyeryong_base:[\s\S]*?\{ k: 'gantry', at: \[0\.3, 0\.75\] \}/); assert.match(Z, /pangyo_lab:[\s\S]*?\{ k: 'glass', n: 40 \}/);
});
