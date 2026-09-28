// SYSTEM CORE v2.4: the four sheets through the authoritative path (store.stats -> Raid), measured live.
// node tools/ue/v24-identity-server-check.cjs
'use strict';
const os=require('node:os'),path=require('node:path'),fs=require('node:fs');
const {Store}=require('../../server/store.cjs');
const {Raid}=require('../../server/raid.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hw-v24-'));
const store=new Store(path.join(dir,'db.sqlite'));
const ids={};
let i=0;
for(const ch of ['ain','kain','ryu','sera']){const g=store.guest('G'+(++i));store.chooseName(g.profile.id,'Hero'+ch,ch);ids[ch]=g.profile.id;}
const member=ch=>{const id=ids[ch],p=store.get(id);return {id,name:ch,ready:true,connected:true,stats:store.stats(id),quickslots:p.quickslots,skills:store.skillsFor(id),character:p.character};};

function fight(chars){
  const raid=new Raid('d01',chars.map(member),()=>{});raid.phase=0;raid.setupBoss();raid.startFight();
  raid.boss.timer=1e9;   // no boss pattern: measure the players only
  const events=[];const ev=raid.event.bind(raid);raid.event=(t,d)=>{events.push({t,d,time:raid.time});return ev(t,d);};
  return {raid,events};
}
const out={};
for(const ch of ['ain','kain','ryu','sera']){
  const {raid,events}=fight([ch]);const p=raid.players.get(ids[ch]);
  p.x=raid.boss.x-90;p.y=raid.boss.y;p.aim=0;
  const t0=raid.time;raid.input(ids[ch],{type:'attack',aim:0});
  let hit=null;for(let k=0;k<400&&!hit;k++){raid.tick(.005);hit=events.find(e=>e.t==='hit'&&e.d.player===ids[ch]);}
  const hp=p.hp;raid.hurt(p,10000,'test');
  out[ch]={maxHp:p.maxHp,atk:p.stats.atk,def:p.stats.defense,crit:p.stats.critChance,critDmg:p.stats.critDamage,move:p.stats.moveMult,
    contact:hit?+(hit.time-t0).toFixed(3):null,hit:hit?hit.d.damage:null,threat:+p.threat.toFixed(1),threatPerDmg:p.damage?+(p.threat/p.damage).toFixed(3):null,hurt10000:hp-p.hp};
}
console.table(out);

// Sera ward on a nearby ally (and not on a far one)
{
  const {raid}=fight(['sera','ain','kain']);
  const s=raid.players.get(ids.sera),a=raid.players.get(ids.ain),k=raid.players.get(ids.kain);
  for(const q of [s,a,k])q.hp=Math.round(q.maxHp*.5);
  a.x=s.x+60;a.y=s.y;k.x=s.x+3000;k.y=s.y;
  const before={a:a.hp,k:k.hp};raid.input(ids.sera,{type:'skill',index:3});
  console.log('sera ward: near ally +%d hp buff %ss x%s | far ally +%d hp buff %s',a.hp-before.a,a.buffT,a.buffReduce,k.hp-before.k,k.buffT||0);
}
// Boss snapshot fields UE reads
{
  const {raid}=fight(['ain','kain']);raid.boss.timer=0;const p=raid.players.get(ids.ain);p.x=raid.boss.x-120;p.y=raid.boss.y;
  let snap=null;for(let k=0;k<2000;k++){raid.tick(.01);const b=raid.snapshot().boss;if(b.state==='telegraph'&&b.windup>.3){snap=b;break;}}
  console.log('boss snapshot:',snap&&JSON.stringify({maxHp:snap.maxHp,hp:snap.hp,posture:snap.posture,state:snap.state,windup:+snap.windup.toFixed(3),pattern:snap.pattern,recoveryDur:snap.recoveryDur}));
}
store.close();
