/* Precalculate the UNCHANGED authoritative Ecology routes outside the 20Hz tick.
   Hashes use LF repository bytes. A changed map/rule invalidates the cache;
   no approximate/new navigation clearance or route budget is introduced. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createCollide} from '../../js/mmo/field-collide.js';
const require=createRequire(import.meta.url),{Ecology}=require('../../server/field-ecology.cjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const rules=['server/field-ecology.cjs','server/field-ecology-route.cjs','js/mmo/field-collide.js','js/mmo/safe-zones.js'];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const catalog=require('../../docs/design/ref/monster-catalog-v10/MonsterRoster_v10.json').Monsters;
const result={schema:1,rules:Object.fromEntries(rules.map(f=>[f,hash(f)])),zones:{}};
let count=0,blocked=0;
for(const id of fs.readdirSync(path.join(root,'maps/2d')).sort()){
 const file='maps/2d/'+id+'/map.json';if(!fs.existsSync(path.join(root,file)))continue;
 const map=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 if(!map.areas?.some(a=>a.kind==='hunt'&&a.pool))continue;
 const row={hash:hash(file),owners:{}};result.zones[id]=row;
 for(const kind of ['boss','guild']){
  const e=new Ecology({zone:{...structuredClone(map),id},catalog,now:0,rng:()=>.5,
   collide:createCollide(structuredClone(map)).collide,owner:{kind}});
  row.owners[kind]={};
  for(const area of e.areas){const routes=[];
   for(let i=0;i<4;i++){const r=e.route(area,area.eco.patrol[(i+3)%4],area.eco.patrol[i]);
    routes.push(r);count++;if(!r)blocked++;}
   row.owners[kind][area.id]=routes;
  }
 }
 console.log(id+' routes prepared');await new Promise(resolve=>setImmediate(resolve));
}
fs.writeFileSync(path.join(root,'server/field-ecology-patrols.json'),JSON.stringify(result)+'\n');
console.log(JSON.stringify({count,blocked,zones:Object.keys(result.zones).length}));
