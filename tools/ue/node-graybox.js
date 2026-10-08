/* 거점 그레이박스 기하 — ue/HwanghonCombatUE/Content/Data/node_<id>.json → 상자들 (docs/design/200).
   UE 쪽(UHWNodeConfig::LoadFromJson)과 같은 셈: 받침(pad)·경사로(road)·벽(wall)·시설. 단위 cm, +X 동, +Y 북, Z 위.
   시험(tests/ue-node-config.test.cjs)과 미리보기(tools/ue/node-graybox.html)가 같이 쓴다. */
(function (root, make) { const m = make(); if (typeof module === 'object' && module.exports) module.exports = m; else root.HW_NODE = m; })(typeof self !== 'undefined' ? self : this, function () {
  const SLAB = 40;  // 바닥 판 두께 (UE SlabThick)
  const pt = (n, v) => Array.isArray(v) ? v : n.anchors[v];
  /* UE FRotator(Pitch, Yaw, 0): 앞(+X)이 (cos p cos y, cos p sin y, sin p), 위(+Z)가 (−sin p cos y, −sin p sin y, cos p) */
  const axes = (pitch, yaw) => { const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180;
    return { f: [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p)], r: [-Math.sin(y), Math.cos(y), 0], u: [-Math.sin(p) * Math.cos(y), -Math.sin(p) * Math.sin(y), Math.cos(p)] }; };
  function blocks(n) {
    const out = [];
    for (const p of n.pads) { const a = pt(n, p.at); out.push({ kind: 'pad', pkind: p.kind || 'pad', center: [a[0], a[1], a[2] - SLAB / 2], half: [p.half[0], p.half[1], SLAB / 2], yaw: 0, pitch: 0 }); }
    for (const r of n.roads) { const A = r.from, B = r.to, d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], run = Math.hypot(d[0], d[1]), len = Math.hypot(run, d[2]);
      const pitch = Math.atan2(d[2], run) * 180 / Math.PI, yaw = Math.atan2(d[1], d[0]) * 180 / Math.PI, { u } = axes(pitch, yaw);
      out.push({ kind: r.kind && r.kind !== 'road' ? 'flank' : 'road', rkind: r.kind || 'road', center: [(A[0] + B[0]) / 2 - u[0] * SLAB / 2, (A[1] + B[1]) / 2 - u[1] * SLAB / 2, (A[2] + B[2]) / 2 - u[2] * SLAB / 2], half: [len / 2 + 40, r.half_width, SLAB / 2], yaw, pitch }); }
    /* 벽: x0..x1 at y (동서로 긴 벽) 또는 y0..y1 at x (남북). kind: wall(기본)·building·cover(낮은 엄폐) */
    for (const w of n.walls) { const d = w.half_depth || 50, k = w.kind || 'wall';
      if (w.y0 != null) out.push({ kind: 'wall', wkind: k, center: [w.x, (w.y0 + w.y1) / 2, w.floor + w.height / 2], half: [d, Math.abs(w.y1 - w.y0) / 2, w.height / 2], yaw: 0, pitch: 0 });
      else out.push({ kind: 'wall', wkind: k, center: [(w.x0 + w.x1) / 2, w.y, w.floor + w.height / 2], half: [Math.abs(w.x1 - w.x0) / 2, d, w.height / 2], yaw: 0, pitch: 0 }); }
    for (const f of n.facilities) { const a = pt(n, f.at); out.push({ kind: 'facility', id: f.id, fkind: f.kind, center: [a[0], a[1], a[2] + f.half[2]], half: f.half, yaw: 0, pitch: 0 }); }
    return out;
  }
  /* 점 (x, y) 바로 위·아래에서 이 상자의 윗면 높이 (덮지 않으면 null) */
  function topAt(b, x, y) {
    const { f, r, u } = axes(b.pitch, b.yaw), dx = x - b.center[0], dy = y - b.center[1];
    // 윗면: center + u·h + f·s + r·t,  수평 성분이 (dx, dy) 가 되는 s, t
    const ox = dx - u[0] * b.half[2], oy = dy - u[1] * b.half[2], det = f[0] * r[1] - f[1] * r[0];
    if (Math.abs(det) < 1e-9) return null;
    const s = (ox * r[1] - oy * r[0]) / det, t = (f[0] * oy - f[1] * ox) / det;
    if (Math.abs(s) > b.half[0] || Math.abs(t) > b.half[1]) return null;
    return b.center[2] + u[2] * b.half[2] + f[2] * s + r[2] * t; }
  function floorAt(bs, x, y, z) { let best = null;
    for (const b of bs) { if (b.kind !== 'pad' && b.kind !== 'road' && b.kind !== 'flank') continue; const h = topAt(b, x, y); if (h != null && (best == null || Math.abs(h - z) < Math.abs(best - z))) best = h; }
    return best; }
  /* 걸어가는 몸이 설 바닥: 발에서 step(턱 45 cm) 안으로 올라설 수 있는 «가장 높은» 면. floorAt(가장 가까운 면)으로 걸으면
     경사로 시작점에서 발판(같은 높이)을 계속 골라 경사로 상자 «안» 을 걷다가 발판 끝 64 cm 턱에 영영 붙었다 — UE 캡슐은 경사면을 탄다.
     올라설 면이 없으면 가장 낮은 면(턱이 높아 못 간다로 판정되게). 바닥이 없으면 null. */
  function standAt(bs, x, y, foot, step = 45) { let up = null, low = null;
    for (const b of bs) { if (b.kind !== 'pad' && b.kind !== 'road' && b.kind !== 'flank') continue; const h = topAt(b, x, y); if (h == null) continue;
      if (h - foot <= step && (up == null || h > up)) up = h; if (low == null || h < low) low = h; }
    return up != null ? up : low; }
  /* 선분이 상자(벽·시설)를 수평으로 지나는가 — 키 높이(바닥 +50 cm)에서 */
  function crosses(b, A, B) { for (let k = 0; k <= 100; k++) { const x = A[0] + (B[0] - A[0]) * k / 100, y = A[1] + (B[1] - A[1]) * k / 100, z = A[2] + (B[2] - A[2]) * k / 100 + 50;
      if (Math.abs(x - b.center[0]) < b.half[0] && Math.abs(y - b.center[1]) < b.half[1] && Math.abs(z - b.center[2]) < b.half[2]) return true; } return false; }
  return { SLAB, blocks, topAt, floorAt, standAt, crosses, pt };
});
