/* 동맹 — 최대 3길드 (docs/design/202 §5, GPT 패키지 GuildRules_v02 · KOREA_GUILD_MMO_ARCHITECTURE §9).
   동맹은 거점 소유를 합치는 게 아니라 «지역 작전을 나눠 맡는» 것이다: 관리권·관리 용량·공헌은 길드마다 따로고,
   동맹끼리는 서로의 전략 명령과 관리 거점을 본다 (누가 남산, 누가 서울역을 맡았나).
   만들기·초대·수락·탈퇴는 길드장만. 패키지의 «동맹 최소 7일 · 재가입 48시간» 은 시간 규칙이라 아직 넣지 않았다. */
const crypto=require('node:crypto');
const ALLIANCE_MAX=3, INVITE_MAX=2;
const cleanName=name=>{ if(typeof name!=='string') throw Error('동맹 이름은 2–24자로 입력하세요.'); const n=name.normalize('NFKC').trim();
 if(n.length<2||n.length>24||/[<>\u0000-\u001f]/.test(n)) throw Error('동맹 이름은 2–24자로 입력하세요.'); return n; };

const methods={
 initAlliance(){ if(this.allianceReady) return; this.db.exec(`
  CREATE TABLE IF NOT EXISTS alliances(id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT UNIQUE NOT NULL,founder TEXT NOT NULL,created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS alliance_members(guild TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,alliance TEXT NOT NULL,joined INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS alliance_invites(alliance TEXT NOT NULL,guild TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,by TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(alliance,guild));`);
  this.allianceReady=true; },
 /* 표는 트랜잭션 밖에서 만든다 — 안에서 만들면 첫 요청이 거절될 때 롤백이 표까지 지우고 «준비됨» 만 남는다 */
 /* 길드장만 동맹을 다룬다 (길드 직책 leader = assign_roles 권한) */
 allyLeader(player){ const me=this.guildRoleOf(player); if(!me) throw Error('길드에 들어가야 합니다.'); if(me.role!=='leader') throw Error('동맹은 길드장만 다룰 수 있습니다.'); return me; },
 /* 이 길드의 동맹 — 없어진 길드는 빼고 (길드가 해산돼도 남지 않게) */
 allianceOf(guild){ this.initAlliance(); const m=this.statement('SELECT alliance FROM alliance_members WHERE guild=?').get(guild); if(!m) return null;
  const a=this.statement('SELECT id,name,founder FROM alliances WHERE id=?').get(m.alliance); if(!a) return null;
  const guilds=this.statement('SELECT g.id,g.name FROM alliance_members m JOIN guilds g ON g.id=m.guild WHERE m.alliance=? ORDER BY m.joined,g.rowid').all(a.id);
  return { ...a, guilds }; },
 allyCreate(player,name,now=Date.now()){ const n=cleanName(name); this.initAlliance(); return this.transaction(()=>{ const me=this.allyLeader(player);
  if(this.allianceOf(me.guild)) throw Error('이미 동맹에 들어가 있습니다.');
  if(this.statement('SELECT 1 FROM alliances WHERE name_key=?').get(n.toLowerCase())) throw Error('이미 쓰는 동맹 이름입니다.');
  const id=crypto.randomUUID(); this.statement('INSERT INTO alliances VALUES(?,?,?,?,?)').run(id,n,n.toLowerCase(),me.guild,now);
  this.statement('INSERT INTO alliance_members VALUES(?,?,?)').run(me.guild,id,now);
  this.statement('DELETE FROM alliance_invites WHERE guild=?').run(me.guild); this.audit(player,'allyCreate',id,{name:n}); return this.allyView(player); }); },
 /* 길드 이름으로 초대 — 동맹이 셋이면(받아 둔 초대 포함) 더 못 부른다 */
 allyInvite(player,guildName,now=Date.now()){ if(typeof guildName!=='string'||!guildName.trim()) throw Error('길드 이름을 입력하세요.');
  this.initAlliance(); return this.transaction(()=>{ const me=this.allyLeader(player), a=this.allianceOf(me.guild); if(!a) throw Error('먼저 동맹을 만드세요.');
   const t=this.statement('SELECT id,name FROM guilds WHERE name_key=?').get(guildName.normalize('NFKC').trim().toLowerCase()); if(!t) throw Error('길드를 찾을 수 없습니다.');
   if(t.id===me.guild||a.guilds.some(g=>g.id===t.id)) throw Error('이미 같은 동맹입니다.');
   if(this.allianceOf(t.id)) throw Error('그 길드는 다른 동맹에 들어가 있습니다.');
   const pending=this.statement('SELECT COUNT(*) c FROM alliance_invites WHERE alliance=?').get(a.id).c;
   if(a.guilds.length+pending>=ALLIANCE_MAX) throw Error('동맹은 '+ALLIANCE_MAX+'길드까지입니다 (받아 둔 초대 포함).');
   if(pending>=INVITE_MAX) throw Error('보낸 초대가 너무 많습니다.');
   this.statement('INSERT INTO alliance_invites VALUES(?,?,?,?) ON CONFLICT(alliance,guild) DO UPDATE SET by=excluded.by,at=excluded.at').run(a.id,t.id,player,now);
   this.audit(player,'allyInvite',t.id,{alliance:a.id}); return this.allyView(player); }); },
 allyAnswer(player,allianceId,accept,now=Date.now()){ if(typeof allianceId!=='string') throw Error('초대를 확인하세요.');
  this.initAlliance(); return this.transaction(()=>{ const me=this.allyLeader(player);
   const inv=this.statement('SELECT 1 FROM alliance_invites WHERE alliance=? AND guild=?').get(allianceId,me.guild); if(!inv) throw Error('초대를 찾을 수 없습니다.');
   this.statement('DELETE FROM alliance_invites WHERE alliance=? AND guild=?').run(allianceId,me.guild);
   if(accept){ if(this.allianceOf(me.guild)) throw Error('이미 동맹에 들어가 있습니다.');
    const a=this.statement('SELECT id FROM alliances WHERE id=?').get(allianceId); if(!a) throw Error('없어진 동맹입니다.');
    const n=this.statement('SELECT COUNT(*) c FROM alliance_members m JOIN guilds g ON g.id=m.guild WHERE m.alliance=?').get(allianceId).c;
    if(n>=ALLIANCE_MAX) throw Error('동맹이 이미 '+ALLIANCE_MAX+'길드입니다.');
    this.statement('INSERT INTO alliance_members VALUES(?,?,?)').run(me.guild,allianceId,now);
    this.statement('DELETE FROM alliance_invites WHERE guild=?').run(me.guild); }
   this.audit(player,accept?'allyAccept':'allyDecline',allianceId,{}); return this.allyView(player); }); },
 /* 탈퇴 — 마지막 길드가 나가면 동맹이 없어진다. 만든 길드가 나가면 다음 길드가 이어받는다 */
 allyLeave(player){ this.initAlliance(); return this.transaction(()=>{ const me=this.allyLeader(player), a=this.allianceOf(me.guild); if(!a) throw Error('동맹에 들어가 있지 않습니다.');
  this.statement('DELETE FROM alliance_members WHERE guild=?').run(me.guild);
  const rest=a.guilds.filter(g=>g.id!==me.guild);
  if(!rest.length){ this.statement('DELETE FROM alliances WHERE id=?').run(a.id); this.statement('DELETE FROM alliance_invites WHERE alliance=?').run(a.id); }
  else if(a.founder===me.guild) this.statement('UPDATE alliances SET founder=? WHERE id=?').run(rest[0].id,a.id);
  this.audit(player,'allyLeave',a.id,{}); return this.allyView(player); }); },
 /* 보기 — 길드원 누구나 우리 동맹을 본다. 받은 초대는 길드장에게만 */
 allyView(player){ this.initAlliance(); const me=this.guildRoleOf(player); if(!me) return { alliance:null, invites:[], leader:false };
  const a=this.allianceOf(me.guild), leader=me.role==='leader';
  const invites=leader?this.statement('SELECT a.id,a.name FROM alliance_invites i JOIN alliances a ON a.id=i.alliance WHERE i.guild=? ORDER BY i.at').all(me.guild):[];
  const sent=a&&leader?this.statement('SELECT g.name FROM alliance_invites i JOIN guilds g ON g.id=i.guild WHERE i.alliance=?').all(a.id).map(r=>r.name):[];
  return { alliance:a, invites, sent, leader, max:ALLIANCE_MAX }; },
};
function install(Store){ Object.assign(Store.prototype,methods); }
module.exports={ install, ALLIANCE_MAX };
