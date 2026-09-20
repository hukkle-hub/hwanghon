/* 바람 검수 시트 — 던전마다 다른 공기를 «같은 자세, 다른 바람» 으로 나란히 본다.
   믹서를 멈춰 자세를 고정하므로, 화면에서 달라지는 것은 오직 바람뿐이다.
   사용: node tools/wind-sheet.mjs [char] */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {spawnSync} from 'node:child_process';

const CHAR=process.argv[2]||'ain';
const OUT='/tmp/claude-0/wind';
spawnSync('mkdir',['-p',OUT]);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const srv=createServer(async(rq,rs)=>{ const u=decodeURIComponent(rq.url.split('?')[0]);
  try{ const b=await readFile(join(process.cwd(), u==='/'?'index.html':u.slice(1)));
    rs.writeHead(200,{'content-type':MIME[extname(u)]||'application/octet-stream'}); rs.end(b);
  }catch{ rs.writeHead(404); rs.end('nope'); } });
await new Promise(r=>srv.listen(0,r));
const PORT=srv.address().port;

const br=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const pg=await br.newPage({viewport:{width:820,height:1020},deviceScaleFactor:1});
pg.on('console',m=>{ if(/tw-wind|tw-pose|tw-mat/.test(m.text())) console.log('  ',m.text()); });

/* 「바람 없음」을 맨 앞에 둔다 — 비교 대상이 없으면 흔들림은 증명되지 않는다 */
const CASES=['off','tutorial','marsh','sewage','relay','grove','road','ward'];
const shots=[];
for(const w of CASES){
  await pg.goto(`http://127.0.0.1:${PORT}/viewer.html?fit=1&equip=1&char=${CHAR}&wind=${w}`,{waitUntil:'load'});
  await pg.waitForFunction(()=>window.__TW_VIEW?.charRoot&&window.__TW_VIEW.clips().length,null,{timeout:90000});
  await pg.waitForTimeout(3500);   /* 장비 부착 */
  const info=await pg.evaluate(async ({w})=>{
    const V=window.__TW_VIEW, T=V.THREE;
    V.play('idle'); V.mixer.update(0.30); V.mixer.timeScale=0;   /* 자세 고정 — 달라지는 건 바람뿐 */
    V.look(0.10,1.42,1.55, 0,1.30,0);                            /* 상반신: 머리카락·어깨 */
    if(window.__WIDE){ V.look(0.35,1.15,2.9, 0,0.95,0); }        /* 전신: 옷자락까지 */
    const wd=V.wind;
    if(wd){ const gp=wd.profile.gust?wd.profile.gust[0]:4;
      /* 내부 시계는 이미 돌아가 있다 — «절반 지점» 으로는 정점을 못 맞춘다.
         한 주기를 훑어 실제 최대치가 나오는 순간에서 멈춘다. */
      let best=-1,bestT=0; const step=0.02, N=Math.ceil(gp/step);
      for(let i=0;i<N;i++){ wd.update(step, V.charRoot);
        const L=wd.uniforms.uWind.value.length(); if(L>best){best=L;bestT=i;} }
      for(let i=0;i<=bestT;i++) wd.update(step, V.charRoot); }
    V.charRoot.updateMatrixWorld(true);
    V.renderer.render(V.scene, V.cam);
    return wd?{name:wd.profile.name,amp:wd.profile.amp,bound:wd.bound,
               len:+wd.uniforms.uWind.value.length().toFixed(4)}:{name:'바람 없음',amp:0,bound:0,len:0};
  },{w});
  await pg.waitForTimeout(150);
  const f=`${OUT}/${CHAR}-${w}.png`; await pg.screenshot({path:f});
  await pg.evaluate(()=>{ window.__WIDE=1; const V=window.__TW_VIEW; V.look(0.35,1.15,2.9,0,0.95,0); V.renderer.render(V.scene,V.cam); });
  await pg.waitForTimeout(120);
  await pg.screenshot({path:`${OUT}/${CHAR}-${w}-full.png`});
  shots.push({w,f,...info});
  console.log(`${w.padEnd(9)} ${info.name.padEnd(14)} 세기 ${info.len}  재질 ${info.bound}`);
}
await br.close(); srv.close();
console.log(JSON.stringify(shots.map(s=>[s.w,s.name,s.len]),null,0));
