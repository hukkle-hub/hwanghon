import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {BOSS_PROFILES,createBossBehavior} from '../js/boss-motion.js';

const REAL=['marsh','sewage','relay','grove','road','ward'];

function modelFor(id){
  const g=new T.Group(), names=new Set(['Hips','Spine','Core','Head']);
  for(const rows of [BOSS_PROFILES[id].idle,...Object.values(BOSS_PROFILES[id].prep)])for(const t of rows)names.add(t[0]);
  for(const n of names){const o=new T.Group();o.name=n;g.add(o);}
  return g;
}

test('six real bosses each have their own idle/preparation language',()=>{
  for(const id of REAL){
    const p=BOSS_PROFILES[id];
    assert.ok(p?.name,id);
    assert.ok(p.idle.length>=3,id+' idle');
    assert.ok(Object.keys(p.prep).length>=4,id+' prep');
  }
  assert.equal(new Set(REAL.map(id=>BOSS_PROFILES[id].tempo)).size>=4,true,'tempo diversity');
});

test('boss behavior is additive, bounded and does not accumulate frame over frame',()=>{
  for(const id of REAL){
    const model=modelFor(id),view=createBossBehavior(model,id);
    const base=new Map();model.traverse(o=>base.set(o.name,o.quaternion.clone()));
    const icon=Object.keys(BOSS_PROFILES[id].prep)[0],state={state:'telegraph',patIcon:icon,windup:.45};
    view.apply(state,1,.016);
    const changed=[...view.nodes?Object.values(view.nodes):[]].some?.(()=>false); // API presence is enough; transforms checked below
    let delta=0;model.traverse(o=>{const b=base.get(o.name);if(b)delta=Math.max(delta,b.angleTo(o.quaternion));});
    assert.ok(delta>0.01,id+' telegraph silhouette');
    const first=[];model.traverse(o=>first.push([o.name,...o.quaternion.toArray()]));
    for(let i=0;i<20;i++){view.restore();view.apply(state,1,.016);}
    const again=[];model.traverse(o=>again.push([o.name,...o.quaternion.toArray()]));
    assert.deepEqual(again,first,id+' must not drift');
    view.restore();model.traverse(o=>{const b=base.get(o.name);if(b)assert.ok(b.angleTo(o.quaternion)<1e-7,id+' restore '+o.name);});
  }
});

test('counter tiers visibly escalate from deflect to clash',()=>{
  const model=modelFor('marsh'),view=createBossBehavior(model,'marsh'),spine=view.nodes.Spine2||view.nodes.Spine;
  function sample(kind){view.restore();view.react(kind);view.apply({state:'stagger'},0,.08);const q=spine.quaternion.clone();view.restore();return q;}
  const d=sample('deflect'),r=sample('repel'),c=sample('clash'),ident=new T.Quaternion();
  assert.ok(ident.angleTo(r)>ident.angleTo(d),'repel stronger than deflect');
  assert.ok(ident.angleTo(c)>ident.angleTo(r),'clash stronger than repel');
});
