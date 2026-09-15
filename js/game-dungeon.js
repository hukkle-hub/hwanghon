/* 황혼 — 던전 01 (Phaser 4 렌더러)
   월드 규칙(world-sim.js)·전투 규칙(combat.js)·레벨(dungeon.js)·리그(dummy-rig.js)는 그대로. 이 파일은 렌더링·입력·연출·흐름만 담당 */
(function(){
  var W=window.TW_WORLD, DG=window.TW_DUNGEONS, CB=window.TW_COMBAT, SIM=window.TW_WORLDSIM, L=window.TW_LEVELS.d01, $=function(s){return document.querySelector(s);};
  var A=DG.ARENAS[L.arena], R=DG.RULES, CHAR=W.CHARS[A.char], SK=DG.SKILLS[A.char], ULT=DG.SKILLS[A.char+'Ult'], DEPTH=SIM.DEPTH, RIGDEF=window.TW_DUMMY_RIG, AIN=window.TW_AIN_RIG;
  var MOBILE=Math.min(window.innerWidth, window.innerHeight)<=640, ZOOM=MOBILE?0.62:0.78;
  var world=SIM.createWorld({rows:L.rows, cell:L.cell}), map=world.map;
  var P=world.add('p',{x:world.marks('S')[0].x, y:world.marks('S')[0].y, r:L.player.r, rollT:0, lockT:0, aim:0, face:'down'});
  var Bs=world.add('b',{x:world.marks('B')[0].x, y:world.marks('B')[0].y, r:60, dist:999, faceX:1});
  var gate=world.marks('G')[0], sign=world.marks('s')[0];
  var state='explore', phase=0, battle=null, paused=false, stageResults=[], zone=null, fightT=0, acc=0, guideT=0, counterT=0, lastHit=0, seen={}, gateClosed=false, shakeT=0;
  var stick={sx:0,sy:0,id:null,ox:0,oy:0}, holdTimer=null, guarding=false, kd={};
  var el={ dg:$('#dg'), flash:$('#flash'), bosshp:$('#bosshp'), name:$('#b-name'), stack:$('#b-stack'), seg:$('#b-seg'), ph:$('#b-ph'), timerBox:$('#bttimer'), timer:$('#b-timer'), counter:$('#counter'), cLb:$('#c-lb'), cV:$('#c-v'), cSub:$('#c-sub'), status:$('#status'), guide:$('#guide'), stickEl:$('#stick'), actions:$('#actions'), ov:$('#ov'), ovBox:$('#ov-box'), mini:$('#mini'), loading:$('#loading') };
  var mctx=el.mini.getContext('2d');
  var scene=null, rig=null, ain=null, zoneG=null, reachG=null, gateImg=null, lights={}, torchLights=[], coreLight=null, sparks=null, ENGINE2RIG={ shl:'padL', shr:'padR' }, HITMAP={ core:'core', body:'body', chain:'chain', shl:'shl', shr:'shr', head:'head' };

  /* ---------- 파티 · 행동 버튼 ---------- */
  $('#btparty').innerHTML='<div class="pmem">'+W.face(CHAR.id,'pmem__face')+'<div class="fill"><div class="flex ac g2"><span class="pmem__n">'+CHAR.nm+'</span><span class="pmem__lv">LV.'+CHAR.lv+'</span><span class="pmem__hp num" id="p-hp">'+W.fmt(CHAR.stats.hp)+'</span></div><div class="bar bar--hp" data-fill="100" id="p-bar"></div></div></div>';
  el.actions.innerHTML=SK.map(function(k,i){ return '<div class="abtn" data-skill="'+i+'"><span class="sk__k">'+k.key+'</span><svg class="ico"><use href="#i-'+k.icon+'"/></svg><span class="sk__cd" hidden></span><span class="sk__nm">'+k.name+'</span></div>'; }).join('')+
    '<div class="abtn abtn--dodge" data-dodge><span class="sk__k">K</span><svg class="ico"><use href="#i-bolt"/></svg><span class="sk__nm">회피</span></div>'+
    '<div class="abtn abtn--atk" data-atk><span class="sk__k">J</span><svg class="ico"><use href="#i-scythe"/></svg><span class="sk__nm">공격 · 길게 방어</span></div>'+
    '<div class="abtn abtn--ult" data-ult><span class="sk__k">R</span><svg class="ico"><use href="#i-'+ULT.icon+'"/></svg><span class="sk__nm">'+ULT.name+'</span></div>';

  /* ---------- Phaser 씬 ---------- */
  var Boot=new Phaser.Class({ Extends:Phaser.Scene, initialize:function(){ Phaser.Scene.call(this,{key:'boot'}); },
    preload:function(){
      var ld=this.load; ld.setPath('');
      ld.image({ key:'ground', url:'art/env/ground.webp', normalMap:'art/env/ground_n.webp' });
      ld.image({ key:'wall', url:'art/env/wall.webp', normalMap:'art/env/wall_n.webp' });
      ['fence','fpost','gate','ring','barrel','crate','post','sign','torch','straw'].forEach(function(k){ ld.image(k,'art/env/'+k+'.webp'); });
      RIGDEF.parts.forEach(function(p){ ld.image('dummy-'+p.id,'art/dummy/'+p.id+'.webp'); });
      Object.keys(AIN).forEach(function(v){ AIN[v].parts.forEach(function(p){ ld.image('ain-'+v+'-'+p.id,'art/ain/'+v+'-'+p.id+'.webp'); }); });
      ld.image('bg','art/lobby-city.webp');
      var self=this; ld.on('progress', function(v){ el.loading.textContent='황 혼 — '+Math.round(v*100)+'%'; });
    },
    create:function(){
      /* 발광·스파크 텍스처 생성 */
      var g=this.add.graphics(); g.fillStyle(0xffffff,1); for(var i=0;i<12;i++){ g.fillStyle(0xffffff, 0.06); g.fillCircle(64,64,64-i*5); } g.generateTexture('fx-glow',128,128); g.clear();
      g.fillStyle(0xffffff,1); g.fillCircle(6,6,5); g.generateTexture('fx-spark',12,12); g.destroy();
      this.scene.start('dungeon');
    } });

  var Dungeon=new Phaser.Class({ Extends:Phaser.Scene, initialize:function(){ Phaser.Scene.call(this,{key:'dungeon'}); },
    create:function(){
      scene=this; var c=map.cell, sh=c*DEPTH, pw=map.pw, ph=map.ph*DEPTH;
      /* 배경(도시 실루엣, 카메라 고정) */
      var bg=this.add.image(0,0,'bg').setOrigin(0,0).setScrollFactor(0.15,0.05).setAlpha(0.5).setDepth(-100); bg.setDisplaySize(pw*0.4+this.scale.width*1.4, ph*0.6+this.scale.height); bg.setTint(0x6a5a60); bg.setPosition(-200,-400);
      /* 바닥 */
      var ground=this.add.tileSprite(0,0,pw,ph,'ground').setOrigin(0,0).setDepth(0); ground.tileScaleX=0.5; ground.tileScaleY=0.5*DEPTH; try{ ground.setLighting(true); }catch(e){}
      /* 보스 원 데칼 */
      var bm=world.marks('B')[0]; var ring=this.add.image(bm.x, bm.y*DEPTH, 'ring').setDepth(0.5); ring.setDisplaySize(560, 560*DEPTH); try{ ring.setLighting(true); }catch(e){}
      /* 구조물·소품 (y 정렬) */
      var self=this; var PROP={ b:{k:'barrel',h:60}, c:{k:'crate',h:56}, p:{k:'post',h:130}, s:{k:'sign',h:110}, t:{k:'torch',h:120} };
      for(var y=0;y<map.h;y++) for(var x=0;x<map.w;x++){ var ch=map.rows[y][x], cx=(x+0.5)*c, by=(y+1)*c*DEPTH;
        if(ch==='#'){ var wimg=this.add.image(cx, by, 'wall').setOrigin(0.5,1).setDepth(by); wimg.setDisplaySize(c+1, sh+72); try{ wimg.setLighting(true); }catch(e){} }
        else if(ch==='|'){ /* 세로 울타리: 셀마다 기둥 + 기둥 사이 가로대 두 줄 */
          var fp=this.add.image(cx, by-sh*0.5, 'fpost').setOrigin(0.5,1).setDepth(by-sh*0.5); var ft=this.textures.get('fpost').getSourceImage(); fp.setDisplaySize(92*ft.width/ft.height, 92); try{ fp.setLighting(true); }catch(e){}
          if(y+1<map.h && map.rows[y+1][x]==='|'){ var rail=this.add.graphics().setDepth(by-sh*0.5-0.1); rail.lineStyle(5,0x3a2e22,1); rail.beginPath(); rail.moveTo(cx-2, by-sh*0.5-70); rail.lineTo(cx-2, by+sh*0.5-70); rail.moveTo(cx+2, by-sh*0.5-38); rail.lineTo(cx+2, by+sh*0.5-38); rail.strokePath(); rail.lineStyle(2,0x6a6a70,0.6); rail.beginPath(); rail.moveTo(cx, by-sh*0.5-54); rail.lineTo(cx, by+sh*0.5-54); rail.strokePath(); } }
        else if(ch==='G'){ gateImg=this.add.image(cx, by, 'gate').setOrigin(0.5,1).setDepth(by).setVisible(false); gateImg.setDisplaySize(c+10, 110); try{ gateImg.setLighting(true); }catch(e){} }
        else if(PROP[ch]){ var pr=PROP[ch], im=this.add.image(cx, by-sh*0.25, pr.k).setOrigin(0.5,1).setDepth(by-sh*0.25); var tex=this.textures.get(pr.k).getSourceImage(); im.setDisplaySize(pr.h*tex.width/tex.height, pr.h); try{ im.setLighting(true); }catch(e){}
          var shd=this.add.ellipse(cx, by-sh*0.25, pr.h*0.6, 12, 0x000000, 0.45).setDepth(by-sh*0.25-0.1);
          if(ch==='t'){ var lt=this.lights.addLight(cx, by-sh*0.25-100, 460, 0xF0A050, 2.2); torchLights.push({l:lt, base:2.2}); var fl=this.add.image(cx, by-sh*0.25-96, 'fx-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xE8702E).setAlpha(0.6).setDepth(by+0.1); fl.setDisplaySize(140,140); torchLights[torchLights.length-1].fx=fl;
            this.add.particles(cx, by-sh*0.25-98, 'fx-spark', { speedY:{min:-40,max:-90}, speedX:{min:-12,max:12}, scale:{start:0.5,end:0}, alpha:{start:0.9,end:0}, lifespan:{min:500,max:900}, frequency:120, tint:[0xFFC070,0xE8502E], blendMode:'ADD' }).setDepth(by+0.2); } }
      }
      /* 조명 */
      try{ this.lights.enable(); this.lights.setAmbientColor(0xcfc4c8); }catch(e){}
      lights.player=this.lights.addLight(P.x, P.y*DEPTH-40, 360, 0xD8C8B0, 0.9);
      coreLight=this.lights.addLight(Bs.x, Bs.y*DEPTH-170, 340, 0xE04A3C, 0.8);
      /* 존·사거리 그래픽 */
      zoneG=this.add.graphics().setDepth(0.8); reachG=this.add.graphics().setDepth(0.7);
      /* 허수아비 리그 */
      rig=window.TW_RIG_PHASER.mount(this, RIGDEF, { x:Bs.x, y:Bs.y*DEPTH, scale:0.42 });
      RIGDEF.parts.forEach(function(p){ try{ rig.part(p.id).list[0].setLighting(true); }catch(e){} });
      var bshadow=this.add.ellipse(Bs.x, Bs.y*DEPTH, 190, 26, 0x000000, 0.5).setDepth(Bs.y*DEPTH-0.5); rig.shadow=bshadow;
      /* 아인 리그 (정면/후면/측면) */
      ain=buildAin(this);
      /* 히트 파티클 */
      sparks=this.add.particles(0,0,'fx-spark',{ speed:{min:120,max:320}, angle:{min:0,max:360}, scale:{start:0.7,end:0}, alpha:{start:1,end:0}, lifespan:{min:220,max:480}, gravityY:500, tint:[0xFFE0C0,0xF0B070,0xD94A45], blendMode:'ADD', emitting:false }).setDepth(9000);
      /* 카메라 */
      var cam=this.cameras.main; cam.setBounds(0,0,pw,ph); cam.setZoom(ZOOM); cam.startFollow(ain.root, true, 0.09, 0.09); cam.setFollowOffset(0, 40); cam.setBackgroundColor('#0B0C0F');
      try{ cam.filters.internal.addVignette(0.5,0.5,0.92,0.45); }catch(e){ try{ cam.enableFilters().filters.internal.addVignette(0.5,0.5,0.92,0.45); }catch(e2){} }
      setupPhase(A.stages[0]); Object.keys(rig.hits).forEach(function(k){ rig.hits[k].setVisible(false); });
      el.loading.classList.add('is-off');
      overlay('<div class="ov__k">던전 01</div><div class="ov__t">'+L.name+'</div><div class="ov__l">'+L.place+'</div><div class="ov__line">마태오 — “뒷마당에 허수아비를 묶어 뒀다. 살아 있는 것처럼 굴 테니, 살아 있는 것처럼 상대해라.”</div><div class="ov__hint">문을 지나면 전투가 시작된다. 붉은 범위 밖으로 구르고, 고리가 흰색일 때 붙어서 쳐라.</div><button class="btn btn--primary" data-go>입장</button>'+
        '<div class="ov__ctrl">폰: 왼쪽 스틱 이동 · 오른쪽 큰 버튼 공격(길게 방어) · 회피 · 기술 1~4 · R<br>키보드: WASD 이동 · J 공격 · K 회피 · L 방어 · 1~4 · R · Q 조준 전환</div>', function(){});
    },
    update:function(t, dms){ var dt=Math.min(0.1, dms/1000); if(paused||el.ov.classList.contains('is-on')) return; step(dt); render(dt); }
  });

  /* ---------- 아인 리그 ---------- */
  function buildAin(sc){
    var root=sc.add.container(P.x, P.y*DEPTH); var views={}, SCALE=176/932;
    Object.keys(AIN).forEach(function(v){ var def=AIN[v], vc=sc.add.container(-def.w/2*SCALE, -def.h*SCALE); vc.setScale(SCALE); var cont={}, byId={}; def.parts.forEach(function(p){ byId[p.id]=p; });
      def.parts.slice().sort(function(a,b){ return a.z-b.z; }).forEach(function(p){ var c=sc.add.container(p.px,p.py); var im=sc.add.image(p.x-p.px, p.y-p.py, 'ain-'+v+'-'+p.id).setOrigin(0,0); try{ im.setLighting(true); }catch(e){} c.add(im); cont[p.id]=c; c._p=p; });
      def.parts.slice().sort(function(a,b){ return a.z-b.z; }).forEach(function(p){ if(p.parent){ cont[p.id].setPosition(p.px-byId[p.parent].px, p.py-byId[p.parent].py); cont[p.parent].add(cont[p.id]); } else vc.add(cont[p.id]); });
      vc.setVisible(false); root.add(vc); views[v]={c:vc, parts:cont}; });
    var shadow=sc.add.ellipse(P.x, P.y*DEPTH, 60, 14, 0x000000, 0.5).setDepth(P.y*DEPTH-0.5);
    var swing=sc.add.graphics().setDepth(9500).setVisible(false);
    return { root:root, views:views, shadow:shadow, swing:swing, cur:'', walkT:0, rollT:0, hitT:0 };
  }
  function ainRender(dt){
    var v=P.face==='left'||P.face==='right' ? 'side' : P.face==='up' ? 'back' : 'front';
    if(ain.cur!==v){ ain.cur=v; Object.keys(ain.views).forEach(function(k){ ain.views[k].c.setVisible(k===v); }); }
    ain.root.setScale(P.face==='left'?-1:1, 1);
    var moving=P.moving && P.rollT<=0, view=ain.views[v];
    if(moving) ain.walkT+=dt*9; else ain.walkT+=(Math.round(ain.walkT/Math.PI)*Math.PI-ain.walkT)*Math.min(1,dt*12);
    var s=Math.sin(ain.walkT), amp=moving?1:0.15, bob=moving?Math.abs(Math.cos(ain.walkT))*5:0;
    var ps=view.parts;
    if(v==='side'){ ps.legF.setAngle(s*22*amp); ps.legB.setAngle(-s*22*amp); ps.arm.setAngle(-s*16*amp); ps.torso.setAngle(moving?4:0); }
    else { ps.legL.setAngle(s*14*amp); ps.legR.setAngle(-s*14*amp); ps.armL.setAngle(-s*12*amp); ps.armR.setAngle(s*12*amp); ps.torso.setAngle(s*1.5*amp); }
    var roll=P.rollT>0 ? (1-P.rollT/L.player.rollDur) : 0; var rollY = roll>0 ? -Math.sin(roll*Math.PI)*24 : 0;
    view.c.setPosition(-AIN[v].w/2*(176/932), -AIN[v].h*(176/932)-bob+rollY); view.c.setAngle(roll>0 ? Math.sin(roll*Math.PI)*(P.face==='left'?12:-12) : 0);
    ain.root.setPosition(P.x, P.y*DEPTH).setDepth(P.y*DEPTH); ain.shadow.setPosition(P.x, P.y*DEPTH).setDepth(P.y*DEPTH-0.5); ain.shadow.setScale(1-roll*0.3, 1);
    if(ain.hitT>0){ ain.hitT-=dt; Object.keys(ps).forEach(function(k){ ps[k].list[0].setTint(0xFF6A5A); }); } else Object.keys(ps).forEach(function(k){ ps[k].list[0].clearTint(); });
    lights.player.setPosition(P.x, P.y*DEPTH-50);
  }
  function swingFx(){ var g=ain.swing; g.clear(); g.setVisible(true); var a=P.aim; g.lineStyle(4,0xF0E4E4,0.9); g.beginPath(); g.arc(P.x, P.y*DEPTH-70, 70, a-0.9, a+0.9, false); g.strokePath(); g.setAlpha(1); scene.tweens.add({ targets:g, alpha:0, duration:200, onComplete:function(){ g.setVisible(false); } }); }

  /* ---------- 허수아비 페이즈 ---------- */
  function setupPhase(d){
    var tint={dormant:0x9a9a9a, chained:0xc8c0c0, awake:0xffffff}[d.kind]||0xffffff; RIGDEF.parts.forEach(function(p){ rig.part(p.id).list[0].setTint(tint); });
    Object.keys(rig.hits).forEach(function(k){ rig.hits[k].setVisible(false); rig.hits[k]._state={}; rig.hits[k].removeAllListeners(); rig.hits[k].disableInteractive && rig.hits[k].disableInteractive(); });
    d.parts.forEach(function(p){ var h=rig.hits[HITMAP[p.id]]; if(!h) return; h.setVisible(true); rig.drawHit(HITMAP[p.id], { weak:!!p.weak, brk:!!p.breakable, hp:p.hp?1:null, target:false });
      h.setSize(h._r*2, h._r*2); h.setInteractive(new Phaser.Geom.Circle(0,0,h._r+10), Phaser.Geom.Circle.Contains); h.on('pointerdown', function(ptr, lx, ly, ev){ ev&&ev.stopPropagation&&ev.stopPropagation(); if(!battle) return; battle.input('target', p.id); guide('조준: <b>'+p.name+'</b>', 1.2); }); });
    var g={dormant:0.35, chained:0.6, awake:1}[d.kind]||1; rig.glow('core', g); rig.glow('eyeL', g); rig.glow('eyeR', g); if(coreLight) coreLight.intensity=0.5+g*1.2;
  }
  function startPhase(i){ phase=i; var d=A.stages[i]; setupPhase(d);
    battle=CB.createBattle({ char:CHAR, dummy:d, rules:R, skills:SK, ult:ULT, seed:Date.now()&0xffff, hooks:hooks });
    el.name.textContent=d.name+' 「'+d.lesson+'」'; el.ph.textContent='PHASE '+(i+1)+' / '+A.stages.length; guide(L.beats.phase[i], 4); }
  var hooks={ canHit:function(){ return Bs.dist<=L.player.reach; }, canCounter:function(){ return Bs.dist<=L.player.reachCounter; }, canStart:function(){ return Bs.dist<=L.ai[phase].start; },
    pick:function(pats, i){ if(L.ai[phase].pick!=='range') return pats[i%pats.length]; if(Bs.dist<170) return pats[1]; return i%2 ? pats[2] : pats[0]; }, inZone:function(pat){ return zone ? world.inZone(zone, P.x, P.y) : true; } };

  /* ---------- 피드백 ---------- */
  function num(wx,wy,text,cls){ var cam=scene.cameras.main; var sx=(wx-cam.worldView.x)*cam.zoom, sy=(wy-cam.worldView.y)*cam.zoom; var d=document.createElement('div'); d.className='dmgnum '+(cls||''); d.style.left=sx+'px'; d.style.top=sy+'px'; d.textContent=text; el.dg.appendChild(d); setTimeout(function(){ d.remove(); }, 950); }
  function guide(html, sec){ el.guide.innerHTML=html; el.guide.classList.add('is-on'); guideT=sec||3; }
  function banner(lb, v, sub, perfect){ el.cLb.textContent=lb; el.cV.textContent=W.fmt(v); el.cSub.textContent=sub||''; el.counter.classList.toggle('perfect',!!perfect); el.counter.classList.add('is-on'); counterT=1.3; }
  function flash(){ el.flash.classList.remove('is-on'); void el.flash.offsetWidth; el.flash.classList.add('is-on'); }
  function vib(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
  function shake(i, d){ scene.cameras.main.shake(d||200, i||0.004); }
  function burst(x,y,n,tint){ sparks.setPosition(x,y); if(tint) sparks.setParticleTint(tint); sparks.explode(n||14); }
  function handle(e){
    var s=battle?battle.snapshot():null;
    switch(e.t){
      case 'hit': var hp=rig.hitPos(HITMAP[e.part]||'body'); num(hp.x+(Math.random()*40-20), hp.y-10, W.fmt(e.dmg), e.counter?'counter':e.crit?'crit':''); rig.flash(); burst(hp.x, hp.y, e.counter?36:e.crit?22:12); if(!e.counter && s.enemy.state!=='downed') rig.play('flinch'); if(e.counter){ flash(); vib(40); shake(0.01,260); scene.cameras.main.zoomTo(ZOOM*1.06,120,'Quad.easeOut',true,function(c,p){ if(p===1) scene.cameras.main.zoomTo(ZOOM,260); }); } else shake(0.003,90); break;
      case 'attack': swingFx(); break;
      case 'whiff': swingFx(); num(P.x, P.y*DEPTH-150, e.ult?'사거리 밖':'닿지 않는다', 'miss'); break;
      case 'counter': banner(e.perfect?'P E R F E C T':'C O U N T E R', lastHit, e.pattern+(e.perfect?' · 완벽한 타이밍':' · 카운터 성공'), e.perfect); rig.stopAll('tele_'); rig.play('stagger'); zone=null; break;
      case 'break': var bp=rig.hitPos(HITMAP[e.part]); num(bp.x, bp.y-30, '부위 파괴 — '+e.name, 'crit'); burst(bp.x, bp.y, 40, 0x7B9BD6); vib([30,40,30]); guide('<b>'+e.name+'</b> 파괴. 자세가 무너진다', 2.5); if(ENGINE2RIG[e.part]) rig.detach(ENGINE2RIG[e.part]); var hb=rig.hits[HITMAP[e.part]]; if(hb) hb.setVisible(false); rig.play('stagger'); shake(0.008,300); break;
      case 'downed': guide('<b>격추!</b> 5초 동안 모든 피해 1.5배', 3); rig.stop('stagger'); rig.play('down'); zone=null; shake(0.012,400); break;
      case 'up': guide('허수아비가 자세를 되찾았다', 1.5); rig.stop('down'); rig.play('up'); break;
      case 'telegraph': zone=world.makeZone({ zone:L.zones[e.pattern] }, Bs.x, Bs.y, P.x, P.y); zone.pattern=e.pattern; rig.play('tele_'+e.icon, { dur:e.dur, hold:true }); if(phase===2 && !seen.tele3){ seen.tele3=1; guide('붉은 범위 안에 있으면 맞는다 · 고리가 <b>흰색</b>일 때 붙어서 탭 = 카운터', 3.5); } if(phase===1 && !seen.tele2){ seen.tele2=1; guide('붉은 범위 <b>밖으로 구르면</b> 피한다', 3); } break;
      case 'swing': rig.stop('tele_'+s.enemy.patIcon); rig.play('hit_'+s.enemy.patIcon); shake(0.009,220); setTimeout(function(){ zone=null; }, 180); break;
      case 'miss': num(P.x, P.y*DEPTH-150, e.out?'범위 밖':'회피', 'miss'); break;
      case 'damaged': num(P.x, P.y*DEPTH-150, '-'+W.fmt(e.dmg)+(e.guarded?' 방어':''), 'taken'); ain.hitT=0.18; burst(P.x, P.y*DEPTH-80, 16, 0xD94A45); vib(e.guarded?15:60); shake(e.guarded?0.004:0.012, 300); break;
      case 'early': guide('너무 빨랐다. 예고가 <b>끝나는 순간</b>에 쳐라', 1.6); break;
      case 'ultready': if(e.first) guide('궁극기 준비 완료 — <b>R</b> 을 눌러라', 3.5); break;
      case 'ult': banner('T W I L I G H T', lastHit, ULT.name+' · 출혈 3중첩', true); flash(); vib([50,30,80]); shake(0.02,500); burst(Bs.x, Bs.y*DEPTH-150, 60, 0xD94A45); break;
      case 'skill': var k=SK[e.index]; if(k.mult===0) guide('<b>'+k.name+'</b> — '+k.desc, 1.4); if(k.dodge) doRoll(); else if(k.mult>0) swingFx(); break;
      case 'nost': guide('스태미나 부족', 1); break;
      case 'guard': if(e.broke) guide('스태미나 소진 — 방어 해제', 1.5); break;
      case 'dodge': doRoll(); break;
      case 'death': guide('마태오 — “다시.”', 2); break;
      case 'clear': phaseClear(); break;
    }
  }
  function doRoll(){ world.roll(P, stick.sx, stick.sy, L.player.rollLen, L.player.rollDur); }

  /* ---------- 흐름 ---------- */
  function overlay(html, onBtn){ el.ovBox.innerHTML=html; el.ov.classList.add('is-on'); var b=el.ovBox.querySelector('[data-go]'); if(b) b.addEventListener('click', function(){ el.ov.classList.remove('is-on'); onBtn&&onBtn(); }); }
  function startFight(){ state='fight'; world.setSolid(gate.cx, gate.cy, true); gateClosed=true; P.x=Math.max(P.x, (gate.cx+1)*map.cell + P.r + 6); gateImg.setVisible(true); gateImg.setAlpha(0); scene.tweens.add({ targets:gateImg, alpha:1, duration:400 });
    el.bosshp.classList.remove('is-off'); el.timerBox.classList.remove('is-off'); fightT=0; guide(L.beats.gate, 3); rig.play('stagger'); vib([40,60,40]); shake(0.01,500); setTimeout(function(){ startPhase(0); }, 1800); }
  function phaseClear(){ var m=Object.assign({}, battle.metrics); stageResults.push(m); rig.stopAll(); zone=null;
    if (phase < A.stages.length-1){ var next=phase+1; battle=null; rig.play('stagger'); flash(); vib([30,30,60]); burst(Bs.x, Bs.y*DEPTH-170, 50, next===1?0xC9A45E:0xD94A45); num(Bs.x, Bs.y*DEPTH-240, next===1?'사슬이 끊어진다':'핵이 타오른다', 'counter'); setTimeout(function(){ startPhase(next); }, 1400); }
    else { battle=null; state='clear'; rig.play('collapse'); el.timerBox.classList.add('is-off'); var sum=CB.summarize(R, A, stageResults); scene.cameras.main.zoomTo(ZOOM*1.15, 1400);
      setTimeout(function(){ overlay('<div class="ov__k">던전 클리어</div><div class="ov__t">'+L.name+'</div><div class="ov__l">'+A.stages[A.stages.length-1].name+' 격파</div>'+
        '<div class="ov__stats"><div>등급<b class="g-'+sum.rank+'">'+sum.rank+'</b></div><div>시간<b>'+sum.op.time+'</b></div><div>카운터<b>'+sum.op.counterRate+'</b></div><div>부위 파괴<b>'+sum.breaks+'/'+sum.breakable+'</b></div><div>받은 피해<b>'+sum.op.dmgTaken+'</b></div></div>'+
        '<button class="btn btn--primary" data-go>정산으로</button>', function(){ finish(sum); }); }, 1800); } }
  function finish(sum){ var T=window.TW_ITEMS; sum.mats=sum.mats.map(function(m){ var it=T.get(m[0]); return [m[0], m[1], it?it.rarity:'common']; });
    var res={ arena:A.id, at:new Date().toISOString(), op:sum.op, mastery:sum.mastery, gold:sum.gold, mats:sum.mats, rank:sum.rank, time:sum.time, counterRate:sum.counterRate, perfect:sum.perfect, dmgTaken:sum.dmgTaken, breaks:sum.breaks, breakable:sum.breakable,
      meta:[ ['작전 모드','던전 01'], ['난이도','튜토리얼 · '+L.place], ['작전 시간', new Date().toLocaleString('ko-KR',{hour12:false})] ],
      praise:{S:'완벽한 타이밍이었다.<br>마태오가 고개를 끄덕인다.<br>의뢰 목록이 열렸다.',A:'날카롭다. 아직 성급한 칼이 몇 번 있었다.<br>의뢰 목록이 열렸다.',B:'기본은 됐다. 예고를 더 오래 봐라.<br>의뢰 목록이 열렸다.',C:'살아남긴 했다. 다시 와라.<br>의뢰 목록이 열렸다.'}[sum.rank] };
    try{ sessionStorage.setItem('tw:result', JSON.stringify(res)); var key='tw:arena:'+A.id, prev=JSON.parse(localStorage.getItem(key)||'null'), order='SABC';
      if(!prev || order.indexOf(sum.rank)<order.indexOf(prev.rank) || (sum.rank===prev.rank && sum.time<prev.time)) localStorage.setItem(key, JSON.stringify({ rank:sum.rank, time:sum.time, counterRate:sum.counterRate, cleared:true, at:res.at })); else { prev.cleared=true; localStorage.setItem(key, JSON.stringify(prev)); } }catch(e){}
    location.href='result.html'; }

  /* ---------- 입력 ---------- */
  el.stickEl.addEventListener('pointerdown', function(e){ e.preventDefault(); stick.id=e.pointerId; var r=el.stickEl.getBoundingClientRect(); stick.ox=r.left+r.width/2; stick.oy=r.top+r.height/2; el.stickEl.setPointerCapture(e.pointerId); stickMove(e); });
  function stickMove(e){ if(stick.id!==e.pointerId) return; var dx=e.clientX-stick.ox, dy=e.clientY-stick.oy, m=Math.hypot(dx,dy), R0=44; if(m>R0){ dx=dx/m*R0; dy=dy/m*R0; } stick.sx=dx/R0; stick.sy=dy/R0; el.stickEl.querySelector('i').style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))'; }
  el.stickEl.addEventListener('pointermove', stickMove);
  function stickUp(e){ if(stick.id!==e.pointerId) return; stick.id=null; stick.sx=stick.sy=0; el.stickEl.querySelector('i').style.transform='translate(-50%,-50%)'; }
  el.stickEl.addEventListener('pointerup', stickUp); el.stickEl.addEventListener('pointercancel', stickUp);
  function attack(){ if(paused) return; if(battle){ if(Bs.dist<=L.player.reach*1.2) world.faceTo(P, Bs.x, Bs.y); battle.input('attack'); } else swingFx(); }
  function dodge(){ if(paused) return; if(battle) battle.input('dodge'); else if(P.rollT<=0) doRoll(); }
  el.actions.addEventListener('pointerdown', function(e){ e.preventDefault(); e.stopPropagation(); var t=e.target.closest('.abtn'); if(!t||paused) return;
    if(t.hasAttribute('data-atk')){ attack(); holdTimer=setTimeout(function(){ guarding=true; battle&&battle.input('guard', true); }, R.guard.holdMs); }
    else if(t.hasAttribute('data-dodge')) dodge(); else if(t.hasAttribute('data-ult')) battle&&battle.input('ult'); else if(t.hasAttribute('data-skill')) battle&&battle.input('skill', +t.getAttribute('data-skill')); });
  function atkUp(){ if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; } if(guarding){ guarding=false; battle&&battle.input('guard', false); } }
  el.actions.addEventListener('pointerup', atkUp); el.actions.addEventListener('pointercancel', atkUp); el.actions.addEventListener('pointerleave', atkUp);
  document.addEventListener('keydown', function(e){ if(kd[e.code]) return; kd[e.code]=true; if(paused) return;
    if(e.code==='Space'||e.code==='KeyJ'){ e.preventDefault(); attack(); } else if(e.code==='KeyK') dodge(); else if(e.code==='KeyL') battle&&battle.input('guard', true);
    else if(e.code==='KeyR') battle&&battle.input('ult'); else if(/^Digit[1-4]$/.test(e.code)) battle&&battle.input('skill', +e.code.slice(5)-1);
    else if((e.code==='KeyQ'||e.code==='Tab')&&battle){ e.preventDefault(); var s=battle.snapshot(), ids=s.enemy.parts.map(function(p){return p.id;}), i=ids.indexOf(s.target); battle.input('target', ids[(i+1)%ids.length]); } });
  document.addEventListener('keyup', function(e){ kd[e.code]=false; if(e.code==='KeyL'&&battle) battle.input('guard', false); });
  function keyStick(){ var x=(kd.KeyD||kd.ArrowRight?1:0)-(kd.KeyA||kd.ArrowLeft?1:0), y=(kd.KeyS||kd.ArrowDown?1:0)-(kd.KeyW||kd.ArrowUp?1:0); if(x||y){ var m=Math.hypot(x,y); return {sx:x/m, sy:y/m}; } return null; }
  $('#btn-pause').addEventListener('click', function(){ paused=!paused; if(paused) overlay('<div class="ov__k">일시정지</div><div class="ov__t">'+L.name+'</div><div class="ov__hint" style="margin-top:12px">'+(battle?A.stages[phase].hint:L.beats.start)+'</div><button class="btn btn--primary" data-go>계속</button> <a class="btn" href="office.html" style="margin-left:8px">사무실로</a>', function(){ paused=false; }); });

  /* ---------- 스텝 · 렌더 ---------- */
  function step(dt){
    var ks=keyStick(); var sx=ks?ks.sx:stick.sx, sy=ks?ks.sy:stick.sy;
    var s=battle?battle.snapshot():null; P.lockT=(s&&(s.player.guard||s.player.locked))?1:0;
    world.movePlayer(P, sx, sy, dt, L.player.speed);
    if(state==='explore'){ if(!seen.start){ seen.start=1; guide(L.beats.start, 4); } if(!seen.sign && world.dist(P.x,P.y,sign.x,sign.y)<110){ seen.sign=1; guide(L.beats.sign, 4); } if(Math.floor(P.x/map.cell)>=L.bossRoom.minCx && P.x>gate.x+map.cell*0.6) startFight(); }
    if(battle){ var busy=s.enemy.state!=='idle'; world.bossThink(Bs, P, dt, L.ai[phase], busy); acc+=dt; var n=0; while(acc>=R.tick && n<6){ battle.tick(R.tick); acc-=R.tick; n++; } fightT+=dt; battle.drain().forEach(function(e){ if(e.t==='hit') lastHit=e.dmg; handle(e); }); }
    else Bs.dist=world.dist(Bs.x,Bs.y,P.x,P.y);
    if(guideT>0){ guideT-=dt; if(guideT<=0) el.guide.classList.remove('is-on'); } if(counterT>0){ counterT-=dt; if(counterT<=0) el.counter.classList.remove('is-on'); }
    rig.tick(dt);
  }
  function fill(id, pct){ var b=$('#'+id), f=b&&b.querySelector('.bar__fill'); if(f){ f.style.transition='none'; f.style.width=Math.max(0,Math.min(100,pct))+'%'; } }
  var flickT=0;
  function render(dt){
    ainRender(dt);
    rig.root.setPosition(Bs.x, Bs.y*DEPTH).setDepth(Bs.y*DEPTH); rig.root.setScale(0.42*(Bs.faceX<0?-1:1), 0.42); rig.shadow.setPosition(Bs.x, Bs.y*DEPTH).setDepth(Bs.y*DEPTH-0.5); coreLight.setPosition(Bs.x, Bs.y*DEPTH-170);
    flickT+=dt; torchLights.forEach(function(t,i){ var f=0.85+Math.sin(flickT*9+i*1.7)*0.08+Math.random()*0.1; t.l.intensity=t.base*f; if(t.fx) t.fx.setAlpha(0.45*f).setScale(0.95+f*0.1); });
    /* 존 */
    zoneG.clear();
    if(zone && battle){ var s=battle.snapshot(), win=s.enemy.state==='telegraph'&&s.enemy.tele<=s.enemy.window, col=win?0xF0E4E4:0xC7332C, fr=s.enemy.state==='telegraph'?1-s.enemy.tele/s.enemy.teleDur:1;
      zoneG.fillStyle(col,0.16); zoneG.lineStyle(3,col,0.9);
      if(zone.kind==='circle'){ zoneG.fillEllipse(zone.x, zone.y*DEPTH, zone.r*2, zone.r*2*DEPTH); zoneG.strokeEllipse(zone.x, zone.y*DEPTH, zone.r*2, zone.r*2*DEPTH); zoneG.fillStyle(col,0.22); zoneG.fillEllipse(zone.x, zone.y*DEPTH, zone.r*2*fr, zone.r*2*fr*DEPTH); }
      else { var ca=Math.cos(zone.a), sa=Math.sin(zone.a)*DEPTH, hw=zone.w/2, px=-sa/DEPTH*hw, py=ca*hw*DEPTH; var x0=zone.x-ca*20, y0=zone.y*DEPTH-sa*20, x1=zone.x+ca*zone.len, y1=zone.y*DEPTH+sa*zone.len;
        zoneG.fillPoints([{x:x0+px,y:y0+py},{x:x1+px,y:y1+py},{x:x1-px,y:y1-py},{x:x0-px,y:y0-py}], true); zoneG.strokePoints([{x:x0+px,y:y0+py},{x:x1+px,y:y1+py},{x:x1-px,y:y1-py},{x:x0-px,y:y0-py}], true);
        var xf=x0+(x1-x0)*fr, yf=y0+(y1-y0)*fr; zoneG.fillStyle(col,0.22); zoneG.fillPoints([{x:x0+px,y:y0+py},{x:xf+px,y:yf+py},{x:xf-px,y:yf-py},{x:x0-px,y:y0-py}], true); } }
    reachG.clear(); if(battle){ reachG.lineStyle(1.5, Bs.dist<=L.player.reach?0xC9A45E:0xFFFFFF, Bs.dist<=L.player.reach?0.5:0.12); reachG.strokeEllipse(P.x, P.y*DEPTH, L.player.reach*2, L.player.reach*2*DEPTH); }
    drawMini();
    if(!battle) return;
    var s2=battle.snapshot();
    fill('b-hp', s2.enemy.hp/s2.enemy.hpMax*100); el.stack.textContent=s2.enemy.bleed?'출혈 ×'+s2.enemy.bleed:'';
    var segs=el.seg.children, on=Math.round(s2.enemy.posture/20); for(var i=0;i<5;i++) segs[i].className=(s2.enemy.state==='downed'||i<on)?'':'off';
    el.timer.textContent=CB.fmtTime(fightT);
    fill('v-hp', s2.player.hp/s2.player.hpMax*100); $('#v-hpv').textContent=W.fmt(Math.round(s2.player.hp))+' / '+W.fmt(s2.player.hpMax);
    fill('v-st', s2.player.st/s2.player.stMax*100); $('#v-stv').textContent=Math.round(s2.player.st)+' / '+s2.player.stMax;
    fill('v-ult', s2.player.ult); $('#v-ultv').textContent=Math.round(s2.player.ult)+'%';
    fill('p-bar', s2.player.hp/s2.player.hpMax*100); $('#p-hp').textContent=W.fmt(Math.round(s2.player.hp));
    s2.enemy.parts.forEach(function(p){ var k=HITMAP[p.id]; if(!rig.hits[k]) return; rig.drawHit(k, { target:p.id===s2.target, hp:p.hpMax?p.hp/p.hpMax:null }); });
    if(s2.enemy.state==='downed') rig.glow('core', 1.4);
    var sks=el.actions.querySelectorAll('[data-skill]'); s2.player.cds.forEach(function(cd,i){ var k=sks[i], o=k.querySelector('.sk__cd'); if(cd>0){ o.hidden=false; o.textContent=Math.ceil(cd); k.classList.remove('is-ready'); } else { o.hidden=true; k.classList.toggle('is-ready', s2.player.st>=SK[i].st); } });
    el.actions.querySelector('[data-ult]').classList.toggle('is-ready', s2.player.ult>=R.ult.max); el.actions.querySelector('[data-atk]').classList.toggle('is-ready', Bs.dist<=L.player.reach);
    var lines=[]; if(s2.enemy.bleed) lines.push(['drop','#C9534E','출혈','×'+s2.enemy.bleed]); if(s2.enemy.state==='downed') lines.push(['x','#C9A45E','격추',Math.ceil(s2.enemy.downT)+'s']); if(s2.player.guard) lines.push(['shield','#7B9BD6','방어 중','']); if(s2.player.buffT>0) lines.push(['shield','#5FAE9B','결의',Math.ceil(s2.player.buffT)+'s']); if(s2.player.critNext) lines.push(['bolt','#C9A45E','치명타 확정','']); if(s2.player.locked) lines.push(['x','#8A8A8A','경직','']);
    el.status.innerHTML=lines.map(function(l){ return '<div class="stline"><svg class="ico ico--xs" style="color:'+l[1]+'"><use href="#i-'+l[0]+'"/></svg>'+l[2]+'<b>'+l[3]+'</b></div>'; }).join('');
  }
  function drawMini(){ var c=el.mini, w=c.width, h=c.height; mctx.clearRect(0,0,w,h); var sx=w/map.w, sy=h/map.h;
    for(var y=0;y<map.h;y++) for(var x=0;x<map.w;x++){ var ch=map.rows[y][x]; if(ch==='#'||ch==='|'||(ch==='G'&&gateClosed)){ mctx.fillStyle='#3a3d45'; mctx.fillRect(x*sx,y*sy,sx,sy); } else if(ch==='G'){ mctx.fillStyle='#C9A45E'; mctx.fillRect(x*sx,y*sy,sx,sy); } }
    mctx.fillStyle='#D9544E'; mctx.beginPath(); mctx.arc(Bs.x/map.cell*sx, Bs.y/map.cell*sy, 4, 0, Math.PI*2); mctx.fill(); mctx.fillStyle='#F0E4E4'; mctx.beginPath(); mctx.arc(P.x/map.cell*sx, P.y/map.cell*sy, 3.5, 0, Math.PI*2); mctx.fill(); }

  /* ---------- 게임 생성 ---------- */
  var game=new Phaser.Game({ type:Phaser.WEBGL, parent:'game', backgroundColor:'#0B0C0F', scale:{ mode:Phaser.Scale.RESIZE, autoCenter:Phaser.Scale.NO_CENTER, width:'100%', height:'100%' }, render:{ antialias:true, roundPixels:false, powerPreference:'high-performance' }, input:{ activePointers:3 }, scene:[Boot, Dungeon] });
  window.TW_DUNGEON={ world:world, get battle(){ return battle; }, P:P, B:Bs, get state(){ return state; }, get phase(){ return phase; }, stick:stick, game:game, get scene(){ return scene; }, start:function(){ var b=el.ovBox.querySelector('[data-go]'); if(b) b.click(); } };
})();
