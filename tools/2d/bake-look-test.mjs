// 2D 외형 시험: 장비 세트 × 8방향을 쿼터뷰로 구워 한 장으로 (docs/design/185 §4.1)
// node tools/serve.cjs &  →  node tools/2d/bake-look-test.mjs [출력.png]
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const OUT=process.argv[2]||'docs/img/185-look-test.png', BASE='http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/';
const SETS=[
 ['기본 (시트 장비)', { main:'w_marsh_scythe', head:null, chest:'a_reed_cuirass', legs:'a_black_greaves', gloves:'a_steel_gauntlet', boots:'a_ranger_boots' }],
 ['수문지기 중갑',    { main:'w_marsh_scythe', head:'a_sluice_helm', chest:'a_sluice_cuirass', legs:'a_sluice_greaves', gloves:'a_sluice_gauntlet', boots:'a_sluice_boots' }],
 ['방역 경갑 (코트)', { main:'w_marsh_scythe', head:'a_ward_mask', chest:'a_ward_coat', legs:'a_ward_greaves', gloves:'a_ward_gloves', boots:'a_ward_boots' }],
 ['맨몸',            { main:'w_marsh_scythe' }]];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); p.on('console',m=>{ if(m.type()==='error'&&!/CERT/.test(m.text())) console.log('ERR',m.text()); });
await p.goto(BASE+'tools/2d/sprite-bake.html?char=ain&size=320'); await p.waitForFunction(()=>window.__BAKE); await p.evaluate(()=>__BAKE.ready);
const rows=[];
for(const [name,eq] of SETS){ const n=await p.evaluate(e=>__BAKE.dress(e), eq);
  const cells=[]; for(let d=0;d<8;d++) cells.push(await p.evaluate(d=>__BAKE.render(d,'run',0.18,'all',2.3), d));
  rows.push({name,cells,n}); console.log(name,'meshes',n); }
const layers=await p.evaluate(()=>__BAKE.layers()); console.log('layers',layers.join(', '));
const html='<body style="margin:0;background:#0B0C0F;color:#ddd;font:14px sans-serif">'+rows.map(r=>'<div style="display:flex;align-items:center"><div style="width:130px;padding-left:10px">'+r.name+'</div>'+r.cells.map(c=>'<img src="'+c+'" width="160" height="160" style="background:radial-gradient(#23262e,#0B0C0F 70%)">').join('')+'</div>').join('')+'</body>';
const v=await b.newPage({viewport:{width:130+160*8,height:160*rows.length}}); await v.setContent(html); await v.waitForTimeout(300); await v.screenshot({path:OUT});
await b.close(); console.log('->',OUT);
