const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('patched Raid snapshot exposes expedition nodes and gate when server exists',()=>{
  if(!fs.existsSync('server/raid.cjs')) return;
  const {Raid}=require('../server/raid.cjs');
  const members=[{id:'a',name:'A',character:'ain'},{id:'b',name:'B',character:'kain'}];
  const raid=new Raid('d02',members);
  const snap=raid.snapshot();
  assert.ok(snap.expedition);
  assert.ok(Array.isArray(snap.expedition.nodes));
  assert.ok(snap.expedition.nodes.length>0);
  assert.ok(snap.gate);
  assert.equal(typeof snap.gate.x,'number');
  assert.equal(typeof snap.gate.y,'number');
  assert.equal(typeof snap.gate.open,'boolean');
  for(const n of snap.expedition.nodes){
    assert.equal(typeof n.id,'string');
    assert.equal(typeof n.x,'number');
    assert.equal(typeof n.y,'number');
    assert.equal(typeof n.enabled,'boolean');
    assert.equal(typeof n.done,'boolean');
    assert.equal(typeof n.discovered,'boolean');
  }
});

test('objective completion stays server authoritative when server exists',()=>{
  if(!fs.existsSync('server/raid.cjs')) return;
  const src=fs.readFileSync('server/raid.cjs','utf8');
  assert.match(src,/this\.expedition\.interact\(p\)/);
  assert.match(src,/msg\.type==='interact'/);
  assert.doesNotMatch(src,/msg\.type==='objectiveComplete'/);
});
