const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const has=fs.existsSync('server/raid.cjs')&&fs.existsSync('server/content.cjs');
const Raid=has?require('../server/raid.cjs').Raid:null;
const Content=has?require('../server/content.cjs'):null;

function levelId(){
  const ids=Object.keys(Content?.levels||{});
  assert.ok(ids.length>0,'server content must have a level');
  return ids.includes('d01')?'d01':ids[0];
}
function member(id,character){return {id,name:id.toUpperCase(),character};}

(has?test:test.skip)('four-player raid keeps four independent character identities and server scaling',()=>{
  const raid=new Raid(levelId(),[
    member('a','ain'),member('b','kain'),member('c','ryu'),member('d','sera')
  ]);
  assert.equal(raid.players.size,4);
  assert.equal(raid.scale,2.95);
  assert.deepEqual([...raid.players.values()].map(p=>p.character),['ain','kain','ryu','sera']);
  const snap=raid.snapshot();
  assert.equal(snap.players.length,4);
});

(has?test:test.skip)('server down/revive remains authoritative at 3 seconds and 30 percent hp',()=>{
  const raid=new Raid(levelId(),[member('a','ain'),member('b','sera')]);
  const a=raid.players.get('a'), b=raid.players.get('b');
  a.hp=0;a.downT=20;a.dead=false;a.revives=0;
  b.x=a.x;b.y=a.y;b.hp=b.maxHp;b.dead=false;b.connected=true;
  raid.input('b',{type:'revive',on:true});
  for(let i=0;i<310;i++)raid.tick(.01);
  assert.equal(a.revives,1);
  assert.equal(a.downT,0);
  assert.equal(a.hp,Math.round(a.maxHp*.3));
});

(has?test:test.skip)('disconnect reconnect and retry preserve independent server-owned players',()=>{
  const raid=new Raid(levelId(),[member('a','ain'),member('b','kain')]);
  raid.disconnect('b');
  assert.equal(raid.players.get('b').connected,false);
  raid.reconnect('b');
  assert.equal(raid.players.get('b').connected,true);
  for(const p of raid.players.values()){p.hp=0;p.dead=true;p.downT=0;}
  raid.tick(.01);
  assert.equal(raid.state,'wiped');
  raid.retry();
  assert.ok(['explore','fight'].includes(raid.state));
  assert.equal(raid.players.size,2);
});

(has?test:test.skip)('target input selects a server-defined boss part only',()=>{
  const raid=new Raid(levelId(),[member('a','ain')]);
  const a=raid.players.get('a');
  assert.ok(raid.boss.parts.length>0);
  const part=raid.boss.parts[raid.boss.parts.length-1].id;
  raid.input('a',{type:'target',part});
  assert.equal(a.target,part);
  raid.input('a',{type:'target',part:'not-a-real-part'});
  assert.equal(a.target,part);
});
