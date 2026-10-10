/* Explicit offline QA navigation only. Never spawns mobs, modifies health,
   grants items, or transmits a teleport to the live server. */
export function reviewTarget(mobs, bodyIds, currentId = null) {
  const live = [...mobs.values()].filter(m => m.alive && bodyIds.has(m.catalogId));
  live.sort((a, b) => a.catalogId.localeCompare(b.catalogId) || a.id.localeCompare(b.id));
  if (!live.length) return null;
  const next = (live.findIndex(m => m.id === currentId) + 1) % live.length;
  return live[next];
}
export function reviewStand(mob, ecology, radius = 2) {
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, p = [mob.x + Math.sin(a) * radius, mob.z + Math.cos(a) * radius];
    if (ecology.legal(mob.group.area, p) && ecology.canTraverse(mob.group.area, p, [mob.x, mob.z]))
      return { x: p[0], z: p[1] };
  }
  return null;
}
export function mountReviewControl({ enabled, online, ecology, bodyIds, move, notify, document }) {
  if (!enabled || online || !ecology) return null;
  const panel = document.createElement('div'), button = document.createElement('button');
  panel.setAttribute('aria-label', '오프라인 몬스터 검수 이동');
  panel.style.cssText = 'position:fixed;left:12px;top:126px;z-index:70;max-width:calc(100vw - 24px);font:12px system-ui;color:white;background:#13202bda;padding:8px;border:1px solid #667d91;border-radius:6px';
  button.textContent = '다음 5급 검수 대상으로 이동';
  button.style.cssText = 'min-width:220px;min-height:64px;background:#263c50;color:white;border:1px solid #99b3c9;border-radius:5px;padding:8px';
  const status = document.createElement('div'); status.textContent = '실제 생태 개체만 · 오프라인 검수 전용';
  let currentId = null;
  button.addEventListener('pointerdown', e => {
    e.stopPropagation(); const m = reviewTarget(ecology.mobs, bodyIds, currentId);
    if (!m) { notify('현재 지역에 검수할 N01 5급 개체가 없습니다', 3); return; }
    const p = reviewStand(m, ecology); if (!p) { notify('안전하게 설 자리를 찾지 못했습니다', 3); return; }
    currentId = m.id; move(p.x, p.z, Math.atan2(m.x - p.x, m.z - p.z));
    status.textContent = m.catalogId + ' · ' + m.id + ' · 세대 ' + m.generation;
  });
  panel.append(button, status); document.body.append(panel); return panel;
}
