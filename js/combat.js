/* 황혼 전투: 10ms 시뮬레이션, 데이터 기반 준비/타격/회복.
   DOM/렌더 프레임에 의존하지 않는다. tick()은 누적 시간을 소비한다. */
(function(){
  /* 접점 저항 모델(js/contact-feel.js)·재질 판정(combat-quality.js)은 전역에서 찾는다.
     없으면 저항 없이 예전처럼 동작한다. */
  var G=typeof globalThis!=='undefined'?globalThis:this;
  var CFEEL=G.TW_CONTACT_FEEL||{dragScale:function(){return 1;}};
  function rng(seed){ var s=seed>>>0||1; return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function createBattle(o){
    var R=o.rules, C=o.char, D=o.dummy, S=o.skills||[], U=o.ult, HK=o.hooks||{}, st=C.stats, rand=rng(o.seed||7);
    var policy=D.discipline||{}, quantum=0.01, accumulator=0, serial=0, patternId=0, events=[], target, telePlus=0, firstCounterDone=false;
    /* 무기별 리듬 (js/dungeons.js RULES.rhythm). 캐릭터마다 박자가 달라진다. */
    var RH=(R.rhythm||{})[(C&&C.id)||'ain']||{}, rDur=RH.dur||1, rStop=RH.stop||1, rSt=RH.st||1;
    var counterWindow=(D.counterWindow||R.counter.window)+(R.counter.bonus||0), perfectWindow=D.perfectWindow||R.counter.perfect;
    /* 흘림/튕김 경계. 던전이 창을 좁혀도 같은 비율로 따라 좁아진다. */
    var midWindow=D.midWindow||(perfectWindow+(counterWindow-perfectWindow)*0.45);
    function counterTier(tele){ return tele<=perfectWindow+1e-8?'clash':tele<=midWindow+1e-8?'repel':'deflect'; }
    var init=o.player||{};
    var P={hp:init.hp!=null?init.hp:st.hp,st:init.st!=null?init.st:R.stamina.max,ult:init.ult||0,
      guard:false,dodgeT:0,dodgeCd:0,dodgeAgo:99,dodgeThreat:0,lockT:0,stDelay:0,combo:0,comboT:0,
      riposteT:0,riposteKind:null,critNext:false,buffT:0,buffReduce:0,cds:S.map(function(){return 0;}),
      hitstop:0,dragT:0,dragTotal:0,dragRate:1,action:null,buffer:null,lastFailure:'공격 준비 동작과 거리를 확인해라.'};
    var parts=D.parts.map(function(p){return Object.assign({},p,{hpMax:p.hp,broken:false});});
    target=(parts.filter(function(p){return p.weak;})[0]||parts[0]).id;
    var E={hp:D.hp,hpMax:D.hp,posture:0,state:'idle',patI:0,patT:D.patternGap||1.4,pat:null,
      def:null,beats:[],beatI:0,linkT:0,
      tele:0,teleDur:0,recovery:0,recoveryDur:0,downT:0,stagT:0,bleed:[],dead:false};
    var M={time:0,dmg:0,dmgTaken:0,hits:0,crits:0,deflects:0,counters:0,perfect:0,telegraphs:0,counterOpportunities:0,dodges:0,guards:0,breaks:0,
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
    function stopFor(opt){ return stopBase(opt)*rStop; }   /* 무기 리듬: 무거울수록 오래 멈춘다 */
    function stopBase(opt){
      var h=R.hitstop,f=h.hit||0.08;
      if(opt.execute)return h.execute||h.brk||f;
      if(opt.counter)return (opt.tier==='clash'?(h.clash||h.perfect):opt.tier==='deflect'?(h.deflect||h.counter):h.counter)||f;
      if(opt.riposte)return h.smash||f;
      if(opt.kind==='smash'||opt.kind==='ult')return h.smash||f;
      if(opt.skill)return h.chain||f;
      return ((opt.combo||P.combo)>=3?h.chain:h.light)||f;
    }
    function damage(pid,mult,opt){
      if(E.dead)return 0;opt=opt||{};var p=B.part(pid)||parts[0];
      /* 튕김 판정은 «피해를 세기 전에» 난다 — 피해를 깎는 게 튕김의 본체다.
         docs/design/65-contact-feel.md §5 */
      var CF=G.TW_CONTACT_FEEL;
      var mat=G.TW_COMBAT_QUALITY?G.TW_COMBAT_QUALITY.material(p.id,D.kind):'straw';
      var deflect=!!(CF&&CF.deflects&&P.action&&!opt.counter&&!opt.riposte&&!opt.skill
                     &&CF.deflects(mat,P.action.clip,p.broken));
      var weak=p.broken?(policy.exposed||R.weak.broken):p.weak?R.weak.weak:R.weak.normal;
      var guard=p.guardedBy&&p.guardedBy.some(function(id){var q=B.part(id);return q&&!q.broken;})?1-p.guardReduce:1;
      var crit=P.critNext||rand()<st.crit/100;P.critNext=false;
      var reward=opt.counter?(opt.tier==='clash'?R.counter.perfectMult:opt.tier==='deflect'?(R.counter.deflectMult||R.counter.mult):R.counter.mult):opt.riposte?(opt.riposte==='counter'?(policy.normal==null?1:policy.normal)*1.15:opt.riposte==='evade'?(policy.evadeMult||2.2):1.5):
        policy.normal!=null?(opt.skill?policy.skill:policy.normal):1;
      var partyPart=p.hp!=null&&!p.broken?(o.partMult||1):1;
      /* 스매시 «타점» — 날이 스윙의 어느 지점(처음·정타·끝)에서, 날의 어디로
         맞았나. 기하가 없으면(기준 봇·서버) 배율 1. docs/design/73-smash-tempo.md */
      var SPT=G.TW_SWING_POINT, pt=SPT&&P.action&&opt.contact&&!opt.counter&&!opt.riposte?SPT.point(P.action.clip,opt.contact):null;
      if(pt)opt.point=pt;
      var amount=Math.round(st.atk*mult*weak*guard*reward*partyPart*(crit?st.critDmg/100:1)*(0.95+rand()*0.1)*(E.state==='downed'?R.posture.downMult:1)*(deflect?CF.DEFLECT.dmg:1)*(pt?pt.mult:1));
      E.hp=Math.max(0,E.hp-amount);if(pt){M.points=M.points||{sweet:0,solid:0,glance:0};M.points[pt.grade]++;}M.dmg+=amount;M.hits++;if(crit)M.crits++;
      if(opt.counter)M.counterDmg+=amount;else if(opt.riposte)M.riposteDmg+=amount;else M.normalDmg+=amount;
      /* 저항 — 히트스톱(정지) 뒤에 «느려짐» 을 잇는다. 정지는 «맞았다» 는 신호고,
         느려짐은 «살을 가르며 지나간다» 다. 둘은 다른 것이다.
         재질이 단단할수록 오래·깊게 끌린다. docs/design/65-contact-feel.md
         ⚠ emit('hit') «앞» 에 있어야 한다. 뒤에 뒀더니 이벤트가 feel:null 로
            나가서 연출이 저항을 아예 못 받았다. */
      if(CF&&P.action){
        var cf=CF.onContact(mat,P.action.clip,0);
        if(cf.dragT>P.dragT){P.dragT=cf.dragT;P.dragTotal=cf.dragT;P.dragRate=cf.dragRate;}
        opt.contactFeel={material:mat,dragT:cf.dragT,dragRate:cf.dragRate,depth:cf.depth,
          ring:cf.ring*(deflect?CF.DEFLECT.ring:1),deflect:deflect};
      }
      emit('hit',{part:p.id,dmg:amount,crit:crit,kind:opt.kind,deflect:deflect,feel:opt.contactFeel||null,contact:opt.contact||null,point:opt.point||null,counter:!!opt.counter,perfect:!!opt.perfect,riposte:opt.riposte||null,skill:opt.skill||null});
      /* 튕기면 «장갑이 안 깎인다» — 약공격으로는 영영 못 벗긴다. 대신 내가 묶인다. */
      /* 행동 자체는 끊지 않는다 — 끊으면 오히려 후딜이 «짧아져» 이득이 된다.
         휘두르던 것은 끝까지 가고, 그 뒤에 경직으로 묶인다. */
      if(deflect){ P.lockT=Math.max(P.lockT,CF.DEFLECT.lock); P.combo=0; P.comboT=0;
        M.deflects++; emit('deflect',{part:p.id,lock:CF.DEFLECT.lock}); }
      if(!deflect&&p.breakable&&p.hp!=null&&!p.broken){
        var partBonus=policy.partMult||1; if(opt.counter||opt.riposte&&opt.riposte!=='counter')partBonus*=policy.precisePartMult||1;
        p.hp=Math.max(0,p.hp-Math.round(amount*partBonus));if(p.hp===0)breakPart(p);
      }
      if(!opt.noBleed&&rand()<R.bleed.chance*(policy.normal!=null&&!opt.counter&&(!opt.riposte||opt.riposte==='counter')?policy.normal:1))bleed(1);
      P.ult=clamp(P.ult+(opt.counter?R.counter.ult:R.ult.onAttack),0,R.ult.max);
      P.hitstop=Math.max(P.hitstop,stopFor(opt));
      if(E.hp===0)finish();return amount;
    }
    function cancel(reason){if(!P.action)return;emit('actioncancel',{id:P.action.id,reason:reason});P.action=null;P.combo=0;P.comboT=0;}
    /* 취소 시점은 둘이다 — «도망» 과 «다음 공격» 은 다른 문제다.

       명조(鳴潮)의 전투가 무거워 보이면서도 안 답답한 이유가 이것이다:
       휘두르는 그림은 길어도 **날이 지나간 직후부터 회피가 열린다.** 그래서
       큰 기술을 써도 «갇혔다» 는 느낌이 안 든다. 몬헌은 반대로 완전히
       묶어서 «무게» 를 만든다. 디렉터가 둘 다 벤치마크로 꼽았으니 갈라 쓴다:
         · 공격 연계(cancelAt)   — 몬헌처럼 늦게. 연타로 밀어붙이지 못하게.
         · 회피·방어(defCancelAt) — 명조처럼 이르게. 날이 멈춘 직후.

       ⚠ 회피가 빨라져도 **피해량은 안 오른다** — 도망만 빨라진다. 그래서
          균형에는 «생존» 쪽으로만 작용한다. 연계 쪽(cancelAt)은 안 건드렸다. */
    function canCancel(def){var a=P.action;
      if(!a)return true;
      return a.elapsed>=(def&&a.defCancelAt!=null?a.defCancelAt:a.cancelAt);}
    function action(kind,clip,mult,opt,profile){
      var overrides=(R.motion.characterProfiles||{})[C.id||'ain']||{};
      var t=overrides[clip]||profile||R.motion.light, speed=clamp(st.aspd/100,0.7,1.6)/rDur;   /* 무기 리듬: 느린 무기는 speed 가 내려간다 */
      /* 연계 단계를 행동에 실어 둔다 — 연출(몸통 비틀기·궤적·흔들림)이 «몇 번째
         타인가» 를 알아야 뒤로 갈수록 커진다. 판정·피해에는 쓰지 않는다. */
      var a={id:++serial,kind:kind,clip:clip,part:target,mult:mult,opt:opt||{},elapsed:0,combo:P.combo||0,
        hitAt:t.hit/speed,activeEnd:(t.hit+t.active)/speed,duration:t.duration/speed,cancelAt:t.cancel/speed,
        /* 날이 멈추고 DEF_CANCEL 초 뒤부터 회피·방어가 열린다 (명조식).
           연계 취소(cancelAt)보다 늦어지는 일은 없게 min 을 씌운다. */
        defCancelAt:Math.min(t.cancel/speed,(t.hit+t.active)/speed+(R.motion.defCancel||0.06)/speed),
        clipHit:((R.motion.clipContactsByChar||{})[(C&&C.id)||'ain']||{})[clip]||(R.motion.clipContacts||{})[clip]||t.clipHit||0.42,resolved:false};P.action=a;P.guard=false;
      emit('actionstart',Object.assign({},a));return a;
    }
    function defensive(type,arg){return type==='dodge'||type==='guard'&&arg||type==='skill'&&S[arg]&&S[arg].dodge;}
    function queue(type,arg){var edge=P.action&&(defensive(type,arg)?(P.action.defCancelAt!=null?P.action.defCancelAt:P.action.cancelAt):P.action.duration);if(P.action&&edge-P.action.elapsed<=(R.motion.buffer||0.16))P.buffer={type:type,arg:arg,ttl:(R.motion.buffer||0.16)+quantum};}
    function counter(){
      if(E.state!=='telegraph'||E.tele<=0||E.tele>counterWindow||E.pat.counterable===false||P.lockT>0||P.dodgeT>0||!canCancel()||(HK.canCounter&&!HK.canCounter()))return false;
      cancel('counter');P.buffer=null;P.guard=false;
      var tier=counterTier(E.tele), perfect=tier==='clash';M.counters++;if(perfect)M.perfect++;
      var tp=(R.counter.tierPosture||{})[tier]||1;
      E.posture=clamp(E.posture+(E.pat.posture||R.counter.posture)*tp,0,R.posture.max);
      E.state='stagger';E.stagT=tier==='clash'?1.0:tier==='repel'?0.8:0.55;E.tele=0;
      action('counter','counter',1,{counter:true,perfect:perfect,tier:tier},R.motion.counter);
      E.stagT=Math.max(E.stagT,P.action.duration+(tier==='clash'?0.4:0.25));
      emit('counter',{perfect:perfect,tier:tier,pattern:E.pat.name});
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
      var dgSt=R.stamina.dodge*rSt;   /* 무기 리듬: 무거운 무기는 회피가 더 든다 */
      if(!B.over&&P.action&&!canCancel(true)){queue('dodge');return;}
      if(B.over||P.dodgeCd>0||P.lockT>0||P.st<dgSt||!canCancel(true)){if(P.st<dgSt)emit('nost');return;}
      cancel('dodge');P.buffer=null;P.st-=dgSt;P.stDelay=R.stamina.delay;P.dodgeT=R.dodge.iframes;P.dodgeCd=R.dodge.cooldown;P.dodgeAgo=0;
      P.dodgeThreat=E.state==='telegraph'&&(!HK.inZone||HK.inZone(E.pat))?patternId:0;P.guard=false;M.dodges++;emit('dodge');
    }
    function guard(on){if(B.over)return;if(!on&&P.buffer&&P.buffer.type==='guard')P.buffer=null;if(on&&P.action&&!canCancel(true)){queue('guard',true);return;}if(on&&(P.st<=0||P.lockT>0||P.dodgeT>0))return;if(on){cancel('guard');P.buffer=null;}if(on!==P.guard){P.guard=on;emit('guard',{on:on});}}
    function skill(i){
      var k=S[i];if(!k||B.over)return;if(P.action){if(k.dodge&&canCancel(true)&&P.cds[i]<=0&&P.st>=k.st&&P.dodgeCd<=0){cancel('evasive-skill');P.buffer=null;}else{queue('skill',i);return;}}
      if(P.lockT>0||P.dodgeT>0||P.guard||k.dodge&&P.dodgeCd>0)return;if(P.cds[i]>0||P.st<k.st){emit(P.cds[i]>0?'cd':'nost',{skill:i});return;}
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
      var targets=a.opt.aoe?parts:[B.part(a.part)||parts[0]],contacts=targets.map(function(p){return {part:p,contact:HK.canHit?HK.canHit(p.id,a):true};}).filter(function(h){return !!h.contact;});
      if(!contacts.length){M.whiffs++;fail('거리가 맞지 않았다. 낫이 닿는 위치에서 공격해라.');emit('whiff',{timed:true,action:a.id});return;}
      var amount=0;
      a.opt.kind=a.kind;a.opt.combo=a.opt.tier!=null?a.opt.tier+1:P.combo;
      contacts.forEach(function(h){amount+=damage(h.part.id,a.mult/targets.length,Object.assign({},a.opt,{contact:typeof h.contact==='object'?h.contact:null}));});
      if(a.opt.counter&&!E.dead){if(a.opt.perfect){P.riposteKind='counter';P.riposteT=Math.max(0,a.duration-a.elapsed)+.65;}emit('counterfollowup',{window:a.opt.perfect?.65:a.opt.tier==='repel'?.45:.25,perfect:!!a.opt.perfect,tier:a.opt.tier||null});}
      if(a.opt.riposte){M.ripostes++;if(a.opt.riposte!=='counter')E.posture=clamp(E.posture+25,0,R.posture.max);emit('riposte',{kind:a.opt.riposte,dmg:amount});}
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
        if(evaded){
          /* 완벽 회피 — 누른 지 R.dodge.perfect 초 안에 공격이 떨어졌다. 반격 창을 늘리고 회피 기력을 돌려준다 */
          var perfect=P.dodgeAgo<=(R.dodge.perfect||0);
          P.riposteT=(policy.evadeWindow||0.85)+(perfect?(R.dodge.perfectRiposte||0):0);P.riposteKind='evade';P.dodgeThreat=0;M.evades++;
          if(perfect){M.perfectDodges=(M.perfectDodges||0)+1;P.st=Math.min(R.stamina.max,P.st+R.stamina.dodge*rSt);}
          emit('evade',{window:P.riposteT,perfect:perfect});}
      }else{
        var guarded=P.guard&&P.st>0&&pat.unblockable!==true,dmg=pat.dmg;
        if(guarded){dmg=Math.round(dmg*(1-R.guard.reduce));P.st=Math.max(0,P.st-(pat.guardCost||0));M.guards++;E.posture=clamp(E.posture+R.posture.onGuard,0,R.posture.max);P.riposteT=0.8;P.riposteKind='guard';emit('guardhit');}
        /* 경직 단계. 한 방에 최대 체력의 heavyAt 이상을 잃으면 대경직이다 —
           굳는 시간도 밀리는 거리도 달라진다 (R.stagger, docs/design/50 §4). */
        var SG=R.stagger||{}, tier=guarded?'guard':(dmg>=st.hp*(SG.heavyAt||0.12)?'heavy':'light'), sg=SG[tier]||{};
        /* 막아 낸 쪽에는 «굳힘» 을 걸지 않는다. 이 게임의 가드는 곧바로 반격(riposte)으로
           이어지는 것이 설계다 — 블록 스턴을 넣으면 그 설계와 정면으로 부딪친다
           (tests/combat.test.cjs 「guard retaliation ...」). 밀림·클립·흔들림만 쓴다. */
        if(!guarded) {fail(pat.counterable===false?'튕길 수 없는 공격이다. 공격 범위 밖으로 피해라.':P.action?'공격 동작 중 맞았다. 빈틈을 확인하고 공격해라.':'타격 순간에 피하거나 튕겨내지 못했다.');cancel('hit');P.buffer=null;P.lockT=sg.lock||0.28;P.riposteT=0;P.riposteKind=null;}
        if(P.buffT>0)dmg=Math.round(dmg*(1-P.buffReduce));P.hp=Math.max(0,P.hp-dmg);M.dmgTaken+=dmg;P.ult=clamp(P.ult+R.ult.onHit,0,R.ult.max);
        emit('damaged',{dmg:dmg,guarded:guarded,tier:tier,pattern:pat.name,reason:P.lastFailure,stop:(guarded?R.hitstop.guard:R.hitstop.hurt)||0});
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
      /* ⚠ 저항은 «연출» 이다. 행동 시계를 늦추면 안 된다.
         처음엔 여기서 a.elapsed 를 늦췄다. 그랬더니 한 대마다 0.07~0.19초씩
         행동이 길어져 DPS 가 빠지고, **수문기 2페이즈를 기준 봇이 못 깼다**
         (보스 HP 13,504 남기고 사망). 이 저장소의 규칙 —「연출이 판정을 옮기지
         않는다」— 를 내가 깬 것이다.
         이제 시계는 그대로 두고, 눈에 보이는 «클립 시각» 만 뒤처졌다 따라잡는다
         (js/game3d.js tickDrag). 총 시간이 안 변하므로 균형도 안 변한다.
         dragT 는 연출이 읽어 가도록 상태로만 남긴다. */
      if(P.dragT>0) P.dragT=Math.max(0,P.dragT-dt);
      var a=P.action;if(a){a.elapsed=Math.min(a.duration,a.elapsed+dt);if(!a.resolved&&a.elapsed+1e-8>=a.hitAt)impact(a);if(B.over)return;if(a.elapsed+1e-8>=a.duration){P.action=null;emit('actionend',{id:a.id});}}
      if(P.hitstop>0)return;
      if(P.buffer){var b=P.buffer;if((!P.action||defensive(b.type,b.arg)&&canCancel(true))&&P.lockT<=0&&P.dodgeT<=0){P.buffer=null;B.input(b.type,b.arg);}else {b.ttl-=dt;if(b.ttl<=0)P.buffer=null;}}
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
    /* 아레나 위험 구역 — 보스 패턴이 아니라 «지형» 이 주는 피해. 최대 체력 비율로 들어온다. */
    B.hazard=function(frac,reason){
      if(B.over||P.dodgeT>0)return 0;
      var dmg=Math.max(1,Math.round(st.hp*(frac||0.06)));
      if(P.buffT>0)dmg=Math.round(dmg*(1-P.buffReduce));
      P.hp=Math.max(0,P.hp-dmg);M.dmgTaken+=dmg;fail(reason||'아레나가 변했다. 위험 구역을 피해라.');
      emit('damaged',{dmg:dmg,guarded:false,pattern:reason||'위험 구역',hazard:true,stop:R.hitstop.guard});
      if(P.hp===0){M.deaths++;if(o.mortal===false){P.hp=st.hp;emit('death');}else{B.over=true;B.dead=true;emit('death',{fatal:true,reason:P.lastFailure});}}
      return dmg;
    };
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
        parts:parts.map(function(p){return {id:p.id,name:p.name,hp:p.hp,hpMax:p.hpMax,weak:!!p.weak,breakable:!!p.breakable,broken:p.broken,pos:p.pos,guardedBy:p.guardedBy};})}};};
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
