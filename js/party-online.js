import {createRpgUI} from './party-rpg.js';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {Animated} from './party-avatar.js';
import {createPumpBoss} from './pump-boss.js';
import {prepareTrainingMotion,sampleBossAttack} from './boss-motion.js';
import {createTrainingParts} from './training-presentation.js';
import {createRelayBoss} from './relay-boss.js';
import {createRootBoss} from './root-boss.js';
import {createHaulerBoss} from './hauler-boss.js';
import {prepareMarshMotion,bossAttackSpec,bossPartPieces} from './marsh-motion.js';
import {buildDungeonProps} from './dungeon-props.js';
const $=id=>document.getElementById(id),levels=window.TW_LEVELS,arenas=window.TW_DUNGEONS.ARENAS,loader=new GLTFLoader();
const storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}},remove(k){try{localStorage.removeItem(k);}catch{}}};
let socket,profile,room,sequence=0,connected=false,reconnectTimer,stopped=false,lastReceived=0,latestEvent=0,noticeUntil=0,view,assetPromise,assets,keys={},stick={x:0,y:0},pingTimer;
let authRequest=null,guild=null,chatMessages=[],pendingChat=null,chatTimer,chatChannel=null;
const params=new URLSearchParams(location.search),invite=params.get('room');
/* 파티 서버 주소: 기본은 이 페이지를 서빙한 서버. 정적 호스팅(GitHub Pages)에서는 ?server=<주소> 로 지정하면 기억한다 */
const serverParam=params.get('server');
if(serverParam!==null){try{serverParam?localStorage.setItem('tw:party-server',serverParam):localStorage.removeItem('tw:party-server');}catch{}}
function partyServer(){let v='';try{v=serverParam||localStorage.getItem('tw:party-server')||'';}catch{v=serverParam||'';}
 if(!v)return{host:location.host,origin:location.origin,remote:false};
 let u;try{u=new URL(/^(https?|wss?):\/\//.test(v)?v.replace(/^ws/,'http'):'https://'+v);}catch{return{host:location.host,origin:location.origin,remote:false};}
 return{host:u.host,origin:u.origin,remote:u.host!==location.host};}
const server=partyServer();
const tokenKey='tw:party-token:'+server.host;
$('nickname').value=storage.get('tw:party-name')||'아인';if(invite)$('room-code').value=invite;
function notice(text){$('notice').textContent=text;$('market-notice').textContent=text;$('shop-notice').textContent=text;}
function send(message){if(!connected||socket?.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify({...message,seq:++sequence}));return true;}
function connect(request=null){if(socket&&[0,1].includes(socket.readyState))return;authRequest=request;stopped=false;clearTimeout(reconnectTimer);$('connect').disabled=true;$('connection').textContent='접속 중';
 if(!/^https?:$/.test(location.protocol)){notice('파티 서버 주소에서 이 화면을 열어 주세요.');$('connect').disabled=false;return;}
 const scheme=(server.remote?server.origin.startsWith('https'):location.protocol==='https:')?'wss:':'ws:';
 socket=new WebSocket(scheme+'//'+server.host+'/party-socket');
 socket.addEventListener('open',()=>{sequence=0;socket.send(JSON.stringify(authRequest||{type:'hello',token:storage.get(tokenKey),name:$('nickname').value}));authRequest=null;$('password').value='';});
 socket.addEventListener('message',e=>{if(e.target!==socket)return;let msg;try{msg=JSON.parse(e.data);}catch{return;}
  rpgUI.receive(msg);
  if(msg.type==='welcome'){$('claim-password').value='';connected=true;profile=msg.profile;$('storage-note').hidden=!msg.ephemeral;if(!msg.room){room=null;renderRoom();}storage.set(tokenKey,msg.token);storage.set('tw:party-name',profile.name);$('login').hidden=true;$('online').hidden=false;$('connection').textContent='연결됨';$('disconnect').hidden=true;updateProfile();notice('접속했습니다. 이름을 정하고 쉘터와 인력사무소를 이용하세요.');renderSocial();if(invite&&!msg.room&&profile.characterCreated)send({type:'join',code:invite});clearInterval(pingTimer);pingTimer=setInterval(()=>send({type:'ping',time:performance.now()}),2000);return;}
  if(msg.type==='profile'){const named=profile?.characterCreated;profile=msg.profile;updateProfile();if(!named&&profile.characterCreated&&invite&&!room)send({type:'join',code:invite});return;}
  if(msg.type==='guild'){guild=msg.guild;renderGuild();return;}
  if(msg.type==='board'){renderBoard(msg);return;}
  if(msg.type==='chatHistory'){chatMessages=msg.messages;renderChat();return;}
  if(msg.type==='chat'){const m=msg.message;if(pendingChat&&m.player===profile?.id&&m.channel===pendingChat.channel&&m.text===pendingChat.text){if($('chat-text').value===pendingChat.draft)$('chat-text').value='';finishChat();}appendChat(m);return;}
  if(msg.type==='rpgNotice'){notice(msg.text);announce(msg.text);return;}
  if(msg.type==='market'){renderMarket(msg.listings);return;}
  if(msg.type==='shop'){renderShop(msg.items);return;}
  if(msg.type==='loggedOut'){stopped=true;connected=false;profile=null;room=null;guild=null;chatMessages=[];storage.remove(tokenKey);$('login').hidden=false;$('online').hidden=true;if(view){view.dispose();view=null;}renderRoom();renderSocial();return;}

  if(msg.type==='patch'){if(!room)return;msg=window.TW_PARTY_WIRE.apply(room,msg.patch);}
  if(msg.type==='state'){const previousRun=room?.raid?.id;room=msg;lastReceived=performance.now();$('disconnect').hidden=true;if(previousRun!==room.raid?.id){latestEvent=0;if(view){view.dispose();view=null;}}renderRoom();renderSocial();if(room.raid){$('market-dialog').close();$('shop-dialog').close();processEvents(room.raid.events);}rpgUI.roomChanged();return;}
  if(msg.type==='left'){room=null;if(view){view.dispose();view=null;}$('arena').hidden=true;$('lobby').hidden=false;renderRoom();renderSocial();return;}
  if(msg.type==='pong'){const ms=Math.round(performance.now()-msg.echo);$('latency').textContent=ms+'ms'+(ms>120?' · 지연 높음':'');return;}
  if(msg.type==='superseded'){stopped=true;connected=false;notice('다른 창에서 같은 프로필로 접속했습니다.');$('disconnect').textContent='다른 창에서 접속했습니다. 한 캐릭터는 한 창에서 조작합니다.';$('disconnect').hidden=false;return;}
  if(msg.type==='error'){finishChat();notice(msg.message);announce(msg.message);if(!connected){$('login').hidden=false;$('online').hidden=true;$('fresh').hidden=false;stopped=true;socket.close();}}
 });
 socket.addEventListener('error',()=>{if(!server.remote&&!connected)notice('이 주소에는 파티 서버가 없습니다. 아래 «파티 서버 주소» 에 서버 주소를 넣고 접속하세요.');});
 socket.addEventListener('close',e=>{if(e.target!==socket)return;connected=false;finishChat();clearInterval(pingTimer);$('connect').disabled=false;$('connection').textContent='연결 끊김';$('social-link-state').textContent='연결을 복구하는 중입니다';clearControls(false);if(room?.raid)$('disconnect').hidden=false;if(!stopped&&profile){notice('연결을 복구하고 있습니다.');reconnectTimer=setTimeout(connect,1500);}else if(!profile&&!stopped)notice('파티 서버에 연결할 수 없습니다. 서버를 실행한 주소로 접속해 주세요.');});
 socket.addEventListener('error',()=>notice('파티 서버에 연결할 수 없습니다. 기존 정적 사이트에서는 서버 실행이 필요합니다.'));
}
function updateProfile(){if(!profile)return;$('profile-name').textContent=profile.name;$('wallet').textContent=profile.gold.toLocaleString()+' G · '+profile.xp+' XP';$('stash').replaceChildren();for(const [id,n]of Object.entries(profile.items)){const row=document.createElement('div');row.textContent=(window.TW_ITEMS?.get(id)?.name||id)+' × '+n;$('stash').append(row);}if(!Object.keys(profile.items).length)$('stash').textContent='협동 던전을 완료하면 전리품이 여기에 쌓입니다.';
 $('account-status').textContent=profile.account?'계정 · '+profile.account:'체험 캐릭터';$('claim-account').hidden=!!profile.account;$('character-stats').textContent='Lv. '+profile.level+' · 체력 '+profile.stats.hp.toLocaleString()+' · 공격 '+profile.stats.atk.toLocaleString();$('sell-item').replaceChildren();$('equipment-list').replaceChildren();$('character-create').hidden=!!profile.characterCreated;$('hub-tools').hidden=!profile.characterCreated;renderSocial();
 for(const [id,n]of Object.entries(profile.items)){if(n<=0)continue;const item=window.TW_ITEMS.get(id);if(id.startsWith('m_')){const option=document.createElement('option');option.value=id;option.textContent=item.name+' · '+n+'개';$('sell-item').append(option);}if(item&&['armor','acc'].includes(item.type)){const row=document.createElement('div');row.className='inventory-row';const name=document.createElement('span');name.textContent=item.name;const button=document.createElement('button');const equipped=Object.values(profile.equipment).includes(id);button.textContent=equipped?'착용 중':'착용';button.disabled=equipped;button.onclick=()=>send({type:'equip',item:id});row.append(name,button);$('equipment-list').append(row);}}
}

/* 캐릭터별 모델·기본 무기. 방에 있는 캐릭터만 내려받는다 */
const CHAR_ASSET={ain:['art/3d/ain_anim.glb','art/3d/ain_scythe_tex.glb'],kain:['art/3d/kain_anim.glb','art/3d/gear/w_kain_greatsword.glb'],ryu:['art/3d/ryu_anim.glb','art/3d/gear/w_ash_dirk.glb'],sera:['art/3d/sera_anim.glb','art/3d/gear/w_sera_flask.glb']};
const charAssets=new Map();
function loadCharacter(c){if(!CHAR_ASSET[c])c='ain';if(charAssets.has(c))return charAssets.get(c);
 const task=Promise.all(CHAR_ASSET[c].map(url=>loader.loadAsync(url))).then(([model,weapon])=>({model,weapon}));
 charAssets.set(c,task);return task;}
function loadAssets(characters){const list=(characters||[]).filter(c=>CHAR_ASSET[c]);const want=[...new Set(list.length?list:['ain'])];
 if(assetPromise&&want.every(c=>charAssets.has(c)))return assetPromise;
 assetPromise=Promise.all([
  Promise.all(want.map(loadCharacter)),
  loader.loadAsync('art/3d/boss_anim.glb'),
  loader.loadAsync(arenas.marsh.model)
 ]).then(([chars,dummy,marsh])=>{const by={};want.forEach((c,i)=>by[c]=chars[i]);
  const first=by[want[0]];
  assets={chars:by,ain:first.model,weapon:first.weapon,dummy,marsh};$('asset-status').textContent='전투 자산 준비 완료';renderRoom();return assets;
 }).catch(e=>{$('asset-status').textContent='전투 자산을 불러오지 못했습니다.';throw e;});
 return assetPromise;}
function renderRoom(){const hasRoom=!!room;$('choose-room').hidden=hasRoom;$('room').hidden=!hasRoom;if(!hasRoom){$('arena').hidden=true;$('lobby').hidden=false;if(view){view.dispose();view=null;}return;}
 $('code').textContent=room.code;$('room-level').textContent=levels[room.level].name;$('roster').replaceChildren();for(const m of room.members){const row=document.createElement('li'),name=document.createElement('span'),status=document.createElement('small');name.textContent=m.name+(m.id===room.leader?' · 파티장':'');status.textContent=!m.connected?'재접속 대기':m.ready?'준비 완료':'준비 중';row.append(name,status);$('roster').append(row);}
 const me=room.members.find(m=>m.id===profile?.id);$('ready').textContent=me?.ready?'준비 취소':'준비 완료';$('ready').disabled=!assets||!connected;$('start').disabled=room.leader!==profile?.id||room.members.length<2||!room.members.every(m=>m.ready&&m.connected)||!connected;
 loadAssets(room.members.map(m=>m.character)).catch(()=>{});
 const active=!!room.raid;$('arena').hidden=!active;$('lobby').hidden=active;
 if(active&&assets&&!view){try{view=new RaidView($('scene'),room.raid,assets);}catch(e){notice('3D 화면 생성 실패: '+e.message);announce('3D 화면을 만들 수 없습니다. 다른 브라우저에서 다시 접속하세요.');}}
 if(active){updateHud();if(room.training)$('outcome-text').textContent='패턴 훈련 · 보상과 의뢰 진행 없음';}else if(view){view.dispose();view=null;}
}
function announce(text){$('announcement').textContent=text;noticeUntil=performance.now()+2600;}
function processEvents(events){for(const e of events){if(e.id<=latestEvent)continue;latestEvent=e.id;
 if(e.type==='break'){announce(e.name+' 파괴 — 보스가 흔들린다');window.TW_SFX?.play('brk');}
 if(e.type==='telegraph')window.TW_SFX?.play('tele');
 if(e.type==='down')window.TW_SFX?.play('down');
 if(e.type==='dodge'&&e.player===profile?.id)window.TW_SFX?.play('roll');
 if(e.type==='skill')window.TW_SFX?.play('swing');
 if(e.type==='counter'){announce((e.perfect?'PERFECT':'COUNTER')+' · '+(room.members.find(p=>p.id===e.player)?.name||'아인'));window.TW_SFX?.play('counter',e.perfect);}
 if(e.type==='evade'&&e.player===profile?.id)announce('회피 성공 · 지금 반격해라');
 if(e.type==='revive')announce('동료가 다시 일어섰다');
 if(e.type==='playerDown')announce('동료 다운 · 가까이서 V / 소생 버튼 유지');
 if(e.type==='interact')announce(e.name);
 if(e.type==='execute'){announce('처형 — '+(room.members.find(p=>p.id===e.player)?.name||'아인'));view?.flashBoss();window.TW_SFX?.play('execute');}
 if(e.type==='phaseClear')announce('페이즈 돌파 — 보스가 깨어난다');
 if(e.type==='phase'){announce('P H A S E '+(e.phase+1)+' — '+(view?.A?.stages?.[e.phase]?.name||''));view?.phaseWake(e.phase+1);window.TW_SFX?.play('phase');}
 if(e.type==='hit'){view?.flashBoss();window.TW_SFX?.play('hit',e.kind==='counter');}
 if(e.type==='hurt'&&e.player===profile?.id){window.TW_SFX?.play('hurt');if(view)view.shake=.15;}
 if(e.type==='feedback'&&e.player===profile?.id)announce(e.text);
 if(e.type==='signal')announce((room.members.find(p=>p.id===e.player)?.name||'동료')+' · '+({focus:'조준 부위 집중',danger:'위험',revive:'소생 요청',gather:'집결'}[e.signal]));
 if(e.type==='consumable'&&e.player===profile?.id)announce(window.TW_ITEMS.get(e.item).name+' 사용');
 if(e.type==='whiff'&&e.player===profile?.id)announce('닿지 않는다 · 보스에게 더 가까이');
 }}
function mine(){return room?.raid?.players.find(p=>p.id===profile?.id);}
function updateHud(){const raid=room.raid,p=mine(),b=raid.boss;if(!p)return;
 $('raid-place').textContent=levels[raid.level].name;$('raid-clock').textContent=Math.floor(raid.time/60)+':'+String(Math.floor(raid.time%60)).padStart(2,'0');$('boss-hud').hidden=raid.state==='explore';$('boss-name').textContent=b.name+' · '+(raid.phase+1)+' / '+raid.phases;$('boss-hp').value=b.hp/b.maxHp;
 $('boss-pattern').textContent=b.state==='telegraph'?(b.pattern.counterable?((raid.level==='d01'&&b.tele<=b.window)?'지금 카운터':'튕길 수 있다'):'회피 전용')+' · '+b.pattern.name+' · '+(raid.players.find(p=>p.id===b.target)?.name||''):b.state==='downed'?(b.executable?'격추 · 붙어서 F — 처형':'격추 · 집중 공격'):b.state==='recover'?'공격 후 빈틈':'';
 $('self-name').textContent=p.name+(p.hp<=0?(p.dead?' · 전투 불능':' · 소생 대기 '+Math.ceil(p.downT)+'초'):'');$('self-hp').value=p.hp/p.maxHp;$('self-st').value=p.st;$('self-numbers').textContent=Math.ceil(p.hp)+' HP · '+Math.floor(p.st)+' ST · 궁극 '+Math.floor(p.ult)+'%';
 const part=b.parts.find(q=>q.id===p.target)||b.parts[0];$('target-button').textContent='조준 · '+part.name+' '+(part.broken?'노출':part.hpMax?Math.ceil(part.hp/part.hpMax*100)+'%':'');
 $('party-vitals').replaceChildren();for(const q of raid.players){const row=document.createElement('div');row.className='member-bar';const n=document.createElement('span');n.textContent=q.name+(q.connected?'':' · 끊김');n.style.color=COLORS[q.color%4];const bar=document.createElement('progress');bar.max=1;bar.value=q.hp/q.maxHp;row.append(n,bar);$('party-vitals').append(row);}
 const level=levels[raid.level],required=level.expedition.required||[],done=required.filter(id=>raid.expedition.done[id]).length;
 $('mission').textContent=raid.state==='explore'?(required.length?'오염원 차단 '+done+' / '+required.length:'정비 지점에서 회복하고 보스실로'):'회피·카운터·부위 파괴로 함께 공략';
 if(p.hp<=0&&!p.dead)$('mission').textContent='동료 소생 '+Math.floor(p.reviveProgress/3*100)+'%';
 document.querySelectorAll('[data-command="skill"]').forEach((el,i)=>{const k=p.kit?.[i];el.disabled=p.cds[i]>0||p.hp<=0||(k?p.st<k.st:false);
  const label=k?k.name+(k.lv>1?' Lv'+k.lv+(k.br?'·'+k.br:''):''):'기술 '+(i+1);
  el.textContent=(i+1)+' · '+(p.cds[i]>0?Math.ceil(p.cds[i])+'초':label);});
 const ultBtn=document.querySelector('[data-command="ult"]');if(ultBtn&&p.ultName)ultBtn.textContent='R · '+p.ultName+(p.ultLv>1?' Lv'+p.ultLv:'')+' '+Math.floor(p.ult)+'%';
 const ended=['clear','wiped'].includes(raid.state);if(ended&&$('outcome').hidden)clearControls();$('outcome').hidden=!ended;if(ended){$('outcome-kicker').textContent=raid.state==='clear'?'EXPEDITION COMPLETE':'PARTY DOWN';$('outcome-title').textContent=raid.state==='clear'?'함께 돌아왔다.':'다시 일어설 시간.';$('outcome-text').textContent=raid.state==='clear'?(raid.result.rewardStatus==='saved'?raid.result.gold.toLocaleString()+' G와 전리품을 파티원 각각에게 지급했습니다.':'보상 저장을 재시도하고 있습니다. 이 파티에서 기다려 주세요.'):'조사한 지점은 유지됩니다. 정비 지점에서 다시 도전하세요.';$('scoreboard').replaceChildren();for(const q of raid.result?.players||raid.players){const row=document.createElement('div');row.textContent=q.name+' · 피해 '+Math.round(q.damage).toLocaleString()+' · 카운터 '+q.counters+' · 파괴 '+q.breaks;$('scoreboard').append(row);}const lead=room.leader===profile.id;$('retry').hidden=raid.state!=='wiped'&&!room.training;$('retry').disabled=!lead;$('return-lobby').disabled=!lead||raid.result?.rewardStatus==='pending';$('leader-hint').textContent=lead?'파티원이 함께 이동합니다.':'파티장이 다음 출격을 선택하고 있습니다.';}
}
(function(){const el=$('server-url');if(!el)return;let cur='';try{cur=localStorage.getItem('tw:party-server')||'';}catch{}
 el.value=cur;const hint=$('server-hint');
 const paint=()=>{if(hint)hint.textContent=server.remote?('원격 서버: '+server.host):'이 페이지를 연 서버에 접속합니다.';};paint();
 el.addEventListener('change',()=>{const v=el.value.trim();try{v?localStorage.setItem('tw:party-server',v):localStorage.removeItem('tw:party-server');}catch{}
  const u=new URL(location.href);v?u.searchParams.set('server',v):u.searchParams.delete('server');location.href=u.href;});})();
$('connect').onclick=()=>connect();$('fresh').onclick=()=>{storage.remove(tokenKey);profile=null;socket?.close();setTimeout(()=>connect(),100);};
$('create').onclick=()=>send({type:'create',level:$('dungeon').value,public:$('public-room').checked,purpose:$('party-purpose').value});$('join').onclick=()=>send({type:'join',code:$('room-code').value});$('ready').onclick=()=>send({type:'ready',ready:!room.members.find(m=>m.id===profile.id)?.ready});$('start').onclick=()=>send({type:'start'});$('leave').onclick=()=>send({type:'leave'});
$('invite').onclick=async()=>{const url=new URL('party.html',location.href);url.searchParams.set('room',room.code);if(server.remote)url.searchParams.set('server',server.origin);try{await navigator.clipboard.writeText(url.href);notice('초대 링크를 복사했습니다.');}catch{notice('초대 주소: '+url.href);}};
$('retry').onclick=()=>send({type:'retry'});$('return-lobby').onclick=()=>send({type:'lobby'});$('menu-button').onclick=()=>{clearControls();$('raid-menu').showModal();};$('close-menu').onclick=()=>$('raid-menu').close();$('exit-raid').onclick=()=>{$('raid-menu').close();send({type:'leave'});};
function cycleTarget(){const p=mine();if(!p)return;const ids=room.raid.boss.parts.map(q=>q.id);send({type:'target',part:ids[(ids.indexOf(p.target)+1)%ids.length]});}
$('target-button').onclick=cycleTarget;
/* 격추된 보스 옆에서는 F 가 «처형» 이 된다 (솔로와 같은 규칙) */
function executeReady(){const b=room?.raid?.boss;if(!b||!b.executable)return false;
 const me=room.raid.players.find(p=>p.id===profile?.id);if(!me||me.hp<=0)return false;
 return Math.hypot(b.x-me.x,(b.y-me.y)/.55)<=(room.raid.reach||110)*1.4;}
function control(command,on=true,index){if(!room?.raid||rpgUI.isModal()||!connected)return;
 if(command==='interact'&&executeReady())command='execute';if(command==='guard'||command==='revive')send({type:command,on});else if(on)send({type:command,...(index===undefined?{}:{index:Number(index)})});}
document.querySelectorAll('[data-command]').forEach(el=>{el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);control(el.dataset.command,true,el.dataset.index);});const release=()=>{if(el.hasAttribute('data-hold'))control(el.dataset.command,false);};el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);});
const commands={KeyJ:'attack',Space:'attack',KeyU:'smash',KeyK:'dodge',KeyL:'guard',KeyF:'interact',KeyV:'revive',KeyR:'ult'};
addEventListener('keydown',e=>{if(!room?.raid||e.target.matches('input,select,textarea')||rpgUI.isModal())return;if(e.repeat)return;keys[e.code]=true;const bound={[rpgUI.settings.attack]:'attack',[rpgUI.settings.dodge]:'dodge',[rpgUI.settings.guard]:'guard'},fixed={KeyU:'smash',KeyF:'interact',KeyV:'revive',KeyR:'ult'},cmd=bound[e.code]||fixed[e.code];if(cmd){e.preventDefault();control(cmd);}else if(e.code==='KeyQ'||e.code==='Tab'){e.preventDefault();cycleTarget();}else if(/^Digit[1-4]$/.test(e.code))control('skill',true,Number(e.code.slice(5))-1);});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code===rpgUI.settings.guard)control('guard',false);if(e.code==='KeyV')control('revive',false);});
function clearControls(transmit=true){keys={};stick={x:0,y:0};$('joystick').querySelector('i').style.transform='';if(transmit){if(room?.raid){send({type:'move',x:0,y:0});send({type:'guard',on:false});send({type:'revive',on:false});}}}
addEventListener('blur',()=>clearControls());document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls();});
let stickPointer=null;function stickMove(e){if(e.pointerId!==stickPointer)return;const r=$('joystick').getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.35),y=(e.clientY-r.top-r.height/2)/(r.height*.35),n=Math.max(1,Math.hypot(x,y));stick={x:x/n,y:y/n};$('joystick').querySelector('i').style.transform=`translate(${stick.x*28}px,${stick.y*28}px)`;}
$('joystick').onpointerdown=e=>{if(stickPointer!==null)return;stickPointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);stickMove(e);};$('joystick').onpointermove=stickMove;for(const type of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(type,e=>{if(e.pointerId===stickPointer){stickPointer=null;stick={x:0,y:0};$('joystick').querySelector('i').style.transform='';send({type:'move',x:0,y:0});}});
setInterval(()=>{if(!room?.raid||!connected||document.hidden||rpgUI.isModal()||!['explore','fight'].includes(room.raid.state))return;const x=(keys[rpgUI.settings.right]||keys.ArrowRight?1:0)-(keys[rpgUI.settings.left]||keys.ArrowLeft?1:0)+stick.x,y=(keys[rpgUI.settings.back]||keys.ArrowDown?1:0)-(keys[rpgUI.settings.forward]||keys.ArrowUp?1:0)+stick.y;send({type:'move',x:.832*x+.555*y,y:-.555*x+.832*y});},50);

function renderSocial(){$('chat-channel').querySelector('[value="party"]').disabled=!room;if(!room&&$('chat-channel').value==='party'){$('chat-channel').value='world';renderChat();}const active=!!profile?.characterCreated;$('social-area').hidden=!active;$('intro-copy').hidden=!!profile;$('social-link-state').textContent=connected?'':'접속이 끊겼습니다';const inRaid=!!room?.raid;const parent=inRaid?$('raid-chat'):$('social-chat-slot');if($('chat-panel').parentElement!==parent)parent.append($('chat-panel'));$('chat-close').hidden=!inRaid;if(!inRaid)$('raid-chat').hidden=true;}
function renderGuild(){$('guild-empty').hidden=!!guild;$('guild-home').hidden=!guild;if(guild){$('guild-notice').textContent=guild.notice||'등록된 길드 공지가 없습니다.';$('guild-title').textContent=guild.name+'의 쉘터';$('guild-invite').textContent='초대 코드 '+guild.code+' · '+guild.members.length+'명';$('guild-members').replaceChildren();for(const m of guild.members){const row=document.createElement('p');row.textContent=(m.online?'● ':'○ ')+m.name+(m.id===guild.owner?' · 길드장':'');$('guild-members').append(row);}}$('chat-channel').querySelector('[value="guild"]').disabled=!guild;if(!guild&&$('chat-channel').value==='guild')$('chat-channel').value='world';renderChat();}
function renderBoard(b){$('population').textContent='접속 '+b.online+' / '+b.capacity+' · 인력사무소 '+b.office;$('party-board').replaceChildren();for(const r of b.rooms){const row=document.createElement('div');row.className='board-row';const text=document.createElement('span');text.textContent=r.leader+' · '+levels[r.level].name+' · '+({practice:'연습',first:'첫 클리어',repeat:'반복 토벌'}[r.purpose]||'모집')+' · '+r.count+'/4';const button=document.createElement('button');button.textContent='참가';button.disabled=!!room;button.onclick=()=>send({type:'join',code:r.code});row.append(text,button);$('party-board').append(row);}if(!b.rooms.length)$('party-board').textContent='새 파티를 만들어 동료를 모집하세요.';}
function appendChat(m){chatMessages.push(m);if(chatMessages.length>150)chatMessages.shift();renderChat();}
function renderChat(){const channel=$('chat-channel').value,log=$('chat-log'),top=log.scrollTop,follow=channel!==chatChannel||log.scrollHeight-log.clientHeight-top<32;log.replaceChildren();for(const m of chatMessages.filter(m=>m.channel===channel)){const row=document.createElement('p');row.textContent=m.name+(m.channel==='whisper'?' → '+m.toName:'')+': '+m.text;log.append(row);}log.scrollTop=follow?log.scrollHeight:top;chatChannel=channel;}
$('chat-channel').onchange=()=>renderChat();
function finishChat(){clearTimeout(chatTimer);pendingChat=null;const button=$('chat-form').querySelector('button');button.disabled=false;button.textContent='전송';}
$('character-submit').onclick=()=>send({type:'character',name:$('character-name').value,character:$('character-pick').value});
$('guild-create').onclick=()=>send({type:'guildCreate',name:$('guild-name').value});$('guild-join').onclick=()=>send({type:'guildJoin',code:$('guild-code').value});$('guild-leave').onclick=()=>send({type:'guildLeave'});
$('raid-chat-toggle').onclick=()=>{clearControls();$('raid-chat').hidden=!$('raid-chat').hidden;};$('chat-close').onclick=()=>$('raid-chat').hidden=true;
function renderMarket(listings){$('market-list').replaceChildren();for(const l of listings){const row=document.createElement('div');row.className='market-row';const text=document.createElement('span');text.textContent=(window.TW_ITEMS.get(l.item)?.name||l.item)+' × '+l.quantity+' · '+(l.quantity*l.price).toLocaleString()+' G · '+l.name;const button=document.createElement('button');const mine=l.seller===profile.id;button.textContent=mine?'판매 취소':'묶음 구매';button.disabled=!mine&&profile.gold<l.quantity*l.price;button.onclick=()=>send({type:mine?'cancelSale':'buy',listing:l.id});row.append(text,button);$('market-list').append(row);}if(!listings.length)$('market-list').textContent='등록된 재료가 없습니다.';}
function renderShop(items){$('shop-list').replaceChildren();for(const offer of items){const item=window.TW_ITEMS.get(offer.id),row=document.createElement('div');row.className='market-row';const text=document.createElement('span');text.textContent=item.name+' · '+offer.price.toLocaleString()+' G'+(item.stats?' · 체력 +'+(item.stats.hp||0)+' / 방어 +'+(item.stats.def||0):'');const button=document.createElement('button');button.textContent='1개 구매';button.onclick=()=>send({type:'purchase',item:offer.id,quantity:1});row.append(text,button);$('shop-list').append(row);}}
for(const mode of ['login','register'])$('account-'+mode).onclick=()=>connect({type:'account',mode,username:$('account-id').value,password:$('password').value,name:$('nickname').value});
$('claim-submit').onclick=()=>send({type:'account',mode:'register',username:$('claim-id').value,password:$('claim-password').value});
$('logout').onclick=()=>{stopped=true;send({type:'logout'});};
$('chat-form').onsubmit=e=>{
 e.preventDefault();if(pendingChat)return;
 const draft=$('chat-text').value,text=draft.replace(/[\u0000-\u001f\u007f<>]/g,'').trim(),channel=$('chat-channel').value;
 if(!text){notice('채팅 내용을 입력하세요.');return;}
 if(!connected||socket?.readyState!==WebSocket.OPEN){notice('연결이 끊겨 전송하지 못했습니다. 입력한 내용은 유지됩니다.');return;}
 const name=$('whisper-target').value.trim();if(channel==='whisper'&&!name){notice('귓속말을 받을 캐릭터 이름을 입력하세요.');return;}
 pendingChat={draft,text,channel};const button=$('chat-form').querySelector('button');button.disabled=true;button.textContent='전송 중';
 chatTimer=setTimeout(()=>{finishChat();notice('전송을 확인하지 못했습니다. 채팅 내역을 확인한 뒤 다시 보내세요.');},10000);
 send(channel==='whisper'?{type:'rpg',action:'whisper',name,text}:{type:'chat',channel,text});
};
// Enter confirms a completed input, never an in-progress Korean IME composition.
function enterClicks(input,button){$(input).addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing||e.keyCode===229||e.repeat)return;e.preventDefault();$(button).click();});}
for(const [input,button] of [['account-id','account-login'],['password','account-login'],['character-name','character-submit'],['room-code','join'],['guild-code','guild-join'],['claim-password','claim-submit']])enterClicks(input,button);
$('chat-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||e.keyCode===229))e.preventDefault();});
$('open-party').onclick=()=>$('recruitment').scrollIntoView({behavior:'smooth'});
$('open-market').onclick=()=>{clearControls();$('market-dialog').showModal();send({type:'market'});};$('market-close').onclick=()=>$('market-dialog').close();$('market-refresh').onclick=()=>send({type:'market'});
$('open-shop').onclick=()=>{clearControls();$('shop-dialog').showModal();send({type:'shop'});};$('shop-close').onclick=()=>$('shop-dialog').close();
$('sell-form').onsubmit=e=>{e.preventDefault();send({type:'sell',item:$('sell-item').value,quantity:Number($('sell-quantity').value),price:Number($('sell-price').value)});};
document.addEventListener('focusin',e=>{if(e.target.matches('input,select,textarea'))clearControls();});
const COLORS=['#d6b778','#79c8c4','#c08ecb','#86b978'],SCALE=50,DEPTH=.55;
/* 예고 진행률 → 모션 진행률. server/raid.cjs · js/combat.js 와 같은 식이어야 보스 동작이 서버와 어긋나지 않는다. */
function windupAt(pat,t,dur){t=Math.max(0,Math.min(1,t));const h=pat&&pat.hold;
 if(h){const at=Math.max(.05,Math.min(.95,h.at||.55)),durF=Math.max(.05,Math.min(.8,(h.dur||.3)/Math.max(.05,dur||1)));const p0=at*(1-durF),p1=p0+durF;
  if(t<=p0)return p0>0?at*(t/p0):at;if(t<p1)return at;return at+(1-at)*((t-p1)/Math.max(1e-6,1-p1));}
 return t*t;}
const pos=(x,y,h=0)=>new T.Vector3(x/SCALE,h,y/(DEPTH*SCALE));
class RaidView{
 constructor(canvas,raid,assets){this.canvas=canvas;this.raidId=raid.id;this.scene=new T.Scene();this.scene.background=new T.Color(0x131c21);this.scene.fog=new T.FogExp2(0x131c21,.022);this.camera=new T.PerspectiveCamera(50,1,.1,250);this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;this.avatars=new Map();this.labels=new Map();this.L=levels[raid.level];this.A=arenas[this.L.arena];this.phase=-1;this.look=new T.Vector3();this.first=true;
  this.scene.add(new T.HemisphereLight(0xc5d7e2,0x4d4637,2));const key=new T.DirectionalLight(0xffd8a0,2.3);key.position.set(-10,25,12);this.scene.add(key);this.buildWorld();this.zoneCircle=new T.Mesh(new T.CircleGeometry(1,64),new T.MeshBasicMaterial({color:0xc83d33,transparent:true,opacity:.26,side:T.DoubleSide,depthWrite:false}));this.zoneCircle.rotation.x=-Math.PI/2;this.scene.add(this.zoneCircle);this.zoneLine=new T.Mesh(new T.PlaneGeometry(1,1),this.zoneCircle.material.clone());this.zoneLine.rotation.x=-Math.PI/2;this.scene.add(this.zoneLine);this.flash=0;
  /* 페이즈 전환 컷 — 서버 state 가 'transition' 인 1.4초 동안만. 상태가 몰아주므로 모든 플레이어가 같은 그림을 본다 */
  this.cut=0;this.ringT=0;this.ringDur=.9;
  this.ring=new T.Mesh(new T.RingGeometry(.86,1,48),new T.MeshBasicMaterial({color:0xD94A45,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));
  this.ring.rotation.x=-Math.PI/2;this.ring.renderOrder=3;this.ring.visible=false;this.scene.add(this.ring);
  this.resize();}
 resize(){const w=this.canvas.clientWidth||innerWidth,h=this.canvas.clientHeight||innerHeight;if(this.w===w&&this.h===h)return;this.w=w;this.h=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 buildWorld(){const L=this.L,cell=L.cell,w=L.rows[0].length*cell/SCALE,h=L.rows.length*cell/(DEPTH*SCALE),swamp=L.env==='swamp';const floor=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({color:swamp?0x35443a:0x414a48,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.set(w/2,-.03,h/2);this.scene.add(floor);const tiles=[];L.rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(ch==='#'||ch==='|')tiles.push([x,y]);}));const walls=new T.InstancedMesh(new T.BoxGeometry(cell/SCALE,swamp?1.6:2.2,cell/(DEPTH*SCALE)),new T.MeshStandardMaterial({color:swamp?0x283c32:0x293c42,transparent:true,opacity:.75,roughness:.9}),tiles.length);const matrix=new T.Matrix4();tiles.forEach(([x,y],i)=>walls.setMatrixAt(i,matrix.makeTranslation((x+.5)*cell/SCALE,swamp?.8:1.1,(y+.5)*cell/(DEPTH*SCALE))));this.scene.add(walls);
  const grid=new T.GridHelper(Math.max(w,h),Math.ceil(Math.max(w,h)/2),0x71877c,0x52645d);grid.position.set(w/2,.005,h/2);grid.material.transparent=true;grid.material.opacity=.13;this.scene.add(grid);
  const gateChar=L.rows.map((row,y)=>({x:row.indexOf('G'),y})).find(p=>p.x>=0);this.gate=new T.Mesh(new T.BoxGeometry(.3,2.8,cell/(DEPTH*SCALE)),new T.MeshStandardMaterial({color:0xa7744a,metalness:.5,roughness:.45}));this.gate.position.copy(pos((gateChar.x+.5)*cell,(gateChar.y+.5)*cell,1.4));this.scene.add(this.gate);
  this.adapter={nodes:(L.expedition.nodes||[]).map(n=>({...n,x:(n.cx+.5)*cell,y:(n.cy+.5)*cell})),hazards:(L.expedition.hazards||[]).map(n=>({...n,x:(n.cx+.5)*cell,y:(n.cy+.5)*cell})),completed:id=>!!room?.raid?.expedition.done[id],hazardPhase:h=>room?.raid?.hazards.find(q=>q.id===h.id)?.phase||'off'};this.props=buildDungeonProps(this.scene,this.adapter,SCALE,DEPTH);
 }
 makeBoss(raid){if(this.boss)this.boss.dispose(this.scene);const asset=this.A.procedural==='root'?createRootBoss():this.A.procedural==='hauler'?createHaulerBoss():this.A.procedural==='relay'?createRelayBoss():this.A.procedural==='pump'?createPumpBoss():this.A.id==='marsh'?prepareMarshMotion(assets.marsh):prepareTrainingMotion(assets.dummy);this.boss=new Animated(asset,this.scene,false,!!this.A.procedural);this.boss.model.scale.setScalar((this.A.bossScale||1.22)*(this.A.scale||1));   /* 보스 크기 — js/game3d.js BOSS_SCALE 과 같게 */this.boss.root.position.copy(pos(raid.boss.x,raid.boss.y));this.boss.mats=[];this.boss.model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();this.boss.owned.add(o.material);if(o.material.emissive){o.userData.em=o.material.emissive.clone();this.boss.mats.push(o);}}});if(this.A.pieces==='dummy'){this.boss.training=createTrainingParts(this.boss.model,{owned:this.boss.owned});this.boss.training.sync(raid.boss.parts);}this.phase=raid.phase;}
 flashBoss(){this.flash=.12*rpgUI.settings.effects;}
 /* 각성: 보스가 바뀌는 순간의 한 방. 솔로(js/game3d.js phaseClear) 와 같은 문법 */
 phaseWake(phase){const fx=rpgUI.settings.effects;this.flash=.34*fx;this.shake=.09*fx;
  this.ringT=this.ringDur;this.ring.material.color.setHex(phase>=2?0xD94A45:0xC9A45E);window.TW_SFX?.play('brk');
  if(navigator.vibrate&&fx>0)try{navigator.vibrate([30,40,70]);}catch{}}
 update(raid,dt){this.resize();const age=Math.min(.05,(performance.now()-lastReceived)/1000);if(this.phase!==raid.phase)this.makeBoss(raid);
  for(const p of raid.players){let a=this.avatars.get(p.id);if(!a){const ca=assets.chars[p.character]||Object.values(assets.chars)[0];a=new Animated(ca.model,this.scene,true,false,ca.weapon,p.character);a.root.position.copy(pos(p.x,p.y));const ring=new T.Mesh(new T.RingGeometry(.48,.56,40),new T.MeshBasicMaterial({color:COLORS[p.color%4],side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;a.root.add(ring);a.owned.add(ring.geometry);a.owned.add(ring.material);this.avatars.set(p.id,a);const label=document.createElement('span');label.className='nameplate';label.style.borderColor=COLORS[p.color%4];$('nameplates').append(label);this.labels.set(p.id,label);}a.update(p,dt,age);const label=this.labels.get(p.id);label.textContent=p.name+(p.id===profile.id?' · 나':'')+(p.hp<=0?' · 다운':'');const projected=a.root.position.clone().add(new T.Vector3(0,2.4,0)).project(this.camera);label.hidden=projected.z>1||projected.z< -1;label.style.left=(projected.x+1)*this.w/2+'px';label.style.top=(1-projected.y)*this.h/2+'px';}
  const b=raid.boss,bb=this.boss;bb.root.position.lerp(pos(b.x,b.y),1-Math.exp(-dt*24));bb.root.rotation.y=Math.PI/2-b.aim;
  if(['telegraph','recover'].includes(b.state)&&b.pattern){const spec=bossAttackSpec(this.A,b.pattern.icon,b.pattern.beat||1),key=b.attackId;bb.play(spec.clip,key);bb.current.paused=true;bb.current.time=sampleBossAttack(spec,bb.current.getClip().duration,{...b,windup:windupAt(b.pattern,1-Math.max(0,b.tele-age)/b.teleDur,b.teleDur),recovery:Math.max(0,b.recovery-age)});}
  else if(b.state==='link'&&b.pattern){const spec=bossAttackSpec(this.A,b.pattern.icon,b.pattern.beat||1);bb.play(spec.clip,b.attackId);bb.current.paused=false;}  /* 연계 사이: 여파 동작을 그대로 흘린다 */
  else {const clip=raid.state==='clear'?'death':b.state==='downed'?'down':b.state==='stagger'?'stagger':b.moving?'walk':'idle';bb.play(clip);bb.current.paused=raid.state==='clear';if(bb.current.paused)bb.current.time=Math.max(0,bb.current.getClip().duration-1e-5);}
  bb.mixer.update(dt);this.flash=Math.max(0,this.flash-dt);bb.mats.forEach(o=>{o.material.emissive.copy(o.userData.em);if(this.flash>0)o.material.emissive.add(new T.Color(.25,.08,.02));});
  bb.training?.sync(b.parts);
  if(this.ringT>0){const k=1-this.ringT/this.ringDur;this.ringT=Math.max(0,this.ringT-dt);
   this.ring.visible=true;this.ring.position.set(bb.root.position.x,.06,bb.root.position.z);
   this.ring.scale.set(.9+k*7.2,1,.9+k*7.2);this.ring.material.opacity=.85*(1-k)*rpgUI.settings.effects;}
  else this.ring.visible=false;
  for(const part of b.parts){if(this.A.pieces==='nodes'){for(const object of bossPartPieces(bb.model,part.id))object.visible=!part.broken;}}
  this.zoneCircle.visible=this.zoneLine.visible=false;if(b.zone&&b.state==='telegraph'){const z=b.zone,teach=this.L.id==='d01',col=b.pattern.counterable?(teach&&b.tele<=b.window?0xf7efd8:0xd84c3b):0xfca044;  /* 흰색 점등은 훈련장 전용 — 그 밖에서는 색이 «종류»만 말한다 */if(z.kind==='circle'){this.zoneCircle.visible=true;this.zoneCircle.position.copy(pos(z.x,z.y,.04));this.zoneCircle.scale.setScalar(z.r/SCALE);this.zoneCircle.material.color.setHex(col);}else{this.zoneLine.visible=true;this.zoneLine.position.copy(pos(z.x+Math.cos(z.a)*z.len/2,z.y+Math.sin(z.a)*z.len/2*DEPTH,.04));this.zoneLine.scale.set(z.len/SCALE,z.w/SCALE,1);this.zoneLine.rotation.set(-Math.PI/2,0,-z.a);this.zoneLine.material.color.setHex(col);}}
  /* 아레나 위험 구역 (광란 페이즈) — 서버가 phase 까지 계산해서 보낸다 */
  const ah=raid.arena?.hazards||[];
  if(!this.arenaHz)this.arenaHz=[];
  while(this.arenaHz.length<ah.length){
   const g=new T.Group();
   const fill=new T.Mesh(new T.CircleGeometry(1,36),new T.MeshBasicMaterial({transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide}));fill.rotation.x=-Math.PI/2;
   const edge=new T.Mesh(new T.RingGeometry(.93,1,44),new T.MeshBasicMaterial({transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));edge.rotation.x=-Math.PI/2;edge.position.y=.012;
   g.add(fill,edge);g.renderOrder=2;this.scene.add(g);this.arenaHz.push({g,fill,edge});
  }
  const acol=raid.arena?.fx?.color||0xE06030;
  this.arenaHz.forEach((o,i)=>{const h=ah[i];if(!h){o.g.visible=false;return;}
   o.g.visible=h.phase!=='off';o.g.position.copy(pos(h.x,h.y,.045));const rr=h.r/SCALE;o.g.scale.set(rr,1,rr);
   o.fill.material.color.setHex(acol);o.edge.material.color.setHex(acol);
   o.fill.material.opacity=h.phase==='active'?.40:.16;o.edge.material.opacity=h.phase==='active'?.95:.6;});
  this.gate.visible=raid.state!=='explore'||(this.L.expedition.required||[]).some(id=>!raid.expedition.done[id]);this.props.update(raid.time);
  const me=raid.players.find(p=>p.id===profile.id)||raid.players[0],target=pos(me.x,me.y,1);if(raid.state==='fight'&&target.distanceTo(bb.root.position)<20)target.lerp(bb.root.position.clone().add(new T.Vector3(0,1,0)),.2);
  /* 전환 동안 서버가 모두를 멈춰 두므로(server/raid.cjs tick: state==='transition' 이면 플레이어를 돌리지 않는다)
     이 사이에만 카메라를 보스로 밀어 넣는다. 조작을 뺏지 않고, 상태가 끝나면 저절로 풀린다. */
  const wantCut=raid.state==='transition'?rpgUI.settings.effects:0;
  this.cut+=(wantCut-this.cut)*(1-Math.exp(-dt/(wantCut>this.cut?.30:.45)));
  if(this.cut>.002)target.lerp(bb.root.position.clone().add(new T.Vector3(0,1.7,0)),this.cut);
  if(this.first){this.look.copy(target);this.first=false;}else this.look.lerp(target,1-Math.exp(-dt*8*rpgUI.settings.camera*(1+this.cut)));
  const orb=this.cut*.55,off=new T.Vector3(8,11,12).multiplyScalar(rpgUI.settings.zoom*(1-.52*this.cut));
  off.applyAxisAngle(new T.Vector3(0,1,0),orb);       /* 살짝 돌면서 들어간다 — 멈춘 그림이 아니라 «컷» 으로 읽히게 */
  this.camera.position.copy(this.look).add(off);this.shake=Math.max(0,(this.shake||0)-dt);if(rpgUI.settings.shake&&this.shake>0)this.camera.position.x+=Math.sin(performance.now()*.15)*this.shake;this.camera.lookAt(this.look);this.renderer.render(this.scene,this.camera);this.drawMap(raid);
 }
 drawMap(raid){const c=$('raid-map'),g=c.getContext('2d'),rows=this.L.rows,w=rows[0].length,h=rows.length,s=Math.min(c.width/w,c.height/h),ox=(c.width-w*s)/2,oy=(c.height-h*s)/2;g.clearRect(0,0,c.width,c.height);rows.forEach((r,y)=>[...r].forEach((ch,x)=>{g.fillStyle=ch==='#'?'#354744':'#101c22';g.fillRect(ox+x*s,oy+y*s,s,s);}));for(const n of this.adapter.nodes){g.fillStyle=raid.expedition.done[n.id]?'#69b28d':n.kind==='checkpoint'?'#76bdcf':'#d9b96c';g.fillRect(ox+n.cx*s,oy+n.cy*s,Math.max(3,s),Math.max(3,s));}for(const p of raid.players){g.fillStyle=COLORS[p.color%4];g.beginPath();g.arc(ox+p.x/this.L.cell*s,oy+p.y/this.L.cell*s,3,0,Math.PI*2);g.fill();}g.fillStyle='#dc594e';g.beginPath();g.arc(ox+raid.boss.x/this.L.cell*s,oy+raid.boss.y/this.L.cell*s,4,0,Math.PI*2);g.fill();}
 dispose(){for(const a of this.avatars.values())a.dispose(this.scene);this.boss?.dispose(this.scene);$('nameplates').replaceChildren();const resources=new Set();this.scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)resources.add(m);});for(const resource of resources)resource.dispose();this.renderer.dispose();}
}
let previous=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-previous)/1000);previous=now;window.TW_SFX?.scene(connected&&view&&room?.raid?(room.raid.state==='fight'?'boss':room.raid.state==='explore'?'explore':'off'):'off');if(view&&room?.raid)view.update(room.raid,dt);if(now>noticeUntil)$('announcement').textContent='';if(room?.raid&&now-lastReceived>3000){$('disconnect').hidden=false;$('disconnect').textContent='서버 응답을 기다리고 있습니다. 조작은 복귀 후 이어집니다.';}}requestAnimationFrame(frame);
/* 검수용 창구 — 솔로의 window.TW_DUNGEON 과 같은 구실. 렌더러 상태를 밖에서 볼 수 있게 한다 */
window.TW_RAID={get view(){return view;},get room(){return room;},get connected(){return connected;},
  get cut(){return view?view.cut:0;},camPos(){return view?view.camera.position.toArray().map(v=>+v.toFixed(2)):null;},
  bossPos(){return view&&view.boss?view.boss.root.position.toArray().map(v=>+v.toFixed(2)):null;}};
const rpgUI=createRpgUI({send,connect,clearControls,getRoom:()=>room,saveToken:token=>storage.set(tokenKey,token)});
if(storage.get(tokenKey))connect();
