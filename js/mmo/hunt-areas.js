/* 지역 표의 hunts(길 좌표) → map.json areas(월드 다각형/원) — 굽기(tools/2d/bake-map.html)와 구역만 고치기(tools/2d/patch-areas.mjs)가 같이 쓴다.
   길 좌표 틀은 게임(mmo.html toRoad)·서버(field.cjs clamp)와 같다. kind: hunt(기본) · rest · siege(거점 점령 지점, 문서 192 §8) */
export function huntAreas(hunts, ang) { const FR = (s, t) => [+(s * Math.cos(ang) - t * Math.sin(ang)).toFixed(2), +(-s * Math.sin(ang) - t * Math.cos(ang)).toFixed(2)];
  return (hunts || []).map(h => ({ kind: h.kind || 'hunt', id: h.id, name: h.name, lv: h.lv || null, mobs: h.mobs || '', danger: h.danger || 1,
    ...(h.r ? { circle: [...FR(h.st[0], h.st[1]), h.r] } : { poly: [FR(h.s[0], h.t[0]), FR(h.s[1], h.t[0]), FR(h.s[1], h.t[1]), FR(h.s[0], h.t[1])] }) })); }
export const HUNT_KINDS = ['hunt', 'rest', 'siege'];
