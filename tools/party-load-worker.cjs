/* Local benchmark harness only. Fixture commands exist on IPC, never on the game protocol. */
const {createPartyServer}=require('../server/index.cjs'),{monitorEventLoopDelay}=require('node:perf_hooks');
const app=createPartyServer({dataDir:process.argv[2]}),delay=monitorEventLoopDelay({resolution:10});delay.enable();let cpu=process.cpuUsage(),started=performance.now(),baseline={...app.stats};
process.on('message',async msg=>{
 if(msg.type==='reset'){cpu=process.cpuUsage();started=performance.now();baseline={...app.stats};delay.reset();process.send({type:'reset'});}
 if(msg.type==='unlock'){for(const id of app.sessions.keys()){const p=app.store.get(id);p.quests={training:'claimed',marsh:'claimed'};app.store.put(p);}process.send({type:'unlock'});}
 if(msg.type==='fight'){for(const room of app.rooms.values()){room.raid.startFight();let i=0;for(const p of room.raid.players.values()){p.x=room.raid.boss.x-110;p.y=room.raid.boss.y+i++*8;}}process.send({type:'fight'});}
 if(msg.type==='stats'){const use=process.cpuUsage(cpu),seconds=(performance.now()-started)/1000;process.send({type:'stats',online:app.sessions.size,rooms:app.rooms.size,seconds,cpuCorePercent:(use.user+use.system)/(seconds*10000),rssMB:process.memoryUsage().rss/1048576,eventLoopP95Ms:delay.percentile(95)/1e6,eventLoopMaxMs:delay.max/1e6,bytesSent:app.stats.bytesSent-baseline.bytesSent,messagesSent:app.stats.messagesSent-baseline.messagesSent,discardedSimulationSteps:app.stats.droppedSteps-baseline.droppedSteps,backpressure:app.stats.backpressure-baseline.backpressure,damage:[...app.rooms.values()].reduce((sum,r)=>sum+[...r.raid.players.values()].reduce((n,p)=>n+p.damage,0),0)});}
 if(msg.type==='stop'){await app.close();process.exit(0);}
});app.listen(0,'127.0.0.1').then(a=>process.send({type:'ready',port:a.port}));
