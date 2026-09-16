/* 황혼 — 전투 엔진 (DOM 없음 · 브라우저/Node 공용)
   createBattle({ char, dummy, rules, skills, ult, seed }) → battle
     battle.input(type, arg)   'attack'(partId) 'dodge' 'guard'(bool) 'skill'(index) 'ult' 'target'(partId)
     battle.tick(dt)           고정 스텝으로 호출 (기본 1/60)
     battle.drain()            렌더용 이벤트 배열을 비우며 반환
     battle.snapshot()         현재 상태 (렌더 입력)
     battle.metrics            누적 지표
   완전 수동: 공격·회피·방어·카운터·기술·궁극기 전부 입력으로만 일어난다 */
(function(){
  function rng(seed){ var s = seed >>> 0 || 1; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function clamp(v,a,b){ return v<a?a:v>b?b:v; }

  function createBattle(o){
    var R = o.rules, C = o.char, D = o.dummy, S = o.skills || [], U = o.ult || null, rand = rng(o.seed || 7), HK = o.hooks || {};
    var st = C.stats;
    var atkInterval = R.attack.base / (st.aspd/100);
    var counterWindow = D.counterWindow || R.counter.window;
    var telePlus = 0;
    var ev = [];
    function emit(t, d){ d = d || {}; d.t = t; d.time = B.time; ev.push(d); }

    var init = o.player || {};
    var P = { hp:init.hp!=null?init.hp:st.hp, hpMax:st.hp, st:init.st!=null?init.st:R.stamina.max, stMax:R.stamina.max, ult:init.ult||0, guard:false, dodgeT:0, dodgeCd:0, stDelay:0,
              atkCd:0, lockT:0, riposteT:0, combo:0, comboT:0, critNext:false, buffT:0, buffReduce:0, cds:S.map(function(){ return 0; }), hitstop:0 };
    var parts = D.parts.map(function(p){ return { id:p.id, name:p.name, hp:p.hp, hpMax:p.hp, weak:!!p.weak, breakable:!!p.breakable, broken:false,
                                                   guardedBy:p.guardedBy||null, guardReduce:p.guardReduce||0, onBreak:p.onBreak||null, pos:p.pos }; });
    var E = { hp:D.hp, hpMax:D.hp, posture:0, state:'idle', patI:0, patT:D.patterns.length ? (D.patterns[0].every || D.patternGap || 1.4) : Infinity,
              tele:0, teleDur:0, pat:null, downT:0, stagT:0, bleed:[], parts:parts, dead:false };
    var target = (parts.filter(function(p){ return p.weak; })[0] || parts[0]).id;
    var M = { time:0, dmg:0, dmgTaken:0, hits:0, crits:0, counters:0, perfect:0, telegraphs:0, dodges:0, guards:0, breaks:0, bleedDmg:0, ultUsed:0, downs:0, deaths:0 };
    var firstCounterDone = false;
    var B = { time:0, over:false, metrics:M, part:function(id){ return parts.filter(function(p){ return p.id===id; })[0]; } };

    /* ---------- 피해 ---------- */
    function partMult(p){ if (p.weak) return R.weak.weak; if (p.broken) return R.weak.broken; return R.weak.normal; }
    function guardMult(p){ if (!p.guardedBy) return 1; var guarded = p.guardedBy.some(function(id){ var g = B.part(id); return g && !g.broken; }); return guarded ? (1 - p.guardReduce) : 1; }
    function dealDamage(pid, mult, opt){
      opt = opt || {}; var p = B.part(pid) || parts[0];
      var crit = P.critNext || rand() < st.crit/100; if (P.critNext) P.critNext = false;
      var dmg = st.atk * mult * partMult(p) * (opt.counter ? (opt.perfect ? R.counter.perfectMult : R.counter.mult) : 1) * (crit ? st.critDmg/100 : 1) * (0.95 + rand()*0.10);
      dmg *= guardMult(p); if (E.state === 'downed') dmg *= R.posture.downMult;
      dmg = Math.round(dmg);
      E.hp = Math.max(0, E.hp - dmg); M.dmg += dmg; M.hits++; if (crit) M.crits++;
      if (p.hp != null && !p.broken){ p.hp = Math.max(0, p.hp - Math.round(dmg * (opt.aoe ? 1 : 1))); if (p.hp === 0) breakPart(p); }
      emit('hit', { part:p.id, dmg:dmg, crit:crit, counter:!!opt.counter, perfect:!!opt.perfect, skill:opt.skill||null });
      if (!opt.noBleed && rand() < R.bleed.chance) addBleed(1);
      P.ult = clamp(P.ult + (opt.counter ? R.counter.ult : R.ult.onAttack), 0, R.ult.max);
      P.hitstop = Math.max(P.hitstop, opt.counter ? R.hitstop.counter : R.hitstop.hit);
      if (E.hp === 0) finish();
      return dmg;
    }
    function breakPart(p){
      p.broken = true; M.breaks++; E.posture = clamp(E.posture + R.posture.onBreak, 0, R.posture.max); P.ult = clamp(P.ult + R.ult.onBreak, 0, R.ult.max);
      P.hitstop = Math.max(P.hitstop, R.hitstop.brk);
      if (p.onBreak && p.onBreak.telePlus) telePlus += p.onBreak.telePlus;
      emit('break', { part:p.id, name:p.name });
      if (D.allBrokenDown && parts.filter(function(q){ return q.breakable; }).every(function(q){ return q.broken; })) down();
      else if (E.posture >= R.posture.max) down();
    }
    function addBleed(n){ for (var i=0;i<n;i++){ if (E.bleed.length >= R.bleed.maxStacks) E.bleed.shift(); E.bleed.push(R.bleed.dur); } emit('bleed', { stacks:E.bleed.length }); }
    function down(){ if (E.state === 'downed' || E.dead) return; E.state = 'downed'; E.downT = R.posture.downDur; E.posture = 0; E.tele = 0; M.downs++; emit('downed', {}); }
    function finish(){ if (E.dead) return; E.dead = true; E.state = 'broken'; B.over = true; emit('clear', {}); }

    /* ---------- 입력 ---------- */
    function attack(pid){
      if (B.over) return;
      if (pid) target = pid;
      /* 예고 창 안이면 카운터 */
      if (E.state === 'telegraph' && E.tele <= counterWindow && P.lockT <= 0 && (!HK.canCounter || HK.canCounter())){
        var perfect = E.tele <= R.counter.perfect;
        M.counters++; if (perfect) M.perfect++;
        E.posture = clamp(E.posture + (E.pat.posture || R.counter.posture), 0, R.posture.max);
        dealDamage(target, 1.0, { counter:true, perfect:perfect });
        emit('counter', { perfect:perfect, pattern:E.pat.name });
        E.state = 'stagger'; E.stagT = 0.8; E.tele = 0;
        if (D.firstCounterUlt && !firstCounterDone){ firstCounterDone = true; P.ult = R.ult.max; emit('ultready', { first:true }); }
        if (!E.dead && E.posture >= R.posture.max) down();
        P.combo = 0; P.atkCd = atkInterval * 0.5; return;
      }
      if (P.atkCd > 0 || P.guard || P.lockT > 0) return;
      if (HK.canHit && !HK.canHit()){ P.atkCd = atkInterval; P.combo = 0; emit('whiff', {}); return; }
      if (E.state === 'telegraph' && E.tele > counterWindow){ P.lockT = E.tele + R.attack.lockAfterEarly; emit('early', {}); }
      if (P.comboT <= 0) P.combo = 0;
      var mult = R.combo.mults[Math.min(P.combo, R.combo.mults.length-1)] || 1;
      dealDamage(target, mult, {});
      P.combo = P.combo + 1; P.comboT = R.combo.gap; P.atkCd = atkInterval * (P.combo >= R.combo.mults.length ? 1.6 : 1);
      emit('attack', { combo:P.combo }); if (P.combo >= R.combo.mults.length){ P.combo = 0; P.comboT = R.combo.gap; }
    }
    function smash(pid){
      if (B.over) return; if (pid) target = pid;
      if (P.atkCd > 0 || P.guard || P.lockT > 0) return;
      if (HK.canHit && !HK.canHit()){ P.atkCd = atkInterval; P.combo = 0; emit('whiff', { smash:true }); return; }
      var n = P.comboT > 0 ? Math.max(0, P.combo - 1) : -1;           /* 직전 일반 공격 타수 (0~3), 콤보 없으면 -1 */
      var tier = n < 0 ? 0 : n;
      var stc = R.combo.smashSt[tier]; if (P.st < stc){ emit('nost', {}); return; }
      P.st -= stc; P.stDelay = R.stamina.delay;
      if (E.state === 'telegraph' && E.tele > counterWindow){ P.lockT = E.tele + R.attack.lockAfterEarly; emit('early', {}); }
      var rip = P.riposteT > 0; var dmg = dealDamage(target, R.combo.smash[tier] * (rip ? 1.5 : 1), { smash:true, tier:tier, riposte:rip }); if (rip){ P.riposteT = 0; E.posture = clamp(E.posture + 25, 0, R.posture.max); emit('riposte', {}); }
      E.posture = clamp(E.posture + R.combo.smashPosture[tier], 0, R.posture.max);
      P.hitstop = Math.max(P.hitstop, R.hitstop.hit * (1.5 + tier));
      emit('smash', { tier:tier, dmg:dmg });
      if (!E.dead && E.posture >= R.posture.max) down();
      P.combo = 0; P.comboT = 0; P.atkCd = atkInterval * (1.2 + tier * 0.25);
    }
    function dodge(){
      if (B.over || P.dodgeCd > 0 || P.lockT > 0 || P.st < R.stamina.dodge) { if (P.st < R.stamina.dodge) emit('nost', {}); return; }
      P.st -= R.stamina.dodge; P.stDelay = R.stamina.delay; P.dodgeT = R.dodge.iframes; P.dodgeCd = R.dodge.cooldown; P.guard = false; M.dodges++; emit('dodge', {});
    }
    function guard(on){ if (B.over) return; if (on && P.st <= 0) return; if (on !== P.guard){ P.guard = on; emit('guard', { on:on }); } }
    function skill(i){
      var k = S[i]; if (!k || B.over) return;
      if (P.cds[i] > 0 || P.st < k.st) { emit(P.cds[i] > 0 ? 'cd' : 'nost', { skill:i }); return; }
      if (P.atkCd > 0 || P.lockT > 0) return;
      if (k.mult > 0 && HK.canHit && !HK.canHit()){ P.atkCd = atkInterval; emit('whiff', { skill:i }); return; }
      P.atkCd = atkInterval; P.st -= k.st; P.stDelay = R.stamina.delay; P.cds[i] = k.cd;
      if (k.dodge){ P.dodgeT = R.dodge.iframes * 1.5; M.dodges++; }
      if (k.critNext) P.critNext = true;
      if (k.buff){ P.buffT = k.buff.dur; P.buffReduce = k.buff.reduce; }
      if (k.mult > 0){
        if (k.aoe) parts.forEach(function(p){ dealDamage(p.id, k.mult, { skill:k.id, aoe:true }); });
        else dealDamage(target, k.mult, { skill:k.id });
      }
      emit('skill', { index:i, id:k.id, name:k.name });
    }
    function ult(){
      if (!U || B.over) return; if (P.ult < R.ult.max){ emit('cd', { ult:true }); return; }
      if (P.lockT > 0) return;
      if (HK.canHit && !HK.canHit()){ emit('whiff', { ult:true }); return; }
      P.atkCd = atkInterval; P.ult = 0; M.ultUsed++;
      dealDamage(target, U.mult, { skill:U.id, noBleed:true }); if (U.bleed) addBleed(U.bleed);
      P.hitstop = Math.max(P.hitstop, R.hitstop.brk); emit('ult', { name:U.name });
    }

    B.input = function(type, arg){
      switch(type){
        case 'attack': attack(arg); break; case 'smash': smash(arg); break; case 'dodge': dodge(); break; case 'guard': guard(!!arg); break;
        case 'skill': skill(arg|0); break; case 'ult': ult(); break; case 'target': if (B.part(arg)) target = arg; break;
      }
    };

    /* ---------- 허수아비 행동 ---------- */
    function startTelegraph(){
      if (HK.canStart && !HK.canStart()){ E.patT = 0.2; return; }
      E.pat = HK.pick ? HK.pick(D.patterns, E.patI) : D.patterns[E.patI % D.patterns.length]; E.patI++;
      E.state = 'telegraph'; E.teleDur = E.pat.tele + telePlus; E.tele = E.teleDur; M.telegraphs++;
      emit('telegraph', { pattern:E.pat.name, icon:E.pat.icon, dur:E.teleDur, window:counterWindow });
    }
    function landAttack(){
      var pat = E.pat; var dmg = pat.dmg;
      if (P.dodgeT > 0 || (HK.inZone && !HK.inZone(pat))){ emit('miss', { pattern:pat.name, out:!(P.dodgeT > 0) }); }
      else {
        if (P.guard && P.st > 0){ dmg = Math.round(dmg * (1 - R.guard.reduce)); P.st = Math.max(0, P.st - (pat.guardCost || 0)); M.guards++; E.posture = clamp(E.posture + R.posture.onGuard, 0, R.posture.max); P.riposteT = 0.8; emit('guardhit', {}); }
        if (P.buffT > 0) dmg = Math.round(dmg * (1 - P.buffReduce));
        P.hp = Math.max(0, P.hp - dmg); M.dmgTaken += dmg; P.ult = clamp(P.ult + R.ult.onHit, 0, R.ult.max);
        emit('damaged', { dmg:dmg, guarded:P.guard, pattern:pat.name });
        if (P.hp === 0){ M.deaths++; if (o.mortal === false){ P.hp = P.hpMax; emit('death', {}); } else { B.over = true; B.dead = true; emit('death', { fatal:true }); } }
      }
      E.state = 'idle'; E.patT = pat.every || D.patternGap || 1.4;
    }

    /* ---------- 틱 ---------- */
    B.tick = function(dt){
      if (B.over) return;
      dt = dt || R.tick;
      B.time += dt; M.time = B.time;
      if (P.hitstop > 0){ P.hitstop -= dt; return; }
      /* 플레이어 자원 */
      if (P.stDelay > 0) P.stDelay -= dt; else if (P.guard){ P.st = Math.max(0, P.st - R.stamina.guardPerSec*dt); if (P.st === 0){ P.guard = false; emit('guard', { on:false, broke:true }); } }
      else P.st = Math.min(P.stMax, P.st + R.stamina.regen*dt);
      if (P.dodgeT > 0) P.dodgeT -= dt; if (P.dodgeCd > 0) P.dodgeCd -= dt; if (P.atkCd > 0) P.atkCd -= dt; if (P.lockT > 0) P.lockT -= dt; if (P.riposteT > 0) P.riposteT -= dt; if (P.comboT > 0) P.comboT -= dt; if (P.buffT > 0) P.buffT -= dt;
      for (var i=0;i<P.cds.length;i++) if (P.cds[i] > 0) P.cds[i] = Math.max(0, P.cds[i]-dt);
      /* 출혈 */
      if (E.bleed.length){
        var tick = st.atk * R.bleed.tickRate * E.bleed.length * dt; E.hp = Math.max(0, E.hp - tick); M.bleedDmg += tick; M.dmg += tick;
        E.bleed = E.bleed.map(function(t){ return t - dt; }).filter(function(t){ return t > 0; });
        if (E.hp === 0){ finish(); return; }
      }
      /* 허수아비 상태 기계 */
      switch (E.state){
        case 'idle': if (D.patterns.length){ E.patT -= dt; if (E.patT <= 0) startTelegraph(); } break;
        case 'telegraph': E.tele -= dt; if (E.tele <= 0){ E.state = 'attack'; emit('swing', { pattern:E.pat.name }); landAttack(); } break;
        case 'stagger': E.stagT -= dt; if (E.stagT <= 0){ E.state = 'idle'; E.patT = (E.pat && E.pat.every) || D.patternGap || 1.4; } break;
        case 'downed': E.downT -= dt; if (E.downT <= 0){ E.state = 'idle'; E.patT = D.patternGap || 1.4; emit('up', {}); } break;
      }
    };
    B.drain = function(){ var out = ev; ev = []; return out; };
    B.exportPlayer = function(){ return { hp:P.hp, st:P.st, ult:P.ult }; };
    B.snapshot = function(){
      return { time:B.time, over:B.over, target:target,
        player:{ hp:P.hp, hpMax:P.hpMax, st:P.st, stMax:P.stMax, ult:P.ult, guard:P.guard, dodging:P.dodgeT>0, locked:P.lockT>0, riposte:P.riposteT>0, comboT:P.comboT, combo:P.combo, cds:P.cds.slice(), buffT:P.buffT, critNext:P.critNext },
        enemy:{ hp:E.hp, hpMax:E.hpMax, posture:E.posture, state:E.state, tele:E.tele, teleDur:E.teleDur, window:counterWindow, pattern:E.pat ? E.pat.name : null, patIcon:E.pat ? E.pat.icon : null, downT:E.downT, bleed:E.bleed.length,
                parts:parts.map(function(p){ return { id:p.id, name:p.name, hp:p.hp, hpMax:p.hpMax, weak:p.weak, breakable:p.breakable, broken:p.broken, pos:p.pos }; }) } };
    };
    return B;
  }

  /* ---------- 등급 산정 (기획서 §3.5) ---------- */
  function grade(rules, sum){
    var g = rules.grade, tf = sum.timeLimit ? sum.time / sum.timeLimit : 1;
    var pf = sum.breakable ? sum.breaks / sum.breakable : 1;
    var cr = sum.telegraphs ? sum.counters / sum.telegraphs : 1;
    if (tf <= g.S.time && pf >= g.S.parts && cr >= g.S.counter) return 'S';
    if (tf <= g.A.time && (sum.breakable ? sum.breaks >= Math.min(g.A.parts, sum.breakable) : true) && cr >= g.A.counter) return 'A';
    if (tf <= g.B.time && (sum.breakable ? sum.breaks >= Math.min(g.B.parts, sum.breakable) : true)) return 'B';
    return 'C';
  }
  function letter(rate){ return rate >= 0.85 ? 'S' : rate >= 0.7 ? 'A' : rate >= 0.5 ? 'B' : 'C'; }
  function fmtTime(s){ s = Math.round(s); var m = Math.floor(s/60); s = s%60; return (m<10?'0':'')+m+' : '+(s<10?'0':'')+s; }

  /* 스테이지 지표 합산 → result.html 이 읽는 형식 */
  function summarize(rules, arena, stageResults){
    var sum = { time:0, timeLimit:0, breaks:0, breakable:0, counters:0, perfect:0, telegraphs:0, dmgTaken:0, deaths:0, dmg:0, hits:0 };
    stageResults.forEach(function(r, i){ var d = arena.stages[i];
      sum.time += r.time; sum.timeLimit += d.timeLimit; sum.breaks += r.breaks; sum.breakable += d.parts.filter(function(p){ return p.breakable; }).length;
      sum.counters += r.counters; sum.perfect += r.perfect; sum.telegraphs += r.telegraphs; sum.dmgTaken += r.dmgTaken; sum.deaths += r.deaths; sum.dmg += r.dmg; sum.hits += r.hits; });
    var rank = grade(rules, sum);
    var cr = sum.telegraphs ? sum.counters/sum.telegraphs : 0, pf = sum.breakable ? sum.breaks/sum.breakable : 1;
    var surv = Math.max(0, 1 - sum.dmgTaken / 6000);
    var mats = arena.rewards.items.map(function(it){ return [it[0], it[1], null]; });
    if (rank === 'S') arena.rewards.sBonus.forEach(function(it){ mats.push([it[0], it[1], null]); });
    return {
      rank:rank, time:sum.time, timeLimit:sum.timeLimit, counterRate:cr, perfect:sum.perfect, dmgTaken:sum.dmgTaken, deaths:sum.deaths, breaks:sum.breaks, breakable:sum.breakable, dmg:Math.round(sum.dmg),
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
