/* Server timing only, NOT Android FPS or GLB visual approval. */
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks'),{Field}=require('../../server/field.cjs');
const root=path.resolve(__dirname,'../..');let seed=7,now=10000;
const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const f=new Field({clock:()=>now,rng}),zones=fs.readdirSync(path.join(root,'maps/2d')).filter(id=>{
 const z=f.zone(id);return z?.map.areas?.some(a=>a.kind==='hunt'&&a.pool);});
for(let i=0;i<100;i++){
 const zone=zones[i%zones.length],p=f.join('bench'+i,{id:'bench'+i,name:'bench',character:'ain',stats:{hp:20000}},zone);
 const e=f.ecologies.get(zone),m=[...e.mobs.values()].find(m=>m.group.kind==='nest');
 p.x=m.x+(i%3)*.1;p.z=m.z;p.invulnUntil=1e12;
}
const tick=[],snap=[];let maxBytes=0,maxVisible=0;
for(let i=0;i<200;i++){
 now+=50;let at=performance.now();f.tickBosses(now);tick.push(performance.now()-at);
 if(i%2===0){at=performance.now();for(const p of f.players.values()){
  const packet=f.view(p,false);maxVisible=Math.max(maxVisible,packet.mobs.length);
  maxBytes=Math.max(maxBytes,Buffer.byteLength(JSON.stringify(packet)));}
  snap.push(performance.now()-at);
 }
}
const summarize=a=>{const sorted=[...a].sort((a,b)=>a-b);return {meanMs:a.reduce((a,b)=>a+b,0)/a.length,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1)};};
const result={test:'server_only_100_players_18_regions_200_ticks',zones:zones.length,players:f.players.size,
 mobs:f.mobStates.size,hunts:[...f.ecologies.values()].reduce((n,e)=>n+e.areas.length,0),
 tick:summarize(tick),snapshot100Players:summarize(snap),maxVisible,maxPacketBytes:maxBytes,
 androidFPSMeasured:false,visualModelsReviewed:false};
console.log(JSON.stringify(result,null,2));
if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2)+'\n');
