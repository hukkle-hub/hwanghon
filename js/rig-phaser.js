/* 황혼 — 리그 데이터(TW_DUMMY_RIG 형식)를 Phaser 4 컨테이너 계층으로 올리는 렌더러/애니메이터
   var rig = TW_RIG_PHASER.mount(scene, RIG, { x, y, scale, texPrefix })
   rig.play(name, {dur, hold, then, fade}) · rig.stop(name) · rig.tick(dt) · rig.detach(partId) · rig.glow(id, v) · rig.flash()
   rig.root : Phaser.GameObjects.Container (발 위치 기준) · rig.part(id) : 파츠 컨테이너 · rig.hitPos(id) : 월드 좌표 */
(function(){
  function ease(t, k){ return k==='in' ? t*t : k==='out' ? 1-(1-t)*(1-t) : t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
  function mount(scene, R, o){
    o=o||{}; var S=o.scale||1, pre=o.texPrefix||'dummy-';
    var root=scene.add.container(o.x||0, o.y||0); root.setScale(S);
    var body=scene.add.container(-R.w/2, -R.h); root.add(body);       /* 발(하단 중앙)이 원점 */
    var byId={}, cont={}, imgs={}, glows={}, hits={};
    R.parts.forEach(function(p){ byId[p.id]=p; });
    var order=R.parts.slice().sort(function(a,b){ return a.z-b.z; });
    order.forEach(function(p){
      /* 컨테이너 원점 = 피벗. 이미지는 피벗 기준 상대 위치 */
      var c=scene.add.container(p.px, p.py); var im=scene.add.image(p.x-p.px, p.y-p.py, pre+p.id).setOrigin(0,0); c.add(im); cont[p.id]=c; imgs[p.id]=im; c._p=p;
    });
    order.forEach(function(p){ var host=p.parent ? cont[p.parent] : body; if(p.parent){ /* 부모 피벗 기준 상대 좌표 */ cont[p.id].setPosition(p.px-byId[p.parent].px, p.py-byId[p.parent].py); } host.add(cont[p.id]); });
    Object.keys(R.glow||{}).forEach(function(k){ var g=R.glow[k], par=byId[g.parent]; var im=scene.add.image(g.cx-par.px, g.cy-par.py, k==='core'?'fx-glow':'fx-glow').setBlendMode(Phaser.BlendModes.ADD); im.setDisplaySize(g.r*2.6, g.r*2.6); im.setTint(0xE8502E); cont[g.parent].add(im); glows[k]=im; });
    Object.keys(R.hits||{}).forEach(function(k){ var h=R.hits[k], par=byId[h.parent]; var gfx=scene.add.container(h.cx-par.px, h.cy-par.py); var ring=scene.add.graphics(); var lb=scene.add.text(0,-h.r-14,h.label,{fontFamily:'Noto Sans KR',fontSize:'24px',color:'#ffffff',stroke:'#000',strokeThickness:4}).setOrigin(0.5,1); gfx.add([ring,lb]); gfx.setVisible(false); gfx._ring=ring; gfx._r=h.r; gfx._state={}; cont[h.parent].add(gfx); hits[k]=gfx; });
    function drawHit(k, st){ var g=hits[k]; if(!g) return; var s=Object.assign(g._state, st||{}); var ring=g._ring; ring.clear();
      var col=s.target?0xC9A45E:s.weak?0xD93A36:s.brk?0x7B9BD6:0xFFFFFF, a=s.target?1:0.55; ring.lineStyle(s.target?5:3, col, a); ring.strokeCircle(0,0,g._r);
      if(s.hp!=null && s.hp<1){ ring.lineStyle(4,0x7B9BD6,0.9); ring.beginPath(); ring.arc(0,0,g._r+5,-Math.PI/2,-Math.PI/2+Math.PI*2*s.hp,false); ring.strokePath(); }
      g.list[1].setColor(s.target?'#C9A45E':'#ffffff'); }
    /* ---------- 애니메이션 (rig.js 와 동일 로직) ---------- */
    var layers=[], idle=R.clips.idle, idleT=0;
    function sample(clip, t, scale){ var keys=clip.keys, dur=keys[keys.length-1].t*(scale||1); if (clip.loop) t=t%dur; var tt=t/(scale||1);
      if (tt>=keys[keys.length-1].t) return { pose:keys[keys.length-1].pose, root:keys[keys.length-1].root||{}, done:!clip.loop };
      var i=1; while(keys[i].t<tt) i++; var a=keys[i-1], b=keys[i], f=ease((tt-a.t)/(b.t-a.t), b.ease);
      var pose={}; Object.keys(a.pose).concat(Object.keys(b.pose)).forEach(function(id){ var va=a.pose[id]||0, vb=b.pose[id]||0; pose[id]=va+(vb-va)*f; });
      var ra=a.root||{}, rb=b.root||{}, rt={}; ['dx','dy','s'].forEach(function(k){ var d=k==='s'?1:0; var va=ra[k]==null?d:ra[k], vb=rb[k]==null?d:rb[k]; rt[k]=va+(vb-va)*f; }); return { pose:pose, root:rt, done:false }; }
    var api={ root:root, hits:hits, drawHit:drawHit };
    api.play=function(name, opt){ opt=opt||{}; var clip=R.clips[name]; if(!clip) return; var sc=opt.dur ? opt.dur/clip.keys[clip.keys.length-1].t : 1; layers=layers.filter(function(L){ return L.name!==name; }); layers.push({ name:name, clip:clip, t:0, scale:sc, then:opt.then, hold:clip.hold||opt.hold, w:0, fade:opt.fade==null?0.12:opt.fade }); };
    api.stop=function(name){ layers=layers.filter(function(L){ return L.name!==name; }); };
    api.stopAll=function(pre){ layers=layers.filter(function(L){ return pre ? L.name.indexOf(pre)!==0 : false; }); };
    api.tick=function(dt){ idleT+=dt; var base=sample(idle, idleT); var pose={}, rt={dx:base.root.dx,dy:base.root.dy,s:base.root.s}; for(var k in base.pose) pose[k]=base.pose[k]; var keep=[];
      layers.forEach(function(L){ L.t+=dt; L.w=Math.min(1, L.w+dt/Math.max(0.001,L.fade)); var s=sample(L.clip, L.t, L.scale); for(var id in s.pose) pose[id]=(pose[id]||0)*(1-L.w)+s.pose[id]*L.w; ['dx','dy','s'].forEach(function(key){ var d=key==='s'?1:0; var v=s.root[key]==null?d:s.root[key]; rt[key]=rt[key]*(1-L.w)+v*L.w; }); if (s.done && !L.hold){ if(L.then) L.then(); } else keep.push(L); });
      layers=keep; R.parts.forEach(function(p){ cont[p.id].setAngle(pose[p.id]||0); }); body.setPosition(-R.w/2+(rt.dx||0), -R.h+(rt.dy||0)); body.setScale(rt.s||1); };
    api.part=function(id){ return cont[id]; };
    api.glow=function(id, v){ var g=glows[id]; if(!g) return; g.setAlpha(Math.min(1,v*0.9)); g.setScale((0.6+v*0.8)); };
    api.detach=function(id){ var c=cont[id]; if(!c||c._gone) return; c._gone=true; scene.tweens.add({ targets:c, y:c.y+260, angle:-40, alpha:0, duration:900, ease:'Quad.easeIn', onComplete:function(){ c.setVisible(false); } }); };
    api.flash=function(){ R.parts.forEach(function(p){ imgs[p.id].setTintFill(0xFFE0D0); }); scene.time.delayedCall(70, function(){ R.parts.forEach(function(p){ imgs[p.id].clearTint(); }); }); };
    api.hitPos=function(k){ var g=hits[k]; if(!g) return {x:root.x, y:root.y-150}; var m=g.getWorldTransformMatrix(); return { x:m.tx, y:m.ty }; };
    api.tick(0); return api;
  }
  window.TW_RIG_PHASER={ mount:mount };
})();
