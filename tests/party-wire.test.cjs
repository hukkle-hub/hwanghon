const test=require('node:test'),assert=require('node:assert/strict'),{diff,apply}=require('../js/party-wire.js'),{Raid}=require('../server/raid.cjs');
test('wire deltas reconstruct real combat snapshots across hits, part destruction, phase change and retry',()=>{
 const raid=new Raid('d01',[{id:'a',name:'A'},{id:'b',name:'B'}]);raid.startFight();for(const p of raid.players.values()){p.x=raid.boss.x-110;p.y=raid.boss.y;}let wire=JSON.parse(JSON.stringify(raid.snapshot())),bytes=0,full=0;
 for(let i=0;i<400;i++){if(i%40===0){raid.input('a',{type:'attack'});raid.input('b',{type:'attack'});}if(i===170){raid.phase=1;raid.setupBoss();}if(i===350){raid.state='wiped';raid.retry();}raid.tick(.01);if(i%5!==0)continue;const snapshot=JSON.parse(JSON.stringify(raid.snapshot())),patch=diff(wire,snapshot);bytes+=JSON.stringify(patch||{}).length;full+=JSON.stringify(snapshot).length;wire=apply(wire,JSON.parse(JSON.stringify(patch||{})));assert.deepEqual(wire,snapshot);}
 assert.ok(bytes<full*.6,`${bytes}/${full}`);
});
test('wire delta handles removed keys, array changes and null without retaining old room members',()=>{const a={members:[{id:'a'},{id:'b'}],raid:{action:{old:true},hp:50}},b={members:[{id:'b'}],raid:null};assert.deepEqual(apply(a,diff(a,b)),b);assert.deepEqual(apply({a:1,b:2},diff({a:1,b:2},{a:1})),{a:1});});
