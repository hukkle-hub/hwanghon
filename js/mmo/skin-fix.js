/* 스킨 가중치 바로잡기 (문서 225) — 디렉터 «모션에 다 늘어나서 붙었네».
   자동 리깅이 늘어뜨린 손과 허벅지처럼 «가까이 있던» 먼 뼈끼리 정점을 나눠 묶었다(클레이브 정점 24 %: 왼손+왼종아리 1119 · 오른허벅지+오른아래팔 884 …).
   팔을 휘두르면 그 정점이 손과 다리 사이에서 엿가락처럼 늘어난다. 정점마다 «주인 뼈 무리»(위계로 hops 칸 안)만 남기고 나머지 가중치를 버린 뒤 다시 1 로 맞춘다.
   주인 무리는 «그 안 가중치 합» 이 가장 큰 뼈를 가운데로 고른다 — 가중치 1위가 엉뚱한 다리여도 손 무리 합이 크면 손 무리가 이긴다.
   구운 에셋을 런타임에 고치므로 AnimationMixer 보다 먼저, 복제(clone)보다 먼저 한 번(지오메트리는 복제끼리 같이 쓴다). */
export function hopTable(bones) {
  const par = bones.map(b => bones.indexOf(b.parent)), n = bones.length, D = [];
  for (let a = 0; a < n; a++) { const up = new Map(); for (let i = a, d = 0; i >= 0; i = par[i], d++) up.set(i, d);
    D.push(bones.map((_, b) => { for (let j = b, d = 0; j >= 0; j = par[j], d++) if (up.has(j)) return up.get(j) + d; return 99; })); }
  return D;
}
/* geometry 의 skinIndex/skinWeight 를 그 자리에서 고친다. 돌려줌: 고친 정점 수 */
export function pruneFarWeights(geometry, bones, hops = 2) {
  if (geometry.userData.skinPruned) return 0; const si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight; if (!si || !sw) return 0;
  const D = hopTable(bones); let fixed = 0; const idx = [0, 0, 0, 0], w = [0, 0, 0, 0], anchor = new Int16Array(si.count).fill(-1);
  for (let v = 0; v < si.count; v++) {
    for (let k = 0; k < 4; k++) { idx[k] = si.getComponent(v, k); w[k] = sw.getComponent(v, k); }
    let best = -1, bestSum = -1; for (let k = 0; k < 4; k++) { if (w[k] <= 0) continue; let s = 0; for (let j = 0; j < 4; j++) if (w[j] > 0 && D[idx[k]][idx[j]] <= hops) s += w[j]; if (s > bestSum + 1e-9) { bestSum = s; best = idx[k]; } }
    if (best < 0) continue; anchor[v] = best; let changed = false, tot = 0;
    for (let k = 0; k < 4; k++) { if (w[k] > 0 && D[best][idx[k]] > hops) { w[k] = 0; changed = true; } tot += w[k]; }
    if (!changed || tot <= 0) continue; fixed++;
    for (let k = 0; k < 4; k++) sw.setComponent(v, k, w[k] / tot);
  }
  sw.needsUpdate = true; geometry.userData.skinPruned = true; geometry.userData.skinAnchor = anchor; geometry.userData.skinHops = D; return fixed;
}
/* 붙은 살 끊기: 주인 뼈가 위계로 cut 칸보다 먼 정점끼리 이은 삼각형(늘어뜨린 손과 허벅지를 잇던 «물갈퀴»)을 지운다. 돌려줌: 지운 삼각형 수 */
export function cutBridges(geometry, cut = 3) {
  const a = geometry.userData.skinAnchor, D = geometry.userData.skinHops, ix = geometry.index; if (!a || !ix || geometry.userData.skinCut) return 0;
  const keep = []; let gone = 0;
  for (let t = 0; t < ix.count; t += 3) { const p = ix.getX(t), q = ix.getX(t + 1), r = ix.getX(t + 2), A = a[p], B = a[q], C = a[r];
    if (A >= 0 && B >= 0 && C >= 0 && (D[A][B] > cut || D[B][C] > cut || D[A][C] > cut)) { gone++; continue; } keep.push(p, q, r); }
  if (gone) { geometry.setIndex(keep); for (const g of geometry.groups) { g.start = 0; g.count = keep.length; } }   /* 재질 묶음이 하나인 보스 메시 기준 */
  geometry.userData.skinCut = true; return gone;
}
/* 떨어진 조각 굳히기: 몸통과 이어지지 않은 조각(같은 자리 정점 용접 뒤)인데 한 뼈가 가중치의 rigid 넘게 끌면 그 뼈에 100 % 묶는다.
   클레이브 셔터 아래 절반(3898 정점)이 왼손 70 % · 왼발·발끝 20 % 로 묶여 손을 들면 바닥까지 판자처럼 늘어났다. 돌려줌: 굳힌 정점 수 */
export function rigidIslands(geometry, rigid = .6, maxShare = .3) {
  const P = geometry.attributes.position, ix = geometry.index, si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight; if (!ix || !si) return 0;
  const n = P.count, id = new Int32Array(n), m = new Map(); for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4); if (!m.has(k)) m.set(k, m.size); id[i] = m.get(k); }
  const par = new Int32Array(m.size).map((_, i) => i), f = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let t = 0; t < ix.count; t += 3) { const a = f(id[ix.getX(t)]); par[f(id[ix.getX(t + 1)])] = a; par[f(id[ix.getX(t + 2)])] = a; }
  const comps = new Map(); for (let i = 0; i < n; i++) { const r = f(id[i]); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); }
  let done = 0; const mask = geometry.userData.rigidMask = new Uint8Array(n); for (const c of comps.values()) { if (c.length > n * maxShare) continue; const tot = new Map(); let all = 0;
    for (const i of c) for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > 0) { const b = si.getComponent(i, k); tot.set(b, (tot.get(b) || 0) + w); all += w; } }
    let best = -1, bw = 0; for (const [b, w] of tot) if (w > bw) { bw = w; best = b; } if (best < 0 || bw / all < rigid || bw / all > .999) continue;
    for (const i of c) { si.setXYZW(i, best, 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); mask[i] = 1; } done += c.length; }
  if (done) { si.needsUpdate = sw.needsUpdate = true; } return done;
}
/* 모델 안 스킨 메시 전부 */
export function fixSkin(model, hops = 2, cut = 3, rigid = .6) { let n = 0, tri = 0, isl = 0; model.traverse(o => { if (!o.isSkinnedMesh) return; if (rigid) isl += rigidIslands(o.geometry, rigid);
  if (hops) n += pruneFarWeights(o.geometry, o.skeleton.bones, hops); if (hops && cut) tri += cutBridges(o.geometry, cut); }); return { islands: isl, verts: n, tris: tri }; }

/* ── 다시 묶기 (rebind) — 위계 칸 수 대신 «몸의 어느 갈래인가» 를 정점마다 정한다 ──
   갈래: 왼팔·오른팔·왼다리·오른다리·몸통(골반·척추·목·머리). 정점의 주인 갈래 = 원래 가중치 × exp(−뼈 마디까지 거리 / σ) 가 가장 큰 것.
   허벅지에 붙은 손 / 손에 붙은 코트 자락처럼 «가중치는 반반» 인 정점을 거리로 가른다(손 피부는 손뼈에 5 cm, 코트는 허벅지에 더 가깝다).
   남기는 가중치: 주인 갈래 + 몸통(+ 몸통 주인이면 가장 센 팔다리 하나). 좌우 다리를 반반 쥔 자락(코트 앞섶)은 그 몫을 골반으로 옮긴다.
   서로 다른 팔다리 갈래를 잇는 삼각형(붙은 살)은 지운다. */
const LIMB = [/^mixamorigLeft(Arm|ForeArm|Hand)/, /^mixamorigRight(Arm|ForeArm|Hand)/,   /* 어깨(빗장)는 몸통 — 믹사모 어깨뼈는 목 옆에서 시작해 빗장 마디가 머리 옆을 지난다 */ /^mixamorigLeft(UpLeg|Leg|Foot|Toe)/, /^mixamorigRight(UpLeg|Leg|Foot|Toe)/];
export const limbOf = name => { for (let i = 0; i < 4; i++) if (LIMB[i].test(name)) return i; return 4; };   /* 4 = 몸통 */
function segDist(p, a, b) { const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, l = abx * abx + aby * aby + abz * abz; let t = l > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l : 0; t = Math.max(0, Math.min(1, t));
  const x = a.x + abx * t - p.x, y = a.y + aby * t - p.y, z = a.z + abz * t - p.z; return Math.sqrt(x * x + y * y + z * z); }
export function rebind(THREE, mesh, { sigma = .08, wpow = 1, floor = 0, reach = 2, geo: geodesic = false, core = .25, tube = 0, cut = true, skirt = false, island = .02 } = {}) {   /* reach: 몸통 주인 정점이 팔다리 가중치를 지니는 거리(σ 배) — 어깨·골반 이음새만 */   /* skirt: 재 보니 골반↔골반 늘어남이 더 커져 기본은 끔 */
  const geo = mesh.geometry; if (geo.userData.rebound) return null; const sk = mesh.skeleton, bones = sk.bones, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, P = geo.attributes.position, n = P.count, ix = geo.index;
  const grp = bones.map(b => limbOf(b.name)), hips = bones.findIndex(b => /Hips$/.test(b.name));
  /* 바인드 자세의 뼈 자리 (메시 바인드 공간) */
  const J = bones.map((b, i) => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert()));
  const segs = [];   /* [a, b, 갈래, 뼈] — 부모→자식 마디는 부모 갈래(골반→허벅지는 몸통, 어깨→위팔은 팔), 끝 뼈는 부모 방향으로 60 % 늘인다 */
  bones.forEach((b, i) => { const p = bones.indexOf(b.parent); if (p >= 0) segs.push([J[p], J[i], grp[p], p]);
    if (!b.children.some(c => bones.includes(c) && !/Slot$/.test(c.name)) && p >= 0) segs.push([J[i], J[i].clone().add(J[i].clone().sub(J[p]).multiplyScalar(.6)), grp[i], i]); });
  let H = 0; { const bb = new THREE.Box3(); for (const j of J) bb.expandByPoint(j); H = bb.max.y - bb.min.y || 1; } const S = sigma * H;
  const v = new THREE.Vector3(), label = new Int8Array(n), Wg = new Float32Array(n * 5), near = new Int16Array(n * 5), DG = new Float32Array(n * 5), OI = new Uint16Array(n * 4), OW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i).applyMatrix4(mesh.bindMatrix); const D = [1e9, 1e9, 1e9, 1e9, 1e9];
    for (let k = 0; k < 4; k++) { OI[i * 4 + k] = si.getComponent(i, k); OW[i * 4 + k] = sw.getComponent(i, k); if (OW[i * 4 + k] > 0) Wg[i * 5 + grp[OI[i * 4 + k]]] += OW[i * 4 + k]; }
    for (const [a, b, g, bone] of segs) { const d = segDist(v, a, b); if (d < D[g]) { D[g] = d; near[i * 5 + g] = bone; } } for (let g = 0; g < 5; g++) DG[i * 5 + g] = D[g];
    let best = 4, bs = -1; for (let g = 0; g < 5; g++) { const sc = Math.pow(Wg[i * 5 + g] + floor, wpow) * Math.exp(-D[g] / S); if (sc > bs) { bs = sc; best = g; } } label[i] = best; }
  /* 팔 관(tube): 팔 주인인데 팔뼈에서 tube×키 넘게 떨어진 정점은 소매가 아니라 옆구리 코트 — 팔이 아닌 가장 가까운 갈래로 */
  /* 굳힌 조각(소품)·손 둘레는 빼고, 위팔·아래팔 옆에 늘어진 천만 몸통으로 */
  if (tube > 0) { const rig = geo.userData.rigidMask; for (let i = 0; i < n; i++) { const L = label[i]; if (L > 1 || (rig && rig[i]) || DG[i * 5 + L] <= tube * H || /Hand/.test(bones[near[i * 5 + L]].name)) continue; label[i] = 4; } }
  /* 같은 자리 정점 용접 (UV 이음매로 갈린 정점을 한 몸으로) */
  const wid = new Int32Array(n); { const m = new Map(); for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4); if (!m.has(k)) m.set(k, m.size); wid[i] = m.get(k); } }
  /* 표면 거리(geodesic) 갈래: 뼈를 꼭 감싼 정점(갈래마다 거리 하위 core 분위) + 그 갈래 가중치 ≥ .9 를 씨앗으로, 메시 표면을 따라 먼저 닿는 갈래가 주인.
     옆구리 코트는 팔 옆에 있어도 표면으로는 몸통에서 이어진다 */
  if (geodesic && ix) { const nW = Math.max(...wid) + 1, adj = Array.from({ length: nW }, () => []), pos = new Array(nW);
    for (let i = 0; i < n; i++) if (!pos[wid[i]]) pos[wid[i]] = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(mesh.bindMatrix);
    for (let t = 0; t < ix.count; t += 3) { const q = [wid[ix.getX(t)], wid[ix.getX(t + 1)], wid[ix.getX(t + 2)]]; for (let e = 0; e < 3; e++) { const a = q[e], b = q[(e + 1) % 3]; if (a !== b) { const d = pos[a].distanceTo(pos[b]); adj[a].push(b, d); adj[b].push(a, d); } } }
    const cut5 = [0, 1, 2, 3, 4].map(g => { const ds = []; for (let i = 0; i < n; i++) if (Wg[i * 5 + g] >= .9) ds.push(DG[i * 5 + g]); ds.sort((a, b) => a - b); return ds.length ? ds[Math.floor(ds.length * core)] : -1; });
    const dist = new Float64Array(nW).fill(Infinity)   /* Float32 면 저장할 때 올림돼 «더 짧다» 가 끝없이 참 — 멈춘다 */, lab = new Int8Array(nW).fill(-1), heap = [];
    const push = (d, x) => { heap.push([d, x]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    for (let i = 0; i < n; i++) for (let g = 0; g < 5; g++) if (Wg[i * 5 + g] >= .9 && DG[i * 5 + g] <= cut5[g] && dist[wid[i]] > 0) { dist[wid[i]] = 0; lab[wid[i]] = g; push(0, wid[i]); }
    while (heap.length) { const [d, x] = pop(); if (d > dist[x]) continue; const A = adj[x]; for (let k = 0; k < A.length; k += 2) { const y = A[k], nd = d + A[k + 1]; if (nd < dist[y]) { dist[y] = nd; lab[y] = lab[x]; push(nd, y); } } }
    for (let i = 0; i < n; i++) if (lab[wid[i]] >= 0) label[i] = lab[wid[i]]; }
  const bad = (x, y) => x !== y && x < 4 && y < 4;   /* 다른 팔다리끼리 = 붙은 살 */
  const triBad = t => { const a = label[ix.getX(t)], b = label[ix.getX(t + 1)], c = label[ix.getX(t + 2)]; return bad(a, b) || bad(b, c) || bad(a, c); };
  /* 끊고 나면 떨어져 나갈 작은 조각은 건너편 갈래로 보낸다 — 팔에 딸려 허공에 뜨는 코트 자락을 막는다 */
  let moved = 0; if (cut && ix) for (let pass = 0; pass < 4; pass++) {
    const par = new Int32Array(n).map((_, i) => i), f = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; }, uni = (a, b) => { a = f(a); b = f(b); if (a !== b) par[b] = a; };
    const byW = new Map(); for (let i = 0; i < n; i++) { const r = byW.get(wid[i]); if (r === undefined) byW.set(wid[i], i); else uni(r, i); }
    const across = new Map();   /* 조각 뿌리 → 건너편 갈래 표 */
    for (let t = 0; t < ix.count; t += 3) { const q = [ix.getX(t), ix.getX(t + 1), ix.getX(t + 2)];
      if (!triBad(t)) { uni(q[0], q[1]); uni(q[1], q[2]); continue; }
      for (const x of q) for (const y of q) if (bad(label[x], label[y])) { const k = f(x); if (!across.has(k)) across.set(k, [0, 0, 0, 0, 0]); across.get(k)[label[y]]++; } }
    const size = new Map(); for (let i = 0; i < n; i++) { const r = f(i); size.set(r, (size.get(r) || 0) + 1); }
    let any = 0; const to = new Map(); for (const [r, votes] of across) { const rr = f(r); if ((size.get(rr) || 0) > n * island) continue; let g = -1, m = 0; votes.forEach((c, k) => { if (c > m) { m = c; g = k; } }); if (g >= 0) to.set(rr, g); }
    for (let i = 0; i < n; i++) { const g = to.get(f(i)); if (g !== undefined && label[i] !== g) { label[i] = g; any++; } }
    moved += any; if (!any) break; }
  /* 가중치: 주인 갈래 + 몸통(+ 몸통 주인이면 가장 센 팔다리 하나). 남는 게 없으면 그 갈래의 가장 가까운 뼈에 */
  let changed = 0; const w = [0, 0, 0, 0], b4 = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) { const best = label[i]; let limb2 = -1; if (best === 4) { let m = 0; for (let g = 0; g < 4; g++) if (Wg[i * 5 + g] > m && DG[i * 5 + g] < reach * S) { m = Wg[i * 5 + g]; limb2 = g; } }
    let any = false, tot = 0; for (let k = 0; k < 4; k++) { b4[k] = OI[i * 4 + k]; w[k] = OW[i * 4 + k]; const g = grp[b4[k]]; if (w[k] > 0 && !(g === best || g === 4 || g === limb2)) { w[k] = 0; any = true; } tot += w[k]; }
    if (skirt && (best === 2 || best === 3) && hips >= 0) { const mv = Math.min(Wg[i * 5 + best], Wg[i * 5 + (best === 2 ? 3 : 2)]); if (mv > .02) { for (let k = 0; k < 4; k++) if (grp[b4[k]] === best) w[k] *= Math.max(0, 1 - mv / Wg[i * 5 + best]);
      let h = b4.findIndex((b, k) => b === hips && w[k] > 0); if (h < 0) { h = w.indexOf(Math.min(...w)); b4[h] = hips; w[h] = 0; } w[h] += mv; any = true; tot = w[0] + w[1] + w[2] + w[3]; } }
    if (tot <= 1e-6) { b4[0] = near[i * 5 + best]; w[0] = 1; b4[1] = b4[2] = b4[3] = 0; w[1] = w[2] = w[3] = 0; tot = 1; any = true; }
    if (!any) continue; changed++; si.setXYZW(i, b4[0], b4[1], b4[2], b4[3]); sw.setXYZW(i, w[0] / tot, w[1] / tot, w[2] / tot, w[3] / tot); }
  si.needsUpdate = sw.needsUpdate = true;
  let gone = 0; if (cut && ix) { const keep = []; for (let t = 0; t < ix.count; t += 3) { if (triBad(t)) { gone++; continue; } keep.push(ix.getX(t), ix.getX(t + 1), ix.getX(t + 2)); } if (gone) geo.setIndex(keep); }
  geo.userData.rebound = true; geo.userData.skinLabel = label; const count = [0, 0, 0, 0, 0]; for (let i = 0; i < n; i++) count[label[i]]++;
  return { changed, cut: gone, moved, labels: count, sigma: S };
}
export function rebindModel(THREE, model, opts) { const out = []; model.traverse(o => { if (o.isSkinnedMesh) { const isl = rigidIslands(o.geometry); const r = rebind(THREE, o, opts); out.push({ mesh: o.name, islands: isl, ...r }); } }); return out; }
