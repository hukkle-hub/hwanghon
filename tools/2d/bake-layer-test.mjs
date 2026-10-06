// 레이어 굽기 검증 (docs/design/185 §4.1): 레이어를 따로 구워 겹친 그림 == 한 번에 그린 그림 인지 잰다.
// 각 레이어는 다른 레이어를 깊이로만 그려 가린 채 굽는다 — 몸 뒤로 돌아간 팔·무기가 앞으로 튀어나오면 안 된다.
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const OUT=process.argv[2]||'docs/img/185-layers.png';
const EQ={ main:'w_marsh_scythe', head:'a_sluice_helm', chest:'a_sluice_cuirass', legs:'a_sluice_greaves', gloves:'a_sluice_gauntlet', boots:'a_sluice_boots' };
const ORDER=['body','a_sluice_greaves','a_sluice_boots','a_sluice_cuirass','a_sluice_gauntlet','a_sluice_helm','w_marsh_scythe'];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.goto('http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/tools/2d/sprite-bake.html?char=ain&size=320');
await p.waitForFunction(()=>window.__BAKE); await p.evaluate(()=>__BAKE.ready); await p.evaluate(e=>__BAKE.dress(e), EQ);
const have=await p.evaluate(()=>__BAKE.layers()); const order=ORDER.filter(l=>have.includes(l)).concat(have.filter(l=>!ORDER.includes(l)));
const rows=[];
for(const d of [1,3,6]){ const all=await p.evaluate(d=>__BAKE.render(d,'run',0.18,'all',2.3),d); const parts=[];
  for(const l of order) parts.push(await p.evaluate(([d,l])=>__BAKE.render(d,'run',0.18,l,2.3),[d,l]));
  /* 겹치기 + 차이 재기 (알파 합성 순서 = order) */
  const r=await p.evaluate(async ([all,parts])=>{ const ld=u=>new Promise(ok=>{ const i=new Image(); i.onload=()=>ok(i); i.src=u; });
    const S=320, A=document.createElement('canvas'), B=document.createElement('canvas'); A.width=B.width=A.height=B.height=S;
    const a=A.getContext('2d'), c=B.getContext('2d'); a.drawImage(await ld(all),0,0); for(const u of parts) c.drawImage(await ld(u),0,0);
    const x=a.getImageData(0,0,S,S).data, y=c.getImageData(0,0,S,S).data; let diff=0, px=0;
    for(let i=0;i<x.length;i+=4){ if(x[i+3]>0||y[i+3]>0){ px++; const dd=Math.max(Math.abs(x[i]-y[i]),Math.abs(x[i+1]-y[i+1]),Math.abs(x[i+2]-y[i+2]),Math.abs(x[i+3]-y[i+3])); if(dd>24) diff++; } }
    return { comp:B.toDataURL(), px, diff }; },[all,parts]);
  rows.push({d,all,parts,comp:r.comp,px:r.px,diff:r.diff}); console.log('dir',d,'캐릭터 픽셀',r.px,'어긋난 픽셀(>24)',r.diff,(100*r.diff/r.px).toFixed(2)+'%'); }
const cell=(u,t)=>'<div style="text-align:center"><img src="'+u+'" width="150" height="150" style="background:#1a1c22;display:block"><div style="font-size:11px;margin-top:2px">'+t+'</div></div>';
const html='<body style="margin:0;padding:8px;background:#0B0C0F;color:#ccc;font:12px sans-serif">'+rows.map(r=>'<div style="display:flex;gap:6px;margin-bottom:8px">'+r.parts.map((u,i)=>cell(u,order[i])).join('')+cell(r.comp,'= 겹친 결과')+cell(r.all,'한 번에 ('+(100*r.diff/r.px).toFixed(1)+'% 차이)')+'</div>').join('')+'</body>';
const v=await b.newPage({viewport:{width:16+(order.length+2)*156,height:16+rows.length*178}}); await v.setContent(html); await v.waitForTimeout(300); await v.screenshot({path:OUT}); await b.close(); console.log('layers',order.join(','),'->',OUT);
