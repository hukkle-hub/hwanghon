// 받은 실제 공간 데이터를 평면도로 그려 확인한다 (docs/design/185 §6.5). node tools/2d/osm-plan.mjs <zone> [out.png]
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs'; import fs from 'node:fs';
const Z=process.argv[2]||'gangnam-real', OUT=process.argv[3]||'docs/img/185-osm-plan.png', d=JSON.parse(fs.readFileSync('maps/2d/'+Z+'/osm.json','utf8'));
const S=1.6, W=1000, H=1100, ox=W/2, oy=380, tx=([x,z])=>[ox+x*S, oy+z*S];
const poly=(pts,fill,stroke)=>'<polygon points="'+pts.map(tx).map(p=>p.join(',')).join(' ')+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1"/>';
const line=(pts,c,w)=>'<polyline points="'+pts.map(tx).map(p=>p.join(',')).join(' ')+'" fill="none" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round"/>';
const RW={primary:12,primary_link:6,secondary:9,tertiary:7,residential:4,service:2.5,busway:4,footway:1,steps:1.5,platform:2};
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" style="background:#101116;font-family:Noto Sans KR,sans-serif">';
for(const a of d.areas) svg+=poly(a.poly, /park|pitch/.test(a.kind)?'#173322':'#16181e','none');
for(const r of d.roads) svg+=line(r.line, r.kind==='busway'?'#7a2a2a':r.kind==='footway'||r.kind==='steps'?'#4a4d58':'#3a3d48', (RW[r.kind]||3)*S);
for(const b of d.buildings){ const h=b.height||(b.levels?b.levels*3.6:null); const k=h?Math.min(1,h/90):0.15; svg+=poly(b.poly, b.under?'none':'rgb('+(40+k*120|0)+','+(44+k*90|0)+','+(60+k*80|0)+')', b.under?'#c9a45e':'#000'); }
for(const c of d.crossings){ const [x,y]=tx(c); svg+='<circle cx="'+x+'" cy="'+y+'" r="2" fill="#fff"/>'; }
for(const s of d.signals){ const [x,y]=tx(s); svg+='<circle cx="'+x+'" cy="'+y+'" r="3.5" fill="#4cff9a"/>'; }
for(const e of d.exits){ const [x,y]=tx(e.p); svg+='<circle cx="'+x+'" cy="'+y+'" r="7" fill="'+(e.ref==='5'?'#ff3a5a':'#ffd23a')+'"/><text x="'+(x+9)+'" y="'+(y+5)+'" fill="#fff" font-size="13" font-weight="700">'+e.ref+'</text>'; }
const [ax,ay]=tx([0,0]); svg+='<circle cx="'+ax+'" cy="'+ay+'" r="5" fill="none" stroke="#39e0ff" stroke-width="2"/>';
svg+='<text x="14" y="26" fill="#ddd" font-size="16" font-weight="700">강남역 일대 — OSM 실측 ('+d.buildings.length+'동 · 출구 '+d.exits.length+')</text><text x="14" y="48" fill="#999" font-size="12">원점 = 강남대로×테헤란로 교차점(하늘색) · 노랑 = 출구, 빨강 = 5번 출구(원작 EP02) · 금색 테두리 = 지하 · 건물 밝기 = 높이 · 1px = '+(1/S).toFixed(2)+' m · 위 = 북</text>';
svg+='<text x="14" y="'+(H-14)+'" fill="#888" font-size="11">'+d.license+'</text></svg>';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:W,height:H}}); await p.setContent('<body style="margin:0">'+svg+'</body>'); await p.screenshot({path:OUT}); await b.close(); console.log('->',OUT);
