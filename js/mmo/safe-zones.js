/* 안전 지대 — 게임(mmo.html)과 서버(server/field.cjs)가 같이 쓴다 (문서 198).
   map.json areas 의 kind 'rest' (마을·쉼터) 안이 안전 지대다. 상점·창고·판매는 여기서만.
   거점(areas 에 kind 'siege' 가 있는 지역)의 마을은 «처음엔 보스가 차지하고 있다» — 길드가 빼앗기 전까지는 안전 지대가 아니다 (디렉터 2026-10-07). */
(function (root, make) { const m = make(); if (typeof module === 'object' && module.exports) module.exports = m; else root.TW_SAFE = m; })(typeof self !== 'undefined' ? self : this, function () {
  function inArea(a, x, z) {
    if (a.circle) { const [cx, cz, r] = a.circle; return (x - cx) ** 2 + (z - cz) ** 2 <= r * r; }
    if (!a.poly) return false; let inside = false;
    for (let i = 0, j = a.poly.length - 1; i < a.poly.length; j = i++) { const [xi, zi] = a.poly[i], [xj, zj] = a.poly[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; }
    return inside; }
  const isHub = areas => (areas || []).some(a => a.kind === 'siege');
  /* 거점의 기본 주인 — 서버가 따로 알려 주지 않으면 보스 */
  const BOSS_OWNER = { kind: 'boss', name: '거점의 주인' };
  /* owner: 거점 주인 {kind:'boss'|'guild'} — 거점이 아닌 지역은 무시한다 */
  function safeArea(areas, x, z, owner) {
    if (isHub(areas) && !(owner && owner.kind === 'guild')) return null;
    return (areas || []).find(a => a.kind === 'rest' && inArea(a, x, z)) || null; }
  return { inArea, isHub, safeArea, BOSS_OWNER };
});
