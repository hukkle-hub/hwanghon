/* 전투 환경 변수 (문서 232) — 숫자는 js/mmo/env-rules.js 한 장 · world3d 가 그대로 읽는가 */
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { WATER_BANDS, waterBand, moveK, wobble, FLOAT, KNOCK_SPIN, FLOATERS, LAMP, envSummary, WET, wetK, SPLASH } from '../js/mmo/env-rules.js';
const R = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('물 깊이 띠: 발목·무릎·허리·가슴·어깨 — 깊을수록 이동·회피는 줄고 공격 지연·먹먹함·뜸은 는다 · 경계값', () => {
  assert.deepEqual(WATER_BANDS.map(b => b.id), ['dry', 'ankle', 'knee', 'waist', 'chest', 'shoulder']);
  for (let i = 1; i < WATER_BANDS.length; i++) { const a = WATER_BANDS[i - 1], b = WATER_BANDS[i]; assert.ok(b.min > a.min && b.move <= a.move && b.dodge <= a.dodge && b.atk >= a.atk && b.hear >= a.hear && b.vis <= a.vis && b.float >= a.float, b.id); }
  assert.equal(waterBand(0).id, 'dry'); assert.equal(waterBand(0.17).id, 'ankle', '여의도 공동구 0.18'); assert.equal(waterBand(0.9).id, 'waist', '지하상가 0.9'); assert.equal(waterBand(1.15).id, 'chest', '2호선 선로 1.15'); assert.equal(waterBand(1.45).id, 'shoulder', '한강 차수문 앞');
  assert.equal(waterBand(1.3).id, 'shoulder', '경계값은 위 띠'); assert.ok(WATER_BANDS.every(b => b.spin === (b.min >= 0.75)), '허리 위에서 반 바퀴');
});

test('«발 들면 몸이 뜹니다»: 가슴 깊이에서 스틱을 끝까지 밀면 살살 미는 것보다 느리고 방향이 흔들린다 · 마른 땅·발목은 그대로', () => {
  const chest = waterBand(1.15), dry = waterBand(0), ankle = waterBand(0.2);
  assert.ok(moveK(chest, 1) < moveK(chest, 0.4), '달리기 ' + moveK(chest, 1) + ' < 걷기 ' + moveK(chest, 0.4)); assert.equal(+moveK(chest, 0.4).toFixed(3), chest.move); assert.equal(+moveK(chest, 1).toFixed(3), +(chest.move * (1 - FLOAT.speedLoss * chest.float)).toFixed(3));
  assert.equal(moveK(dry, 1), 1); assert.equal(moveK(ankle, 1), ankle.move, '발목은 뜨지 않는다');
  assert.equal(wobble(chest, 0.4, 1.3), 0); assert.ok(Math.abs(wobble(chest, 1, 0.5)) > 0 && Math.abs(wobble(chest, 1, 0.5)) <= FLOAT.wobble * chest.float + 1e-9); assert.equal(wobble(dry, 1, 0.5), 0);
  assert.equal(KNOCK_SPIN.turns, 0.5); assert.ok(FLOATERS.push > FLOATERS.idle * 5, '예고 때 부유물은 확실히 밀린다'); assert.ok(LAMP.deepReach < LAMP.reach);
  assert.match(envSummary(chest), /^가슴까지 물 · 이동 46% · 회피 40% · 공격 \+160ms · 소리 먹먹 · 뛰면 뜬다/); assert.equal(envSummary(dry), '');
});

test('world3d 연결: 이동 배율·흔들림·회피 배율·공격/맞대기 지연(통째로 늦게)·밀려남 반 바퀴·먹먹함(sfx.muffle)·안개·램프 거리·부유물 흐름·환경 띠', () => {
  const W = R('world3d.html');
  assert.match(W, /movementSpeed\(m,walkKey\?1\.5:4\.8\)\*moveK\(ENV\.band,walkKey\?0\.3:m\)/); assert.match(W, /me\.yaw\+=wobble\(ENV\.band,walkKey\?0\.3:m,gameNow\/1000\)\*dt;/);
  assert.match(W, /const sp = 3\.4 \* rate \* ENV\.band\.dodge \* \(ENV\.wetT > 0 \? WET\.dodge : 1\);/);
  assert.match(W, /function attack\(\) \{ if \(STAGE && STAGE\.locked\) \{ STAGE\.skip\(\); return; \} if \(ENV\.band\.atk && !ENV\.fromQueue\) \{ if \(!ENV\.pend\) ENV\.pend = \{ fn: attack, at: gameNow \+ ENV\.band\.atk \}; return; \}/);
  assert.match(W, /function counter\(\) \{[^\n]*if \(ENV\.band\.atk && !ENV\.fromQueue\) \{ if \(!ENV\.pend\) ENV\.pend = \{ fn: counter, at: gameNow \+ ENV\.band\.atk \}; return; \}/);
  assert.match(W, /if \(ENV\.pend && gameNow >= ENV\.pend\.at\) \{ const f = ENV\.pend\.fn; ENV\.pend = null; ENV\.fromQueue = true; try \{ f\(\); \} finally \{ ENV\.fromQueue = false; \} \}/);
  assert.match(W, /if \(ENV\.band\.spin && !ENV\.brace\) \{ ENV\.spinT = KNOCK_SPIN\.dur; ENV\.splashT = SPLASH_RULE\.dur; \}/); assert.match(W, /me\.yaw \+= Math\.PI \* 2 \* KNOCK_SPIN\.turns \* k \/ KNOCK_SPIN\.dur;/);
  assert.match(W, /if \(sf && sf\.muffle\) sf\.muffle\(b\.hear\);/); assert.match(W, /scene\.fog\.near = ENV\.fog0\[0\] \* b\.vis;/); assert.match(W, /const reach = b\.id === 'shoulder' \? LAMP_RULE\.deepReach : LAMP_RULE\.reach;/);
  assert.match(W, /flow = FLOW_V\.set\(dx \/ dd, dz \/ dd\)\.multiplyScalar\(FLOATERS\.push\)/, '보스에서 멀어지는 쪽으로'); assert.match(W, /ENV\.chip\.hidden = !t; ENV\.chip\.textContent = t;/);
  assert.match(W, /const yAt = G \? \(x, z\) => \{ const sv = sOf\(x, z\);/, '경사 수면 깊이'); assert.match(W, /bg\.setIndex\(idx\); bg\.computeVertexNormals\(\); w = new THREE\.Mesh\(bg, m\);/, '꺾인 수면 판');
  assert.match(R('js/sfx.js'), /api\.muffle=function\(k\)\{[^\n]*var f=20000\*Math\.pow\(700\/20000,k\);/); assert.match(R('js/sfx.js'), /master\.connect\(muff\); muff\.connect\(compressor\);/);
  assert.match(R('js/mmo/zones.js'), /hangang_tunnel:[\s\S]*?waterGrade: \[\[24, 0\.15\], \[120, 0\.5\], \[200, 0\.9\], \[260, 1\.15\], \[330, 1\.45\]\]/);
  assert.match(R('js/mmo/env-indoor.js'), /const wyAt = sv => \{ const g = th\.waterGrade;/); assert.match(R('js/mmo/env-indoor.js'), /grade: th\.waterGrade \? th\.waterGrade\.map\(/);
});

test('젖은 옷 «젖은 테크웨어의 무게» L4110: 허리 위 물에서 나오면 10 초 — 처음 절반은 이동 92 %, 뒤 절반은 마른다 · 띠 없이도 환경 띠에 보인다 · 물보라', () => {
  assert.equal(WET.minBand, 'waist'); assert.equal(wetK(0), 1); assert.equal(+wetK(WET.dur).toFixed(3), WET.move); assert.equal(+wetK(WET.dur * 0.5).toFixed(3), WET.move); assert.ok(wetK(1) > WET.move && wetK(1) < 1);
  assert.match(envSummary(waterBand(0), 6), /^젖은 옷 — 이동 92% \(6초\)$/); assert.equal(envSummary(waterBand(0), 0), '');
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
  assert.match(W, /if \(b\.id === 'dry' && ENV\.band\.min >= WATER_BANDS\.find\(x => x\.id === WET\.minBand\)\.min\) ENV\.wetT = WET\.dur;/); assert.match(W, /\*wetK\(ENV\.wetT\)/); assert.match(W, /\* \(ENV\.wetT > 0 \? WET\.dodge : 1\);/);
  assert.ok(SPLASH.scale > 2); assert.match(W, /if \(ENV\.band\.spin && !ENV\.brace\) \{ ENV\.spinT = KNOCK_SPIN\.dur; ENV\.splashT = SPLASH_RULE\.dur; \}/);
});

test('클레이브 던전 장치 (문서 233 #1): 매대 버팀 «발뒤꿈치가 매대 다리에 닿았다» L2768 — 밀려남 ⅓·반 바퀴 없음 · 미끄러운 타일 ×1.4 · 배수로 격자 퇴로 «배수로 격자를 낫으로 뜯어냈다» L1912', async () => {
  const { BRACE, SLIP, braceAt, knockK, envSummary, waterBand } = await import('../js/mmo/env-rules.js');
  const braces = [{ x: 10, z: 5, r: 2 }]; assert.ok(braceAt(braces, 11, 5)); assert.equal(braceAt(braces, 13, 5), null); assert.equal(braceAt(null, 0, 0), null);
  const waist = waterBand(0.9), dry = waterBand(0);
  assert.equal(knockK(waist, true, false), SLIP.knock, '물 찬 타일'); assert.equal(knockK(dry, true, false), 1, '마른 타일은 안 미끄럽다'); assert.equal(+knockK(waist, true, true).toFixed(3), +(SLIP.knock * BRACE.knock).toFixed(3)); assert.equal(knockK(waist, false, false), 1);
  assert.match(envSummary(waist, 0, true), /허리까지 물 · 매대 다리에 발 — 버틴다 \(밀려남 ⅓\)/); assert.match(envSummary(dry, 0, true), /^매대 다리에 발/);
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), D = fs.readFileSync(new URL('../js/mmo/env-dungeon.js', import.meta.url), 'utf8');
  assert.match(W, /const kn = hit\.knock \* knockK\(ENV\.band, ENV\.slip, !!ENV\.brace\); p\.x \+= dx \/ d \* kn;/); assert.match(W, /if \(ENV\.band\.spin && !ENV\.brace\) \{ ENV\.spinT = KNOCK_SPIN\.dur;/, '버티면 안 돈다');
  assert.match(W, /const br = braceAt\(env\.braces, root\.position\.x, root\.position\.z\); if \(br !== ENV\.brace\)/); assert.match(W, /if \(!DWATER\) envTick\(dt\);/, '물 없는 던전도 버팀은 본다');
  assert.match(D, /braces\.push\(\{ x: \+x\.toFixed\(2\), z: \+z\.toFixed\(2\), r: 2\.0 \}\); \}/, '뒤집힌 진열대마다 버팀 자리'); assert.match(D, /braces, slip: true,/);
  assert.match(D, /\{ id: 'drain', x: \+drainP\[0\]\.toFixed\(2\), z: \+drainP\[1\]\.toFixed\(2\), r: 1\.9, to: \{ zone: 'gangnam', gate: 'exit5' \}, label: '배수로 격자 · 물길로 빠져나간다', kind: 'zone', local: true \}/);
  assert.match(fs.readFileSync(new URL('../js/mmo/zones.js', import.meta.url), 'utf8'), /gangnam_b2:[\s\S]*?fogDist: \[9, 46\], slip: true \}/); assert.match(fs.readFileSync(new URL('../js/mmo/env-indoor.js', import.meta.url), 'utf8'), /slip: !!th\.slip, braces: \[\],/);
});

test('레비아탄 던전 장치 (문서 233 #4): 윈치 케이블 80 m 생명줄 «윈치! 당겨!» — 줄 끝 밖으로 못 가고·끌려 돌아오고·풀 수 있다 · 기계실 고정핀 둘 → 차수문 낙하(1.2 초 자유 낙하) → 막이 · 둘 다 내려오고 보스가 사이면 «가둠 — 차수문 3-B 폐쇄»', async () => {
  const { WINCH, FLOODGATE } = await import('../js/mmo/env-rules.js');
  assert.equal(WINCH.reach, 80); assert.ok(WINCH.speed > 0 && WINCH.dur > 0); assert.equal(FLOODGATE.pins, 2); assert.ok(FLOODGATE.drop > 0.5 && FLOODGATE.drop < 3); assert.match(FLOODGATE.sealCard, /^가둠 — 차수문 3-B/);
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), I = fs.readFileSync(new URL('../js/mmo/env-indoor.js', import.meta.url), 'utf8'), Z = fs.readFileSync(new URL('../js/mmo/zones.js', import.meta.url), 'utf8');
  /* 장면: 핀·평형추에 표를 달고 interacts 로 내놓는다 · 문은 천장 속에 숨어 scene.userData.floodgates 로 넘어온다 · 윈치는 cable 이 있을 때만 장치 */
  assert.match(I, /interacts\.push\(\{ id: gd\.id \+ '-pin' \+ k, kind: 'pin', gate: gd\.id,/); assert.match(I, /pin\.userData\.pin = gd\.id \+ '-pin' \+ k;/); assert.match(I, /wt\.userData\.pinWeight = gd\.id \+ '-pin' \+ k; wt\.userData\.keep = true;/); assert.match(I, /pin\.userData\.keep = true;/); assert.match(W, /skip: o => o\.name === 'sky' \|\| !!o\.userData\.keep,/, '핀·평형추는 정적 합치기에서 뺀다 — 합쳐지면 잘라도 안 숨는다');
  assert.match(I, /door\.visible = false; scene\.add\(door\);/); assert.match(I, /scene\.userData\.floodgates = \(scene\.userData\.floodgates \|\| \[\]\)\.concat\(\[\{ id: gd\.id, door, hTop: H \+ H \/ 2 \+ 0\.2, hDown: H \/ 2 \}\]\)/);
  assert.match(I, /if \(zone\.view3d && o\.cable\) interacts\.push\(\{ id: 'winch', kind: 'winch', x: \+p\[0\]\.toFixed\(2\), z: \+p\[1\]\.toFixed\(2\), r: o\.cable,/); assert.match(I, /braces: \[\], interacts, floodgates,/);
  assert.match(Z, /hangang_tunnel:[\s\S]*?\{ k: 'winch', u: 0\.7, v: 0\.75, cable: 80 \}/); assert.match(Z, /\{ k: 'floodgates', gates: \[ \{ id: 'inner', name: '내측', u: 0\.48, pins: 'mechIn' \}, \{ id: 'outer', name: '외측', u: 0\.9, pins: 'mechOut' \} \] \}/);
  /* world3d: 같은 단추(gatebtn) 로 핀·윈치 · 줄 끝 당김 · 끌려감 · 낙하 끝에 막이 · 가둠 판정은 떨어질 때와 그 뒤에도 (사이에 갇혀 있다가 나오면) */
  assert.match(W, /if \(!g\) g = devNear\(\);/); assert.match(W, /if \(g && \(g\.kind === 'pin' \|\| g\.kind === 'winch' \|\| g\.kind === 'seam'\)\) return useDevice\(g\);/); assert.match(W, /\n  devTick\(dt\);/);
  assert.match(W, /if \(d > w\.r && d > 0\.01\) \{ p\.x = w\.x \+ dx \/ d \* w\.r; p\.z = w\.z \+ dz \/ d \* w\.r; collide\(p\);/, '줄 끝 밖으로 못 간다'); assert.match(W, /if \(DEV\.pull > 0\) \{ DEV\.pull -= dt; const st = Math\.min\(Math\.max\(0, d - 2\.5\), WINCH\.speed \* dt\);/, '끌려 돌아간다');
  assert.match(W, /if \(g\.release\) \{ DEV\.attached = false; DEV\.taut = false; if \(DEV\.cable\) DEV\.cable\.visible = false;/, '줄을 푼다');
  assert.match(W, /const left = \(fg\.pins \|\| FLOODGATE\.pins\) - fg\.cut; if \(left > 0\) toast\(.*?\); else dropGate\(fg\); return; \}/);
  assert.match(W, /door\.door\.position\.y = door\.hTop \+ \(door\.hDown - door\.hTop\) \* u \* u;/, '자유 낙하'); assert.match(W, /walkMeta\.blockers\.push\(\{ x: d\.fg\.x, z: d\.fg\.z, hw: d\.fg\.hw, hd: d\.fg\.hd, rot: d\.fg\.rot \}\); shakeT = Math\.max\(shakeT, \.55\); window\.TW_SFX\?\.play\('brk'\); checkSeal\(true\); \}/);
  assert.match(W, /if \(!DEV\.sealed && DEV\.gates\.size && frames % 15 === 0\) checkSeal\(false\);/); assert.match(W, /if \(boss && !inside\(hs\)\) \{ DEV\.sealed = true; if \(boss\.ai\) boss\.ai\.alive = false; boss\.sealed = true;/);
});

test('판교 연구소 장치 (문서 233 #5): 좁은 계단 «폭이 사람 둘 너비 … 하나씩만» — 난간 안쪽 1.6 m, 안에서는 계단 축으로만 밀린다 · 이음매 고정액 «마지막 고정액을 부어 임시 봉쇄» — 병 둘, 40 초 막이, 지나면 «아래에서 부딪쳐 돌파»', async () => {
  const { NARROW, narrowAt, FIX } = await import('../js/mmo/env-rules.js');
  assert.equal(NARROW.width, 1.6); assert.equal(FIX.bottles, 2); assert.equal(FIX.hold, 40);
  const a = 28 * Math.PI / 180, n = [{ x: 0, z: 0, hw: 4, hd: 0.8, rot: a }], S = (s, t) => [s * Math.cos(a) - t * Math.sin(a), -s * Math.sin(a) - t * Math.cos(a)];
  assert.ok(narrowAt(n, ...S(3.9, 0.7)), '계단 축 끝·너비 안'); assert.equal(narrowAt(n, ...S(4.2, 0)), null, '축 밖'); assert.equal(narrowAt(n, ...S(0, 0.9)), null, '난간 밖'); assert.equal(narrowAt(null, 0, 0), null);
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), I = fs.readFileSync(new URL('../js/mmo/env-indoor.js', import.meta.url), 'utf8'), Z = fs.readFileSync(new URL('../js/mmo/zones.js', import.meta.url), 'utf8');
  assert.match(I, /railing\(r, o\) \{/); assert.match(I, /narrows\.push\(\{ x: \+c\[0\]\.toFixed\(2\), z: \+c\[1\]\.toFixed\(2\), hw: \+\(L \/ 2\)\.toFixed\(2\), hd: \+\(W \/ 2 - inset\)\.toFixed\(2\), rot: SCREEN_ANG,/); assert.match(I, /block\(bc\[0\], bc\[1\], L \/ 2, inset \/ 2, SCREEN_ANG\);/, '난간은 막이');
  assert.match(I, /seam\(r, o\) \{/); assert.match(I, /interacts\.push\(\{ id: 'seam', kind: 'seam',[^\n]*bottles: o\.fix \?\? 2,/); assert.match(I, /braces: \[\], interacts, floodgates, narrows,/);
  assert.match(Z, /\{ id: 'stair', s: \[30, 38\], t: \[-1\.6, 1\.6\], light: 'red', props: \[ \{ k: 'railing' \} \] \}/); assert.match(Z, /\{ id: 'neck', s: \[62, 70\],[^\n]*\{ k: 'railing' \}, \{ k: 'seam', u: 0\.5, fix: 2 \}/);
  assert.match(W, /const nr = narrowAt\(env\.narrows, root\.position\.x, root\.position\.z\); if \(nr !== ENV\.narrow\) \{ ENV\.narrow = nr; refreshChip\(\); \}/);
  assert.match(W, /if \(ENV\.narrow\) \{ const ax = Math\.cos\(ENV\.narrow\.rot\), az = -Math\.sin\(ENV\.narrow\.rot\), k = dx \* ax \+ dz \* az, sg = k < 0 \? -1 : 1; dx = ax \* sg; dz = az \* sg; d = 1; \}/, '좁은 계단 — 축으로만 밀린다');
  assert.match(W, /if \(g\.kind === 'seam'\) \{ g\.bottles--; DEV\.fixT = FIX\.hold; DEV\.fixBlock = \{ x: g\.x, z: g\.z, hw: g\.hw, hd: g\.hd, rot: g\.rot \}; walkMeta\.blockers\.push\(DEV\.fixBlock\);/);
  assert.match(W, /if \(DEV\.fixT <= 0\) \{ DEV\.fixT = 0; const i = walkMeta\.blockers\.indexOf\(DEV\.fixBlock\); if \(i >= 0\) walkMeta\.blockers\.splice\(i, 1\);/, '시간이 지나면 막이가 풀린다');
  assert.match(W, /if \(x\.kind === 'seam'\) \{ if \(x\.bottles <= 0 \|\| DEV\.fixT > 0\) continue;/, '병이 없거나 이미 굳어 있으면 단추 없음');
});

test('계룡 격납고 장치 (문서 233 #8): 소모성 엄폐물 «1발 파임, 2발 관통, 3발 소멸» L12717 — 세 단계, 소멸하면 막이도 풀린다 · 포탑 18 «4·5·6초 세 종류» L12805 — 혼자 연습은 클라가 쏘고 엄폐물 뒤면 엄폐물이 맞는다', async () => {
  const { COVER, coverStage, TURRET, turretInterval } = await import('../js/mmo/env-rules.js');
  assert.deepEqual(COVER.stages, ['파임', '관통', '소멸']); assert.equal(COVER.hits, 3); assert.equal(coverStage(0), ''); assert.equal(coverStage(1), '파임'); assert.equal(coverStage(2), '관통'); assert.equal(coverStage(3), '소멸'); assert.equal(coverStage(9), '소멸');
  assert.equal(TURRET.n, 18); assert.equal(TURRET.main, 6); assert.deepEqual(TURRET.intervals, [4, 5, 6]); assert.deepEqual([0, 1, 2, 3, 17].map(turretInterval), [4, 5, 6, 4, 6]);
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), I = fs.readFileSync(new URL('../js/mmo/env-indoor.js', import.meta.url), 'utf8');
  assert.match(I, /covers\.push\(\{ id, x: \+p\[0\]\.toFixed\(2\), z: \+p\[1\]\.toFixed\(2\), hw: \(big \? 7 : 6\) \/ 2, hd: 1\.5, rot: \+rot\.toFixed\(4\), h: big \? 3 : 2\.9, big \}\); scene\.userData\.covers = \(scene\.userData\.covers \|\| \[\]\)\.concat\(\[\{ id, group: g, blocker: blockers\[blockers\.length - 1\] \}\]\);/);
  assert.match(I, /if \(zone\.view3d\) m\.userData\.keep = true;/, '장갑차는 합치지 않는다 — 소멸하면 숨겨야'); assert.match(I, /braces: \[\], interacts, floodgates, narrows, covers,/);
  assert.match(W, /function coverHit\(c, at\) \{ if \(c\.hits >= COVER\.hits\) return; c\.hits\+\+; const st = coverStage\(c\.hits\);/); assert.match(W, /else \{ if \(g\) g\.visible = false; for \(const d of c\.decals\) d\.visible = false; const i = walkMeta\.blockers\.indexOf\(c\.ref && c\.ref\.blocker\); if \(i >= 0\) walkMeta\.blockers\.splice\(i, 1\);/, '소멸 — 막이도 풀린다');
  assert.match(W, /function turretTick\(dt\) \{ if \(net \|\| !INDOOR\) return; const o = fbs\.find\(x => x\.b\.id === 'arsenal' && x\.root\.visible && !x\.sealed\);/, '혼자 연습만 · 온라인은 서버(GPT)'); assert.match(W, /const iv = turretInterval\(k\); ARS\.tur\.push\(\{ m, iv, t: Math\.random\(\) \* iv, main, a \}\);/); assert.equal(TURRET.aimArc, Math.PI / 3); assert.match(W, /aims = da <= TURRET\.aimArc \/ 2; if \(!near \|\| !aims\) \{/, '내 방위 ±30° 포탑만 쏜다 (18 개가 다 쏘면 엄폐물이 1 초에 소멸)');
  assert.match(W, /const c = narrowAt\(COVERS\.filter\(c => c\.hits < COVER\.hits\), q\.x, q\.z\); if \(c && q\.y < c\.h\) \{ coverHit\(c, q\); ARS\.stats\.coverHits\+\+; done = true; \}/, '엄폐물이 대신 맞는다 — 소멸한 것은 안 막는다');
  assert.match(W, /devTick\(dt\); turretTick\(dt\);/);
});

test('소독약 복도 (문서 233 #9 박 준장): «원을 그릴 반경이 늘 반 뼘 모자람» L13334 — 벽을 안으로 세워 폭 2.6 m, 3.0 m 보다 좁으면 내 공격 85% · 흰 타일 · 관측창 · 비상등 맥동', async () => {
  const { CIRCLE, swingK } = await import('../js/mmo/env-rules.js');
  assert.equal(CIRCLE.need, 3.0); assert.equal(swingK({ w: 2.6 }), CIRCLE.k); assert.equal(swingK({ w: 3.2 }), 1); assert.equal(swingK({ hw: 4, hd: 0.8 }), 1, '폭 없는 좁은 구간(계단)은 그대로'); assert.equal(swingK(null), 1);
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), I = fs.readFileSync(new URL('../js/mmo/env-indoor.js', import.meta.url), 'utf8'), Z = fs.readFileSync(new URL('../js/mmo/zones.js', import.meta.url), 'utf8');
  assert.match(I, /corridor\(r, o\) \{[^\n]*if \(!zone\.view3d\) return;/); assert.match(I, /const W = r\.t1 - r\.t0, width = o\.width \?\? 2\.6, inset = \(W - width\) \/ 2,/); assert.match(I, /box\(L, H, inset, tileM, c\[0\], H \/ 2, c\[1\], SCREEN_ANG\); block\(c\[0\], c\[1\], L \/ 2, inset \/ 2, SCREEN_ANG\); \}/, '벽은 막이');
  assert.match(I, /Lt\.userData\.pulse = true;/, '비상등 맥동'); assert.match(I, /narrows\.push\(\{ x: \+cc\[0\]\.toFixed\(2\), z: \+cc\[1\]\.toFixed\(2\), hw: \+\(L \/ 2\)\.toFixed\(2\), hd: \+\(width \/ 2\)\.toFixed\(2\), rot: SCREEN_ANG, w: width,/);
  assert.match(Z, /\{ id: 'corridor', s: \[300, 350\], t: \[2, 6\], h: 3\.4, floor: 'tile', light: 'fluo', props: \[ \{ k: 'corridor', width: 2\.6 \} \] \}/);
  assert.match(W, /\* \(counter \? 1\.65 : 1\) \* swingK\(ENV\.narrow\)\); ai\.hp -= n;/, '좁은 복도에서 낫의 원이 걸린다'); assert.match(W, /\(ENV\.narrow\.label \|\| NARROW\.label\) \+ \(swingK\(ENV\.narrow\) < 1 \? ' · 공격 ' \+ Math\.round\(swingK\(ENV\.narrow\) \* 100\) \+ '%' : ''\)/);
});
