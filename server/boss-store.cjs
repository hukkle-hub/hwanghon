/* 필드 보스 저장 — 다음 출현 시각·살아 있나·처치 기록 (docs/design/186 §3 boss_kills)
   서버가 재시작해도 «다음 주기 창» 약속이 이어지고, 누가 언제 무엇을 얻었는지 남는다.
   (Render 무료 요금제의 /tmp 는 재시작 때 지워진다 — 지워지지 않는 디스크가 필요하다: docs/DEPLOY-PENDING.md) */
const C=require('./content.cjs');
const methods={
 initBoss(){ if(this.bossReady) return; this.db.exec(`
  CREATE TABLE IF NOT EXISTS field_bosses(id TEXT PRIMARY KEY,zone TEXT NOT NULL,state TEXT NOT NULL,next_at INTEGER NOT NULL,updated INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS boss_kills(id INTEGER PRIMARY KEY,boss TEXT NOT NULL,zone TEXT NOT NULL,at INTEGER NOT NULL,top TEXT,top_name TEXT,players INTEGER NOT NULL,drops TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS boss_kills_boss ON boss_kills(boss,at);
  CREATE INDEX IF NOT EXISTS boss_kills_top ON boss_kills(top,boss);`); this.bossReady=true; },
 bossStates(){ this.initBoss(); return this.statement('SELECT * FROM field_bosses').all(); },
 bossSave(id, zone, state, nextAt, now=Date.now()){ this.initBoss();
  this.statement('INSERT INTO field_bosses(id,zone,state,next_at,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET zone=excluded.zone,state=excluded.state,next_at=excluded.next_at,updated=excluded.updated').run(id,zone,state,Math.floor(nextAt),now); },
 /* 처치 기록 + 재료(기여도 5% 이상)를 한 트랜잭션으로. 반환: 바뀐 프로필들 */
 bossKill(boss, zone, at, ranking, drops, material){ this.initBoss();
  return this.transaction(()=>{ const top=ranking[0]||null, changed=[];
   this.statement('INSERT INTO boss_kills(boss,zone,at,top,top_name,players,drops) VALUES(?,?,?,?,?,?,?)').run(boss,zone,at,top?top.id:null,top?top.name:null,ranking.length,JSON.stringify(drops));
   if(material) for(const r of ranking){ if(r.share<material.share) continue; let p; try{ p=this.get(r.id); }catch{ continue; }
    p.items={...p.items,[material.item]:(p.items[material.item]||0)+1}; this.put(p); changed.push(r.id); }
   return changed; }); },
 /* 바닥의 보스 장비 줍기 — 장비는 종류별 하나만(이미 있으면 못 줍는다 → 다른 사람이 주울 수 있다) */
 bossLoot(id, item){ const d=C.equipment.find(i=>i.id===item); if(!d||d.src!=='boss') throw Error('주울 수 없는 물품입니다.');
  return this.transaction(()=>{ const p=this.get(id); if((p.items[item]||0)+((p.vault||{})[item]||0)>0) throw Error('이미 가진 장비입니다.');
   p.items={...p.items,[item]:1}; this.put(p); return this.public(id); }); },
 bossKills(boss, limit=20){ this.initBoss(); return this.statement('SELECT * FROM boss_kills WHERE (? IS NULL OR boss=?) ORDER BY at DESC LIMIT ?').all(boss??null,boss??null,limit); },
 /* 칭호용: 이 플레이어가 1위로 잡은 횟수 */
 bossTitles(id){ this.initBoss(); return this.statement('SELECT boss,count(*) AS n FROM boss_kills WHERE top=? GROUP BY boss').all(id); },
};
function install(Store){ Object.assign(Store.prototype, methods); }
module.exports={ install };
