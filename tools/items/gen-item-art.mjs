// 아이템 고유 이미지 생성기 — 의존성 없음. `node tools/items/gen-item-art.mjs` → art/items/<id>.svg
// 64×64 뷰박스, 투명 배경, 슬롯·상세 어디서나 쓰는 벡터 아이콘. items.js 의 모든 기본 아이템 id 를 빠짐없이 덮는다.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'art', 'items'); mkdirSync(OUT, { recursive: true });

/* ---- 공통 팔레트·그라디언트 ---- */
const P = {
  iron:['#8f96a3','#4a4e58','#23252b'], steel:['#d5dbe6','#8a93a3','#3d424c'], black:['#5a5e69','#24262c','#0d0e11'],
  rust:['#b8724a','#6e3f27','#3a2014'], gold:['#f0d27a','#c08c2c','#6e4a12'], wood:['#8a6238','#4f351e','#2b1b10'],
  leather:['#9a6b3f','#5a3c22','#2f1e10'], reed:['#a9b85a','#5f7a2e','#2d3d15'], purple:['#d3a6ff','#7a4bd6','#31174f'],
  red:['#ff6c58','#c2332a','#5a1410'], bone:['#f1eadb','#bfb39a','#6f6350'], teal:['#8fd6d0','#3d8a86','#183836'],
  glass:['#e6f0ff','#8aa3c4','#3b4a62'], oil:['#3b3a3f','#1b1a1e','#08080a'], ember:['#ffd08a','#ff7a2a','#7a2a10'],
  green:['#9ee08a','#3f8a3c','#1a3d1a']
};
let uid = 0;
function grad(cols, angle, id){ id = id || ('g' + (++uid)); const a = (angle==null?90:angle) * Math.PI/180;
  const x1 = 50 - Math.cos(a)*50, y1 = 50 - Math.sin(a)*50, x2 = 50 + Math.cos(a)*50, y2 = 50 + Math.sin(a)*50;
  return { id, def: `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0" stop-color="${cols[0]}"/><stop offset=".55" stop-color="${cols[1]}"/><stop offset="1" stop-color="${cols[2]}"/></linearGradient>` }; }
function rgrad(cols, id, cx, cy){ id = id || ('r' + (++uid)); return { id, def: `<radialGradient id="${id}" cx="${cx==null?40:cx}%" cy="${cy==null?35:cy}%" r="65%"><stop offset="0" stop-color="${cols[0]}"/><stop offset=".6" stop-color="${cols[1]}"/><stop offset="1" stop-color="${cols[2]}"/></radialGradient>` }; }
const OUTLINE = 'stroke="#07080a" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"';
const OL = 'stroke="#07080a" stroke-linejoin="round" stroke-linecap="round"';
const SHADE = 'stroke="rgba(0,0,0,.45)" stroke-width=".7" stroke-linejoin="round" stroke-linecap="round"';
function glowDef(id, col, sd){ return `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${sd||2.2}" result="b"/><feFlood flood-color="${col}" flood-opacity=".9"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`; }
const SHADOW = `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#000" flood-opacity=".55"/></filter>`;
function spec(x,y,rx,ry,rot,op){ return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot||0} ${x} ${y})" fill="#fff" opacity="${op==null?.35:op}"/>`; }
function svg(defs, body){ uid = 0; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><defs>${SHADOW}${defs.join('')}</defs><g filter="url(#sh)">${body}</g></svg>`; }

/* ---- 무기 ---- */
function scythe({blade, shaft, edge, wrap, big, chip, rune}){
  const b = grad(blade, 20), s = grad(shaft, 60), e = grad(edge||P.gold, 0), w = grad(wrap||P.leather, 90);
  // 자루: 좌하→우상 대각선. 날: 상단에서 왼쪽으로 크게 휘어진 낫
  const bladePath = big
    ? 'M46 12 C 30 4, 12 12, 8 30 C 14 20, 26 16, 38 20 C 44 22, 47 18, 46 12 Z'
    : 'M45 14 C 33 8, 17 14, 12 28 C 18 20, 28 18, 38 21 C 43 23, 46 19, 45 14 Z';
  const chipMark = chip ? `<path d="M22 17 l2 3 l-4 1 z M31 18 l2 2 l-3 1 z" fill="#1c1210" opacity=".8"/>` : '';
  const runeMark = rune ? `<path d="M20 20 l3 -1 M26 18.5 l3 -1 M32 18.5 l3 -.5" stroke="${rune}" stroke-width=".9" opacity=".9" fill="none"/>` : '';
  return svg([b.def, s.def, e.def, w.def], `
    <path d="M14 58 L 44 14" stroke="url(#${s.id})" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M14 58 L 44 14" stroke="rgba(0,0,0,.45)" fill="none" stroke-width="3.6" opacity=".5"/>
    <path d="M22 47 l3 2 M25 43 l3 2 M28 39 l3 2" stroke="url(#${w.id})" stroke-width="2.2" stroke-linecap="round"/>
    <path d="${bladePath}" fill="url(#${b.id})" ${OUTLINE}/>
    <path d="${big?'M46 12 C 30 4, 12 12, 8 30':'M45 14 C 33 8, 17 14, 12 28'}" stroke="url(#${e.id})" stroke-width="1.6" fill="none" opacity=".95"/>
    ${chipMark}${runeMark}
    <circle cx="44.5" cy="15" r="2.4" fill="url(#${e.id})" ${OUTLINE}/>
    ${spec(30,13,5,1.2,-15,.4)}`);
}
function sword({blade, guard, grip, long, wide, notch, tint}){
  const b = grad(blade, 100), g = grad(guard||P.gold, 0), h = grad(grip||P.leather, 90);
  const tipY = long ? 6 : 10, half = wide ? 4.2 : 3.2;
  return svg([b.def, g.def, h.def], `
    <g transform="rotate(45 32 32)">
      <path d="M${32-half} 40 L ${32-half} ${tipY+6} L 32 ${tipY} L ${32+half} ${tipY+6} L ${32+half} 40 Z" fill="url(#${b.id})" ${OUTLINE}/>
      <path d="M32 ${tipY+2} L 32 39" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>
      ${notch ? `<path d="M${32+half} 20 l-1.6 1.4 l1.6 1.4 M${32-half} 28 l1.6 1.2 l-1.6 1.4" fill="#2a1a12" stroke="none"/>` : ''}
      <rect x="24" y="39.5" width="16" height="3.4" rx="1" fill="url(#${g.id})" ${OUTLINE}/>
      <rect x="29.6" y="43" width="4.8" height="11" rx="1.2" fill="url(#${h.id})" ${OUTLINE}/>
      <path d="M29.8 45.5 h4.4 M29.8 48 h4.4 M29.8 50.5 h4.4" stroke="rgba(0,0,0,.4)" stroke-width=".7"/>
      <circle cx="32" cy="56" r="2.2" fill="url(#${g.id})" ${OUTLINE}/>
      ${tint ? `<path d="M${32-half+.6} ${tipY+8} L ${32-half+.6} 38" stroke="${tint}" stroke-width="1" opacity=".7"/>` : ''}
      ${spec(30.4, tipY+12, 1, 7, 0, .35)}
    </g>`);
}
const ART = {};
ART.w_marsh_scythe = () => scythe({ blade:P.steel, shaft:P.black, edge:P.gold, wrap:P.reed, big:true, rune:'#c9a45e' });
ART.w_rust_executioner = () => scythe({ blade:P.rust, shaft:P.wood, edge:['#d89a6a','#8a5432','#4a2a18'], wrap:P.black, big:true, chip:true });
ART.w_hook_scythe = () => { const b = grad(P.iron, 20), s = grad(P.wood, 60), r = grad(P.leather, 0);
  return svg([b.def, s.def, r.def], `
    <path d="M22 56 L 30 30" stroke="url(#${s.id})" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M24 50 l4 1.2 M25.5 45 l4 1.2" stroke="url(#${r.id})" stroke-width="2" stroke-linecap="round"/>
    <path d="M30 30 C 26 14, 40 8, 50 16 C 42 12, 34 16, 34 28 Z" fill="url(#${b.id})" ${OUTLINE}/>
    <path d="M30 30 C 26 14, 40 8, 50 16" stroke="#d5dbe6" stroke-width="1.2" fill="none" opacity=".8"/>
    <path d="M50 16 C 53 19, 52 23, 48 24" stroke="url(#${b.id})" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <circle cx="30.5" cy="30" r="2.2" fill="#c08c2c" ${OUTLINE}/>
    <path d="M14 40 q 6 2 10 -2" stroke="#8a6238" stroke-width="1" fill="none" stroke-dasharray="1.5 1.2"/>
    ${spec(38,15,4,1,-20,.35)}`); };
ART.w_marsh_blade = () => { const b = grad(P.steel, 100), g = grad(P.gold, 0), h = grad(P.black, 90), t = grad(P.teal, 100);
  return svg([b.def, g.def, h.def, t.def], `
    <g transform="rotate(40 32 32)">
      <path d="M29 34 L 29 14 L 32 3 L 35 14 L 35 34 Z" fill="url(#${b.id})" ${OUTLINE}/>
      <path d="M30.2 15 L 32 6 L 33.8 15" fill="url(#${t.id})" opacity=".8"/>
      <path d="M32 8 L 32 33" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>
      <path d="M25 33 h14 l2 3 h-18 z" fill="url(#${g.id})" ${OUTLINE}/>
      <rect x="29.5" y="36" width="5" height="18" rx="1.2" fill="url(#${h.id})" ${OUTLINE}/>
      <path d="M29.7 39 h4.6 M29.7 42 h4.6 M29.7 45 h4.6 M29.7 48 h4.6" stroke="#c08c2c" stroke-width=".8" opacity=".7"/>
      <path d="M29.5 54 h5 l-2.5 5 z" fill="url(#${g.id})" ${OUTLINE}/>
      ${spec(30.3, 20, .9, 9, 0, .4)}
    </g>`); };
ART.w_ash_dirk = () => sword({ blade:['#9c9ea6','#5c5e66','#2a2b30'], guard:P.black, grip:['#8a3a32','#5a1e1a','#2a0c0a'], long:false, wide:false });
ART.w_ruin_spear = () => { const b = grad(P.iron, 100), s = grad(P.wood, 60), r = grad(['#a04038','#5e1f1a','#2a0c0a'], 0);
  return svg([b.def, s.def, r.def], `
    <path d="M12 60 L 46 18" stroke="url(#${s.id})" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M46 18 L 56 6 L 52 20 Z M46 18 L 56 6 L 42 12 Z" fill="url(#${b.id})" ${OUTLINE}/>
    <path d="M44 20 l-3 1 l2 2 z" fill="#c08c2c" ${OUTLINE}/>
    <path d="M40 24 c -4 6 -2 10 2 12 c -5 -3 -9 -1 -12 4" stroke="url(#${r.id})" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M20 50 l2 2 M18 52 l2 2" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    ${spec(51,11,1.2,4,45,.4)}`); };
ART.w_rust_sword = () => sword({ blade:P.rust, guard:['#7c5a3a','#4a3320','#241810'], grip:['#6b5a48','#3d3226','#1b1510'], long:true, wide:true, notch:true });

/* ---- 방어구 ---- */
ART.a_reed_cuirass = () => { const l = grad(P.leather, 90), r = grad(P.reed, 0), m = grad(P.iron, 90);
  return svg([l.def, r.def, m.def], `
    <path d="M16 14 L 26 10 C 29 14, 35 14, 38 10 L 48 14 L 52 30 L 46 32 L 46 54 L 18 54 L 18 32 L 12 30 Z" fill="url(#${l.id})" ${OUTLINE}/>
    <path d="M22 16 L 42 16 L 44 40 L 20 40 Z" fill="rgba(0,0,0,.18)"/>
    <path d="M26 10 C 29 18, 35 18, 38 10" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1"/>
    <path d="M18 34 h28 M18 42 h28" stroke="url(#${r.id})" stroke-width="2.6"/>
    <path d="M32 18 L 32 54" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    <path d="M14 20 h6 M44 20 h6" stroke="url(#${m.id})" stroke-width="3" stroke-linecap="round"/>
    <circle cx="25" cy="26" r="1.3" fill="#c08c2c"/><circle cx="39" cy="26" r="1.3" fill="#c08c2c"/>
    ${spec(24,20,4,2,-30,.18)}`); };
ART.a_black_greaves = () => { const b = grad(P.black, 100), s = grad(P.iron, 0);
  const leg = (x) => `<path d="M${x} 10 L ${x+12} 10 L ${x+13} 30 L ${x+11} 52 L ${x+1} 52 L ${x-1} 30 Z" fill="url(#${b.id})" ${OUTLINE}/>
    <path d="M${x+1} 30 h11 M${x+1.5} 38 h10 M${x+2} 46 h9" stroke="url(#${s.id})" stroke-width="1.6"/>
    <path d="M${x+1} 52 L ${x+11} 52 L ${x+12} 56 L ${x} 56 Z" fill="url(#${s.id})" ${OUTLINE}/>
    ${spec(x+3, 18, 1.2, 6, 0, .22)}`;
  return svg([b.def, s.def], leg(18) + leg(34)); };
ART.a_steel_gauntlet = () => { const s = grad(P.steel, 100), d = grad(P.iron, 0), l = grad(P.leather, 90);
  return svg([s.def, d.def, l.def], `
    <rect x="20" y="42" width="24" height="12" rx="2" fill="url(#${l.id})" ${OUTLINE}/>
    <path d="M20 44 h24" stroke="url(#${d.id})" stroke-width="2.4"/>
    <path d="M22 44 L 22 21 C 22 18, 26.5 18, 26.5 21 L 26.5 26 L 27 26 L 27 15 C 27 12, 31.5 12, 31.5 15 L 31.5 25 L 32 25 L 32 14 C 32 11, 36.5 11, 36.5 14 L 36.5 25 L 37 25 L 37 18 C 37 15, 42 15, 42 18 L 42 44 Z" fill="url(#${s.id})" ${OUTLINE}/>
    <path d="M26.7 26 v9 M31.7 25 v10 M36.7 25 v10" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    <path d="M23 34 h18" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    <path d="M14 30 C 14 24, 20 22, 22 28 L 22 40 L 16 38 Z" fill="url(#${s.id})" ${OUTLINE}/>
    <path d="M24 26 h16 l1 4 h-18 z" fill="url(#${d.id})" opacity=".9"/>
    ${spec(30, 38, 4, 1.6, 0, .35)}`); };
ART.a_ranger_boots = () => { const l = grad(P.leather, 100), d = grad(P.black, 0), t = grad(P.reed, 0);
  return svg([l.def, d.def, t.def], `
    <path d="M20 10 L 36 10 L 37 34 L 48 40 L 50 48 L 22 48 L 20 34 Z" fill="url(#${l.id})" ${OUTLINE}/>
    <path d="M22 44 L 50 48 L 50 52 L 21 52 Z" fill="url(#${d.id})" ${OUTLINE}/>
    <path d="M20 12 h16" stroke="url(#${t.id})" stroke-width="3"/>
    <path d="M23 18 h12 M23 24 h12 M23 30 h12" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    <path d="M28 18 l0 12" stroke="#c08c2c" stroke-width=".9" stroke-dasharray="2 2"/>
    <path d="M37 34 L 48 40" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    ${spec(30, 20, 1.2, 6, 0, .2)}`); };
ART.a_hood = () => { const c = grad(['#7c7f8a','#3e414a','#1a1b20'], 100), i = grad(['#2a2c33','#0e0f12','#050506'], 90);
  return svg([c.def, i.def], `
    <path d="M32 8 C 18 10, 12 24, 14 40 L 10 54 L 54 54 L 50 40 C 52 24, 46 10, 32 8 Z" fill="url(#${c.id})" ${OUTLINE}/>
    <path d="M32 14 C 24 16, 21 26, 22 38 L 20 50 L 44 50 L 42 38 C 43 26, 40 16, 32 14 Z" fill="url(#${i.id})" ${OUTLINE}/>
    <path d="M26 36 q 6 -4 12 0" stroke="#c2332a" stroke-width="1.2" fill="none" opacity=".8"/>
    <path d="M16 40 l4 -12 M48 40 l-4 -12" stroke="rgba(0,0,0,.4)" stroke-width="1" fill="none"/>
    <path d="M14 46 l6 -1 M50 46 l-6 -1" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    ${spec(26,16,3,1.4,-40,.18)}`); };

/* ---- 장신구 ---- */
function ring({band, gem, glow}){ const b = grad(band, 90), g = rgrad(gem||P.iron, null, 35, 30); const f = glow ? glowDef('gl', glow, 2) : '';
  return svg([b.def, g.def, f], `
    <ellipse cx="32" cy="36" rx="16" ry="14" fill="none" stroke="url(#${b.id})" stroke-width="6"/>
    <ellipse cx="32" cy="36" rx="16" ry="14" fill="none" ${OL} stroke-width="1" opacity=".9"/>
    <ellipse cx="32" cy="36" rx="10" ry="8" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
    ${gem ? `<g ${glow?'filter="url(#gl)"':''}><path d="M32 14 L 40 20 L 36 28 L 28 28 L 24 20 Z" fill="url(#${g.id})" ${OUTLINE}/><path d="M28 28 L 32 34 L 36 28" fill="url(#${g.id})" ${OUTLINE}/><path d="M32 14 L 32 28 M24 20 L 40 20" stroke="rgba(255,255,255,.35)" stroke-width=".7"/></g>` : `<rect x="26" y="20" width="12" height="5" rx="1" fill="url(#${b.id})" ${OUTLINE}/><path d="M28 22.5 h8" stroke="rgba(0,0,0,.5)" stroke-width=".8"/>`}
    ${spec(22,30,1.5,4,20,.35)}`); }
ART.acc_blood_ring = () => ring({ band:P.gold, gem:P.red, glow:'#ff3a2a' });
ART.acc_band = () => ring({ band:['#e0a070','#a05a30','#4a2a14'], gem:null });
ART.acc_charm = () => { const c = grad(P.iron, 90), t = grad(P.wood, 100), r = grad(P.red, 0);
  return svg([c.def, t.def, r.def], `
    <path d="M14 8 C 18 30, 26 36, 32 40 C 38 36, 46 30, 50 8" fill="none" stroke="url(#${c.id})" stroke-width="2"/>
    <path d="M14 8 C 18 30, 26 36, 32 40 C 38 36, 46 30, 50 8" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="2.6" stroke-dasharray="1.2 2.2" opacity=".7"/>
    <path d="M26 40 L 38 40 L 40 44 L 36 58 L 28 58 L 24 44 Z" fill="url(#${t.id})" ${OUTLINE}/>
    <circle cx="32" cy="40" r="2.2" fill="url(#${c.id})" ${OUTLINE}/>
    <path d="M32 44 l3 3 l-3 6 l-3 -6 z" fill="url(#${r.id})" ${OUTLINE}/>
    <path d="M27 54 h10" stroke="#c08c2c" stroke-width=".9" opacity=".7"/>
    ${spec(28,46,1,3,10,.22)}`); };

/* ---- 재료 ---- */
ART.m_alloy = () => { const s = grad(P.steel, 100), d = grad(P.iron, 100);
  const bar = (x,y,g) => `<path d="M${x} ${y+10} L ${x+6} ${y} L ${x+30} ${y} L ${x+36} ${y+10} Z" fill="url(#${g})" ${OUTLINE}/><path d="M${x+6} ${y} L ${x+30} ${y} L ${x+28} ${y+3} L ${x+8} ${y+3} Z" fill="rgba(255,255,255,.28)"/>`;
  return svg([s.def, d.def], `${bar(20,36,d.id)}${bar(8,36,d.id)}${bar(14,24,s.id)}<path d="M22 27 h16" stroke="rgba(0,0,0,.35)" stroke-width="1"/>${spec(24,27,3,.8,0,.5)}`); };
ART.m_shard = () => { const c = grad(P.purple, 70), f = glowDef('gl', '#a06cff', 2.4);
  return svg([c.def, f], `<g filter="url(#gl)">
    <path d="M32 6 L 42 26 L 36 56 L 28 56 L 22 26 Z" fill="url(#${c.id})" ${OUTLINE}/>
    <path d="M32 6 L 31 56 M22 26 L 32 30 L 42 26" stroke="rgba(255,255,255,.35)" stroke-width=".8" fill="none"/>
    <path d="M14 40 l4 -8 l4 10 z" fill="url(#${c.id})" ${OUTLINE}/><path d="M46 44 l3 -7 l4 9 z" fill="url(#${c.id})" ${OUTLINE}/>
    ${spec(28,18,1,6,8,.5)}</g>`); };
ART.m_core = () => { const c = rgrad(P.ember, null, 45, 40), r = grad(P.black, 0), f = glowDef('gl', '#ff5a2a', 3);
  return svg([c.def, r.def, f], `
    <ellipse cx="32" cy="34" rx="22" ry="8" fill="none" stroke="url(#${r.id})" stroke-width="3" transform="rotate(-20 32 34)"/>
    <g filter="url(#gl)"><circle cx="32" cy="34" r="13" fill="url(#${c.id})" ${OUTLINE}/>
    <path d="M26 30 q6 -6 12 0 M24 38 q8 8 16 0" stroke="rgba(255,240,200,.6)" stroke-width="1" fill="none"/></g>
    <ellipse cx="32" cy="34" rx="22" ry="8" fill="none" stroke="url(#${r.id})" stroke-width="3" transform="rotate(-20 32 34)" stroke-dasharray="28 40"/>
    <ellipse cx="32" cy="34" rx="22" ry="8" fill="none" ${OL} stroke-width=".8" transform="rotate(-20 32 34)" opacity=".7"/>
    ${spec(27,28,3,1.6,-30,.55)}`); };
function flask({liquid, glass, glow, round, cork, stripe}){ const l = grad(liquid, 100), g = grad(glass||P.glass, 0), f = glow ? glowDef('gl', glow, 2.2) : '';
  const body = round ? 'M26 12 L 38 12 L 38 22 C 50 26, 52 50, 32 52 C 12 50, 14 26, 26 22 Z' : 'M26 12 L 38 12 L 38 24 L 46 44 C 48 50, 44 54, 38 54 L 26 54 C 20 54, 16 50, 18 44 Z';
  const liq = round ? 'M22 34 C 20 46, 26 51, 32 51 C 38 51, 44 46, 42 34 C 36 36, 28 36, 22 34 Z' : 'M21.5 38 L 42.5 38 L 46 46 C 47 51, 43 53, 38 53 L 26 53 C 21 53, 17 51, 18 46 Z';
  return svg([l.def, g.def, f], `
    <path d="${body}" fill="url(#${g.id})" opacity=".55" ${OUTLINE}/>
    <g ${glow?'filter="url(#gl)"':''}><path d="${liq}" fill="url(#${l.id})"/></g>
    ${stripe ? `<path d="M22 36 h20" stroke="${stripe}" stroke-width="1.4" opacity=".9"/>` : ''}
    <path d="${body}" fill="none" ${OUTLINE}/>
    <rect x="25" y="8" width="14" height="5" rx="1.2" fill="${cork||'#8a6238'}" ${OUTLINE}/>
    <circle cx="35" cy="44" r="1.4" fill="rgba(255,255,255,.45)"/><circle cx="29" cy="47" r=".9" fill="rgba(255,255,255,.4)"/>
    ${spec(24,30,1.4,8,6,.4)}`); }
ART.m_booster = () => flask({ liquid:P.ember, glow:'#ff8a3a', round:false, cork:'#c08c2c', stripe:'#c9a45e' });
ART.m_oil = () => { const c = grad(P.oil, 100), m = grad(P.iron, 0), l = grad(['#d9b25a','#8a6420','#3a2a10'], 0);
  return svg([c.def, m.def, l.def], `
    <path d="M20 22 L 44 22 L 46 54 L 18 54 Z" fill="url(#${c.id})" ${OUTLINE}/>
    <rect x="26" y="12" width="12" height="11" rx="1.5" fill="url(#${m.id})" ${OUTLINE}/>
    <path d="M38 15 L 50 10 L 50 14 L 40 19" fill="url(#${m.id})" ${OUTLINE}/>
    <rect x="23" y="32" width="18" height="12" fill="url(#${l.id})" opacity=".9" ${OUTLINE}/>
    <path d="M26 36 h12 M26 40 h8" stroke="#2a1b10" stroke-width="1.2"/>
    <path d="M20 26 h24" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
    ${spec(23,30,1.2,9,4,.18)}`); };
ART.m_fiber = () => { const r = grad(P.reed, 100), t = grad(P.leather, 0);
  const strands = [-8,-5,-2,1,4,7].map((d,i) => `<path d="M${32+d} 8 C ${30+d} 24, ${34+d*1.3} 40, ${31+d*1.6} 56" stroke="url(#${r.id})" stroke-width="2.4" fill="none" stroke-linecap="round"/>`).join('');
  return svg([r.def, t.def], `${strands}
    <path d="M22 30 C 28 27, 36 27, 42 30 L 42 36 C 36 33, 28 33, 22 36 Z" fill="url(#${t.id})" ${OUTLINE}/>
    <path d="M24 33 l16 0" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    <path d="M40 30 l4 -6 M40 36 l6 4" stroke="url(#${t.id})" stroke-width="1.6" stroke-linecap="round"/>
    ${spec(28,16,1,5,10,.25)}`); };
ART.m_bone = () => { const b = grad(P.bone, 100);
  const bone = (tr) => `<g transform="${tr}"><rect x="-14" y="-3" width="28" height="6" rx="3" fill="url(#${b.id})" ${OUTLINE}/>
    <circle cx="-14" cy="-3.5" r="3.6" fill="url(#${b.id})" ${OUTLINE}/><circle cx="-14" cy="3.5" r="3.6" fill="url(#${b.id})" ${OUTLINE}/>
    <circle cx="14" cy="-3.5" r="3.6" fill="url(#${b.id})" ${OUTLINE}/><circle cx="14" cy="3.5" r="3.6" fill="url(#${b.id})" ${OUTLINE}/>
    <path d="M-8 -1 h4 M2 1 h6" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></g>`;
  return svg([b.def], `${bone('translate(30 26) rotate(-30)')}${bone('translate(36 42) rotate(20)')}
    <path d="M44 14 l3 -3 l2 5 l-4 2 z" fill="url(#${b.id})" ${OUTLINE}/><path d="M14 50 l4 -4 l3 3 l-4 4 z" fill="url(#${b.id})" ${OUTLINE}/>`); };
ART.m_ore = () => { const o = grad(['#5b5f6b','#2a2c33','#0f1013'], 100), s = grad(P.steel, 0);
  return svg([o.def, s.def], `
    <path d="M14 42 L 22 22 L 36 14 L 52 24 L 50 44 L 34 54 Z" fill="url(#${o.id})" ${OUTLINE}/>
    <path d="M22 22 L 34 30 L 36 14 M34 30 L 50 44 M34 30 L 34 54 M14 42 L 34 30" stroke="rgba(0,0,0,.45)" stroke-width="1" fill="none"/>
    <path d="M27 24 l3 -1 l1 3 z M40 30 l4 2 l-2 4 z M30 40 l3 1 l-1 4 z" fill="url(#${s.id})" opacity=".9"/>
    <path d="M40 30 l4 2 l-2 4 z" fill="#c9a45e" opacity=".8"/>
    ${spec(30,20,3,1.2,-25,.25)}`); };
ART.m_dew = () => { const l = grad(P.reed, 100), d = rgrad(['#ff9a8a','#c2332a','#5a1410'], null, 35, 30), f = glowDef('gl', '#ff4a3a', 2);
  return svg([l.def, d.def, f], `
    <path d="M10 50 C 18 22, 40 12, 56 14 C 54 34, 40 52, 10 50 Z" fill="url(#${l.id})" ${OUTLINE}/>
    <path d="M12 49 C 28 42, 42 30, 54 16" stroke="rgba(0,0,0,.4)" stroke-width="1" fill="none"/>
    <path d="M22 44 l8 -8 M30 38 l6 -10 M36 32 l10 -6" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>
    <g filter="url(#gl)"><path d="M34 22 C 38 30, 42 34, 42 38 A 8 8 0 0 1 26 38 C 26 34, 30 30, 34 22 Z" fill="url(#${d.id})" ${OUTLINE}/></g>
    ${spec(30,36,1.3,3,-15,.55)}`); };
ART.m_heart = () => { const c = grad(P.purple, 60), f = glowDef('gl', '#b06cff', 3), v = grad(['#ff8a9a','#a03050','#40101c'], 90);
  return svg([c.def, f, v.def], `<g filter="url(#gl)">
    <path d="M32 54 C 18 44, 10 34, 12 22 C 14 12, 26 10, 32 20 C 38 10, 50 12, 52 22 C 54 34, 46 44, 32 54 Z" fill="url(#${c.id})" ${OUTLINE}/>
    <path d="M32 20 L 30 54 M12 22 L 32 30 L 52 22 M20 40 L 32 30 L 44 40" stroke="rgba(255,255,255,.3)" stroke-width=".8" fill="none"/>
    <path d="M28 12 C 26 6, 30 4, 32 8 M36 12 C 38 6, 42 6, 40 12" stroke="url(#${v.id})" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${spec(22,22,2,5,-20,.45)}</g>`); };

/* ---- 소모품 ---- */
ART.c_potion = () => flask({ liquid:['#ff8a7a','#c2332a','#5a1410'], glow:'#ff5a4a', round:true, cork:'#8a6238' });
ART.c_throw = () => { const b = rgrad(['#6a6e78','#23252b','#0a0b0d'], null, 35, 30), f = glowDef('gl', '#ffb040', 2), r = grad(P.leather, 0);
  return svg([b.def, f, r.def], `
    <circle cx="30" cy="38" r="16" fill="url(#${b.id})" ${OUTLINE}/>
    <path d="M18 34 q12 -4 24 0" stroke="url(#${r.id})" stroke-width="2.4" fill="none"/>
    <path d="M18 42 q12 4 24 0" stroke="url(#${r.id})" stroke-width="2.4" fill="none"/>
    <rect x="26" y="18" width="8" height="6" rx="1" fill="#4a4e58" ${OUTLINE}/>
    <path d="M30 18 C 30 12, 38 12, 40 8" stroke="#8a6238" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <g filter="url(#gl)"><path d="M40 8 l3 -4 l1 5 l4 1 l-4 2 l1 5 l-4 -3 l-4 2 l1 -5 l-4 -2 z" fill="#ffd060"/></g>
    ${spec(24,32,3,1.6,-35,.3)}`); };
ART.c_tool = () => { const m = grad(P.iron, 100), w = grad(P.wood, 60);
  return svg([m.def, w.def], `
    <path d="M14 58 L 40 20" stroke="url(#${w.id})" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M30 12 C 38 6, 50 10, 54 20 C 48 14, 42 14, 40 20 C 40 26, 44 32, 52 34 C 42 34, 32 26, 30 12 Z" fill="url(#${m.id})" ${OUTLINE}/>
    <path d="M18 50 l3 2 M21 46 l3 2" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    <path d="M40 20 l-2 3" stroke="#c08c2c" stroke-width="1.6" stroke-linecap="round"/>
    ${spec(36,13,4,1.2,-20,.35)}`); };
ART.c_antidote = () => { const b = grad(P.bone, 100), r = grad(P.red, 0);
  return svg([b.def, r.def], `
    <rect x="14" y="24" width="30" height="18" rx="3" fill="url(#${b.id})" ${OUTLINE}/>
    <path d="M44 26 C 52 26, 52 40, 44 40 Z" fill="url(#${b.id})" ${OUTLINE}/>
    <ellipse cx="44" cy="33" rx="4" ry="7" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
    <path d="M18 28 h22 M18 32 h22 M18 36 h22" stroke="rgba(0,0,0,.18)" stroke-width="1"/>
    <path d="M27 30 h6 v-4 h-6 z" fill="none"/>
    <path d="M24 33 h10 M29 28 v10" stroke="url(#${r.id})" stroke-width="3" stroke-linecap="round"/>
    <path d="M12 46 C 20 44, 28 48, 36 46 C 40 45, 44 46, 50 50" stroke="url(#${b.id})" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${spec(20,27,3,1,0,.35)}`); };

/* ---- 의뢰 아이템 ---- */
ART.q_record = () => { const p = grad(['#d8c8a8','#a8956e','#5a4a30'], 100), c = grad(P.leather, 0), s = grad(P.red, 0);
  return svg([p.def, c.def, s.def], `
    <path d="M16 12 L 44 12 L 50 18 L 50 54 L 16 54 Z" fill="url(#${c.id})" ${OUTLINE}/>
    <path d="M20 10 L 46 10 L 46 50 L 20 50 Z" fill="url(#${p.id})" ${OUTLINE}/>
    <path d="M24 18 h16 M24 23 h18 M24 28 h12 M24 33 h18 M24 38 h10" stroke="rgba(40,30,20,.55)" stroke-width="1.2"/>
    <path d="M16 12 L 16 54" stroke="rgba(0,0,0,.4)" stroke-width="1.4"/>
    <circle cx="38" cy="42" r="5" fill="url(#${s.id})" ${OUTLINE}/><path d="M35.5 42 l2 2 l3 -4" stroke="#ffd0c0" stroke-width="1" fill="none"/>
    ${spec(26,14,4,1,0,.3)}`); };
ART.q_fragment = () => { const c = grad(['#7a6aa0','#2b2340','#0a0810'], 70), f = glowDef('gl', '#b06cff', 2.6), v = grad(['#ffb0ff','#b06cff','#4a2a8a'], 0);
  return svg([c.def, f, v.def], `<g filter="url(#gl)">
    <path d="M30 8 L 46 18 L 48 36 L 34 56 L 18 44 L 14 24 Z" fill="url(#${c.id})" ${OUTLINE}/>
    <path d="M30 8 L 32 32 L 48 36 M32 32 L 34 56 M32 32 L 14 24" stroke="rgba(255,255,255,.22)" stroke-width=".8" fill="none"/>
    <path d="M24 26 L 34 22 L 40 32 L 30 38 Z" fill="url(#${v.id})" opacity=".85"/>
    <path d="M26 30 l6 -2 l2 4" stroke="#fff" stroke-width=".8" fill="none" opacity=".7"/>
    ${spec(24,18,1.5,6,20,.3)}</g>`); };

/* 쌍단검: 짧은 날 두 자루를 교차 */
function twin({blade, grip, gem}){
  const b = grad(blade, 100), h = grad(grip || P.leather, 90), j = gem ? grad([gem, gem, '#000'], 0) : null;
  const one = (deg) => `
    <g transform="rotate(${deg} 32 34)">
      <path d="M29.6 34 L 29.6 14 L 32 9 L 34.4 14 L 34.4 34 Z" fill="url(#${b.id})" ${OUTLINE}/>
      <path d="M32 12 L 32 33" stroke="rgba(0,0,0,.35)" stroke-width=".7"/>
      <path d="M26 34 h12 v2.4 h-12 z" fill="url(#${h.id})" ${OUTLINE}/>
      <path d="M30.4 36.4 h3.2 v10 h-3.2 z" fill="url(#${h.id})" ${OUTLINE}/>
      ${j ? `<circle cx="32" cy="35.2" r="1.5" fill="url(#${j.id})"/>` : ''}
    </g>`;
  return svg([b.def, h.def, ...(j ? [j.def] : [])], one(-28) + one(28));
}
ART.w_ryu_dagger = () => twin({ blade:['#d8b0a8','#8a3a32','#3a1210'], grip:['#4a4e58','#24262c','#0d0e11'], gem:'#ff4a3a' });
ART.w_kain_greatsword = () => sword({ blade:['#e2e7f0','#8a93a3','#3d424c'], guard:['#f0d27a','#a8761f','#5a3a0e'], grip:['#6b5a48','#3d3226','#1b150f'], long:true, wide:true });
ART.w_ryu_shiv = () => twin({ blade:['#9aa0a8','#565a63','#26282d'], grip:['#6b5a48','#3d3226','#1b150f'] });
ART.w_ryu_twinfang = () => twin({ blade:['#ffe6a8','#c98a2b','#6e4a12'], grip:['#8a3a32','#5a1e1a','#2a0c0a'], gem:'#ff6c58' });
ART.w_sera_vial = () => flask({ liquid:['#b9c9d2','#6f7f86','#2c383d'], glow:null, round:true, cork:'#6b5a48' });
ART.w_sera_reagent = () => flask({ liquid:['#b8f4ea','#3fbfae','#12514a'], glow:'#6ff0dc', round:true, cork:'#c08c2c', stripe:'#f0d27a' });

/* ---- 출력·검증 ---- */
const items = readFileSync(join(ROOT, 'js', 'items.js'), 'utf8');
const ids = [...items.matchAll(/id:'([a-z]+_[a-z_]+)'/g)].map(m => m[1]).filter((v,i,a) => a.indexOf(v)===i && !/^r_/.test(v));
const { existsSync } = await import('node:fs');
const missing = ids.filter(id => !ART[id] && !existsSync(join(OUT, id + '.svg')));
const handmade = ids.filter(id => !ART[id] && existsSync(join(OUT, id + '.svg')));
if (missing.length){ console.error('아트 없는 아이템:', missing.join(' ')); process.exit(1); }
let n = 0;
for (const id of Object.keys(ART)){ const s = ART[id]().replace(/\n\s*/g, ''); writeFileSync(join(OUT, id + '.svg'), s); n++; }
console.log(n + ' item images → art/items/ (' + ids.length + ' ids in items.js'
  + (handmade.length ? ', 손으로 만든 ' + handmade.length + '종 유지: ' + handmade.join(' ') : '') + ')');
