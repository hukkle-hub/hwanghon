const crypto=require('node:crypto'),C=require('./content.cjs');
function createRpgCommands(ctx){
 const {store,sessions,send,current,requireOffice,profileUpdate,unready,broadcast,sendBoard,sendGuild,sendHistory,refreshGuild,join,rooms}=ctx;
 const invitations=new Map(),adminIds=new Set((process.env.ADMIN_IDS||'').split(',').filter(Boolean));
 const isAdmin=id=>adminIds.has(id);
 const update=id=>{const ws=sessions.get(id);if(ws)send(ws,{type:'rpg',data:{...store.rpgState(id),admin:isAdmin(id),contacts:store.contacts(id).map(c=>({...c,online:!store.blocked(c.id,id)&&sessions.has(c.id)})),guild:store.guildDetails(id),notice:store.db.prepare("SELECT value FROM meta WHERE key='announcement'").get()?.value||''}});};
 const account=id=>{if(!store.public(id).account)throw Error('먼저 캐릭터를 계정에 저장하세요.');};
 async function command(ws,msg){
  if(msg.type!=='rpg')return false;const id=ws.playerId,room=current(id),op=msg.action;
  if(Date.now()-(ws.lastRpg||0)<120)throw Error('잠시 후 다시 시도하세요.');ws.lastRpg=Date.now();
  if(op==='state'){update(id);return true;}
  if(op==='partyTransfer'){requireOffice(id);if(!room||room.leader!==id||!room.members.get(msg.target)?.connected)throw Error('연결된 파티원에게 파티장이 위임할 수 있습니다.');room.leader=msg.target;broadcast(room);sendBoard();return true;}
  if(op==='partyPurpose'){requireOffice(id);if(!room||room.leader!==id||!['practice','first','repeat'].includes(msg.purpose))throw Error('모집 목적을 확인하세요.');room.purpose=msg.purpose;broadcast(room);sendBoard();return true;}
  if(op==='partyInvite'){requireOffice(id);const target=store.playerNamed(msg.name);if(!room||room.members.size>=4||room.raid)throw Error('모집 중인 파티가 필요합니다.');if(store.blocked(target,id)||store.blocked(id,target)||!sessions.has(target))throw Error('초대할 수 없는 캐릭터입니다.');if(Date.now()-(ws.lastInvite||0)<3000)throw Error('초대는 3초 간격입니다.');ws.lastInvite=Date.now();const token=crypto.randomUUID();for(const [key,v]of invitations)if(v.expires<Date.now())invitations.delete(key);if(invitations.size>=500)throw Error('초대가 많습니다. 잠시 후 시도하세요.');invitations.set(token,{target,from:id,code:room.code,expires:Date.now()+120000});send(sessions.get(target),{type:'partyInvitation',token,name:store.get(id).name,level:room.level});send(ws,{type:'rpgNotice',text:'파티 초대를 보냈습니다.'});return true;}
  if(op==='partyAccept'){requireOffice(id);const invitation=invitations.get(msg.token);if(!invitation||invitation.target!==id||invitation.expires<Date.now()||store.blocked(id,invitation.from)||store.blocked(invitation.from,id))throw Error('초대가 만료되었습니다.');const target=rooms.get(invitation.code);if(!target)throw Error('파티가 해산되었습니다.');join(target,store.public(id));invitations.delete(msg.token);return true;}
  if(op==='signal'){if(!room?.raid||!['focus','danger','revive','gather'].includes(msg.signal))throw Error('전투 중 사용할 신호를 선택하세요.');if(Date.now()-(ws.lastSignal||0)<2000)throw Error('신호는 2초 간격입니다.');ws.lastSignal=Date.now();room.raid.event('signal',{player:id,signal:msg.signal,part:room.raid.players.get(id)?.target});return true;}
  if(op==='useItem'){if(!room?.raid)throw Error('출격 후 사용할 수 있습니다.');const p=room.raid.players.get(id),item=p.quickslots?.[msg.slot];room.raid.validateConsumable(id,item);profileUpdate(store.consume(id,item).profile);room.raid.useConsumable(id,item);return true;}
  if(op==='whisper'){if(store.sanction(id).mute_until>Date.now())throw Error('채팅이 제한된 계정입니다.');const target=store.playerNamed(msg.name);if(typeof msg.text!=='string'||!msg.text.trim()||msg.text.length>160)throw Error('내용은 1–160자입니다.');if(!sessions.has(target)||store.blocked(id,target)||store.blocked(target,id))throw Error('귓속말을 보낼 수 없습니다.');if(Date.now()-(ws.lastChat||0)<1000)throw Error('채팅은 1초 간격입니다.');ws.lastChat=Date.now();const message={id:crypto.randomUUID(),channel:'whisper',player:id,target,name:store.get(id).name,toName:store.get(target).name,text:msg.text.replace(/[<>\u0000-\u001f]/g,''),created:Date.now()};send(ws,{type:'chat',message});if(target!==id)send(sessions.get(target),{type:'chat',message});ctx.rememberWhisper(message);return true;}
  account(id);
  if(['request','accept','remove','block','unblock'].includes(op)){const target=msg.target||store.playerNamed(msg.name);store.relationship(id,target,op);update(id);update(target);sendHistory(id);return true;}
  if(op==='report'){const target=msg.target||store.playerNamed(msg.name);store.report(id,target,msg.reason,ctx.evidence(id,target));send(ws,{type:'rpgNotice',text:'신고를 접수했습니다.'});return true;}
  if(op==='guildManage'){const before=store.guild(id);store.guildManage(id,msg.operation,msg.target,msg.value);
   /* 당한 쪽에게 «무슨 일이 있었는지» 를 알린다. 예전에는 추방당해도 길드가 조용히
      사라지기만 해서, 나간 것인지 쫓겨난 것인지 화면으로 구분할 수 없었다. */
   const named=pid=>{try{return store.get(pid).name;}catch{return '길드원';}};
   const tell=(pid,text)=>{const peer=sessions.get(pid);if(peer)send(peer,{type:'rpgNotice',text});};
   const actor=named(id),to=msg.target&&msg.target!==id?named(msg.target):'';
   if(msg.operation==='notice'){tell(id,'길드 공지를 저장했습니다.');
    if(before)for(const m of before.members)if(m.id!==id)tell(m.id,'[길드] '+actor+' 님이 공지를 바꿨습니다.');}
   else if(msg.operation==='kick'){tell(msg.target,'길드에서 추방되었습니다.');tell(id,to+' 님을 추방했습니다.');
    if(before)for(const m of before.members)if(m.id!==id&&m.id!==msg.target)tell(m.id,'[길드] '+to+' 님이 추방되었습니다.');}
   else if(msg.operation==='transfer'){tell(msg.target,'길드장이 되었습니다.');tell(id,'길드장을 '+to+' 님에게 넘겼습니다.');
    if(before)for(const m of before.members)if(m.id!==id&&m.id!==msg.target)tell(m.id,'[길드] '+to+' 님이 새 길드장입니다.');}
   else if(msg.operation==='officer'){tell(msg.target,'길드 임원이 되었습니다.');tell(id,to+' 님을 임원으로 임명했습니다.');}
   else if(msg.operation==='member'){tell(msg.target,'길드 임원에서 내려왔습니다.');tell(id,to+' 님의 임원을 해제했습니다.');}
   if(before)for(const member of before.members){sendGuild(member.id);update(member.id);sendHistory(member.id);}return true;}
  if(op==='adminState'||op==='moderate'||op==='announcement'){
   if(!isAdmin(id))throw Error('운영 권한이 없습니다.');
   if(op==='moderate'){store.moderate(id,msg.operation,msg.target,msg.minutes,msg.reason);if(msg.operation==='ban')sessions.get(msg.target)?.close(4003,'Account restricted');}
   if(op==='announcement'){if(typeof msg.text!=='string'||msg.text.length>240||/[<>\u0000-\u001f]/.test(msg.text))throw Error('공지는 240자 이하입니다.');store.transaction(()=>{store.db.prepare("INSERT INTO meta VALUES('announcement',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(msg.text);store.audit(id,'announcement','world');});for(const peer of sessions.values())send(peer,{type:'rpgNotice',text:'[공지] '+msg.text});}
   send(ws,{type:'adminState',reports:store.db.prepare('SELECT * FROM reports ORDER BY created DESC LIMIT 50').all(),audit:store.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 50').all(),trades:store.db.prepare('SELECT * FROM trades ORDER BY id DESC LIMIT 50').all()});return true;
  }
  if(op==='password'){requireOffice(id);const now=Date.now();if(now-(ws.lastPassword||0)<10000)throw Error('계정 변경은 10초 후 다시 시도하세요.');ws.lastPassword=now;await ctx.passwordChange(ws,msg);return true;}
  requireOffice(id);
  let result;
  if(['lock','deposit','withdraw','vendorSell','dismantle','unequip'].includes(op))result=store.inventoryAction(id,op,msg.item,msg.quantity??1);
  else if(op==='craft')result=store.craft(id,msg.recipe);
  else if(op==='enhance')result=store.enhance(id,msg.item,msg.protect===true);
  else if(op==='repair')result=store.repair(id,msg.item);
  else if(op==='trait')result=store.trait(id,msg.trait);
  else if(op==='skillUp')result=store.skillUp(id,msg.skill);
  else if(op==='skillBranch')result=store.skillBranch(id,msg.skill,msg.branch);
  else if(op==='skillReset')result=store.skillReset(id);
  else if(op==='switchCharacter')result=store.switchCharacter(id,msg.character);
  else if(op==='quest')result=store.questAction(id,msg.quest,msg.operation);
  else if(op==='quickslots')result=store.supplies(id,msg.slots);
  else if(op==='claimRewards'){store.deliverRewards(id);result={profile:store.public(id)};}
  else throw Error('지원하지 않는 요청입니다.');
  profileUpdate(result.profile);unready(id);update(id);send(ws,{type:'rpgResult',action:op,result:result.result||{}});return true;
 }
 return {command,update,isAdmin};
}
module.exports={createRpgCommands};
