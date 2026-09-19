/* 황혼 전투: 10ms 시뮬레이션, 데이터 기반 준비/타격/회복.
   DOM/렌더 프레임에 의존하지 않는다. tick()은 누적 시간을 소비한다. */
(function(){
  function rng(seed){ var s=seed>>>0||1; return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function createBattle(o){
    var R=o.rules, C=o.char, D=o.dummy, S=o.skills||[], U=o.ult, HK=o.hooks||{}, st=C.stats, rand=rng(o.seed||7);
    var policy=D.discipline||{}, quantum=0.01, accumulator=0, serial=0, patternId=0, events=[], target, telePlus=0, firstCounterDone=false;
    var counterWindow=(D.counterWindow||R.counter.window)+(R.counter.bonus||0), perfectWindow=D.perfectWindow||R.counter.perfect;
    var init=o.player||{};
    var P={hp:init.hp!=null?init.hp:st.hp,st:init.st!=null?init.st:R.stamina.max,ult:init.ult||0,
      guard:false,dodgeT:0,dodgeCd:0,dodgeAgo:99,dodgeThreat:0,lockT:0,stDelay:0,combo:0,comboT:0,
      riposteT:0,riposteKind:null,critNext:false,buffT:0,buffReduce:0,cds:S.map(function(){return 0;}),
      hitstop:0,action:null,buffer:null,lastFailure:'공격 준비 동작과 거리를 확인해라.'};
    var parts=D.parts.map(function(p){return Object.assign({},p,{hpMax:p.hp,broken:false});});
    target=(parts.filter(function(p){return p.weak;})[0]||parts[0]).id;
    var E={hp:D.hp,hpMax:D.hp,posture:0,state:'idle',patI:0,patT:D.patternGap||1.4,pat:null,
      def:null,beats:[],beatI:0,linkT:0,
      tele:0,teleDur:0,recovery:0,recoveryDur:0,downT:0,stagT:0,bleed:[],dead:false};
    var M={time:0,dmg:0,dmgTaken:0,hits:0,crits:0,counters:0,perfect:0,telegraphs:0,counterOpportunities:0,dodges:0,guards:0,breaks:0,
      bleedDmg:0,ultUsed:0,downs:0,deaths:0,evades:0,ripostes:0,normalDmg:0,counterDmg:0,riposteDmg:0,breakDmg:0,whiffs:0};
    var B={time:0,poseTime:0,over:false,metrics:M,part:function(id){return parts.find(function(p){return p.id===id;});}};
    function emit(t,d){events.push(Object.assign({t:t,time:B.time},d||{}));}
    function fail(s){P.lastFailure=s;}
    function finish(){if(E.dead)return; E.dead=true; E.state='broken'; B.over=true; P.buffer=null; emit('clear');}
    function down(){if(E.dead||E.state==='downed')return;E.state='downed';E.downT=R.posture.downDur;E.posture=0;E.tele=0;E.executed=false;M.downs++;emit('downed');}
    function bleed(n){for(var i=0;i<n;i++){if(E.bleed.length>=R.bleed.maxStacks)E.bleed.shift();E.bleed.push(R.bleed.dur);}emit('bleed',{stacks:E.bleed.length});}
    function breakPart(p){
      if(!p.breakable||p.broken)return;
      p.broken=true;M.breaks++;E.posture=clamp(E.posture+R.posture.onBreak+(p.onBreak&&p.onBreak.posture||0),0,R.posture.max);
      P.ult=clamp(P.ult+R.ult.onBreak,0,R.ult.max);P.hitstop=Math.max(P.hitstop,R.hitstop.brk);
      if(p.onBreak&&p.onBreak.telePlus)telePlus+=p.onBreak.telePlus;
      var burst=Math.round(st.atk*(policy.breakBurst||0));E.hp=Math.max(0,E.hp-burst);M.dmg+=burst;M.breakDmg+=burst;
      emit('break',{part:p.id,name:p.name,dmg:burst});
      var breakables=parts.filter(function(q){return q.breakable;});
      if((D.allBrokenDown&&breakables.length&&breakables.every(function(q){return q.broken;}))||E.posture>=R.posture.max)down();
      else if(E.state!=='downed'){E.state='stagger';E.stagT=0.8;E.tele=0;}
    }
    /* 타격 종류별 정지 길이 — 약타와 스매시가 같은 무게로 느껴지지 않게 한다 */
    function stopFor(opt){
      var h=R.hitstop,f=h.hit||0.08;
      if(opt.execute)return h.execute||h.brk||f;
      if(opt.counter)return (opt.perfect?h.perfect:h.counter)||f;
      if(opt.riposte)return h.smash||f;
      if(opt.kind==='smash'||opt.kind==='ult')return h.smash||f;
      if(opt.skill)return h.chain||f;
      return ((opt.combo||P.combo)>=3?h.chain:h.light)||f;
    }
    function damage(pid,mult,opt){
      if(E.dead)return 0;opt=opt||{};var p=B.part(pid)||parts[0];
      var weak=p.broken?(policy.exposed||R.weak.broken):p.weak?R.weak.weak:R.weak.normal;
      var guard=p.guardedBy&&p.guardedBy.some(function(id){var q=B.part(id);return q&&!q.broken;})?1-p.guardReduce:1;
      var crit=P.critNext||rand()<st.crit/100;P.critNext=false;
      var reward=opt.counter?(opt.perfect?R.counter.perfectMult:R.counter.mult):opt.riposte?(opt.riposte==='evade'?(policy.evadeMult||2.2):1.5):
        policy.normal!=null?(opt.skill?policy.skill:policy.normal):1;
      var partyPart=p.hp!=null&&!p.broken?(o.partMult||1):1;
      var amount=Math.round(st.atk*mult*weak*guard*reward*partyPart*(crit?st.critDmg/100:1)*(0.95+rand()*0.1)*(E.state==='downed'?R.posture.downMult:1));
      E.hp=Math.max(0,E.hp-amount);M.dmg+=amount;M.hits++;if(crit)M.crits++;
      if(opt.counter)M.counterDmg+=amount;else if(opt.riposte)M.riposteDmg+=amount;else M.normalDmg+=amount;
      emit('hit',{part:p.id,dmg:amount,crit:crit,counter:!!opt.counter,perfect:!!opt.perfect,riposte:opt.riposte||null,skill:opt.skill||null});
      if(p.breakable&&p.hp!=null&&!p.broken){
        var partBonus=policy.partMult||1; if(opt.counter||opt.riposte)partBonus*=policy.precisePartMult||1;
        p.hp=Math.max(0,p.hp-Math.round(amount*partBonus));if(p.hp===0)breakPart(p);
      }
      if(!opt.noBleed&&rand()<R.bleed.chance*(policy.normal!=null&&!opt.counter&&!opt.riposte?policy.normal:1))bleed(1);
      P.ult=clamp(P.ult+(opt.counter?R.counter.ult:R.ult.onAttack),0,R.ult.max);
      P.hitstop=Math.max(P.hitstop,stopFor(opt));
      if(E.hp===0)finish();return amount;
    }
    function cancel(reason){if(!P.action)return;emit('actioncancel',{id:P.action.id,reason:reason});P.action=null;P.combo=0;P.comboT=0;}
    function canCancel(){return !P.action||P.action.elapsed>=P.action.cancelAt;}
    function action(kind,clip,mult,opt,profile){
      var t=profile||R.motion.light, speed=clamp(st.aspd/100,0.7,1.6);
      var a={id:++serial,kind:kind,clip:clip,part:target,mult:mult,opt:opt||{},elapsed:0,
        hitAt:t.hit/speed,activeEnd:(t.hit+t.active)/speed,duration:t.duration/speed,cancelAt:t.cancel/speed,
        clipHit:(R.motion.clipContacts||{})[clip]||t.clipHit||0.42,resolved:false};P.action=a;P.guard=false;
      emit('actionstart',Object.assign({},a));return a;
    }
    function queue(type,arg){if(P.action&&P.action.duration-P.action.elapsed<=(R.motion.buffer||0.16))P.buffer={type:type,arg:arg,ttl:R.motion.buffer||0.16};}
    function counter(){
      if(E.state!=='telegraph'||E.tele<=0||E.tele>counterWindow||E.pat.counterable===false||P.lockT>0||P.dodgeT>0||!canCancel()||(HK.canCounter&&!HK.canCounter()))return false;
      cancel('counter');P.buffer=null;P.guard=false;
      var perfect=E.tele<=perfectWindow+1e-8;M.counters++;if(perfect)M.perfect++;
      E.posture=clamp(E.posture+(E.pat.posture||R.counter.posture),0,R.posture.max);
      E.state='stagger';E.stagT=0.8;E.tele=0;
      action('counter','counter',1,{counter:true,perfect:perfect},R.motion.counter);
      emit('counter',{perfect:perfect,pattern:E.pat.name});
      if(D.firstCounterUlt&&!firstCounterDone){firstCounterDone=true;P.ult=R.ult.max;emit('ultready',{first:true});}
      if(E.posture>=R.posture.max)down();return true;
    }
    /* 처형: 자세가 무너져 격추된 동안 근접에서 한 번만. 전용 동작 + 큰 피해 (§처형 연출) */
    function execute(){
      if(B.over||E.state!=='downed'||E.executed||P.action||P.lockT>0||P.dodgeT>0)return false;
      if(HK.canExecute&&!HK.canExecute())return false;
      E.executed=true;P.buffer=null;
      action('exec','exec',(R.execute&&R.execute.mult)||4,{execute:true,noBleed:true},R.motion.exec||R.motion.ult);
      emit('execute',{});return true;
    }
    function attack(pid){
      if(B.over)return;if(pid&&B.part(pid))target=pid;if(counter())return;
      if(P.action){queue('attack',pid);return;}if(P.guard||P.lockT>0||P.dodgeT>0)return;
      if(P.comboT<=0)P.combo=0;var index=P.combo%R.combo.mults.length;
      var rip=P.riposteT>0?P.riposteKind:null;P.riposteT=0;P.riposteKind=null;
      var a=action('attack','attack'+(index%3+1),R.combo.mults[index],{riposte:rip},R.motion.light);
      P.combo=index+1;P.comboT=a.duration+R.combo.gap;
      emit('attack',{combo:index+1,timed:true});
      if(E.state==='telegraph'&&E.tele>counterWindow){fail('공격을 너무 일찍 시작했다. 타격 직전에 튕겨내라.');emit('early');}
    }
    function smash(pid){
      if(B.over)return;if(pid&&B.part(pid))target=pid;
      if(P.action){queue('smash',pid);return;}if(P.guard||P.lockT>0||P.dodgeT>0)return;
      var tier=P.comboT>0?Math.max(0,P.combo-1):0,cost=R.combo.smashSt[tier];if(P.st<cost){emit('nost');return;}
      P.st-=cost;P.stDelay=R.stamina.delay;var rip=P.riposteT>0?P.riposteKind:null;P.riposteT=0;P.riposteKind=null;
      action('smash','smash',R.combo.smash[tier],{riposte:rip,tier:tier},R.motion.smash);P.combo=0;P.comboT=0;emit('smash',{tier:tier,timed:true});
    }
    function dodge(){
      if(B.over||P.dodgeCd>0||P.lockT>0||P.st<R.stamina.dodge||!canCancel()){if(P.st<R.stamina.dodge)emit('nost');return;}
      cancel('dodge');P.buffer=null;P.st-=R.stamina.dodge;P.stDelay=R.stamina.delay;P.dodgeT=R.dodge.iframes;P.dodgeCd=R.dodge.cooldown;P.dodgeAgo=0;
      P.dodgeThreat=E.state==='telegraph'&&(!HK.inZone||HK.inZone(E.pat))?patternId:0;P.guard=false;M.dodges++;emit('dodge');
    }
    function guard(on){if(B.over)return;if(on&&(P.st<=0||P.lockT>0||P.dodgeT>0||!canCancel()))return;if(on)cancel('guard');if(on!==P.guard){P.guard=on;emit('guard',{on:on});}}
    function skill(i){
      var k=S[i];if(!k||B.over)return;if(P.action){queue('skill',i);return;}
      if(P.lockT>0||P.dodgeT>0||P.guard)return;if(P.cds[i]>0||P.st<k.st){emit(P.cds[i]>0?'cd':'nost',{skill:i});return;}
      P.st-=k.st;P.stDelay=R.stamina.delay;P.cds[i]=k.cd;
      if(k.dodge){P.dodgeT=R.dodge.iframes;P.dodgeAgo=0;P.dodgeThreat=E.state==='telegraph'&&(!HK.inZone||HK.inZone(E.pat))?patternId:0;P.dodgeCd=R.dodge.cooldown;M.dodges++;}
      if(k.critNext)P.critNext=true;if(k.buff){P.buffT=k.buff.dur;P.buffReduce=k.buff.reduce;}
      var sclip=k.clip||('skill'+(i+1));
      if(k.mult>0)action('skill',sclip,k.mult,{skill:k.id,aoe:k.aoe},R.motion.skill||R.motion.smash);
      emit('skill',{index:i,id:k.id,name:k.name,clip:sclip,timed:k.mult>0});
    }
    function ult(){
      if(!U||B.over)return;if(P.action){queue('ult');return;}if(P.lockT>0||P.dodgeT>0||P.guard)return;
      if(P.ult<R.ult.max){emit('cd',{ult:true});return;}P.ult=0;M.ultUsed++;
      action('ult','ult',U.mult,{skill:U.id,noBleed:true,bleed:U.bleed},R.motion.ult);emit('ult',{name:U.name,timed:true});
    }
    B.input=function(type,arg){
      if(B.over)return;
      if(P.hitstop>0&&type!=='target'&&!(type==='guard'&&!arg)){P.buffer={type:type,arg:arg,ttl:R.motion.buffer};return;}
      switch(type){case 'attack':attack(arg);break;case 'smash':smash(arg);break;case 'dodge':dodge();break;case 'guard':guard(!!arg);break;case 'skill':skill(arg|0);break;case 'ult':ult();break;case 'execute':execute();break;case 'target':if(B.part(arg))target=arg;break;}
    };
    function impact(a){
      a.resolved=true;
      if(HK.canHit&&!HK.canHit(a.part,a)){M.whiffs++;fail('거리가 맞지 않았다. 낫이 닿는 위치에서 공격해라.');emit('whiff',{timed:true,action:a.id});return;}
      var amount=0;
      a.opt.kind=a.kind;a.opt.combo=a.opt.tier!=null?a.opt.tier+1:P.combo;
      if(a.opt.aoe)parts.forEach(function(p){amount+=damage(p.id,a.mult/parts.length,a.opt);});
      else amount=damage(a.part,a.mult,a.opt);
      if(a.opt.riposte){M.ripostes++;E.posture=clamp(E.posture+25,0,R.posture.max);emit('riposte',{kind:a.opt.riposte,dmg:amount});}
      if(a.kind==='smash')E.posture=clamp(E.posture+R.combo.smashPosture[a.opt.tier],0,R.posture.max);
      if(a.opt.bleed&&!E.dead)bleed(a.opt.bleed);if(E.posture>=R.posture.max&&!E.dead)down();
      emit('impact',{id:a.id,kind:a.kind,dmg:amount});
    }
    /* ---------- 연계(chain) · 지연타(hold) ----------
       패턴의 chain[] 은 첫 타격 뒤에 이어지는 «비트»다. 비트마다 patternId 를 올려
       회피 판정이 타격 단위로 유지된다. 반격 창은 연계의 마지막 비트에서만 열리고,
       마무리 후딜은 연계 길이에 비례해 길어진다 (docs/design/18-boss-fight-design.md §1-1). */
    function disabled(b){return (b.disabledBy||[]).some(function(id){var part=B.part(id);return part&&part.broken;});}
    function beatsOf(def){
      var ch=def.chain||[],n=ch.length+1,out=[];
      for(var i=0;i<n;i++){
        var raw=i?ch[i-1]:{},o=Object.assign({},def,raw);
        delete o.chain;o.beat=i;o.beats=n;
        o._cSet=raw.counterable!==undefined;o._rSet=raw.recovery!==undefined;
        /* 존·이동 설정은 이름으로 찾으므로, 비트 이름을 바꿔도 조회용 키는 따로 남긴다 */
        o.zoneKey=raw.zone||def.zone||def.name;
        if(n>1)o.name=(raw.name||def.name)+' '+(i+1)+'/'+n;
        out.push(o);
      }
      return out;
    }
    /* 이 비트 다음으로 실제로 나올 비트 (부위 파괴로 빠진 비트는 건너뛴다). 없으면 -1 */
    function nextBeat(i){for(;i<E.beats.length;i++)if(!disabled(E.beats[i]))return i;return -1;}
    /* 예고 진행률 t(0→1) → 모션 진행률. 선형이면 모션이 곧 초읽기라 이징을 넣는다. */
    function windupOf(pat,t,dur){
      t=clamp(t,0,1);var h=pat&&pat.hold;
      if(h){
        var at=clamp(h.at||0.55,0.05,0.95),durF=clamp((h.dur||0.3)/Math.max(0.05,dur||1),0.05,0.8);
        var p0=at*(1-durF),p1=p0+durF;
        if(t<=p0)return p0>0?at*(t/p0):at;
        if(t<p1)return at;                                  /* 들어올린 채 버틴다 */
        return at+(1-at)*((t-p1)/Math.max(1e-6,1-p1));
      }
      if(pat&&pat.windup==='linear')return t;
      return t*t;                                           /* 천천히 들었다 확 내려친다 */
    }
    function startBeat(i){
      var last=nextBeat(i+1)<0,def=E.def;
      E.beatI=i;E.pat=Object.assign({},E.beats[i]);patternId++;
      if(E.beats.length>1){
        if(!E.pat._cSet)E.pat.counterable=last&&def.counterable!==false;
        if(last&&!E.pat._rSet)E.pat.recovery=+((def.recovery||0.65)*(1+0.35*(E.beats.length-1))).toFixed(2);
      }
      E.pat.final=last;
      counterWindow=(D.counterWindow||E.pat.window||R.counter.window)+(R.counter.bonus||0);
      E.state='telegraph';E.teleDur=E.pat.tele+telePlus;E.tele=E.teleDur;
      M.telegraphs++;if(E.pat.counterable!==false)M.counterOpportunities++;
      if(HK.enemyStart)HK.enemyStart(E.pat,E.teleDur);
      emit('telegraph',{pattern:E.pat.name,icon:E.pat.icon,dur:E.teleDur,window:counterWindow,
        counterable:E.pat.counterable!==false,beat:i+1,beats:E.beats.length,last:last,hold:!!E.pat.hold});
    }
    function startTelegraph(){
      if(HK.canStart&&!HK.canStart()){E.patT=0.2;return;}
      var available=D.patterns.filter(function(p){return !disabled(p);});
      if(!available.length){E.patT=0.2;return;}
      E.def=HK.pick?HK.pick(available,E.patI):available[E.patI%available.length];E.patI++;
      E.beats=beatsOf(E.def);
      var i=nextBeat(0);if(i<0){E.patT=0.2;return;}
      startBeat(i);
    }
    function landAttack(){
      var pat=E.pat,inside=!HK.inZone||HK.inZone(pat),evaded=P.dodgeThreat===patternId&&P.dodgeAgo<=R.dodge.iframes+0.18&&(P.dodgeT>0||!inside);
      if(P.dodgeT>0||!inside){
        emit('miss',{pattern:pat.name,out:!inside});
        if(evaded){P.riposteT=policy.evadeWindow||0.85;P.riposteKind='evade';P.dodgeThreat=0;M.evades++;emit('evade',{window:P.riposteT});}
      }else{
        var guarded=P.guard&&P.st>0&&pat.unblockable!==true,dmg=pat.dmg;
        if(guarded){dmg=Math.round(dmg*(1-R.guard.reduce));P.st=Math.max(0,P.st-(pat.guardCost||0));M.guards++;E.posture=clamp(E.posture+R.posture.onGuard,0,R.posture.max);P.riposteT=0.8;P.riposteKind='guard';emit('guardhit');}
        else {fail(pat.counterable===false?'튕길 수 없는 공격이다. 공격 범위 밖으로 피해라.':P.action?'공격 동작 중 맞았다. 빈틈을 확인하고 공격해라.':'타격 순간에 피하거나 튕겨내지 못했다.');cancel('hit');P.buffer=null;P.lockT=0.28;P.riposteT=0;P.riposteKind=null;}
        if(P.buffT>0)dmg=Math.round(dmg*(1-P.buffReduce));P.hp=Math.max(0,P.hp-dmg);M.dmgTaken+=dmg;P.ult=clamp(P.ult+R.ult.onHit,0,R.ult.max);
        emit('damaged',{dmg:dmg,guarded:guarded,pattern:pat.name,reason:P.lastFailure,stop:(guarded?R.hitstop.guard:R.hitstop.hurt)||0});
        if(P.hp===0){M.deaths++;if(o.mortal===false){P.hp=st.hp;emit('death');}else{B.over=true;B.dead=true;emit('death',{fatal:true,reason:P.lastFailure});}}
      }
      var nx=B.over?-1:nextBeat(E.beatI+1);
      if(nx>=0){E.state='link';E.linkT=pat.gap!=null?pat.gap:0.28;}
      else {E.state='recover';E.recoveryDur=pat.recovery||0.65;E.recovery=E.recoveryDur;}
      if(E.posture>=R.posture.max&&!B.over)down();
    }
    function step(dt){
      if(B.over)return;B.time+=dt;M.time=B.time;
      if(P.hitstop>0){P.hitstop=Math.max(0,P.hitstop-dt);return;}B.poseTime+=dt;
      ['dodgeT','dodgeCd','lockT','stDelay','comboT','riposteT','buffT'].forEach(function(k){P[k]=Math.max(0,P[k]-dt);});P.dodgeAgo+=dt;
      if(P.stDelay<=0){if(P.guard){P.st=Math.max(0,P.st-R.stamina.guardPerSec*dt);if(P.st===0){P.guard=false;emit('guard',{on:false,broke:true});}}else P.st=Math.min(R.stamina.max,P.st+R.stamina.regen*dt);}
      P.cds=P.cds.map(function(v){return Math.max(0,v-dt);});
      var a=P.action;if(a){a.elapsed=Math.min(a.duration,a.elapsed+dt);if(!a.resolved&&a.elapsed+1e-8>=a.hitAt)impact(a);if(B.over)return;if(a.elapsed+1e-8>=a.duration){P.action=null;emit('actionend',{id:a.id});}}
      if(P.hitstop>0)return;
      if(P.buffer){var b=P.buffer;if(!P.action&&P.lockT<=0&&P.dodgeT<=0){P.buffer=null;B.input(b.type,b.arg);}else {b.ttl-=dt;if(b.ttl<=0)P.buffer=null;}}
      if(E.bleed.length){var amount=st.atk*R.bleed.tickRate*E.bleed.length*dt;E.hp=Math.max(0,E.hp-amount);M.bleedDmg+=amount;M.dmg+=amount;E.bleed=E.bleed.map(function(v){return v-dt;}).filter(function(v){return v>0;});if(E.hp===0){finish();return;}}
      switch(E.state){
        case 'idle':if(D.patterns.length){E.patT-=dt;if(E.patT<=1e-8)startTelegraph();}break;
        case 'telegraph':E.tele=Math.max(0,E.tele-dt);if(HK.enemyAdvance)HK.enemyAdvance(E.pat,windupOf(E.pat,1-E.tele/E.teleDur,E.teleDur));if(E.tele<=1e-8){emit('swing',{pattern:E.pat.name,beat:E.beatI+1,last:!!E.pat.final});landAttack();}break;
        case 'link':E.linkT-=dt;if(E.linkT<=0){var nb=nextBeat(E.beatI+1);if(nb<0){E.state='recover';E.recoveryDur=E.pat.recovery||0.65;E.recovery=E.recoveryDur;}else startBeat(nb);}break;
        case 'recover':E.recovery-=dt;if(E.recovery<=0){E.state='idle';E.patT=E.pat.every||D.patternGap||1.4;emit('recoverend');}break;
        case 'stagger':E.stagT-=dt;if(E.stagT<=0){E.state='idle';E.patT=D.patternGap||1.4;}break;
        case 'downed':E.downT-=dt;if(E.downT<=0){E.state='idle';E.patT=D.patternGap||1.4;emit('up');}break;
      }
    }
    B.execute=execute;
    B.tick=function(dt){accumulator+=dt==null?(R.tick||quantum):Math.max(0,dt);while(accumulator+1e-9>=quantum){step(quantum);accumulator-=quantum;}};
    B.drain=function(){var r=events;events=[];return r;};
    B.exportPlayer=function(){return {hp:P.hp,st:P.st,ult:P.ult};};
    B.snapshot=function(){return {time:B.time,poseTime:B.poseTime,over:B.over,target:target,
      player:{hp:P.hp,hpMax:st.hp,st:P.st,stMax:R.stamina.max,ult:P.ult,guard:P.guard,dodging:P.dodgeT>0,locked:P.lockT>0,
        riposte:P.riposteT>0,riposteKind:P.riposteKind,riposteT:P.riposteT,combo:P.combo,comboT:P.comboT,cds:P.cds.slice(),buffT:P.buffT,critNext:P.critNext,
        hitstop:P.hitstop,action:P.action?Object.assign({},P.action):null,buffer:P.buffer?P.buffer.type:null,lastFailure:P.lastFailure},
      enemy:{hp:E.hp,hpMax:E.hpMax,posture:E.posture,state:E.state,tele:E.tele,teleDur:E.teleDur,window:counterWindow,
        counterable:!E.pat||E.pat.counterable!==false,pattern:E.pat?E.pat.name:null,patIcon:E.pat?E.pat.icon:null,
        windup:E.state==='telegraph'&&E.teleDur?windupOf(E.pat,1-E.tele/E.teleDur,E.teleDur):(E.state==='telegraph'?0:1),
        hold:!!(E.pat&&E.pat.hold),beat:E.pat?E.pat.beat+1:0,beats:E.beats.length,lastBeat:!!(E.pat&&E.pat.final),linkT:E.linkT,
        recovery:E.recovery,recoveryDur:E.recoveryDur,downT:E.downT,bleed:E.bleed.length,
        executable:E.state==='downed'&&!E.executed&&!B.over,
        parts:parts.map(function(p){return {id:p.id,name:p.name,hp:p.hp,hpMax:p.hpMax,weak:!!p.weak,breakable:!!p.breakable,broken:p.broken,pos:p.pos};})}};};
    return B;
  }

  /* ---------- 등급 산정 (기획서 §3.5) ---------- */
  function grade(rules, sum){
    var g = rules.grade, tf = sum.timeLimit ? sum.time / sum.timeLimit : 1;
    var pf = sum.breakable ? sum.breaks / sum.breakable : 1;
    var opportunities=sum.counterOpportunities!=null?sum.counterOpportunities:sum.telegraphs;
    var cr = opportunities ? sum.counters / opportunities : 1;
    if (tf <= g.S.time && pf >= g.S.parts && cr >= g.S.counter) return 'S';
    if (tf <= g.A.time && (sum.breakable ? sum.breaks >= Math.min(g.A.parts, sum.breakable) : true) && cr >= g.A.counter) return 'A';
    if (tf <= g.B.time && (sum.breakable ? sum.breaks >= Math.min(g.B.parts, sum.breakable) : true)) return 'B';
    return 'C';
  }
  function letter(rate){ return rate >= 0.85 ? 'S' : rate >= 0.7 ? 'A' : rate >= 0.5 ? 'B' : 'C'; }
  function fmtTime(s){ s = Math.round(s); var m = Math.floor(s/60); s = s%60; return (m<10?'0':'')+m+' : '+(s<10?'0':'')+s; }

  /* 스테이지 지표 합산 → result.html 이 읽는 형식 */
  function summarize(rules, arena, stageResults){
    var sum = { time:0, timeLimit:0, breaks:0, breakable:0, counters:0, perfect:0, telegraphs:0, counterOpportunities:0, dmgTaken:0, deaths:0, dmg:0, hits:0, evades:0, ripostes:0, normalDmg:0, counterDmg:0, riposteDmg:0, breakDmg:0 };
    stageResults.forEach(function(r, i){ var d = arena.stages[i];
      sum.time += r.time; sum.timeLimit += d.timeLimit; sum.breaks += r.breaks; sum.breakable += d.parts.filter(function(p){ return p.breakable; }).length;
      sum.counters += r.counters; sum.perfect += r.perfect; sum.telegraphs += r.telegraphs; sum.counterOpportunities += r.counterOpportunities!=null?r.counterOpportunities:r.telegraphs; sum.dmgTaken += r.dmgTaken; sum.deaths += r.deaths; sum.dmg += r.dmg; sum.hits += r.hits; ['evades','ripostes','normalDmg','counterDmg','riposteDmg','breakDmg'].forEach(function(k){sum[k]+=r[k]||0;}); });
    var rank = grade(rules, sum);
    var cr = sum.counterOpportunities ? sum.counters/sum.counterOpportunities : 0, pf = sum.breakable ? sum.breaks/sum.breakable : 1;
    var surv = Math.max(0, 1 - sum.dmgTaken / 6000);
    var mats = arena.rewards.items.map(function(it){ return [it[0], it[1], null]; });
    if (rank === 'S') arena.rewards.sBonus.forEach(function(it){ mats.push([it[0], it[1], null]); });
    return {
      rank:rank, time:sum.time, timeLimit:sum.timeLimit, counterRate:cr, counters:sum.counters, telegraphs:sum.telegraphs, counterOpportunities:sum.counterOpportunities, evades:sum.evades, ripostes:sum.ripostes, damageSources:{normal:sum.normalDmg,counter:sum.counterDmg,riposte:sum.riposteDmg,break:sum.breakDmg}, perfect:sum.perfect, dmgTaken:sum.dmgTaken, deaths:sum.deaths, breaks:sum.breaks, breakable:sum.breakable, dmg:Math.round(sum.dmg),
      op:{ name:arena.name, boss:arena.stages[arena.stages.length-1].name+' ('+arena.stages.length+'단계)', rank:rank, time:fmtTime(sum.time),
           counterRate:(Math.round(cr*1000)/10).toFixed(1)+' %', perfect:sum.perfect+' 회', dmgTaken:String(Math.round(sum.dmgTaken)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), deaths:String(sum.deaths) },
      mastery:[ ['카운터 등급', letter(cr), Math.round(cr*100), '#D94A45'], ['파괴 등급', letter(pf), Math.round(pf*100), '#7B9BD6'], ['생존 등급', letter(surv), Math.round(surv*100), '#5FAE9B'] ],
      gold:arena.rewards.gold, mats:mats, stages:stageResults
    };
  }

  var API = { createBattle:createBattle, grade:grade, summarize:summarize, fmtTime:fmtTime };
  if (typeof window !== 'undefined') window.TW_COMBAT = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
