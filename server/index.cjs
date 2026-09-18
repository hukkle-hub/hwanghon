const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws'),{Store}=require('./store.cjs'),{Raid}=require('./raid.cjs'),C=require('./content.cjs');
const WIRE=require('../js/party-wire.js');
const ROOT=path.resolve(__dirname,'..');
const os=require('node:os');
function createPartyServer(options={}){
 const store=options.store||new Store(options.dataDir||process.env.DATA_DIR||path.join(ROOT,'.party-data'));
 const rooms=new Map(),sessions=new Map(),memberships=new Map(),connections=new Set(),histories=new Map(),authAttempts=new Map();let closing=false,pendingAuth=0,chatSerial=0;const stats={bytesSent:0,messagesSent:0,droppedSteps:0,backpressure:0};
 const maxRooms=options.maxRooms||Number(process.env.MAX_ROOMS||32),maxPlayers=options.maxPlayers||Number(process.env.MAX_PLAYERS||100),maxConnections=options.maxConnections||maxPlayers+32;
 const send=(socket,message)=>{if(socket.readyState!==WebSocket.OPEN)return;if(socket.bufferedAmount>256*1024){stats.backpressure++;return;}const payload=typeof message==='string'?message:JSON.stringify(message);socket.send(payload);stats.bytesSent+=Buffer.byteLength(payload);stats.messagesSent++;return true;};
 const server=http.createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(req.url==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:!closing,protocol:2,rooms:rooms.size,online:sessions.size,capacity:maxPlayers}));}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  if(name==='/')name='/party.html';
  const parts=name.split('/').filter(Boolean),allowed=parts.length===1&&(/^[\w-]+\.html$/.test(parts[0])||['manifest.json','sw.js'].includes(parts[0]))||['art','css','js','vendor','maps','design-sheets'].includes(parts[0]);
  if(!allowed||parts.some(p=>p.startsWith('.')||p.includes('\\'))){res.writeHead(404);return res.end();}
  const file=path.resolve(ROOT,'.'+name);if(!file.startsWith(ROOT+path.sep)){res.writeHead(404);return res.end();}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);return res.end();}const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.wasm':'application/wasm'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);});
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  let allowed=false;try{const origin=req.headers.origin;allowed=!origin||new URL(origin).host===req.headers.host||(process.env.ALLOWED_ORIGINS||'').split(',').includes(origin);}catch{}
  if(closing||req.url!=='/party-socket'||!allowed||connections.size>=maxConnections){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 function roomState(room){return {type:'state',protocol:2,code:room.code,leader:room.leader,level:room.level,public:room.public,members:[...room.members.values()].map(({id,name,ready,connected})=>({id,name,ready,connected})),raid:room.raid?.snapshot()||null};}
 function broadcast(room){const state=JSON.parse(JSON.stringify(roomState(room))),previous=room.wireState,prior=room.revision||0;const full=JSON.stringify(state),patch=previous&&WIRE.diff(previous,state),delta=patch&&JSON.stringify({type:'patch',patch});room.revision=prior+(!previous||patch?1:0);for(const m of room.members.values()){const socket=sessions.get(m.id);if(!socket)continue;if(previous&&!patch&&socket.stateRoom===room.code&&socket.stateRevision===prior)continue;const incremental=delta&&socket.stateRoom===room.code&&socket.stateRevision===prior&&delta.length<full.length;if(send(socket,incremental?delta:full)){socket.stateRoom=room.code;socket.stateRevision=room.revision;}}room.wireState=state;}
 function current(id){return rooms.get(memberships.get(id));}
 function chooseLeader(room){if(!room.members.get(room.leader)?.connected)room.leader=[...room.members.values()].find(m=>m.connected)?.id||room.leader;}
 function board(){return {type:'board',online:sessions.size,capacity:maxPlayers,office:[...sessions.keys()].filter(id=>!current(id)?.raid).length,rooms:[...rooms.values()].filter(r=>r.public&&!r.raid&&r.members.size<4).map(r=>({code:r.code,level:r.level,count:r.members.size,leader:r.members.get(r.leader)?.name||'아인'}))};}
 function sendBoard(){const payload=JSON.stringify(board());for(const [id,ws] of sessions)if(!current(id)?.raid)send(ws,payload);}
 function history(key){return histories.get(key)||[];}
 function guildState(id){const g=store.guild(id);return g?{...g,members:g.members.map(p=>({...p,online:sessions.has(p.id)}))}:null;}
 function sendGuild(id){const ws=sessions.get(id);if(ws)send(ws,{type:'guild',guild:guildState(id)});}
 function refreshGuild(id){const g=store.guild(id);if(g)for(const m of g.members)sendGuild(m.id);}
 function sendHistory(id){const ws=sessions.get(id);if(!ws)return;const g=store.guild(id),r=current(id);send(ws,{type:'chatHistory',messages:[...history('world'),...history('guild:'+g?.id),...history('party:'+r?.code)].sort((a,b)=>a.id-b.id)});}
 function enterOffice(id){const ws=sessions.get(id);if(!ws)return;send(ws,board());sendGuild(id);sendHistory(id);}
 function profileUpdate(profile){const ws=sessions.get(profile.id);if(ws)send(ws,{type:'profile',profile});}
 function leave(id){const room=current(id);if(!room)return;room.members.delete(id);memberships.delete(id);room.raid?.disconnect(id);chooseLeader(room);if(!room.members.size){rooms.delete(room.code);histories.delete('party:'+room.code);}else broadcast(room);}
 function join(room,profile){if(room.raid)throw Error('출격 중인 방은 새로 참가할 수 없습니다.');if(room.members.size>=4)throw Error('파티가 가득 찼습니다.');if(current(profile.id))throw Error('현재 파티에서 먼저 나가 주세요.');room.members.set(profile.id,{id:profile.id,name:profile.name,ready:false,connected:true});memberships.set(profile.id,room.code);broadcast(room);sendHistory(profile.id);sendBoard();}
 function attach(ws,result){
  if(closing||ws.readyState!==WebSocket.OPEN)return;
  const {profile,token}=result;if(!sessions.has(profile.id)&&sessions.size>=maxPlayers)throw Error('서버가 가득 찼습니다. 잠시 후 다시 접속하세요.');
  ws.playerId=profile.id;ws.authDeadline=Infinity;const old=sessions.get(profile.id);if(old&&old!==ws){send(old,{type:'superseded'});old.close(4001,'Another connection');}sessions.set(profile.id,ws);
  const room=current(profile.id);if(room){const m=room.members.get(profile.id);m.connected=true;m.name=profile.name;m.disconnectedAt=null;room.raid?.reconnect(profile.id);chooseLeader(room);}
  send(ws,{type:'welcome',protocol:2,ephemeral:process.env.EPHEMERAL_STORAGE==='1',token,profile,room:room?.code||null});
  enterOffice(profile.id);refreshGuild(profile.id);if(room)broadcast(room);sendBoard();
 }
 function requireOffice(id){if(current(id)?.raid)throw Error('인력사무소에서 이용할 수 있습니다.');}
 function unready(id){const r=current(id);if(r&&!r.raid){r.members.get(id).ready=false;broadcast(r);}}
 async function account(ws,msg){
  const upgrade=msg.mode==='register'&&ws.playerId;
  if(ws.playerId&&!upgrade)throw Error('현재 계정에서 로그아웃한 뒤 다시 시도하세요.');
  if(upgrade)requireOffice(ws.playerId);
  if(!['register','login'].includes(msg.mode))throw Error('계정 요청을 확인하세요.');
  if(!ws.playerId&&sessions.size>=maxPlayers&&msg.mode==='register')throw Error('서버가 가득 찼습니다.');
  const key=String(msg.username).toLowerCase().slice(0,32),now=Date.now(),recent=authAttempts.get(key)||{count:0,until:now+60000};
  if(now>recent.until){recent.count=0;recent.until=now+60000;}if(++recent.count>10||pendingAuth>=4)throw Error('로그인 요청이 많습니다. 잠시 후 다시 시도하세요.');authAttempts.set(key,recent);if(authAttempts.size>1000)authAttempts.delete(authAttempts.keys().next().value);
  pendingAuth++;
  try{const result=msg.mode==='register'?await store.register(msg.username,msg.password,msg.name,upgrade||undefined):await store.authenticate(msg.username,msg.password);attach(ws,result);}finally{pendingAuth--;}
 }
 async function command(ws,msg){
  if(!msg||typeof msg!=='object'||Array.isArray(msg)||typeof msg.type!=='string')throw Error('잘못된 요청입니다.');
  if(msg.type==='ping'){send(ws,{type:'pong',echo:Number.isFinite(msg.time)?msg.time:0});return;}
  if(msg.type==='account'){await account(ws,msg);return;}
  if(msg.type==='hello'){if(ws.playerId)throw Error('이미 접속했습니다.');if(sessions.size>=maxPlayers&&!msg.token)throw Error('서버가 가득 찼습니다.');attach(ws,store.login(msg.token,msg.name));return;}
  const id=ws.playerId;if(!id||sessions.get(id)!==ws)throw Error('먼저 접속해 주세요.');const room=current(id);
  if(msg.type==='logout'){store.revoke(id);leave(id);sessions.delete(id);send(ws,{type:'loggedOut'});ws.close(1000,'Logout');sendBoard();return;}
  if(msg.type==='character'){const p=store.chooseName(id,msg.name);profileUpdate(p);enterOffice(id);sendBoard();return;}
  if(!store.public(id).characterCreated)throw Error('먼저 캐릭터 이름을 정하세요.');
  if(['guildCreate','guildJoin','guildLeave'].includes(msg.type)){
   if(!store.public(id).account)throw Error('길드 이용 전 계정을 등록하세요.');
   const old=store.guild(id);
   if(msg.type==='guildCreate')store.createGuild(id,msg.name);
   if(msg.type==='guildJoin')store.joinGuild(id,msg.code);
   if(msg.type==='guildLeave')store.leaveGuild(id);
   if(old){for(const m of old.members)sendGuild(m.id);if(old.members.length===1)histories.delete('guild:'+old.id);}
   refreshGuild(id);sendGuild(id);sendHistory(id);return;
  }
  if(msg.type==='chat'){
   if(!['world','guild','party'].includes(msg.channel))throw Error('채팅 채널을 선택하세요.');
   if(typeof msg.text!=='string')return;const text=msg.text.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,160);if(!text)return;
   let key='world',ids=[...sessions.keys()];
   if(msg.channel==='party'){if(!room)throw Error('파티가 없습니다.');key='party:'+room.code;ids=[...room.members.keys()];}
   if(msg.channel==='guild'){const g=store.guild(id);if(!g)throw Error('길드에 가입해야 길드 채팅을 할 수 있습니다.');key='guild:'+g.id;ids=g.members.map(m=>m.id);}
   if(Date.now()-(ws.lastChat||0)<1000)throw Error('채팅은 1초 간격으로 보낼 수 있습니다.');
   ws.lastChat=Date.now();const message={id:++chatSerial,channel:msg.channel,name:store.public(id).name,player:id,text};const messages=history(key);messages.push(message);if(messages.length>50)messages.shift();histories.set(key,messages);
   const payload=JSON.stringify({type:'chat',message});for(const pid of ids){const peer=sessions.get(pid);if(peer)send(peer,payload);}return;
  }
  if(['market','sell','buy','cancelSale','shop','purchase','equip'].includes(msg.type)){
   requireOffice(id);if(msg.type==='market'){send(ws,{type:'market',listings:store.market()});return;}
   if(msg.type==='shop'){send(ws,{type:'shop',items:store.shop()});return;}
   if(!store.public(id).account)throw Error('거래·장비 이용 전 계정을 등록하세요.');
   if(Date.now()-(ws.lastEconomy||0)<250)throw Error('처리 중입니다. 잠시 후 다시 시도하세요.');ws.lastEconomy=Date.now();
   if(msg.type==='sell'){store.list(id,msg.item,msg.quantity,msg.price);profileUpdate(store.public(id));}
   if(msg.type==='buy'){if(typeof msg.listing!=='string')throw Error('물품을 선택하세요.');for(const p of store.buy(id,msg.listing))profileUpdate(p);}
   if(msg.type==='cancelSale'){if(typeof msg.listing!=='string')throw Error('물품을 선택하세요.');profileUpdate(store.cancel(id,msg.listing));}
   if(msg.type==='purchase')profileUpdate(store.purchase(id,msg.item,msg.quantity));
   if(msg.type==='equip'){profileUpdate(store.equip(id,msg.item));unready(id);}
   send(ws,{type:'market',listings:store.market()});return;
  }
  if(msg.type==='create'){requireOffice(id);if(room)throw Error('현재 파티에서 먼저 나가 주세요.');if(rooms.size>=maxRooms)throw Error('서버가 가득 찼습니다.');const level=Object.hasOwn(C.levels,msg.level)?msg.level:'d01';let code;do{code=crypto.randomBytes(5).toString('hex').toUpperCase();}while(rooms.has(code));const next={code,leader:id,level,public:msg.public!==false,members:new Map(),raid:null};rooms.set(code,next);join(next,store.public(id));return;}
  if(msg.type==='join'){requireOffice(id);if(typeof msg.code!=='string')throw Error('방 코드를 확인하세요.');const target=rooms.get(msg.code.trim().toUpperCase());if(!target)throw Error('방을 찾을 수 없습니다.');join(target,store.public(id));return;}
  if(msg.type==='leave'){leave(id);send(ws,{type:'left'});enterOffice(id);sendBoard();return;}
  if(!room)throw Error('파티에 먼저 참가해 주세요.');
  if(msg.type==='ready'){if(room.raid)throw Error('이미 출격했습니다.');room.members.get(id).ready=msg.ready===true;broadcast(room);return;}
  if(['start','retry','lobby'].includes(msg.type)&&room.leader!==id)throw Error('파티장만 실행할 수 있습니다.');
  if(msg.type==='start'){
   if(room.raid)throw Error('이미 출격했습니다.');const members=[...room.members.values()];if(members.length<2||!members.every(m=>m.connected&&m.ready))throw Error('2명 이상이 연결되어 모두 준비해야 합니다.');
   room.raid=new Raid(room.level,members.map(m=>({...m,stats:store.stats(m.id)})),raid=>{const profiles=store.award(raid.id,[...room.members.keys()],raid.A.id,raid.result);for(const profile of Object.values(profiles))profileUpdate(profile);});broadcast(room);sendBoard();return;
  }
  if(msg.type==='retry'){if(room.raid?.state!=='wiped')throw Error('전멸 후 재도전할 수 있습니다.');room.raid.retry();broadcast(room);return;}
  if(msg.type==='lobby'){if(!['clear','wiped'].includes(room.raid?.state))throw Error('전투가 끝난 후 인력사무소로 돌아갑니다.');if(room.raid.result?.rewardStatus==='pending')throw Error('보상 저장을 재시도하고 있습니다. 잠시 후 다시 시도하세요.');room.raid=null;for(const m of room.members.values()){m.ready=false;enterOffice(m.id);}broadcast(room);sendBoard();return;}
  if(!room.raid)throw Error('출격 후 조작할 수 있습니다.');
  if(!Number.isSafeInteger(msg.seq)||msg.seq<=ws.lastSeq)return;ws.lastSeq=msg.seq;room.raid.input(id,msg);
 }
 wss.on('connection',ws=>{
  connections.add(ws);ws.alive=true;ws.authDeadline=Date.now()+20000;ws.lastSeq=0;ws.bucket=120;ws.bucketAt=Date.now();ws.queue=Promise.resolve();ws.queued=0;
  ws.on('pong',()=>ws.alive=true);ws.on('error',()=>{});
  ws.on('message',bytes=>{const now=Date.now();ws.bucket=Math.min(120,ws.bucket+(now-ws.bucketAt)*.08);ws.bucketAt=now;if(ws.bucket<1||ws.queued>=64){ws.close(4008,'Rate limit');return;}ws.bucket--;ws.queued++;ws.queue=ws.queue.then(async()=>{if(ws.readyState!==WebSocket.OPEN)return;try{await command(ws,JSON.parse(bytes.toString()));}catch(e){send(ws,{type:'error',message:e instanceof SyntaxError?'잘못된 메시지입니다.':e.message});}}).finally(()=>ws.queued--);});
  ws.on('close',()=>{connections.delete(ws);if(closing)return;if(!ws.playerId||sessions.get(ws.playerId)!==ws)return;sessions.delete(ws.playerId);const room=current(ws.playerId);if(room){const m=room.members.get(ws.playerId);m.connected=false;m.ready=false;m.disconnectedAt=Date.now();room.raid?.disconnect(ws.playerId);chooseLeader(room);broadcast(room);}refreshGuild(ws.playerId);sendBoard();});
 });
 let prev=performance.now(),acc=0,broadcastAcc=0;
 const timer=setInterval(()=>{const now=performance.now(),elapsed=(now-prev)/1000,dt=Math.min(.1,elapsed);if(elapsed>.1)stats.droppedSteps+=Math.floor((elapsed-.1)/.01);prev=now;acc+=dt;broadcastAcc+=dt;while(acc>=.01){for(const room of rooms.values())room.raid?.tick(.01);acc-=.01;}if(broadcastAcc>=.05){broadcastAcc=0;for(const room of rooms.values())if(room.raid)broadcast(room);}},10);
 const heartbeat=setInterval(()=>{const now=Date.now();for(const ws of connections){if(!ws.alive||now>ws.authDeadline)ws.terminate();else{ws.alive=false;ws.ping();}}for(const room of [...rooms.values()])for(const m of [...room.members.values()])if(!m.connected&&now-m.disconnectedAt>90000)leave(m.id);sendBoard();},5000);
 timer.unref();heartbeat.unref();
 return {server,rooms,store,sessions,stats,listen:(port=Number(process.env.PORT||8787),host=process.env.HOST||'0.0.0.0')=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve(server.address());});}),close:()=>new Promise(resolve=>{closing=true;clearInterval(timer);clearInterval(heartbeat);for(const ws of connections)ws.terminate();wss.close();server.close(()=>{store.close();resolve();});})};
}
if(require.main===module){const app=createPartyServer();app.listen().then(a=>{console.log(`황혼 쉘터·인력사무소: http://localhost:${a.port}/party.html`);for(const n of Object.values(os.networkInterfaces()).flat())if(n.family==='IPv4'&&!n.internal)console.log(`같은 Wi-Fi: http://${n.address}:${a.port}/party.html`);}).catch(e=>{console.error(e.message);process.exitCode=1;});for(const s of ['SIGINT','SIGTERM'])process.once(s,()=>app.close().then(()=>process.exit(0)));}
module.exports={createPartyServer};
