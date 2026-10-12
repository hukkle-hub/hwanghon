/* 작은 구멍 메우기 (문서 229 §52) — N01 보행자 목: 목과 깃이 만나는 자리에 3~12 정점짜리 작은 구멍이 열려 있어
   (찰흙으로 보면 검은 틈) 뒷목·옆목에 «삐죽한 검은 조각» 이 보였다. 열린 테두리를 고리로 나누고(두 구멍이 한 정점에서 만나는 8 자도 둘로) 작은 고리만
   있는 정점으로 부채꼴 삼각형을 채운다 — 새 정점 없음(가중치·UV·노멀은 둘레 정점 것), 감는 방향은 이웃 면과 같게.
   머리카락 끝·소매 끝 같은 큰 열린 테두리는 크기 제한으로 건드리지 않는다. 공유 geometry 에 한 번 */
export const FILL = { maxVerts: 12, maxSize: .03 };
export function fillSmallHoles(THREE, root, opt = {}) {
  const maxV = opt.maxVerts ?? FILL.maxVerts, maxS = opt.maxSize ?? FILL.maxSize, out = { loops: 0, tris: 0 };
  root.traverse(o => { const geo = o.isMesh && o.geometry; if (!geo || !geo.index || geo.userData.holesFilled || geo.groups.length > 1) return; geo.userData.holesFilled = true;
    const pos = geo.attributes.position, idx = geo.index, key = new Int32Array(pos.count), id = new Map();
    for (let i = 0; i < pos.count; i++) { const k = ((Math.round(pos.getX(i) * 1e4) + 50000) * 100001 + Math.round(pos.getY(i) * 1e4) + 50000) * 100001 + Math.round(pos.getZ(i) * 1e4) + 50000; let n = id.get(k);   /* 0.1 mm 격자 · ±5 m 안 — 숫자 열쇠 */ if (n === undefined) id.set(k, n = id.size); key[i] = n; }
    const cnt = new Map(), dir = [];   /* 무방향 변 쓰임 수 · 면 안 방향 변(a→b, a 의 원래 정점) */
    for (let t = 0; t < idx.count; t += 3) for (let k = 0; k < 3; k++) { const ia = idx.getX(t + k), ib = idx.getX(t + (k + 1) % 3), a = key[ia], b = key[ib]; if (a === b) continue;
      const u = a < b ? a * 4194304 + b : b * 4194304 + a; cnt.set(u, (cnt.get(u) || 0) + 1); dir.push(a, b, ia, ib, u); }
    const out_ = new Map(), rep = new Map();   /* 구멍 둘레는 면 방향의 반대로 돈다: b → a. 두 구멍이 한 정점에서 만나면(8 자) 나가는 변이 둘 */
    for (let j = 0; j < dir.length; j += 5) { if (cnt.get(dir[j + 4]) !== 1) continue; const a = dir[j], b = dir[j + 1];
      (out_.get(b) || out_.set(b, []).get(b)).push(a); if (!rep.has(a)) rep.set(a, dir[j + 2]); if (!rep.has(b)) rep.set(b, dir[j + 3]); }
    const loops = [];   /* 변을 한 번씩 따라 걷다 지나온 정점을 다시 만나면 거기서 고리 하나를 떼어 낸다 — 8 자도 작은 고리 둘로 */
    for (const s of out_.keys()) { const path = [s], at = new Map([[s, 0]]); let c = s;
      for (;;) { const nx = out_.get(c); if (!nx || !nx.length) break; const d = nx.pop();
        if (at.has(d)) { const j = at.get(d), lp = path.splice(j + 1); lp.unshift(d); loops.push(lp); for (const k of lp.slice(1)) at.delete(k); c = d; if (path.length === 1 && !(out_.get(d) || []).length) break; continue; }
        at.set(d, path.length); path.push(d); c = d; } }
    const add = [], v = new THREE.Vector3(), box = new THREE.Box3(), sz = new THREE.Vector3();
    for (const loop of loops) { if (loop.length < 3 || loop.length > maxV) continue;
      box.makeEmpty(); for (const k of loop) box.expandByPoint(v.fromBufferAttribute(pos, rep.get(k))); if (Math.max(...box.getSize(sz).toArray()) > maxS) continue;
      for (let i = 1; i + 1 < loop.length; i++) add.push(rep.get(loop[0]), rep.get(loop[i]), rep.get(loop[i + 1]));
      out.loops++; out.tris += loop.length - 2; }
    if (!add.length) return;
    const old = idx.array, arr = new (pos.count > 65535 ? Uint32Array : old.constructor)(old.length + add.length); arr.set(old); arr.set(add, old.length);
    geo.setIndex(new THREE.BufferAttribute(arr, 1)); if (geo.groups.length === 1) geo.groups[0].count = arr.length; });
  return out;
}
