// 그림은 그대로 두고 map.json 의 계획(막이·문·보스·구역 …)만 다시 만든다 — 막이처럼 «보이지 않는» 것만 바꿨을 때 다시 굽지 않으려고.
//   node tools/serve.cjs & → node tools/2d/replan-map.mjs <zone>
// 그림이 바뀌는 변경(물체를 더하거나 옮김)에는 쓰지 않는다 — 같은 씨앗이라 같은 장면이 나오는지 타일 격자(cols·rows·u0·v1)로 확인하고, 다르면 멈춘다.
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const ID=process.argv[2]; if(!ID) throw Error('지역 id'); const F='maps/2d/'+ID+'/map.json', old=JSON.parse(fs.readFileSync(F,'utf8'));
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/tools/2d/bake-map.html?zone='+ID); await p.waitForFunction(()=>window.__BAKEMAP,null,{timeout:600000});
const plan=await p.evaluate(()=>__BAKEMAP.plan()); await b.close();
for(const k of ['cols','rows','pxPerM','tile']) if(plan[k]!==old[k]) throw Error(k+' 가 다르다 ('+old[k]+' → '+plan[k]+') — 다시 구워야 한다');
for(const k of ['u0','v1']) if(Math.abs(plan[k]-old[k])>1e-6) throw Error(k+' 가 다르다 — 다시 구워야 한다');
const out={ ...plan, tiles:old.tiles }; fs.writeFileSync(F, JSON.stringify(out,null,1));
console.log(ID,'계획만 다시 —','막이',old.blockers.length,'→',plan.blockers.length);
