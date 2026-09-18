/* 황혼 — 잡몹 교전 (탐색 구간). 보스전 엔진(combat.js)과 같은 규칙/수치를 쓰되 다수의 적을 다룬다
   var sk = TW_SKIRMISH.create({ char, rules, world, player(P), state:{hp,st,ult}, mobs:[{id,x,y,def}], hooks })
   sk.input('attack'|'smash'|'dodge'|'guard',arg) · sk.tick(dt) · sk.drain() · sk.snapshot()
   피격 반응: light → stiffen(0.25s) · smash tier0-1 → knockback · tier2-3 → knockdown */
(function(){
  function clamp(v,a,b){ return v<a?a:v>b?b:v; }
  function create(o){
    var R=o.rules, C=o.char, st=C.stats, W=o.world, P=o.player, HK=o.hooks||{}, DEPTH=W.DEPTH||0.55;
    var atkInterval=R.attack.base/(st.aspd/100);
    var S=Object.assign({ hp:st.hp, st:R.stamina.max, ult:0 }, o.state||{});
    var A={ atkCd:0, combo:0, comboT:0, guard:false, dodgeT:0, dodgeCd:0, stDelay:0, hitstop:0, dead:false };
    var mobs=o.mobs.map(function(m){ return Object.assign({ hp:m.def.hp, hpMax:m.def.hp, state:'idle', t:0, tele:0, zone:null, react:0, reactT:0, kx:0, ky:0, dead:false, face:1, atkT:1+Math.random()*1.5 }, m); });
    var ev=[]; function emit(t,d){ d=d||{}; d.t=t; ev.push(d); }
    function alive(){ return mobs.filter(function(m){ return !m.dead; }); }
    function inReach(m, reach){ return W.dist(P.x,P.y,m.x,m.y) <= reach + (m.def.r||30); }
    function facing(m){ var a=W.angle(P.x,P.y,m.x,m.y); return W.angDiff(a, P.aim==null?a:P.aim) <= (o.cone||1.3); }
    function dmgTo(m, mult, opt){
      opt=opt||{}; var crit=Math.random()<st.crit/100; var dmg=Math.round(st.atk*mult*(crit?st.critDmg/100:1)*(0.95+Math.random()*0.1)*(m.def.armor||1));
      m.hp=Math.max(0,m.hp-dmg); S.ult=clamp(S.ult+(opt.smash?4:2),0,R.ult.max);
      var tier=opt.smash?opt.tier:-1, react=tier>=2?'knockdown':tier>=0?'knockback':'stiffen';
      if(m.state==='telegraph' && react!=='stiffen'){ m.state='idle'; m.zone=null; }
      if(m.state!=='knockdown'){ m.react=react; m.reactT=react==='knockdown'?1.1:react==='knockback'?0.35:0.22; if(react!=='stiffen'){ var a=W.angle(P.x,P.y,m.x,m.y); var f=react==='knockdown'?260:150; m.kx=Math.cos(a)*f; m.ky=Math.sin(a)*f; } if(react!=='stiffen') m.state=react; else if(m.state==='idle'||m.state==='chase') m.state='stiffen'; }
      emit('hit',{ mob:m.id, dmg:dmg, crit:crit, react:react, smash:!!opt.smash, tier:tier });
      A.hitstop=Math.max(A.hitstop, R.hitstop.hit*(opt.smash?1.5+tier:1));
      if(m.hp===0){ m.dead=true; m.state='dead'; emit('kill',{ mob:m.id, def:m.def, x:m.x, y:m.y }); }
      return dmg;
    }
    function attack(){
      if(A.dead) return; if(A.atkCd>0||A.guard) return;
      var targets=alive().filter(function(m){ return inReach(m, o.reach||150) && facing(m); });
      if(A.comboT<=0) A.combo=0; var mult=R.combo.mults[Math.min(A.combo,R.combo.mults.length-1)]||1;
      if(!targets.length){ A.atkCd=atkInterval; A.combo=0; emit('whiff',{}); return; }
      targets.forEach(function(m){ dmgTo(m, mult, {}); });
      A.combo++; A.comboT=R.combo.gap; A.atkCd=atkInterval*(A.combo>=R.combo.mults.length?1.6:1); emit('attack',{ combo:A.combo }); if(A.combo>=R.combo.mults.length){ A.combo=0; }
    }
    function smash(){
      if(A.dead) return; if(A.atkCd>0||A.guard) return;
      var n=A.comboT>0?Math.max(0,A.combo-1):-1, tier=n<0?0:n, stc=R.combo.smashSt[tier]; if(S.st<stc){ emit('nost',{}); return; }
      var targets=alive().filter(function(m){ return inReach(m, (o.reach||150)+30) && facing(m); });
      S.st-=stc; A.stDelay=R.stamina.delay;
      if(!targets.length){ A.atkCd=atkInterval; A.combo=0; emit('whiff',{smash:true}); return; }
      var total=0; targets.forEach(function(m){ total+=dmgTo(m, R.combo.smash[tier], { smash:true, tier:tier }); });
      emit('smash',{ tier:tier, dmg:total }); A.combo=0; A.comboT=0; A.atkCd=atkInterval*(1.2+tier*0.25);
    }
    function dodge(){ if(A.dead||A.dodgeCd>0||S.st<R.stamina.dodge){ if(S.st<R.stamina.dodge) emit('nost',{}); return; } S.st-=R.stamina.dodge; A.stDelay=R.stamina.delay; A.dodgeT=R.dodge.iframes; A.dodgeCd=R.dodge.cooldown; A.guard=false; emit('dodge',{}); }
    function guard(on){ if(A.dead) return; if(on&&S.st<=0) return; if(on!==A.guard){ A.guard=on; emit('guard',{on:on}); } }
    var api={ mobs:mobs, state:S, get over(){ return alive().length===0; }, get dead(){ return A.dead; } };
    api.input=function(t,a){ if(t==='attack') attack(); else if(t==='smash') smash(); else if(t==='dodge') dodge(); else if(t==='guard') guard(!!a); };
    api.tick=function(dt){
      if(A.hitstop>0){ A.hitstop-=dt; return; }
      if(A.stDelay>0) A.stDelay-=dt; else if(A.guard){ S.st=Math.max(0,S.st-R.stamina.guardPerSec*dt); if(S.st===0){ A.guard=false; emit('guard',{on:false,broke:true}); } } else S.st=Math.min(R.stamina.max, S.st+R.stamina.regen*dt);
      if(A.dodgeT>0) A.dodgeT-=dt; if(A.dodgeCd>0) A.dodgeCd-=dt; if(A.atkCd>0) A.atkCd-=dt; if(A.comboT>0) A.comboT-=dt;
      mobs.forEach(function(m){ if(m.dead) return; var d=W.dist(m.x,m.y,P.x,P.y); m.dist=d; m.face=P.x<m.x?-1:1; var def=m.def;
        switch(m.state){
          case 'idle': if(d<def.aggro){ m.state='chase'; emit('aggro',{mob:m.id}); } break;
          case 'chase': if(d>def.keep){ var a=W.angle(m.x,m.y,P.x,P.y); m.x+=Math.cos(a)*def.speed*dt; m.y+=Math.sin(a)*def.speed*dt*DEPTH; m.moving=true; } else m.moving=false;
            m.atkT-=dt; if(m.atkT<=0 && d<def.range+40){ m.state='telegraph'; m.tele=def.tele; m.zone=W.makeZone({ zone:def.zone }, m.x, m.y, P.x, P.y); emit('telegraph',{mob:m.id, dur:def.tele}); } break;
          case 'telegraph': m.tele-=dt; if(m.tele<=0){ m.state='swing'; m.t=0.18; var hit=!(A.dodgeT>0) && W.inZone(m.zone, P.x, P.y); emit('swing',{mob:m.id});
              if(hit){ var dmg=def.dmg; if(A.guard&&S.st>0){ dmg=Math.round(dmg*(1-R.guard.reduce)); S.st=Math.max(0,S.st-10); } S.hp=Math.max(0,S.hp-dmg); S.ult=clamp(S.ult+R.ult.onHit,0,R.ult.max); emit('damaged',{dmg:dmg, guarded:A.guard, mob:m.id}); if(S.hp===0){ A.dead=true; emit('death',{fatal:true}); } }
              else emit('miss',{mob:m.id, out:!(A.dodgeT>0)}); } break;
          case 'swing': m.t-=dt; if(m.t<=0){ m.state='chase'; m.zone=null; m.atkT=def.cooldown+Math.random()*0.6; } break;
          case 'stiffen': m.reactT-=dt; if(m.reactT<=0){ m.state='chase'; m.react=null; } break;
          case 'knockback': case 'knockdown': m.reactT-=dt; var k=Math.max(0,m.reactT)/(m.state==='knockdown'?1.1:0.35); var nx=m.x+m.kx*dt*k*2, ny=m.y+m.ky*dt*k*2*DEPTH; if(!W.isSolid(nx,m.y)) m.x=nx; if(!W.isSolid(m.x,ny)) m.y=ny; if(m.reactT<=0){ m.state='chase'; m.react=null; m.atkT=0.8; } break;
        } });
    };
    api.drain=function(){ var v=ev; ev=[]; return v; };
    api.snapshot=function(){ return { player:{ hp:S.hp, hpMax:st.hp, st:S.st, stMax:R.stamina.max, ult:S.ult, guard:A.guard, dodging:A.dodgeT>0, combo:A.combo, comboT:A.comboT }, mobs:mobs.map(function(m){ return { id:m.id, x:m.x, y:m.y, hp:m.hp, hpMax:m.hpMax, state:m.state, react:m.react, tele:m.tele, teleDur:m.def.tele, zone:m.zone, dead:m.dead, face:m.face, moving:m.moving, dist:m.dist }; }) }; };
    return api;
  }
  window.TW_SKIRMISH={ create:create };
})();
