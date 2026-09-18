/* 황혼 — 2D 컷아웃 스켈레탈 리그 렌더러/애니메이터 (SVG)
   var rig = TW_RIG.mount(svgEl, TW_DUMMY_RIG, { scale })
   rig.play(name, { dur, then, fade })   클립 재생 (dur 를 주면 그 길이로 늘려 재생)
   rig.stop(name)                         hold 클립 해제
   rig.tick(dt)                           매 프레임 갱신
   rig.part(id)                           파츠 <g>
   rig.detach(id)                         파츠를 떨어뜨린다 (부위 파괴)
   rig.hit(id)  / rig.glow(id, 0~1)       히트 영역 <g> / 발광 강도 */
(function(){
  var NS='http://www.w3.org/2000/svg';
  function el(n, a){ var e=document.createElementNS(NS,n); for(var k in a) e.setAttribute(k,a[k]); return e; }
  function ease(t, k){ return k==='in' ? t*t : k==='out' ? 1-(1-t)*(1-t) : t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }

  function mount(svg, R, opt){
    opt=opt||{};
    svg.setAttribute('viewBox','0 0 '+R.w+' '+R.h);
    var defs=el('defs',{}); defs.innerHTML=
      '<filter id="rg-blur"><feGaussianBlur stdDeviation="6"/></filter>'+
      '<filter id="rg-target" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#C9A45E" flood-opacity=".95"/></filter>'+
      '<filter id="rg-hit" x="-20%" y="-20%" width="140%" height="140%"><feColorMatrix type="matrix" values="1 0 0 0 .5  0 1 0 0 .1  0 0 1 0 .05  0 0 0 1 0"/></filter>'+
      '<radialGradient id="rg-core"><stop offset="0" stop-color="#FFD9B0" stop-opacity="1"/><stop offset=".35" stop-color="#E8502E" stop-opacity=".9"/><stop offset="1" stop-color="#A51C1C" stop-opacity="0"/></radialGradient>'+
      '<radialGradient id="rg-eye"><stop offset="0" stop-color="#FFE0C0"/><stop offset=".5" stop-color="#E8502E"/><stop offset="1" stop-color="#A51C1C" stop-opacity="0"/></radialGradient>';
    svg.appendChild(defs);
    /* 바닥 그림자 */
    var shadow=el('ellipse',{cx:R.w/2,cy:R.h-4,rx:R.w*0.28,ry:14,fill:'rgba(0,0,0,.55)','class':'rig-shadow'}); shadow.setAttribute('filter','url(#rg-blur)'); svg.appendChild(shadow);
    var root=el('g',{'class':'rig-root'}); svg.appendChild(root);
    var groups={}, images={}, byId={};
    R.parts.forEach(function(p){ byId[p.id]=p; });
    /* 부모 → 자식 중첩 (z 순서는 형제 내에서 정렬) */
    var order=R.parts.slice().sort(function(a,b){ return a.z-b.z; });
    order.forEach(function(p){
      var g=el('g',{'class':'rig-part','data-part':p.id}); var wrap=el('g',{'class':'rig-rot'}); g.appendChild(wrap);
      var im=el('image',{x:p.x,y:p.y,width:p.w,height:p.h,href:R.dir+p.id+'.webp',preserveAspectRatio:'none'}); wrap.appendChild(im);
      groups[p.id]=g; images[p.id]=im; g._rot=wrap; g._p=p;
    });
    /* 자식은 부모의 회전 그룹 안에 (같은 좌표계) — z 순서대로 삽입 */
    order.forEach(function(p){ var g=groups[p.id]; var host=p.parent ? groups[p.parent]._rot : root; host.appendChild(g); });
    /* 히트 영역과 발광은 부모 파츠 안에 */
    var hits={}, glows={};
    Object.keys(R.glow||{}).forEach(function(k){ var h=R.glow[k]; var c=el('circle',{cx:h.cx,cy:h.cy,r:h.r,fill:k==='core'?'url(#rg-core)':'url(#rg-eye)','class':'rig-glow','data-glow':k,style:'mix-blend-mode:screen;pointer-events:none'}); groups[h.parent]._rot.appendChild(c); glows[k]=c; });
    Object.keys(R.hits||{}).forEach(function(k){ var h=R.hits[k]; var g=el('g',{'class':'rig-hit','data-hit':k,style:'display:none'});
      g.appendChild(el('circle',{cx:h.cx,cy:h.cy,r:h.r,'class':'rig-hit__ring'})); g.appendChild(el('circle',{cx:h.cx,cy:h.cy,r:h.r+6,'class':'rig-hit__zone',fill:'transparent'}));
      var t=el('text',{x:h.cx,y:h.cy-h.r-8,'text-anchor':'middle','class':'rig-hit__lb'}); t.textContent=h.label; g.appendChild(t);
      var hp=el('circle',{cx:h.cx,cy:h.cy,r:h.r+3,'class':'rig-hit__hp',fill:'none',style:'display:none'}); g.appendChild(hp); g._hp=hp;
      groups[h.parent]._rot.appendChild(g); hits[k]=g; });

    /* ---------- 애니메이션 ---------- */
    var cur={ pose:{}, root:{dx:0,dy:0,s:1} }, layers=[], idle=R.clips.idle, idleT=0;
    function sample(clip, t, scale){
      var keys=clip.keys, dur=keys[keys.length-1].t*(scale||1);
      if (clip.loop) t=t%dur; var tt=t/(scale||1); if (tt>=keys[keys.length-1].t){ return { pose:keys[keys.length-1].pose, root:keys[keys.length-1].root||{}, done:!clip.loop }; }
      var i=1; while(keys[i].t<tt) i++; var a=keys[i-1], b=keys[i], f=(tt-a.t)/(b.t-a.t); f=ease(f, b.ease);
      var pose={}, ids=Object.keys(a.pose).concat(Object.keys(b.pose)); ids.forEach(function(id){ var va=a.pose[id]||0, vb=b.pose[id]||0; pose[id]=va+(vb-va)*f; });
      var ra=a.root||{}, rb=b.root||{}, root={}; ['dx','dy','s'].forEach(function(k){ var d=k==='s'?1:0; var va=ra[k]==null?d:ra[k], vb=rb[k]==null?d:rb[k]; root[k]=va+(vb-va)*f; });
      return { pose:pose, root:root, done:false };
    }
    var api={};
    api.play=function(name, o){ o=o||{}; var clip=R.clips[name]; if(!clip) return; var scale=o.dur ? o.dur/clip.keys[clip.keys.length-1].t : 1;
      layers=layers.filter(function(L){ return L.name!==name; }); layers.push({ name:name, clip:clip, t:0, scale:scale, then:o.then, hold:clip.hold||o.hold, w:0, fade:o.fade==null?0.12:o.fade }); };
    api.stop=function(name){ layers=layers.filter(function(L){ return L.name!==name; }); };
    api.tick=function(dt){
      idleT+=dt; var base=sample(idle, idleT); var pose={}, root={dx:base.root.dx,dy:base.root.dy,s:base.root.s}; for(var k in base.pose) pose[k]=base.pose[k];
      var keep=[];
      layers.forEach(function(L){ L.t+=dt; L.w=Math.min(1, L.w+dt/Math.max(0.001,L.fade)); var s=sample(L.clip, L.t, L.scale);
        for(var id in s.pose) pose[id]=(pose[id]||0)*(1-L.w)+s.pose[id]*L.w;
        ['dx','dy','s'].forEach(function(key){ var d=key==='s'?1:0; var v=s.root[key]==null?d:s.root[key]; root[key]=root[key]*(1-L.w)+v*L.w; });
        if (s.done && !L.hold){ if(L.then) L.then(); } else keep.push(L); });
      layers=keep;
      R.parts.forEach(function(p){ var a=pose[p.id]||0; groups[p.id]._rot.setAttribute('transform','rotate('+a.toFixed(2)+' '+p.px+' '+p.py+')'); });
      var s=root.s||1; api.root.setAttribute('transform','translate('+(root.dx||0)+' '+(root.dy||0)+') translate('+(R.w/2)+' '+R.h+') scale('+s+') translate('+(-R.w/2)+' '+(-R.h)+')');
      cur={pose:pose,root:root};
    };
    api.root=root; api.part=function(id){ return groups[id]; }; api.hit=function(id){ return hits[id]; }; api.hits=hits; api.groups=groups;
    api.glow=function(id, v){ var g=glows[id]; if(!g) return; g.style.opacity=v; g.setAttribute('transform','translate('+R.glow[id].cx+' '+R.glow[id].cy+') scale('+(0.6+v*0.8)+') translate('+(-R.glow[id].cx)+' '+(-R.glow[id].cy)+')'); };
    api.detach=function(id){ var g=groups[id]; if(!g||g._gone) return; g._gone=true; g.classList.add('rig-fall'); setTimeout(function(){ g.style.display='none'; }, 900); };
    api.flash=function(){ root.setAttribute('filter','url(#rg-hit)'); setTimeout(function(){ root.removeAttribute('filter'); }, 70); };
    api.tick(0);
    return api;
  }
  window.TW_RIG={ mount:mount };
})();
