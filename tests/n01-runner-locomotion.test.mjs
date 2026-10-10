import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {motionFor} from '../js/mmo/n01-body-catalog.js';import {mobsFromPacket} from '../js/mmo/field-mobs.js';
const M=createRequire(import.meta.url)('../server/field-mob-combat.cjs'),clips=['walk','run','idle','flank_swipe'];
test('Runner patrol walks but existing combat movement runs, through the real packet decoder',()=>{
 const m={catalogId:'G5_RUNNER',anim:'walk',engaged:false},a={action:null,seq:0,lastTick:100};
 for(const [engaged,want] of [[false,'walk'],[true,'run'],[false,'walk']]){m.engaged=engaged;const meta=M.visualAction(m,a),row=mobsFromPacket([['r',m.catalogId,0,0,true,'walk',1,100,0,meta]])[0];assert.equal(motionFor('walk',row.action,clips,m.catalogId),want);}
 assert.equal(a.action,null,'view metadata must never mutate authoritative action');assert.equal(M.statsFor(m.catalogId).speed,5.2);
});
test('Runner locomotion metadata retains the prior attack and the same offline clock',()=>{
 const action={key:'flank_swipe',clip:'flank_swipe',seq:4,startAt:100,windupMs:600},a={action,seq:4,lastTick:100},m={catalogId:'G5_RUNNER',anim:'walk',engaged:true};
 const v=M.visualAction(m,a,250);assert.equal(v.locomotion,'run');assert.equal(v.elapsedMs,150);assert.equal(v.key,action.key);assert.equal('locomotion' in action,false);
 assert.deepEqual(M.visualAction({...m,anim:'attack'},a),action);assert.equal(M.visualAction({catalogId:'G5_WALKER',anim:'walk'},{action:null}),null);
});
test('negative control: turning a slow patrol into a run is visibly rejected',()=>{
 const meta=M.visualAction({catalogId:'G5_RUNNER',anim:'walk',engaged:false},{action:null,seq:0,lastTick:0});
 const check=v=>assert.equal(motionFor('walk',v,clips,'G5_RUNNER'),'walk');check(meta);assert.throws(()=>check({...meta,locomotion:'run'}));
});
