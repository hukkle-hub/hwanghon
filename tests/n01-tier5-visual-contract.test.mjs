import test from 'node:test';import assert from 'node:assert/strict';import {bodyFor,N01_BODIES,motionFor} from '../js/mmo/n01-body-catalog.js';import {mobsFromPacket} from '../js/mmo/field-mobs.js';
import fs from 'node:fs';import vm from 'node:vm';
test('six bodies are director-approved for live play (2026-10-11); grade 4+ keeps the temporary body',()=>{
 assert.equal(Object.keys(N01_BODIES).length,6);for(const id of Object.keys(N01_BODIES)){const live=bodyFor(id);assert.ok(live,id+' live');assert.equal(live.approved,true);assert.ok(live.url.endsWith('_mobile.glb'),'phones get the mobile LOD by default');assert.equal(bodyFor(id,{detail:'high'}).url,N01_BODIES[id].highUrl);assert.equal(bodyFor(id,{review:true}).url,live.url);}
 for(const id of ['G4_HARRIER','G3_BLACKBLADE','G4_STANDARD_BEARER'])assert.equal(bodyFor(id),null,id+' keeps the temporary body');
 const fm=fs.readFileSync(new URL('../js/mmo/field-mobs.js',import.meta.url),'utf8');assert.match(fm,/const bodyLabel=asset\.n01Asset\?\(asset\.n01Asset\.approved\?'':' · 검수 후보'\):' · 임시 몸';/,'approved bodies drop the «임시 몸»/«검수 후보» label');
});
test('named armor actions select their own clips, legacy bodies keep attack1/death, runner locomotion uses run',()=>{
 const all=['idle','walk','run','attack','shield_bash','heavy_charge','overhead_crush','hit','die'];for(const key of ['shield_bash','heavy_charge','overhead_crush'])assert.equal(motionFor('attack',{key},all,'G5_ARMORED'),key);
 assert.equal(motionFor('attack',{key:'heavy_charge'},['attack1'],'G5_ARMORED'),'attack1');assert.equal(motionFor('die',null,['death'],'x'),'death');assert.equal(motionFor('walk',null,all,'G5_RUNNER'),'run');assert.equal(motionFor('walk',null,all,'G5_BREAKER'),'walk');
});
test('optional tenth action metadata preserves legacy nine-slot row exactly and rejects invalid timing',()=>{
 const base=['m','G5_ARMORED',0,0,true,'attack',2,100,9],old=mobsFromPacket([base])[0];assert.equal('action' in old,false);
 const a={key:'overhead_crush',clip:'overhead_crush',windupMs:1200,startAt:10,damageAt:1210,seq:9};assert.deepEqual(mobsFromPacket([[...base,a]])[0].action,a);
 for(const windupMs of [NaN,0,Infinity,-1,10000])assert.equal('action' in mobsFromPacket([[...base,{...a,windupMs}]])[0],false);
 assert.equal(mobsFromPacket([[...base,a]],310)[0].action.elapsedMs,300);
 assert.equal(mobsFromPacket([[...base,a]],-1)[0].action.elapsedMs,0);
});
test('zone travel preserves candidate/detail flags; deliberate lost-query mutation fails',()=>{
 const html=fs.readFileSync(new URL('../world3d.html',import.meta.url),'utf8'),line=html.split('\n').find(l=>l.includes('const nq = new URLSearchParams()'));assert(line);
 const run=code=>vm.runInNewContext(code+';nq.toString()',{URLSearchParams,q:new URLSearchParams('char=kain&n01Candidates=1&n01Detail=high'),to:{zone:'daejeon',gate:'south'}});
 const check=code=>{const q=new URLSearchParams(run(code));assert.equal(q.get('n01Candidates'),'1');assert.equal(q.get('n01Detail'),'high');assert.equal(q.get('zone'),'daejeon');assert.equal(q.get('char'),'kain');};
 check(line);assert.throws(()=>check(line.replace(", 'n01Candidates', 'n01Detail'",'')));
});
test('every grade-5 species without its own body borrows a close approved body (director 2026-10-11); grade 4+ stays temporary; one download per file',async()=>{
 const {BORROW}=await import('../js/mmo/n01-body-catalog.js'),{CATALOG}=await import('../js/mmo/monster-catalog.js');
 const g5=CATALOG.filter(c=>c.grade===5).map(c=>c.id);for(const id of g5){const b=bodyFor(id);assert.ok(b,id+' has a body');if(!N01_BODIES[id]){assert.ok(N01_BODIES[BORROW[id]],id+' borrows a real body');assert.equal(b.url,N01_BODIES[BORROW[id]].url);assert.equal(b.borrowedFrom,BORROW[id]);}else assert.equal(b.borrowedFrom,undefined);}
 for(const k of Object.keys(BORROW))assert.ok(g5.includes(k),k+' is a grade-5 catalog id');
 for(const c of CATALOG.filter(c=>c.grade<5))assert.equal(bodyFor(c.id),null,c.id+' keeps the temporary body');
 assert.equal(bodyFor('G5_CLIMBER',{detail:'high'}).url,N01_BODIES.G5_RUNNER.highUrl);
 const html=fs.readFileSync(new URL('../world3d.html',import.meta.url),'utf8');assert.match(html,/if\(!n01CandidateCache\.has\(a\.url\)\)n01CandidateCache\.set\(a\.url,load\(a\.url\)/,'borrowed species share one load per file');
});
