/* Real browser/server audit. No application/UI patching, no live service or
   persistent profiles. Simulation can be paused for readable screenshot poses;
   packets still travel through the actual server and client WebSockets. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {createPartyServer}=require('../../server/index.cjs'),{Store}=require('../../server/store.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.argv[2]||'.node-shots/monster-server-v10');fs.mkdirSync(out,{recursive:true});
const store=new Store(null),app=createPartyServer({store}),report={
 kind:'real_two_browser_local_server_audit',profileStorage:'memory_only',
 simulation:'paused_and_stepped_for_screenshot_capture',mobileViewport:[915,412],
 actualAndroidFPSVerified:false,applicationFilesModified:false,errors:[],checks:{},shots:[]};
report.testedCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'}).trim();
let browser;
const progress=s=>console.log(s);
async function main(){
 const addr=await app.listen(0,'127.0.0.1'),base='http://127.0.0.1:'+addr.port;
 const tick=app.field.tickBosses.bind(app.field);app.field.tickBosses=()=>{};
 const eco=app.field.ecology('daejeon'),mob=[...eco.mobs.values()].find(m=>m.catalogId==='G5_BREAKER'&&m.group.kind==='nest');
 assert.ok(mob,'real N01 breaker spawn required');report.mob={id:mob.id,catalogId:mob.catalogId,x:mob.x,z:mob.z};
 for(const m of eco.mobs.values())if(m!==mob)eco.defeat(m.id,Date.now());
 const actors=['ain','kain'].map((char,i)=>{const g=store.guest('화면검수'+i);store.chooseName(g.profile.id,'화면검수'+i,char);return {id:g.profile.id,token:g.token,char};});
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const pages=await Promise.all(actors.map(async(a,i)=>{
  const ctx=await browser.newContext({viewport:{width:915,height:412},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await ctx.addInitScript(([host,token])=>localStorage.setItem('tw:party-token:'+host,token),['127.0.0.1:'+addr.port,a.token]);
  const p=await ctx.newPage();p.on('pageerror',e=>{report.errors.push({page:i,error:e.message,stack:e.stack});progress('page '+i+' error: '+e.message);});
  p.on('websocket',ws=>{ws.on('framereceived',e=>{try{const m=JSON.parse(e.payload);if(m.type==='field'||m.type==='mobHit'){
   a.last=m.type==='field'?m:a.last;if(m.type==='mobHit')a.hit=m;}}catch{}});});
  a.page=p;a.hook=i?'__W3D':'__MMO';
  progress('loading '+(i?'3D':'2D')+' actual client');
  await p.goto(base+'/'+(i?'world3d.html':'mmo.html')+'?zone=daejeon&online=1&lod=1&char='+a.char,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(h=>window[h]&&window[h].net, a.hook,{timeout:180000});
  progress((i?'3D':'2D')+' client ready');return p;
 }));
 report.checks.actualClientsJoined=app.field.players.size===2;
 for(const [i,a]of actors.entries()){
  const p=app.field.players.get(a.id);assert.ok(p);p.x=mob.x+(i?1:-1);p.z=mob.z+1;p.at=Date.now();p.invulnUntil=0;
  await a.page.evaluate(([h,x,z])=>{window[h].teleport(x,z,0);},[a.hook,p.x,p.z]);
 }
 async function view(a){return a.page.evaluate(([h,id])=>{const q=window[h],v=q.mobs?.views.get(id),act=v?.act[v.cur];return {net:!!q.net,frames:q.frames,remoteCount:q.remotes.size,mob:v?{id:v.id,gen:v.gen,hp:v.hp,alive:v.alive,cur:v.cur,seq:v.seq,warn:!!v.warn?.visible,clipTime:act?.time,clipDuration:act?.getClip().duration,deadT:v.deadT,position:[v.root.position.x,v.root.position.z]}:null};},[a.hook,mob.id]);}
 for(const a of actors)await a.page.waitForFunction(([h,id])=>window[h].mobs?.views.has(id),[a.hook,mob.id],{timeout:180000});
 report.joined=await Promise.all(actors.map(view));assert.ok(report.joined.every(v=>v.net&&v.mob?.alive));
 report.checks.sameGeneration=report.joined[0].mob.gen===report.joined[1].mob.gen;
 report.checks.remotePlayerRendered=report.joined.every(v=>v.remoteCount===1);
 for(const a of actors)await a.page.evaluate(([h,x,z])=>{const q=window[h];q.dtCap=1/30;if(h==='__W3D')q.view([x+4,3,z+7],[x,1,z]);},[a.hook,mob.x,mob.z]);
 const now=Date.now();tick(now);const state=app.field.mobStates.get(mob.id);assert.equal(mob.anim,'attack');
 for(const a of actors)await a.page.waitForFunction(([h,id])=>{const v=window[h].mobs?.views.get(id);return v?.cur==='attack'&&v.warn?.visible;},[a.hook,mob.id],{timeout:180000});
 report.attack=await Promise.all(actors.map(view));report.checks.telegraphRendered=report.attack.every(v=>v.mob.warn&&v.mob.seq===state.ai.seq);
 for(const [i,a]of actors.entries()){await a.page.evaluate(h=>{window[h].hold=true;},a.hook);const file=path.join(out,i?'3d-attack.png':'2d-attack.png');await a.page.screenshot({path:file});report.shots.push(file);}
 progress('real attack packets rendered in both clients');
 tick(now+600);report.checks.hurtSourceMatchesMob=[...app.field.players.values()].some(p=>p.hurt?.[2]===mob.id);
 for(const a of actors)await a.page.evaluate(h=>{window[h].hold=false;},a.hook);
 await actors[0].page.evaluate(h=>window[h].hitBoss(),actors[0].hook);
 const end=Date.now()+10000;while(!actors[0].hit&&Date.now()<end)await new Promise(r=>setTimeout(r,100));
 assert.ok(actors[0].hit?.dmg>0,'actual UI attack must receive mobHit');report.hit={...actors[0].hit};
 for(const a of actors)await a.page.waitForFunction(([h,id,hp])=>window[h].mobs?.views.get(id)?.hp===hp,[a.hook,mob.id,actors[0].hit.hp],{timeout:180000});
 report.hitViews=await Promise.all(actors.map(view));report.checks.hitHPShared=report.hitViews.every(v=>v.mob.hp===actors[0].hit.hp);
 for(const [i,a]of actors.entries()){await a.page.evaluate(h=>{window[h].hold=true;},a.hook);const file=path.join(out,i?'3d-hit.png':'2d-hit.png');await a.page.screenshot({path:file});report.shots.push(file);}
 progress('actual hit HP rendered; continuing real client attacks until death');
 for(const a of actors)await a.page.evaluate(h=>{window[h].hold=false;},a.hook);
 for(let n=0;mob.alive&&n<6;n++){
  const prior=actors[0].hit;await actors[0].page.evaluate(h=>window[h].hitBoss(),actors[0].hook);
  const end=Date.now()+10000;while(actors[0].hit===prior&&Date.now()<end)await new Promise(r=>setTimeout(r,100));
  assert.notEqual(actors[0].hit,prior,'next actual client hit required');
 }
 assert.equal(mob.alive,false);assert.equal(actors[0].hit.reward?.status,'pending_policy');
 await Promise.all(actors.map(a=>a.page.waitForFunction(([h,id])=>{const q=window[h],v=q.mobs?.views.get(id),act=v?.act.die;if(v&&!v.alive&&v.cur==='die'&&act&&act.time>=Math.min(.75,act.getClip().duration*.65)){q.hold=true;return true;}return false;},[a.hook,mob.id],{timeout:180000})));
 report.death=await Promise.all(actors.map(view));report.checks.deathShared=report.death.every(v=>v.mob.hp===0&&!v.mob.alive&&v.mob.cur==='die');
 report.visualPoseApproval='manual_review_required_not_inferred_from_clip_time';
 for(const [i,a]of actors.entries()){await a.page.evaluate(h=>{window[h].hold=true;},a.hook);const file=path.join(out,i?'3d-death.png':'2d-death.png');await a.page.screenshot({path:file});report.shots.push(file);}
 progress('death rendered; waiting for actual 30s ecology respawn time');
 for(const a of actors)await a.page.evaluate(h=>{window[h].hold=false;},a.hook);
 while(Date.now()<mob.respawnAt)await new Promise(r=>setTimeout(r,250));
 const oldGeneration=mob.generation;tick(Date.now());
 for(const a of actors)await a.page.waitForFunction(([h,id,gen])=>{const v=window[h].mobs?.views.get(id);return v?.alive&&v.gen>gen&&v.hp===100;},[a.hook,mob.id,oldGeneration],{timeout:180000});
 report.respawn=await Promise.all(actors.map(view));report.checks.newGenerationShared=report.respawn.every(v=>v.mob.alive&&v.mob.gen===oldGeneration+1&&v.mob.hp===100);
 for(const [i,a]of actors.entries()){const file=path.join(out,i?'3d-respawn.png':'2d-respawn.png');await a.page.screenshot({path:file});report.shots.push(file);}
 report.checks.profileRewardsPending=app.field.mobRewards===null;
 report.checks.noPageErrors=report.errors.length===0;
 report.complete=Object.values(report.checks).every(Boolean);progress('audit checks '+JSON.stringify(report.checks));
}
main().catch(e=>{report.complete=false;report.failure=e.stack;console.error(e.message);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();await app.close();fs.writeFileSync(path.join(out,'browser-audit.json'),JSON.stringify(report,null,2)+'\n');
 progress('saved '+path.join(out,'browser-audit.json'));if(!report.complete)process.exitCode=1;
});
