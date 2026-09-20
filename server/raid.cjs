const crypto=require('node:crypto'),C=require('./content.cjs'),SIM=require('../js/world-sim.js'),EXP=require('../js/dungeon-run.js'),DIRECTOR=require('../js/boss-director.js');
const QUALITY=require('../js/combat-quality.js');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),R=C.rules;
// One world, one boss, independent players. Clients submit intents only.
class Raid{
 constructor(levelId,members,onClear){
  this.L=C.levels[levelId];this.A=C.arenas[this.L.arena];this.id=crypto.randomUUID();this.time=0;this.state='explore';this.phase=0;this.events=[];this.serial=0;this.onClear=onClear;this.scale=1+.65*(members.length-1);this.players=new Map();this.withdrawn=new Set();
  this.world=SIM.createWorld({rows:this.L.rows,cell:this.L.cell});this.gate=this.world.marks('G')[0];this.expedition=EXP.create({level:this.L,world:this.world,id:this.id});this.world.setSolid(this.gate.cx,this.gate.cy,!this.expedition.ready());
  const spawn=this.world.marks('S')[0];members.forEach((m,i)=>this.players.set(m.id,this.player(m,spawn,i)));this.setupBoss();
 }
 player(m,spawn,i){const stats=m.stats||C.character.stats;
  /* m 은 신규 참가자({skills:{skills,ult}}) 또는 재도전 시 기존 플레이어(skills 배열 + ultSkill) */
  const kit=Array.isArray(m.skills)?{skills:m.skills,ult:m.ultSkill}:(m.skills||{});
  const table=Array.isArray(kit.skills)&&kit.skills.length===4?kit.skills:C.skills.ain, ultDef=kit.ult||C.skills.ainUlt;return {stats:{...stats},skills:table,ultSkill:ultDef,character:m.character||'ain',id:m.id,name:m.name,color:i,x:spawn.x+(i%2)*28,y:spawn.y+Math.floor(i/2)*18,r:22,aim:0,hp:stats.hp,maxHp:stats.hp,st:R.stamina.max,ult:0,axes:{x:0,y:0},lastInput:0,connected:true,guard:false,action:null,combo:0,comboT:0,dodgeT:0,dodgeCd:0,rollT:0,lock:0,regenDelay:0,riposteT:0,reviveHeld:false,reviveProgress:0,revives:0,downT:0,dead:false,threat:0,damage:0,counters:0,perfect:0,breaks:0,evades:0,cds:[0,0,0,0],buffT:0,buffReduce:.5,critNext:false,hazardCd:0,target:'core',buffer:null,quickslots:m.quickslots||['c_potion','c_antidote'],uses:m.uses||{},itemCd:0,attackBuffT:0,moveBuffT:0,bleedT:0,bleedTick:0,lastFailure:'',counterAttempts:0,evadeRetaliations:0,whiffs:0,deaths:0};}
 event(type,data={}){this.events.push({id:++this.serial,type,time:this.time,...data});if(this.events.length>100)this.events.shift();}
 setupBoss(){const mark=this.world.marks('B')[0],stage=this.A.stages[this.phase];this.stage=stage;this.boss={x:mark.x,y:mark.y,r:this.L.bossR||60,aim:Math.PI,state:'idle',hp:Math.round(stage.hp*this.scale),maxHp:Math.round(stage.hp*this.scale),posture:0,timer:stage.patternGap||1.4,tele:0,teleDur:0,recovery:0,recoveryDur:0,pattern:null,def:null,beats:[],beatI:0,linkT:0,executed:false,zone:null,target:null,patternIndex:0,bleeds:[],parts:stage.parts.map(p=>({...p,hp:p.hp==null?null:Math.round(p.hp*this.scale),hpMax:p.hp==null?null:Math.round(p.hp*this.scale),broken:false})),slow:1,zoneScale:1};this.focus={x:mark.x,y:mark.y};this.director=DIRECTOR.create(this.world,this.boss,this.focus,this.L);
  /* 아레나 변화: 광란 페이즈의 바닥 위험 구역. dx/dy 는 보스 자리 기준 (js/game3d.js 와 같은 규칙) */
  const fx=(this.A.stageFx||[])[this.phase];
  this.arenaFx=fx||null; this.arenaT=0;
  this.arenaHz=(fx&&fx.hazards||[]).map(h=>({x:mark.x+(h.dx||0),y:mark.y+(h.dy||0),r:h.r,period:h.period||4.4,warning:h.warning||1.2,active:h.active||1.4,offset:h.offset||0,damage:h.damage||0.07}));}
 arenaPhase(h){const k=(this.arenaT+h.offset)%h.period;return k<h.warning?'warning':k<h.warning+h.active?'active':'off';}
 alive(p){return p.hp>0&&!p.dead;}
 nearBoss(p,reach=this.L.player.reach){return this.world.dist(p.x,p.y,this.boss.x,this.boss.y)<=reach&&this.world.lineOfSight(p.x,p.y,this.boss.x,this.boss.y);}
 inZone(p){return !!this.boss.zone&&this.world.inZone(this.boss.zone,p.x,p.y)&&this.world.lineOfSight(this.boss.x,this.boss.y,p.x,p.y);}
 input(id,msg){const p=this.players.get(id);if(!p||!p.connected||!this.alive(p)||!['explore','fight'].includes(this.state))return;
  if(msg.type==='move'){if(!Number.isFinite(msg.x)||!Number.isFinite(msg.y))return;const n=Math.max(1,Math.hypot(msg.x,msg.y));p.axes={x:msg.x/n,y:msg.y/n};p.lastInput=this.time;return;}
  if(msg.type==='target'){if(this.boss.parts.some(q=>q.id===msg.part))p.target=msg.part;return;}
  if(msg.type==='guard'){if(!msg.on){p.guard=false;if(p.buffer?.type==='guard')p.buffer=null;return;}if(p.lock>0||p.dodgeT>0||p.st<=0)return;if(p.action){if(p.action.elapsed>=p.action.cancelAt){p.action=null;p.buffer=null;}else{if(p.action.cancelAt-p.action.elapsed<=R.motion.buffer)p.buffer={...msg,expires:this.time+R.motion.buffer+.01};return;}}p.guard=true;return;}
  if(msg.type==='revive'){p.reviveHeld=msg.on===true;return;}
  if(msg.type==='interact'){if(this.state==='explore')this.interact(p);return;}
  if(!['attack','smash','dodge','skill','ult','execute'].includes(msg.type))return;
  if(p.lock>0||p.dodgeT>0)return;
  if(p.action){const late=p.action.elapsed>=p.action.cancelAt,defense=this.defensive(p,msg),edge=defense?p.action.cancelAt:p.action.duration;
   const affordable=msg.type==='dodge'?p.st>=R.stamina.dodge&&p.dodgeCd<=0:msg.type==='skill'?p.cds[msg.index]<=0&&p.st>=p.skills[msg.index]?.st&&p.dodgeCd<=0:true;
   if((defense||msg.type==='attack'&&this.canCounter(p))&&late&&affordable){p.action=null;p.buffer=null;}else{if(edge-p.action.elapsed<=R.motion.buffer)p.buffer={...msg,expires:this.time+R.motion.buffer+.01};return;}}
  if(msg.type==='dodge'){this.dodge(p,R.stamina.dodge);return;}
  /* 처형: 격추된 보스에게 붙어서 한 번. 솔로(js/combat.js execute)와 같은 규칙 */
  if(msg.type==='execute'){ if(!this.canExecute(p))return;
   this.boss.executed=true;
   this.action(p,'exec',(R.execute&&R.execute.mult)||4.5,1,{clip:'exec',posture:0});
   this.event('execute',{player:id});return;}
  if(msg.type==='attack'&&this.boss.state==='telegraph'&&this.inZone(p)){p.counterAttempts++;if(!this.canCounter(p)){p.lastFailure=this.boss.pattern.counterable===false?'카운터 불가 공격 · 회피가 필요합니다.':this.boss.tele>(this.stage.counterWindow||.18)?'카운터 입력이 빨랐습니다.':'거리 또는 방향을 확인하세요.';this.event('feedback',{player:id,text:p.lastFailure});}}
  if(msg.type==='attack'&&this.canCounter(p)){const perfect=this.boss.tele<=.04+1e-8;p.counters++;if(p.stats.counterBuff)p.attackBuffT=5;p.perfect+=+perfect;p.guard=false;this.boss.state='stagger';this.boss.timer=.8;this.boss.zone=null;this.boss.posture+=30;this.action(p,'counter',1,(perfect?R.counter.perfectMult:R.counter.mult)*(p.stats.counterMult||1),{perfect,clip:'counter'});this.boss.timer=Math.max(this.boss.timer,p.action.duration+.25);this.event('counter',{player:id,perfect});this.checkDown();return;}
  if(msg.type==='attack'){const tier=p.comboT>0?p.combo%4:0;this.action(p,'attack',R.combo.mults[tier],p.riposteT>0?(p.riposteKind==='counter'?this.policy().normal*1.15:p.riposteKind==='evade'?2.2:1.5):this.policy().normal,{riposte:p.riposteT>0,followup:p.riposteT>0&&p.riposteKind==='counter',evade:p.riposteT>0&&p.riposteKind==='evade',clip:'attack'+(tier%3+1)});p.combo=tier+1;p.comboT=1.3;return;}
  if(msg.type==='smash'){const tier=p.comboT>0?Math.max(0,p.combo-1):0;if(p.st<R.combo.smashSt[tier])return;p.st-=R.combo.smashSt[tier];this.action(p,'smash',R.combo.smash[tier],p.riposteT>0?(p.riposteKind==='counter'?this.policy().normal*1.15:p.riposteKind==='evade'?2.2:1.5):this.policy().normal,{posture:R.combo.smashPosture[tier],riposte:p.riposteT>0,followup:p.riposteT>0&&p.riposteKind==='counter'});p.combo=0;return;}
  if(msg.type==='skill'){if(!Number.isInteger(msg.index)||msg.index<0||msg.index>3)return;const k=p.skills[msg.index];if(!k||p.cds[msg.index]>0||p.st<k.st)return;
   if(k.dodge&&p.dodgeCd>0)return;p.st-=k.st;p.cds[msg.index]=k.cd;p.regenDelay=R.stamina.delay;
   if(k.dodge){this.dodge(p,0,k.iframes||1);p.critNext=true;}
   else if(k.buff){p.buffT=k.buff.dur;p.buffReduce=k.buff.reduce;}
   else this.action(p,'smash',k.mult,this.policy().skill,{aoe:k.aoe,skill:true,posture:k.posture,bleed:k.bleed,clip:'skill'+(msg.index+1)});
   // Presentation only: no extra damage, lock or invulnerability. Include in
   // snapshots so reconnecting clients do not depend on receiving an event.
   if(p.character==='ain'&&(k.dodge||k.buff))p.gesture={id:++this.serial,clip:'skill'+(msg.index+1),elapsed:0,duration:k.dodge?this.L.player.rollDur:.875};
   this.event('skill',{player:id,index:msg.index,clip:'skill'+(msg.index+1),name:k.name});return;}
  if(msg.type==='ult'&&p.ult>=100){const k=p.ultSkill;p.ult=0;this.action(p,'ult',k.mult,1,{posture:k.posture,bleed:k.bleed});}
 }
 policy(){return {normal:.3,skill:.65,exposed:1.75,breakBurst:2.5,...this.stage.discipline};}
 targetAim(p){const c=QUALITY.partCenter({...this.boss,arena:this.A.id,scale:(this.A.bossScale||1.22)*(this.A.scale||1)},this.boss.parts.find(q=>q.id===p.target)||this.boss.parts[0],this.A.parts3d);return this.world.angle(p.x,p.y,c.x,c.y);}
 defensive(p,msg){return msg.type==='dodge'||msg.type==='guard'&&msg.on||msg.type==='skill'&&Number.isInteger(msg.index)&&!!p.skills[msg.index]?.dodge;}
 contact(p,part,a){return QUALITY.contact({player:p,boss:{...this.boss,scale:(this.A.bossScale||1.22)*(this.A.scale||1),arena:this.A.id},part,parts3d:this.A.parts3d,action:a,reach:this.L.player.reach,cone:this.L.player.cone,character:p.character,lineOfSight:(...v)=>this.world.lineOfSight(...v)});}
 canExecute(p){return this.state==='fight'&&this.boss.state==='downed'&&!this.boss.executed&&this.alive(p)&&!p.action&&p.lock<=0&&this.nearBoss(p,this.L.player.reach*1.4);}
 canCounter(p){return this.state==='fight'&&this.boss.state==='telegraph'&&this.boss.pattern.counterable!==false&&this.boss.tele>0&&this.boss.tele<=(this.stage.counterWindow||.18)&&this.inZone(p)&&!!this.contact({...p,aim:this.targetAim(p)},this.boss.parts.find(q=>q.id===p.target)||this.boss.parts[0],{clip:'counter'});}
 action(p,kind,mult,reward,opt={}){const clip=opt.clip||(kind==='counter'?'counter':kind==='ult'?'ult':'smash'),overrides=(R.motion.characterProfiles||{})[p.character||'ain']||{},profile=overrides[clip]||R.motion[kind==='attack'?'light':kind]||R.motion.light,speed=p.stats.aspd/100;p.action={id:++this.serial,kind,clip,part:p.target,elapsed:0,hitAt:profile.hit/speed,duration:profile.duration/speed,cancelAt:profile.cancel/speed,clipHit:R.motion.clipContacts[clip]||profile.clipHit,mult,reward,opt,resolved:false};p.riposteT=0;p.guard=false;p.regenDelay=R.stamina.delay;const center=QUALITY.partCenter({...this.boss,arena:this.A.id,scale:(this.A.bossScale||1.22)*(this.A.scale||1)},this.boss.parts.find(q=>q.id===p.target)||this.boss.parts[0],this.A.parts3d);p.aim=this.world.angle(p.x,p.y,center.x,center.y);}
 dodge(p,cost,iframeMult){if(p.st<cost||p.dodgeCd>0)return;p.st-=cost;p.regenDelay=R.stamina.delay;p.dodgeT=R.dodge.iframes*(iframeMult||1);p.dodgeCd=R.dodge.cooldown;p.dodgeAt=this.time;p.dodgeThreat=this.inZone(p)?this.boss.attackId:null;p.guard=false;let {x,y}=p.axes;if(Math.hypot(x,y)<.1){x=Math.cos(p.aim);y=Math.sin(p.aim);}this.world.roll(p,x,y,this.L.player.rollLen,this.L.player.rollDur);this.event('dodge',{player:p.id});}
 interact(p){if(!this.expedition.interact(p))return;for(const e of this.expedition.drain()){if(e.t==='interact'){if(e.node.kind==='checkpoint')for(const q of this.players.values())if(this.alive(q)&&this.world.dist(q.x,q.y,p.x,p.y)<160){q.hp=q.maxHp;q.st=120;}this.event('interact',{player:p.id,name:e.node.name});}if(e.t==='gateReady')this.world.setSolid(this.gate.cx,this.gate.cy,false);}}
 impact(p,a){a.resolved=true;const targets=a.opt.aoe?this.boss.parts:[this.boss.parts.find(q=>q.id===a.part)||this.boss.parts[0]],hits=targets.map(part=>({part,contact:this.contact(p,part,a)})).filter(h=>h.contact);
  if(this.state!=='fight'||!hits.length){p.whiffs++;p.lastFailure='공격이 닿지 않았습니다. 거리와 방향을 확인하세요.';this.event('whiff',{player:p.id});return;}
  if(a.opt.evade)p.evadeRetaliations++;for(const h of hits){if(this.state!=='fight')break;this.damage(p,h.part,{...a,contact:h.contact},targets.length);}if(a.opt.riposte&&!a.opt.followup||a.opt.posture){this.boss.posture+=a.opt.posture||25;this.checkDown();}p.ult=clamp(p.ult+(a.kind==='counter'?18:2),0,100);
  if(a.kind==='counter'&&this.state==='fight'){if(a.opt.perfect){p.riposteKind='counter';p.riposteT=Math.max(0,a.duration-a.elapsed)+.65;}this.event('counterfollowup',{player:p.id,perfect:!!a.opt.perfect});}}
 damage(p,part,a,div){const policy=this.policy(),guard=part.guardedBy?.some(id=>this.boss.parts.some(q=>q.id===id&&!q.broken))?1-part.guardReduce:1,weak=part.broken?policy.exposed:part.weak?1.5:1;
  const crit=p.critNext||crypto.randomInt(100000)<(p.stats.critChance||0)*100000;const amount=Math.round(p.stats.atk*(p.attackBuffT>0?1.03:1)*(a.opt.skill?(p.stats.skillMult||1):1)*a.mult*a.reward*weak*guard*(this.boss.state==='downed'?1.5:1)*(crit?(p.stats.critDamage||1.426):1)/div);p.critNext=false;if(a.opt.bleed||crypto.randomInt(100000)<(p.stats.bleedChance||0)*100000){this.boss.bleeds=this.boss.bleeds.filter(d=>d.owner!==p.id);this.boss.bleeds.push({owner:p.id,remaining:p.stats.bleedDuration||3,next:1});}this.boss.hp=Math.max(0,this.boss.hp-amount);p.damage+=amount;p.threat+=amount;this.event('hit',{player:p.id,part:part.id,damage:amount,kind:a.kind,contact:a.contact||null,perfect:!!a.opt.perfect,material:QUALITY.material(part.id,this.stage.kind)});
  if(part.breakable&&!part.broken){part.hp=Math.max(0,part.hp-amount*(policy.partMult||1.3)*(a.kind==='counter'||a.opt.riposte&&!a.opt.followup?1.6:1)*(p.stats.partMult||1));if(part.hp===0){part.broken=true;p.breaks++;const burst=Math.round(p.stats.atk*policy.breakBurst);this.boss.hp=Math.max(0,this.boss.hp-burst);p.damage+=burst;this.boss.posture+=40+(part.onBreak?.posture||0);this.boss.state='stagger';this.boss.timer=.8;this.boss.zone=null;if(part.onBreak?.slow)this.boss.slow=Math.min(this.boss.slow,part.onBreak.slow);if(part.onBreak?.zoneScale)this.boss.zoneScale=Math.min(this.boss.zoneScale,part.onBreak.zoneScale);this.event('break',{player:p.id,part:part.id,name:part.name});this.checkDown();}}
  if(this.boss.hp<=0)this.phaseClear();
 }
 checkDown(){if(this.boss.hp<=0)return;const breakable=this.boss.parts.filter(p=>p.breakable);if(this.boss.posture>=100||this.stage.allBrokenDown&&breakable.length&&breakable.every(p=>p.broken)&&!this.boss.allDown){this.boss.allDown=true;this.boss.state='downed';this.boss.timer=5;this.boss.zone=null;this.boss.posture=0;this.boss.executed=false;this.event('down');}}
 hurt(p,damage,reason){p.hp=Math.max(0,p.hp-Math.round(damage*(p.buffT>0?1-(p.buffReduce??.5):1)*(1-Math.min(.25,(p.stats.defense||0)/((p.stats.defense||0)+5000)))));p.lastFailure=reason;p.lock=.28;p.action=null;p.buffer=null;p.reviveHeld=false;this.event('hurt',{player:p.id,damage:Math.round(damage),reason});if(!p.hp){p.deaths++;p.downT=20;p.guard=false;p.axes={x:0,y:0};p.rollT=0;this.event('playerDown',{player:p.id});}}
 rewards(){const items=new Map(this.A.rewards.items);for(const n of this.expedition.nodes)if(this.expedition.completed(n.id))for(const [id,count]of n.loot||[])items.set(id,(items.get(id)||0)+count);return {gold:this.A.rewards.gold,items:[...items]};}
 settleRewards(){try{this.onClear?.(this);this.result.rewardStatus='saved';}catch{this.result.rewardStatus='pending';this.rewardRetry=5;this.event('rewardPending');}}
 phaseClear(){this.boss.zone=null;this.event('phaseClear',{phase:this.phase});if(!this.training&&this.phase+1<this.A.stages.length){this.state='transition';this.transition=1.4;}else{this.state='clear';this.event('clear');this.result={breaksTotal:[...this.players.values()].reduce((n,p)=>n+p.breaks,0),breakable:this.boss.parts.filter(q=>q.breakable).length,run:this.id,arena:this.A.id,time:this.time,...this.rewards(),rewardStatus:'pending',players:[...this.players.values()].map(p=>({id:p.id,name:p.name,damage:p.damage,counters:p.counters,perfect:p.perfect,breaks:p.breaks,evades:p.evades,evadeRetaliations:p.evadeRetaliations,counterAttempts:p.counterAttempts,counterRate:p.counterAttempts?Math.round(p.counters/p.counterAttempts*100):0,whiffs:p.whiffs,deaths:p.deaths,lastFailure:p.lastFailure}))};this.settleRewards();}}
 startFight(){this.state='fight';this.world.setSolid(this.gate.cx,this.gate.cy,true);let i=0;for(const p of this.players.values()){if(!this.alive(p))continue;if(p.x<this.gate.x+64){p.x=this.gate.x+100+(i%2)*35;p.y=this.gate.y+Math.floor(i++/2)*20;}p.axes={x:0,y:0};}this.event('fight');}
 target(){const live=[...this.players.values()].filter(p=>this.alive(p)&&p.connected);return live.sort((a,b)=>(b.threat-this.world.dist(b.x,b.y,this.boss.x,this.boss.y)*10)-(a.threat-this.world.dist(a.x,a.y,this.boss.x,this.boss.y)*10))[0];}
 /* 연계(chain)·지연타(hold) — js/combat.js 와 같은 규칙. docs/design/18-boss-fight-design.md */
 beatDisabled(beat){return (beat.disabledBy||[]).some(id=>this.boss.parts.some(q=>q.id===id&&q.broken));}
 beatsOf(def){const ch=def.chain||[],n=ch.length+1,out=[];
  for(let i=0;i<n;i++){const raw=i?ch[i-1]:{},o={...def,...raw};
   delete o.chain;o.beat=i;o.beats=n;o._cSet=raw.counterable!==undefined;o._rSet=raw.recovery!==undefined;
   o.zoneKey=raw.zone||def.zone||def.name;if(n>1)o.name=(raw.name||def.name)+' '+(i+1)+'/'+n;out.push(o);}
  return out;}
 nextBeat(i){const b=this.boss;for(;i<b.beats.length;i++)if(!this.beatDisabled(b.beats[i]))return i;return -1;}
 /* 예고 진행률 → 모션 진행률. 선형이면 모션이 곧 초읽기다 */
 windup(pat,t,dur){t=Math.max(0,Math.min(1,t));const h=pat&&pat.hold;
  if(h){const at=Math.max(.05,Math.min(.95,h.at||.55)),durF=Math.max(.05,Math.min(.8,(h.dur||.3)/Math.max(.05,dur||1)));
   const p0=at*(1-durF),p1=p0+durF;
   if(t<=p0)return p0>0?at*(t/p0):at;
   if(t<p1)return at;
   return at+(1-at)*((t-p1)/Math.max(1e-6,1-p1));}
  return pat&&pat.windup==='linear'?t:t*t;}
 startBeat(i){const b=this.boss,last=this.nextBeat(i+1)<0,def=b.def;
  b.beatI=i;b.pattern={...b.beats[i]};
  if(b.beats.length>1){
   if(!b.pattern._cSet)b.pattern.counterable=last&&def.counterable!==false;
   if(last&&!b.pattern._rSet)b.pattern.recovery=+((def.recovery||.8)*(1+.35*(b.beats.length-1))).toFixed(2);}
  b.pattern.final=last;
  const spec={...this.L.zones[b.pattern.zoneKey||b.pattern.name]};for(const k of ['r','w','len'])if(spec[k])spec[k]*=b.zoneScale;
  const plan=this.director.start(b.pattern,spec);b.zone=plan.zone;b.aim=plan.angle;
  b.state='telegraph';b.teleDur=b.pattern.tele+b.parts.filter(q=>q.broken).reduce((n,q)=>n+(q.onBreak?.telePlus||0),0);b.tele=b.teleDur;
  b.attackId=++this.serial;this.event('telegraph',{target:b.target,pattern:b.pattern.name,beat:i+1,beats:b.beats.length,last});}
 bossStep(dt){const b=this.boss;if(b.state==='idle'){const p=this.target();if(!p)return;this.world.bossThink(b,p,dt,{...this.L.ai[this.phase],speed:this.L.ai[this.phase].speed*b.slow},false);b.aim=this.world.angle(b.x,b.y,p.x,p.y);b.timer-=dt;
   if(b.timer<=0&&this.nearBoss(p,this.L.ai[this.phase].start)){this.focus.x=p.x;this.focus.y=p.y;const available=this.stage.patterns.filter(a=>!(a.disabledBy||[]).some(id=>b.parts.some(q=>q.id===id&&q.broken)));if(!available.length)return;const pat=this.training?this.stage.patterns[this.training.pattern]||available[0]:this.director.pick(available,b.patternIndex++);b.target=p.id;b.def=pat;b.beats=this.beatsOf(pat);const i0=this.nextBeat(0);if(i0<0)return;this.startBeat(i0);}
  }else if(b.state==='telegraph'){b.tele=Math.max(0,b.tele-dt);this.director.advance(this.windup(b.pattern,1-b.tele/b.teleDur,b.teleDur));if(b.tele<=1e-8){for(const p of this.players.values()){if(!this.alive(p))continue;const inside=this.inZone(p);if(!inside||p.dodgeT>0){if(p.dodgeThreat===b.attackId&&this.time-p.dodgeAt<=.48){p.riposteT=.85;p.riposteKind='evade';p.evades++;if(p.stats.evadeBuff)p.moveBuffT=3;this.event('evade',{player:p.id});}continue;}const guarded=p.guard&&p.st>0&&b.pattern.unblockable!==true;if(guarded){p.st=Math.max(0,p.st-(b.pattern.guardCost||20));p.riposteT=.8;p.riposteKind='guard';}this.hurt(p,b.pattern.dmg*(guarded?.3:1),b.pattern.name);if(!guarded&&this.A.id!=='tutorial'){p.bleedT=6*(p.stats.statusDuration||1);p.bleedTick=1;}}const nx=this.nextBeat(b.beatI+1);
   if(nx>=0){b.state='link';b.linkT=b.pattern.gap!=null?b.pattern.gap:.28;b.zone=null;}
   else {b.state='recover';b.recoveryDur=b.pattern.recovery||.8;b.recovery=b.recoveryDur;}
   this.event('swing',{beat:b.beatI+1,last:!!b.pattern.final});}}
  else if(b.state==='link'){b.linkT-=dt;if(b.linkT<=0){const nb=this.nextBeat(b.beatI+1);if(nb<0){b.state='recover';b.recoveryDur=b.pattern.recovery||.8;b.recovery=b.recoveryDur;}else this.startBeat(nb);}}
  else if(b.state==='recover'){b.recovery-=dt;if(b.recovery<=0){b.state='idle';b.zone=null;b.timer=this.stage.patternGap||1.4;}}
  else {b.timer-=dt;if(b.timer<=0){b.state='idle';b.timer=this.stage.patternGap||1.4;}}
 }
 tick(dt=.01){if(this.state==='clear'&&this.result.rewardStatus==='pending'){this.rewardRetry-=dt;if(this.rewardRetry<=0)this.settleRewards();}if(!['explore','fight','transition'].includes(this.state)||![...this.players.values()].some(p=>p.connected))return;this.time+=dt;
  if(this.state==='transition'){this.transition-=dt;if(this.transition<=0){this.phase++;this.setupBoss();this.state='fight';this.event('phase',{phase:this.phase});}return;}
  const reviving=new Set();for(const p of this.players.values()){
   if(!this.alive(p)){p.downT=Math.max(0,p.downT-dt);if(p.downT===0)p.dead=true;continue;}
   for(const key of ['dodgeT','dodgeCd','lock','regenDelay','riposteT','comboT','buffT','hazardCd','itemCd','attackBuffT','moveBuffT'])p[key]=Math.max(0,p[key]-dt);p.cds=p.cds.map(t=>Math.max(0,t-dt));p.threat*=Math.exp(-dt*.12);
   if(p.gesture){p.gesture.elapsed+=dt;if(p.gesture.elapsed>=p.gesture.duration||p.action||p.guard||p.lock>0||(p.gesture.clip==='skill4'&&(p.rollT>0||Math.hypot(p.axes.x,p.axes.y)>.1)))p.gesture=null;}
   if(p.bleedT>0){p.bleedT=Math.max(0,p.bleedT-dt);p.bleedTick-=dt;if(p.bleedTick<=0){p.bleedTick=1;p.hp=Math.max(1,p.hp-Math.round(p.maxHp*.01*(1-(p.stats.bleedResist||0))));}}
   if(!p.connected||this.time-p.lastInput>.25)p.axes={x:0,y:0};
   if(p.guard){p.st=Math.max(0,p.st-12*dt);if(p.st===0)p.guard=false;}else if(p.regenDelay===0)p.st=Math.min(120,p.st+18*dt);
   if(p.action){const a=p.action;a.elapsed+=dt;if(!a.resolved&&a.elapsed>=a.hitAt)this.impact(p,a);if(a.elapsed>=a.duration)p.action=null;}
   if(p.buffer){if(p.buffer.expires<this.time)p.buffer=null;else if(!p.action||this.defensive(p,p.buffer)&&p.action.elapsed>=p.action.cancelAt){const msg=p.buffer;p.buffer=null;this.input(p.id,msg);}}
   if(!['explore','fight'].includes(this.state))break;
   p.lockT=p.action||p.guard||p.lock>0||p.reviveHeld?1:0;this.world.movePlayer(p,p.axes.x,p.axes.y,dt,this.L.player.speed*(p.stats.moveMult||1)*(p.moveBuffT>0?1.05:1));
   if(p.reviveHeld&&p.connected&&!p.action&&p.lock===0&&p.rollT<=0&&!p.guard){const q=[...this.players.values()].find(q=>q.hp===0&&!q.dead&&q.revives<2&&this.world.dist(p.x,p.y,q.x,q.y)<100&&this.world.lineOfSight(p.x,p.y,q.x,q.y));if(q&&!reviving.has(q.id)){reviving.add(q.id);q.reviveProgress+=dt;if(q.reviveProgress>=3){q.hp=Math.round(q.maxHp*.3);q.revives++;q.reviveProgress=0;q.downT=0;this.event('revive',{player:q.id,by:p.id});}}}
  }
  for(const p of this.players.values())if(!reviving.has(p.id))p.reviveProgress=0;
  if(!['explore','fight'].includes(this.state))return;
  if(this.state==='explore'){
   const someone=[...this.players.values()].find(p=>this.alive(p));if(someone){this.expedition.tick(dt,{...someone,dodging:true},true);this.expedition.drain();}
   for(const p of this.players.values()){if(!this.alive(p))continue;if(p.hazardCd<=0&&p.dodgeT<=0){const h=this.expedition.hazards.find(h=>this.expedition.hazardPhase(h)==='active'&&this.world.dist(p.x,p.y,h.x,h.y)<h.r);if(h){p.hazardCd=.9;this.hurt(p,p.maxHp*(h.damage||.08),'분출');}}
    if(this.expedition.ready()&&p.x>this.gate.x+this.L.cell*.6){this.startFight();break;}}
  }else {
   this.arenaT=(this.arenaT||0)+dt;
   if(this.state==='fight'&&this.arenaHz&&this.arenaHz.length)for(const p of this.players.values()){
    if(!this.alive(p)||p.hazardCd>0||p.dodgeT>0)continue;
    const h=this.arenaHz.find(h=>this.arenaPhase(h)==='active'&&this.world.dist(p.x,p.y,h.x,h.y)<h.r);
    if(h){p.hazardCd=.9;this.hurt(p,p.maxHp*h.damage,(this.arenaFx&&this.arenaFx.reason)||'아레나가 변했다. 위험 구역을 피해라.');}}
   for(const dot of this.boss.bleeds){dot.remaining-=dt;dot.next-=dt;const owner=this.players.get(dot.owner);if(dot.next<=0&&owner){dot.next=1;const damage=Math.round(owner.stats.atk*.03*(owner.stats.bleedMult||1));this.boss.hp=Math.max(0,this.boss.hp-damage);owner.damage+=damage;this.event('hit',{player:owner.id,part:'bleed',damage,kind:'bleed'});if(this.boss.hp===0){this.phaseClear();break;}}}this.boss.bleeds=this.boss.bleeds.filter(d=>d.remaining>0);if(this.state==='fight')this.bossStep(dt);}
  if(![...this.players.values()].some(p=>this.alive(p))){this.state='wiped';this.event('wipe');}
 }
 disconnect(id){const p=this.players.get(id);if(p){p.connected=false;p.axes={x:0,y:0};p.guard=false;p.reviveHeld=false;p.buffer=null;}}
 reconnect(id){const p=this.players.get(id);if(p)p.connected=true;}
 retry(){if(this.state!=='wiped'&&!(this.training&&this.state==='clear'))return;this.result=null;this.phase=this.training?.phase||0;this.setupBoss();this.state='explore';const spawn=this.expedition.checkpoint()||this.world.marks('S')[0];let i=0;for(const [id,p]of this.players){const fresh=this.player(p,spawn,i++);fresh.connected=p.connected;this.players.set(id,fresh);}this.world.setSolid(this.gate.cx,this.gate.cy,!this.expedition.ready());if(this.training){this.startFight();for(const p of this.players.values()){p.x=this.boss.x-120;p.y=this.boss.y;}}this.event('retry');}
 validateConsumable(id,item){const p=this.players.get(id);if(!p||!p.connected||!this.alive(p)||!['explore','fight'].includes(this.state)||p.action||p.guard||p.lock>0||p.dodgeT>0)throw Error('지금은 소모품을 사용할 수 없습니다.');if(!['c_potion','c_antidote','c_throw'].includes(item)||!p.quickslots.includes(item))throw Error('퀵슬롯을 확인하세요.');if(p.itemCd>0||(p.uses[item]||0)>=3)throw Error('소모품은 20초 간격, 종류별 출격당 3회입니다.');if(item==='c_potion'&&p.hp>=p.maxHp)throw Error('체력이 가득 찼습니다.');if(item==='c_antidote'&&p.bleedT<=0)throw Error('출혈 상태가 아닙니다.');if(item==='c_throw'&&(this.state!=='fight'||!this.nearBoss(p,300)))throw Error('보스 가까이에서 사용하세요.');}
 useConsumable(id,item){const p=this.players.get(id);p.itemCd=20;p.uses[item]=(p.uses[item]||0)+1;if(item==='c_potion')p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*.35));if(item==='c_antidote')p.bleedT=0;if(item==='c_throw'){const part=this.boss.parts.find(q=>q.id===p.target)||this.boss.parts[0];this.damage(p,part,{kind:'item',mult:.6,reward:1,opt:{riposte:true}},1);}this.event('consumable',{player:id,item});}
 snapshot(){const b=this.boss;return {id:this.id,level:this.L.id,state:this.state,time:this.time,phase:this.phase,phases:this.A.stages.length,boss:{...b,def:undefined,beats:undefined,pattern:b.pattern&&{name:b.pattern.name,icon:b.pattern.icon,counterable:b.pattern.counterable!==false,hold:b.pattern.hold||null,beat:b.pattern.beat+1,beats:b.pattern.beats,last:!!b.pattern.final},
  windup:b.state==='telegraph'&&b.teleDur?this.windup(b.pattern,1-b.tele/b.teleDur,b.teleDur):1,
  executable:b.state==='downed'&&!b.executed&&this.state==='fight',name:this.stage.name,window:this.stage.counterWindow||.18},reach:this.L.player.reach,players:[...this.players.values()].map(({buffer,lastInput,dodgeThreat,threat,axes,skills,ultSkill,...p})=>({...p,kit:skills.map(k=>({name:k.name,lv:k.lv,br:k.br,st:k.st})),ultName:ultSkill.name,ultLv:ultSkill.lv})),expedition:this.expedition.snapshot(),hazards:this.expedition.hazards.map(h=>({...h,phase:this.expedition.hazardPhase(h)})),arena:{fx:this.arenaFx?{color:this.arenaFx.color,line:this.arenaFx.line}:null,hazards:(this.arenaHz||[]).map(h=>({x:h.x,y:h.y,r:h.r,phase:this.arenaPhase(h)}))},events:this.events.slice(-20),training:this.training||null,result:this.result||null};}
}
module.exports={Raid};
