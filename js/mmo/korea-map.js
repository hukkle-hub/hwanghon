/* 전국 지도 (문서 219) — 3D 필드에서 «어디로 이어지나» 를 한눈에. 실제 위경도 위에 필드 지역과 길을 긋는다.
   길 = 지역 표의 문 + 전국 길 문(zone-links) + 강남·남산처럼 문을 장면 빌더가 따로 정하는 곳(SEOUL). 던전·지하를 거쳐 이어지면 점선.
   koreaMapSVG(...) 는 문자열만 돌려준다 (노드에서 시험). */
const SEOUL = [['gangnam', 'namsan'], ['gangnam', 'namtae'], ['gangnam', 'bunker']];   /* map.json 문 (env-osm · env-namsan 이 정한다) */
export function mapEdges(ZONES, linkGates) {
  const out = new Map(), adj = new Map(), add = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  for (const [id, Z] of Object.entries(ZONES)) for (const g of [...(Z.gates || []), ...((Z.field && Z.field.gates) || []), ...linkGates(id)]) if (g.to && ZONES[g.to.zone]) { add(id, g.to.zone); add(g.to.zone, id); }
  for (const [a, b] of SEOUL) { add(a, b); add(b, a); }
  const field = z => ZONES[z] && ZONES[z].kind === 'field';
  for (const a of Object.keys(ZONES)) { if (!field(a)) continue;   /* 필드에서 필드까지 — 던전·벙커를 거치면 «안으로» */
    const seen = new Set([a]), q = [[a, false]];
    while (q.length) { const [z, via] = q.shift(); for (const b of adj.get(z) || []) { if (seen.has(b)) continue; seen.add(b); if (field(b)) { const k = [a, b].sort().join('|'); const ferry = /jeju/.test(k) && /mokpo/.test(k); if (!out.has(k) || out.get(k).via) out.set(k, { a, b, via, ferry }); } else q.push([b, true]); } } }
  return [...out.values()]; }
/* 수도권은 한 점에 몰려 이름이 겹친다 — 서해(왼쪽 위 빈 곳)에 확대 상자 */
const INSET = { lat: [37.18, 37.62], lon: [126.82, 127.36], box: [40, 108, 400, 420] };
export function koreaMapSVG({ ZONES, REGIONS, linkGates, current, W = 900, H = 1100 }) {
  const ll = {}; for (const r of REGIONS) { const z = r.zone || r.id; if (ZONES[z] && ZONES[z].kind === 'field') ll[z] = [r.lat, r.lon, r.name]; }
  const X = lon => (lon - 125.9) / (130.0 - 125.9) * (W - 120) + 60, Y = lat => (38.7 - lat) / (38.7 - 33.0) * (H - 140) + 70, esc = t => String(t).replace(/[<>&"]/g, '');
  const [bx0, by0, bx1, by1] = INSET.box, inIn = ([lat, lon]) => lat >= INSET.lat[0] && lat <= INSET.lat[1] && lon >= INSET.lon[0] && lon <= INSET.lon[1];
  const IX = lon => bx0 + 30 + (lon - INSET.lon[0]) / (INSET.lon[1] - INSET.lon[0]) * (bx1 - bx0 - 60), IY = lat => by0 + 40 + (INSET.lat[1] - lat) / (INSET.lat[1] - INSET.lat[0]) * (by1 - by0 - 70);
  const edges = mapEdges(ZONES, linkGates), line = (x1, y1, x2, y2, e) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${e.ferry ? '#6ab0ff' : '#c9a45e'}" stroke-width="4" stroke-linecap="round"${e.via || e.ferry ? ' stroke-dasharray="9 8"' : ''}/>`;
  const dot = (z, x, y, name, label) => { const me = z === current; return (me ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20" fill="none" stroke="#7af0c8" stroke-width="4"><animate attributeName="r" values="14;26;14" dur="1.6s" repeatCount="indefinite"/></circle>` : '')
    + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${me ? 11 : 8}" fill="${me ? '#7af0c8' : '#f0e2d0'}" stroke="#140c12" stroke-width="2"/>`
    + (label ? `<text x="${(x + 13).toFixed(1)}" y="${(y + 6).toFixed(1)}" font-size="${me ? 24 : 19}" font-weight="800" fill="${me ? '#7af0c8' : '#f0e2d0'}" font-family="Noto Sans KR, sans-serif" paint-order="stroke" stroke="#140c12" stroke-width="5">${esc(name)}</text>` : ''); };
  let lines = '', dots = '', inset = '';
  const cx0 = X(INSET.lon[0]), cy0 = Y(INSET.lat[1]), cx1 = X(INSET.lon[1]), cy1 = Y(INSET.lat[0]);
  inset += `<rect x="${cx0.toFixed(1)}" y="${cy0.toFixed(1)}" width="${(cx1 - cx0).toFixed(1)}" height="${(cy1 - cy0).toFixed(1)}" fill="none" stroke="#7a6a60" stroke-width="2"/><line x1="${cx0.toFixed(1)}" y1="${cy0.toFixed(1)}" x2="${bx1}" y2="${by1}" stroke="#4a3e3a" stroke-width="1.5"/>`
    + `<rect x="${bx0}" y="${by0}" width="${bx1 - bx0}" height="${by1 - by0}" rx="12" fill="#221820" stroke="#7a6a60" stroke-width="2"/><text x="${bx0 + 14}" y="${by0 + 26}" font-size="17" font-weight="800" fill="#c9a45e" font-family="Noto Sans KR, sans-serif">수도권</text>`;
  for (const e of edges) { const a = ll[e.a], b = ll[e.b]; if (!a || !b) continue; lines += line(X(a[1]), Y(a[0]), X(b[1]), Y(b[0]), e);
    if (inIn(a) && inIn(b)) inset += line(IX(a[1]), IY(a[0]), IX(b[1]), IY(b[0]), e);
    else if (inIn(a) || inIn(b)) { const [p, o] = inIn(a) ? [a, b] : [b, a], dx = o[1] - p[1], dy = p[0] - o[0], L = Math.hypot(dx, dy) || 1; inset += line(IX(p[1]), IY(p[0]), IX(p[1]) + dx / L * 40, IY(p[0]) + dy / L * 40, e); } }   /* 상자 밖으로 나가는 길은 짧은 꼬리 */
  for (const [z, [lat, lon, name]] of Object.entries(ll)) { const inn = inIn([lat, lon]); dots += dot(z, X(lon), Y(lat), name, !inn); if (inn) inset += dot(z, IX(lon), IY(lat), name, true); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><rect width="${W}" height="${H}" rx="18" fill="#1a1016"/>`
    + `<text x="40" y="50" font-size="30" font-weight="900" fill="#f0e2d0" font-family="Noto Sans KR, sans-serif">황혼의 한국</text><text x="40" y="82" font-size="17" fill="#c9a45e" font-family="Noto Sans KR, sans-serif">길 끝까지 걸어가면 다음 지역 · 점선은 지하·배</text>${lines}${dots}${inset}</svg>`; }
