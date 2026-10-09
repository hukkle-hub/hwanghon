/* 지역 표의 hunts(길 좌표) → map.json areas(월드 다각형/원) — 굽기(tools/2d/bake-map.html)와 구역만 고치기(tools/2d/patch-areas.mjs)가 같이 쓴다.
   길 좌표 틀은 게임(mmo.html toRoad)·서버(field.cjs clamp)와 같다. kind: hunt(기본) · rest · siege(거점 점령 지점, 문서 192 §8) */
import { huntMobs, ecologyOf } from './hunt-pools.js';   /* «(가안)» 사냥터에 캐논 종을 앉힌다 (문서 208) — zoneId 를 주면 */
export function huntAreas(hunts, ang, zoneId = null, place = null) {   /* place(area) → { ok(x,z), link(a,b) }: 생태 자리(둥지·순찰)를 깔 때 «걸을 수 있나» · «길이 이어지나» — 없으면 생태 자리를 안 깐다 */ const FR = (s, t) => [+(s * Math.cos(ang) - t * Math.sin(ang)).toFixed(2), +(-s * Math.sin(ang) - t * Math.cos(ang)).toFixed(2)];
  return (hunts || []).map(h => { const shape = h.r ? { circle: [...FR(h.st[0], h.st[1]), h.r] } : { poly: [FR(h.s[0], h.t[0]), FR(h.s[1], h.t[0]), FR(h.s[1], h.t[1]), FR(h.s[0], h.t[1])] };
    const kind = h.kind || 'hunt', P = zoneId && place && kind === 'hunt' ? place({ kind, id: h.id, ...shape }) : null;
    return { kind, id: h.id, name: h.name, lv: h.lv || null, mobs: h.mobs || '', danger: h.danger || 1, ...(zoneId ? huntMobs(zoneId, h) : {}),
      ...(P ? { eco: ecologyOf(zoneId, h, ang, P.ok, P.link) } : {}), ...shape }; }); }
export const HUNT_KINDS = ['hunt', 'rest', 'siege'];
