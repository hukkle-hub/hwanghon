/* 거점 길 그래프 (docs/design/201 §8) — 모든 길(routes)의 점을 마디로, 이웃한 점과 links 를 변으로.
   같은 점(1 cm 안)을 공유하는 길은 저절로 이어진다. 적이 목표를 바꾸면 «지금 자리에서 직선» 이 아니라 이 그래프의
   최단 경로로 간다 — 직선은 허공·벽을 지나 발전동 앞에서 적 19마리가 멈췄다 (tools/ue/node-sim.cjs).
   UE 쪽 같은 셈: UHWNodeConfig::PathBetween. 시험: tests/ue-node-config.test.cjs. */
(function (root, make) { const m = make(); if (typeof module === 'object' && module.exports) module.exports = m; else root.HW_NODE_GRAPH = m; })(typeof self !== 'undefined' ? self : this, function () {
  const pt = (n, v) => Array.isArray(v) ? v : n.anchors[v];
  function build(n) {
    const nodes = [], adj = [];
    const id = p => { for (let i = 0; i < nodes.length; i++) { const q = nodes[i]; if (Math.abs(q[0] - p[0]) < 1 && Math.abs(q[1] - p[1]) < 1 && Math.abs(q[2] - p[2]) < 1) return i; }
      nodes.push([p[0], p[1], p[2]]); adj.push([]); return nodes.length - 1; };
    const link = (a, b) => { if (a === b || adj[a].includes(b)) return; adj[a].push(b); adj[b].push(a); };
    for (const r of Object.values(n.routes)) { const ps = r.map(v => pt(n, v)); for (let i = 1; i < ps.length; i++) link(id(ps[i - 1]), id(ps[i])); }
    for (const [a, b] of n.links || []) link(id(pt(n, a)), id(pt(n, b)));
    return { nodes, adj };
  }
  /* 가장 가까운 마디 — 높이 차이는 세 배로 친다 (다른 층의 마디를 고르지 않게). 150 cm 까지는 무시: 몸(캡슐 중심)은 바닥보다 ~90 cm 위다 */
  function nearest(g, p) { let best = -1, bd = Infinity;
    for (let i = 0; i < g.nodes.length; i++) { const q = g.nodes[i], d = Math.hypot(q[0] - p[0], q[1] - p[1]) + 3 * Math.max(0, Math.abs(q[2] - p[2]) - 150); if (d < bd) { bd = d; best = i; } }
    return best; }
  const cost = (g, a, b) => { const p = g.nodes[a], q = g.nodes[b]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  /* from 근처 마디 → to 근처 마디의 최단 경로 (점 목록). 못 가면 [] */
  function path(g, from, to) {
    const s = nearest(g, from), t = nearest(g, to); if (s < 0 || t < 0) return [];
    const n = g.nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false); dist[s] = 0;
    for (;;) { let u = -1; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === t) break; done[u] = true;
      for (const v of g.adj[u]) { const d = dist[u] + cost(g, u, v); if (d < dist[v]) { dist[v] = d; prev[v] = u; } } }
    if (dist[t] === Infinity) return [];
    const out = []; for (let v = t; v >= 0; v = prev[v]) out.unshift(g.nodes[v]); return out;
  }
  return { build, nearest, path };
});
