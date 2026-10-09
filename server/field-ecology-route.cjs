/* Bounded A* on an injected, shared collision predicate. No engine/node access. */
class MinHeap {
  constructor() { this.a = []; }
  push(v) {
    const a = this.a; let i = a.length; a.push(v);
    while (i) { const p = (i - 1) >> 1; if (a[p].f <= v.f) break; a[i] = a[p]; i = p; } a[i] = v;
  }
  pop() {
    const a = this.a, first = a[0], end = a.pop(); if (!a.length) return first;
    let i = 0;
    while (i * 2 + 1 < a.length) { let child = i * 2 + 1; if (child + 1 < a.length && a[child + 1].f < a[child].f) child++; if (a[child].f >= end.f) break; a[i] = a[child]; i = child; }
    a[i] = end; return first;
  }
}
function planRoute(from, to, legal, traverse, { step = 2, budget = 8000 } = {}) {
  if (![from, to].every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) || !(step > 0 && step <= 4) || !Number.isInteger(budget) || budget < 1 || budget > 20000) throw Error('Invalid route request');
  if (!legal(from) || !legal(to)) return null;
  if (traverse(from, to)) return [from.slice(), to.slice()];
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]], heap = new MinHeap();
  const key = (x, z) => x + ',' + z, point = (x, z) => [from[0] + x * step, from[1] + z * step], dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const nodes = new Map(), allowed = new Map(), closed = new Set();
  const start = { x: 0, z: 0, g: 0, f: dist(from, to), parent: null }; nodes.set('0,0', start); heap.push(start);
  let visited = 0;
  while (heap.a.length && visited < budget) {
    const current = heap.pop(), id = key(current.x, current.z);
    if (closed.has(id) || nodes.get(id) !== current) continue; closed.add(id); visited++;
    const p = point(current.x, current.z);
    if (dist(p, to) <= step * 2 && traverse(p, to)) {
      const out = [to.slice()]; for (let n = current; n; n = n.parent) out.push(point(n.x, n.z));
      return out.reverse();
    }
    for (const [dx, dz] of dirs) {
      const x = current.x + dx, z = current.z + dz, k = key(x, z); if (closed.has(k)) continue;
      const q = point(x, z); if (!allowed.has(k)) allowed.set(k, legal(q));
      if (!allowed.get(k)) continue;
      const g = current.g + step * Math.hypot(dx, dz); if (nodes.has(k) && nodes.get(k).g <= g) continue;
      if (!traverse(p, q)) continue; // no diagonal corner cutting, including thin sanctuaries
      const next = { x, z, g, f: g + dist(q, to), parent: current }; nodes.set(k, next); heap.push(next);
    }
  }
  return null; // disconnected, or budget exhausted; never fake a route
}
module.exports = { planRoute };
