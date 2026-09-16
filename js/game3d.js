/* 황혼 — 던전 01 (Three.js 3D 렌더러)
   월드 규칙(world-sim.js)·전투 규칙(combat.js)·잡몹(skirmish.js)·레벨(dungeon.js)·저장(save.js)은 그대로. 이 파일은 3D 렌더링·입력·연출·흐름만 담당.
   좌표: world-sim 의 저장 좌표 (x, y) → 3D (x/SCALE, 0, y/DEPTH/SCALE). 1 m = SCALE px. */
import * as THREE from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
(function(){
  var W=window.TW_WORLD, DG=window.TW_DUNGEONS, CB=window.TW_COMBAT, SIM=window.TW_WORLDSIM, L=window.TW_LEVELS.d01, $=function(s){return document.querySelector(s);};
  var A=DG.ARENAS[L.arena], R=DG.RULES, CHAR=W.CHARS[A.char], SK=DG.SKILLS[A.char], ULT=DG.SKILLS[A.char+'Ult'], DEPTH=SIM.DEPTH;
  var SCALE=50; /* px per m */
  var MOBILE=Math.min(window.innerWidth, window.innerHeight)<=640;
  var world=SIM.createWorld({rows:L.rows, cell:L.cell}), map=world.map;
  var P=world.add('p',{x:world.marks('S')[0].x, y:world.marks('S')[0].y, r:L.player.r, rollT:0, lockT:0, aim:0, face:'down'});
  var Bs=world.add('b',{x:world.marks('B')[0].x, y:world.marks('B')[0].y, r:60, dist:999, faceX:1});
  var gate=world.marks('G')[0], sign=world.marks('s')[0];
  var state='explore', phase=0, battle=null, paused=false, stageResults=[], zone=null, fightT=0, acc=0, guideT=0, counterT=0, lastHit=0, seen={}, gateClosed=false;
  var stick={sx:0,sy:0,id:null,ox:0,oy:0}, holdTimer=null, guarding=false, kd={};
  var SFX=window.TW_SFX, SAVE=window.TW_SAVE, SKM=window.TW_SKIRMISH, timeScale=1, cine=false, fpsSamples=[], autoLow=false;
  var skirm=null, mobsEnt={}, PS={ hp:CHAR.stats.hp, st:R.stamina.max, ult:0 }, quest={ mobs:0, gate:0, boss:0 }, pickups=[], gateOpen=false, comboT=0, lockedT=0;
  var RETRY=(function(){ try{ var v=sessionStorage.getItem('tw:retry'); sessionStorage.removeItem('tw:retry'); return v; }catch(e){ return null; } })();
  var SET=(function(){ try{ return Object.assign({ bright:1, lights:true, vib:true, sound:true }, JSON.parse(localStorage.getItem('tw:settings')||'{}')); }catch(e){ return { bright:1, lights:true, vib:true, sound:true }; } })();
  function saveSet(){ try{ localStorage.setItem('tw:settings', JSON.stringify(SET)); }catch(e){} }
  var el={ dg:$('#dg'), flash:$('#flash'), bosshp:$('#bosshp'), name:$('#b-name'), stack:$('#b-stack'), ph:$('#b-ph'), timerBox:$('#bttimer'), timer:$('#b-timer'), counter:$('#counter'), cLb:$('#c-lb'), cV:$('#c-v'), cSub:$('#c-sub'), status:$('#status'), guide:$('#guide'), stickEl:$('#stick'), actions:$('#actions'), ov:$('#ov'), ovBox:$('#ov-box'), mini:$('#mini'), loading:$('#loading'), quest:$('#quest'), combo:$('#combo'), comboN:$('#combo-n'), toasts:$('#toasts'), dlg:$('#dlg'), dlgWho:$('#dlg-who'), dlgTxt:$('#dlg-txt'), stag:$('#b-stag'), canvas:$('#game3d') };
  var mctx=el.mini.getContext('2d');
  var HITMAP={ core:'core', body:'body', chain:'chain', shl:'shl', shr:'shr', head:'head' };

  /* ---------- 좌표 ---------- */
  function X(x){ return x/SCALE; } function Z(y){ return y/DEPTH/SCALE; } function M(px){ return px/SCALE; }
  function v3(x,y,h){ return new THREE.Vector3(X(x), h||0, Z(y)); }
  function yawOf(a){ return Math.atan2(Math.cos(a), Math.sin(a)); } /* 바닥 각 a(atan2(z,x)) → 모델 Y 회전 (+Z 정면) */

  /* ---------- 파티 · 행동 버튼 ---------- */
  $('#btparty').innerHTML='<div class="pmem">'+W.face(CHAR.id,'pmem__face')+'<div class="fill"><div class="flex ac g2"><span class="pmem__n">'+CHAR.nm+'</span><span class="pmem__lv">LV.'+CHAR.lv+'</span><span class="pmem__hp num" id="p-hp">'+W.fmt(CHAR.stats.hp)+'</span></div><div class="bar bar--hp" data-fill="100" id="p-bar"></div></div></div>';
  el.actions.innerHTML=SK.map(function(k,i){ return '<div class="abtn" data-skill="'+i+'"><span class="sk__k">'+k.key+'</span><svg class="ico"><use href="#i-'+k.icon+'"/></svg><span class="sk__cd" hidden></span><span class="sk__nm">'+k.name+'</span></div>'; }).join('')+
    '<div class="abtn abtn--dodge" data-dodge><span class="sk__k">K</span><svg class="ico"><use href="#i-bolt"/></svg><span class="sk__nm">회피</span></div>'+
    '<div class="abtn abtn--guard" data-guard><span class="sk__k">L</span><svg class="ico"><use href="#i-shield"/></svg><span class="sk__nm">방어</span></div>'+
    '<div class="abtn abtn--atk" data-atk><span class="sk__k">J</span><svg class="ico"><use href="#i-scythe"/></svg><span class="sk__nm">탭 공격 · 길게 스매시</span></div>'+
    '<div class="abtn abtn--ult" data-ult><span class="sk__k">R</span><svg class="ico"><use href="#i-'+ULT.icon+'"/></svg><span class="sk__nm">'+ULT.name+'</span></div>';

  /* ---------- 렌더러 · 씬 ---------- */
  var renderer=new THREE.WebGLRenderer({ canvas:el.canvas, antialias:!MOBILE, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(MOBILE?1.5:2, devicePixelRatio)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.45*SET.bright;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  var scene=new THREE.Scene(); scene.background=new THREE.Color(0x0B0C0F); scene.fog=new THREE.FogExp2(0x0B0C0F, 0.018);
  var cam=new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  var camYaw=-Math.PI*0.5, camPitch=0.50, camDist=MOBILE?6.2:7.0, dragT=0, camLook=new THREE.Vector3(), camPos=new THREE.Vector3(), camFree=false, camZoom=1;
  function resize(){ var w=el.dg.clientWidth||innerWidth, h=el.dg.clientHeight||innerHeight; renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  var TL=new THREE.TextureLoader(); function tex(n, rep){ var t=TL.load('art/env/'+n+'.webp'); t.colorSpace=THREE.SRGBColorSpace; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); } t.anisotropy=4; return t; }
  function texLin(n, rep){ var t=TL.load('art/env/'+n+'.webp'); if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); } return t; }
  function canvasTex(draw, size){ var c=document.createElement('canvas'); c.width=c.height=size||128; draw(c.getContext('2d'), c.width); var t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
  var glowTex=canvasTex(function(g,s){ var r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.35,'rgba(255,255,255,.55)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,s,s); });
  var ringTex=canvasTex(function(g,s){ g.strokeStyle='#fff'; g.lineWidth=s*0.08; g.beginPath(); g.arc(s/2,s/2,s*0.42,0,Math.PI*2); g.stroke(); }, 128);

  /* 조명 */
  var hemi=new THREE.HemisphereLight(0x9aa0c0, 0x3a2c20, 1.1); scene.add(hemi);
  var moon=new THREE.DirectionalLight(0xc0c8e8, 1.6); moon.position.set(-8, 18, -6); moon.castShadow=true; moon.shadow.mapSize.set(MOBILE?1024:2048, MOBILE?1024:2048); moon.shadow.camera.near=1; moon.shadow.camera.far=60; moon.shadow.bias=-0.0015; scene.add(moon); scene.add(moon.target);
  var pLight=new THREE.PointLight(0xE0D0B8, 3.0, 10, 1.4); scene.add(pLight);
  var coreLight=new THREE.PointLight(0xE04A3C, 3.0, 9, 1.4); scene.add(coreLight);
  var torchLights=[];
  function applySettings(){ SFX.enabled=SET.sound; renderer.toneMappingExposure=1.45*SET.bright; torchLights.forEach(function(t){ t.l.visible=SET.lights; }); pLight.visible=SET.lights; coreLight.visible=SET.lights; hemi.intensity=SET.lights?1.1:1.6; }

  /* ---------- 환경 ---------- */
  var cellW=M(map.cell), cellD=M(map.cell/DEPTH), mapW=M(map.pw), mapD=M(map.ph/DEPTH);
  (function buildEnv(){
    var g=new THREE.PlaneGeometry(mapW, mapD); g.rotateX(-Math.PI/2);
    var ground=new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map:tex('ground',[mapW/3.2, mapD/3.2]), normalMap:texLin('ground_n',[mapW/3.2, mapD/3.2]), roughness:0.95, color:0xd8d0c8 }));
    ground.position.set(mapW/2, 0, mapD/2); ground.receiveShadow=true; scene.add(ground);
    /* 보스 원 데칼 */
    var bm=world.marks('B')[0]; var ring=new THREE.Mesh(new THREE.PlaneGeometry(11.2, 11.2), new THREE.MeshBasicMaterial({ map:tex('ring'), transparent:true, opacity:0.75, depthWrite:false })); ring.rotation.x=-Math.PI/2; ring.position.set(X(bm.x), 0.02, Z(bm.y)); scene.add(ring);
    /* 벽 (병합) */
    var wallMat=new THREE.MeshStandardMaterial({ map:tex('wall',[1,1]), normalMap:texLin('wall_n',[1,1]), roughness:0.9 }); var wallGeo=new THREE.BoxGeometry(cellW, 3.2, cellD);
    var walls=new THREE.InstancedMesh(wallGeo, wallMat, map.w*map.h); var n=0, mtx=new THREE.Matrix4();
    var fpostGeo=new THREE.CylinderGeometry(0.07,0.09,1.7,6), fpostMat=new THREE.MeshStandardMaterial({ color:0x5a4634, roughness:0.9 }), railGeo=new THREE.BoxGeometry(0.06, 0.05, cellD), railMat=new THREE.MeshStandardMaterial({ color:0x4a3a2c, roughness:0.9 });
    var sprMat={}; function sprite(k, h, x, z, w){ var m=sprMat[k]||(sprMat[k]=new THREE.SpriteMaterial({ map:tex(k), transparent:true, alphaTest:0.2 })); var s=new THREE.Sprite(m); var asp=w||0.5; s.scale.set(h*asp, h, 1); s.center.set(0.5,0); s.position.set(x, 0, z); scene.add(s); return s; }
    var sprites=[]; var ASP={ barrel:0.85, crate:1.25, post:0.22, sign:0.42, torch:0.18 };
    for(var y=0;y<map.h;y++) for(var x=0;x<map.w;x++){ var ch=map.rows[y][x], cx=X((x+0.5)*map.cell), cz=Z((y+0.5)*map.cell);
      if(ch==='#'){ mtx.makeTranslation(cx, 1.6, cz); walls.setMatrixAt(n++, mtx); }
      else if(ch==='|'){ var fp=new THREE.Mesh(fpostGeo, fpostMat); fp.position.set(cx, 0.85, cz-cellD/2); fp.castShadow=true; scene.add(fp); var r1=new THREE.Mesh(railGeo, railMat); r1.position.set(cx, 1.15, cz); scene.add(r1); var r2=r1.clone(); r2.position.y=0.6; scene.add(r2); }
      else if(ch==='b'){ var s=sprite('barrel', 1.0, cx, cz, ASP.barrel); sprites.push(s); }
      else if(ch==='c'){ sprites.push(sprite('crate', 0.9, cx, cz, ASP.crate)); }
      else if(ch==='p'){ sprites.push(sprite('post', 2.0, cx, cz, ASP.post)); }
      else if(ch==='s'){ sprites.push(sprite('sign', 1.9, cx, cz, ASP.sign)); }
      else if(ch==='t'){ sprites.push(sprite('torch', 2.2, cx, cz, ASP.torch)); var lt=new THREE.PointLight(0xF0A050, SET.lights?6:0, 14, 1.3); lt.position.set(cx, 2.1, cz); scene.add(lt); var fl=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xE8702E, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); fl.scale.set(1.3,1.3,1); fl.position.set(cx, 2.15, cz); scene.add(fl); torchLights.push({ l:lt, base:6, fx:fl }); }
    }
    walls.count=n; walls.instanceMatrix.needsUpdate=true; walls.castShadow=true; walls.receiveShadow=true; scene.add(walls);
    /* 스프라이트 바닥 정렬: center 0 → 위치 y=0 */
    sprites.forEach(function(s){ s.center.set(0.5,0); });
    /* 문 */
    gateMesh=new THREE.Mesh(new THREE.BoxGeometry(cellW*1.05, 3.0, 0.25), new THREE.MeshStandardMaterial({ map:tex('gate'), transparent:true, alphaTest:0.3, roughness:0.8, side:THREE.DoubleSide })); gateMesh.rotation.y=Math.PI/2; gateMesh.position.set(X(gate.x), 1.5, Z(gate.y)); gateMesh.castShadow=true; scene.add(gateMesh);
    /* 원경: 도시 실루엣 */
    var far=new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshBasicMaterial({ map:tex('lobby-city'.replace('lobby-city','../lobby-city')), transparent:true, opacity:0.55, color:0x6a5a60, fog:false, depthWrite:false })); far.position.set(mapW/2, 9, -8); scene.add(far);
  })();
  var gateMesh;
  /* 스프라이트 하단 정렬은 center 로 처리했으므로 y=0 */

  /* ---------- 허수아비 (자리표시자 리그: 원시 도형 + 짚 텍스처) ---------- */
  var strawTex=tex('straw',[2,2]);
  var boss=(function(){
    var root=new THREE.Group(); root.position.set(X(Bs.x), 0, Z(Bs.y)); scene.add(root);
    var wood=new THREE.MeshStandardMaterial({ color:0x6a5238, roughness:0.9 }), straw=new THREE.MeshStandardMaterial({ map:strawTex, roughness:1, color:0xd8c8a8 }), iron=new THREE.MeshStandardMaterial({ color:0x7a7278, roughness:0.55, metalness:0.7 }), coreMat=new THREE.MeshStandardMaterial({ color:0xE04A3C, emissive:0xE04A3C, emissiveIntensity:0.8, roughness:0.4 }), chainMat=new THREE.MeshStandardMaterial({ color:0x8a8288, roughness:0.5, metalness:0.8 });
    var parts={};
    function add(id, mesh, parent){ mesh.name=id; mesh.castShadow=true; (parent||root).add(mesh); parts[id]=mesh; return mesh; }
    add('post', new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.14,3.0,8), wood)).position.y=1.5;
    var body=add('body', new THREE.Group()); body.position.y=1.55; body.userData.hit={ r:0.6, y:0.1 };
    var torso=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,1.5,10), straw); torso.castShadow=true; body.add(torso);
    add('core', new THREE.Mesh(new THREE.SphereGeometry(0.17,14,12), coreMat), body).position.set(0,0.3,0.42); parts.core.userData.hit={ r:0.28, y:0 };
    var bar=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.12,0.12), wood); bar.position.y=0.55; body.add(bar);
    add('head', new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10), straw), body).position.y=1.1; parts.head.userData.hit={ r:0.4, y:0 };
    var eyeMat=new THREE.MeshStandardMaterial({ color:0xE04A3C, emissive:0xE04A3C, emissiveIntensity:1 }); var eL=new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6), eyeMat); eL.position.set(-0.12,1.15,0.3); body.add(eL); var eR=eL.clone(); eR.position.x=0.12; body.add(eR); parts.eyeL=eL; parts.eyeR=eR;
    ['L','R'].forEach(function(s,i){ var sg=i?1:-1; var arm=add('arm'+s, new THREE.Group(), body); arm.position.set(sg*0.55,0.55,0); var am=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.09,1.1,8), straw); am.rotation.z=sg*Math.PI/2*0.92; am.position.x=sg*0.5; am.castShadow=true; arm.add(am);
      var hand=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.34,0.34), wood); hand.position.x=sg*1.05; hand.castShadow=true; arm.add(hand);
      var pad=add(i?'shr':'shl', new THREE.Mesh(new THREE.BoxGeometry(0.5,0.32,0.5), iron), body); pad.position.set(sg*0.55,0.72,0); pad.userData.hit={ r:0.34, y:0 };
      var ch=add('chain'+s, new THREE.Mesh(new THREE.TorusGeometry(0.22,0.05,6,12), chainMat), body); ch.position.set(sg*0.3,0.1,0.35); ch.rotation.x=Math.PI/2; });
    var chain=add('chain', new THREE.Mesh(new THREE.TorusGeometry(0.4,0.06,6,16), chainMat), body); chain.position.set(0,0.2,0.4); chain.rotation.y=0; chain.userData.hit={ r:0.45, y:0 };
    /* 부위 표시 링(빌보드) */
    var hits={}; ['core','body','head','shl','shr','chain'].forEach(function(k){ var sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:ringTex, color:0xC9A45E, transparent:true, depthTest:false, opacity:0.9 })); sp.scale.set(0.5,0.5,1); sp.visible=false; sp.renderOrder=5; scene.add(sp); hits[k]=sp; });
    var anim={ lean:0, leanT:0, raise:0, spin:0, shake:0, down:0, collapse:0, glow:1, flash:0, tele:null, teleT:0 };
    return { root:root, parts:parts, body:body, hits:hits, anim:anim, raycastable:['core','body','head','shl','shr','chain'].map(function(k){ return parts[k]; }) };
  })();
  function bossHitPos(k){ var p=boss.parts[k]||boss.parts.body; var v=new THREE.Vector3(); p.getWorldPosition(v); if(p.userData.hit) v.y+=p.userData.hit.y; return v; }
  function setupPhase(d){
    var k=d.kind; var tint={dormant:0x9a9a9a, chained:0xc8c0c0, awake:0xffffff}[k]||0xffffff; boss.root.traverse(function(o){ if(o.isMesh && o.material && o.material.map===strawTex){ o.material=o.material.clone(); o.material.color.setHex(tint); } });
    Object.keys(boss.hits).forEach(function(kk){ boss.hits[kk].visible=false; });
    ['shl','shr','chainL','chainR','chain'].forEach(function(id){ if(boss.parts[id]) boss.parts[id].visible = k!=='dormant' ? true : false; });
    if(k==='awake'){ boss.parts.shl.visible=boss.parts.shr.visible=false; boss.parts.chainL.visible=boss.parts.chainR.visible=false; boss.parts.chain.visible=true; } else boss.parts.chain.visible=false;
    d.parts.forEach(function(p){ var h=boss.hits[HITMAP[p.id]]; if(h){ h.visible=true; h.material.color.setHex(p.weak?0xD94A45:p.breakable?0x7B9BD6:0xC9A45E); } });
    boss.anim.glow={dormant:0.35, chained:0.6, awake:1}[k]||1; coreLight.intensity=0.5+boss.anim.glow*1.2;
  }
  function bossPlay(n, o){ var a=boss.anim; o=o||{};
    if(n==='flinch'){ a.shake=0.25; a.flash=0.12; } else if(n==='stagger'){ a.shake=0.7; a.lean=-0.35; a.leanT=0.7; } else if(n==='down'){ a.down=1; } else if(n==='up'){ a.down=0; } else if(n==='collapse'){ a.collapse=1; }
    else if(n.indexOf('tele_')===0){ a.tele=n.slice(5); a.teleT=o.dur||1; a.teleDur=o.dur||1; } else if(n.indexOf('hit_')===0){ a.tele=null; a.swing=0.35; a.swingKind=n.slice(4); } }
  function bossStop(){ boss.anim.tele=null; }
  function bossTick(dt){ var a=boss.anim, b=boss.body; var t=performance.now()/1000;
    if(a.leanT>0){ a.leanT-=dt; } else a.lean+= (0-a.lean)*Math.min(1,dt*4);
    if(a.shake>0) a.shake-=dt; if(a.flash>0) a.flash-=dt;
    var teleAmt=0; if(a.tele){ a.teleT-=dt; teleAmt=1-Math.max(0,a.teleT)/a.teleDur; }
    var swing=0; if(a.swing>0){ a.swing-=dt; swing=a.swing/0.35; }
    /* 몸통: 기본 흔들림 + 예고(뒤로 젖힘/팔 들기) + 휘두름 */
    var breathe=Math.sin(t*1.3)*0.02*a.glow;
    var lean=a.lean + (a.tele ? (a.tele==='hammer'? -0.5*teleAmt : a.tele==='bolt'? -0.25*teleAmt : -0.15*teleAmt) : 0) + (swing? 0.55*swing : 0) + (a.down?0.9:0) + (a.collapse?1.3:0);
    b.rotation.x += (lean+breathe - b.rotation.x)*Math.min(1,dt*10);
    var spin=(a.tele==='scythe') ? teleAmt*0.8 : 0; if(a.swingKind==='scythe' && swing) spin=Math.PI*2*(1-swing);
    b.rotation.y += (spin*Bs.faceX - b.rotation.y)*Math.min(1,dt*8);
    var sh=a.shake>0 ? Math.sin(t*60)*0.05*a.shake : 0; b.position.x=sh; b.position.y=1.55+(a.collapse?-0.6:0)+(a.down?-0.25:0);
    /* 팔 */
    var raise=a.tele==='hammer' ? teleAmt*1.6 : a.tele==='bolt' ? teleAmt*0.9 : 0; if(swing) raise=-0.9*swing;
    boss.parts.armL.rotation.z += (raise - boss.parts.armL.rotation.z)*Math.min(1,dt*9); boss.parts.armR.rotation.z += (-raise - boss.parts.armR.rotation.z)*Math.min(1,dt*9);
    /* 핵·눈 발광 */
    var g=a.glow*(0.8+Math.sin(t*3)*0.2)+(a.flash>0?1.5:0); boss.parts.core.material.emissiveIntensity=g; coreLight.intensity=SET.lights?(1.5+g*2.5):0; boss.parts.eyeL.material.emissiveIntensity=g;
    boss.root.position.set(X(Bs.x), 0, Z(Bs.y)); boss.root.rotation.y=Math.atan2(X(P.x)-X(Bs.x), Z(P.y)-Z(Bs.y));
    var cp=bossHitPos('core'); coreLight.position.copy(cp).add(new THREE.Vector3(0,0.3,0.5));
    Object.keys(boss.hits).forEach(function(k){ var h=boss.hits[k]; if(!h.visible) return; var p=boss.parts[k]; if(!p||!p.visible){ h.visible=false; return; } h.position.copy(bossHitPos(k)); }); }
  function bossDetach(id){ var p=boss.parts[id]; if(!p) return; p.visible=false; var h=boss.hits[id]; if(h) h.visible=false; }

  /* ---------- 아인 (GLB + 애니메이션) ---------- */
  var ain={ root:new THREE.Group(), mixer:null, clips:{}, base:'idle', cur:null, act:null, oneshot:null, hitT:0, ready:false, model:null, dead:false };
  ain.root.position.copy(v3(P.x,P.y)); scene.add(ain.root);
  var loader=new GLTFLoader(); var loadN=0;
  function loaded(){ loadN++; el.loading.textContent='황 혼 — '+Math.round(loadN/2*100)+'%'; if(loadN>=2) begin(); }
  loader.load('art/3d/ain_anim.glb', function(g){ ain.model=g.scene; ain.model.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; o.frustumCulled=false; } }); ain.root.add(ain.model);
    ain.mixer=new THREE.AnimationMixer(ain.model); g.animations.forEach(function(c){ ain.clips[c.name]=c; });
    ['attack1','attack2','attack3','smash','ult','hit','hit2','death','roll','dodgeB','dodgeL','dodgeR','pickup','cheer'].forEach(function(n){ var c=ain.clips[n]; if(!c) return; });
    var slot=null; ain.model.traverse(function(o){ if(o.isBone && /RightHandSlot/.test(o.name)) slot=o; }); ain.slot=slot;
    loader.load('art/3d/ain_scythe_v02.glb', function(w){ var wr=new THREE.Group(); w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); w.scene.position.set(0,-0.95,0); wr.add(w.scene); if(slot){ slot.add(wr); var ws=new THREE.Vector3(); slot.getWorldScale(ws); wr.scale.set(1/ws.x,1/ws.y,1/ws.z); } ain.weapon=wr; loaded(); }, undefined, function(){ loaded(); });
    setBase('idle'); loaded(); }, undefined, function(err){ el.loading.textContent='아인 모델 로드 실패: '+(err&&err.message||err); });
  function action(n){ var c=ain.clips[n]; if(!c||!ain.mixer) return null; return ain.mixer.clipAction(c); }
  function setBase(n){ if(ain.base===n && ain.act) return; var a=action(n); if(!a) return; var prev=ain.act; a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.enabled=true; a.setEffectiveWeight(1); a.timeScale=n==='run'?1.15:n==='walk'?1.25:1; if(prev && prev!==a){ a.crossFadeFrom(prev, 0.18, true); } a.play(); ain.act=a; ain.base=n; }
  function playOnce(n, o){ o=o||{}; var a=action(n); if(!a) return; if(ain.oneshot){ ain.oneshot.fadeOut(0.05); } a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished=!!o.hold; a.timeScale=o.speed||1; a.enabled=true; a.setEffectiveWeight(1); a.fadeIn(0.06); a.play(); if(ain.act) ain.act.fadeOut(0.06);
    ain.oneshot=a; ain.oneshotEnd=a.getClip().duration/(o.speed||1)-(o.hold?0:0.12); ain.oneshotT=0; ain.hold=!!o.hold; }
  function ainTick(dt){ if(!ain.mixer) return;
    var moving=P.moving && P.rollT<=0 && P.lockT<=0; var guard=battle?battle.snapshot().player.guard:(skirm?skirm.snapshot().player.guard:false);
    if(ain.oneshot){ ain.oneshotT+=dt; if(!ain.hold && ain.oneshotT>=ain.oneshotEnd){ ain.oneshot.fadeOut(0.15); ain.oneshot=null; if(ain.act){ ain.act.reset(); ain.act.fadeIn(0.15); ain.act.play(); } } }
    var want=ain.dead?'idle':guard?'guard':P.rollT>0?'run':moving?'run':'idle'; if(want!==ain.base){ setBase(want); }
    ain.mixer.update(dt);
    ain.root.position.copy(v3(P.x,P.y)); var yaw=yawOf(P.aim==null?0:P.aim); var d=yaw-ain.root.rotation.y; while(d>Math.PI) d-=Math.PI*2; while(d<-Math.PI) d+=Math.PI*2; ain.root.rotation.y+=d*Math.min(1,dt*(P.rollT>0?30:14));
    if(ain.hitT>0){ ain.hitT-=dt; } ain.model.traverse(function(o){ if(o.isMesh && o.material){ if(!o.userData.em0) o.userData.em0=o.material.emissive?o.material.emissive.clone():null; if(o.material.emissive) o.material.emissive.setHex(ain.hitT>0?0x802020:0x000000); } });
    pLight.position.copy(ain.root.position).add(new THREE.Vector3(0.4,1.9,0.4)); }
  function ainAttack(kind, combo){ var n=kind==='smash'?'smash':kind==='ult'?'ult':kind==='skill'?'attack2':(combo%3===1?'attack1':combo%3===2?'attack2':'attack3'); playOnce(n, { speed:kind==='smash'?1.35:kind==='ult'?1.1:1.7 }); }

  /* ---------- 잡몹 (짚 인형 자리표시자) ---------- */
  function mkMob(m){ var g=new THREE.Group(); g.position.copy(v3(m.x,m.y)); var wood=new THREE.MeshStandardMaterial({ color:0x6a5238, roughness:0.9 }), straw=new THREE.MeshStandardMaterial({ map:strawTex, roughness:1, color:0xd8c8b0 });
    var post=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,1.5,6), wood); post.position.y=0.75; post.castShadow=true; g.add(post);
    var body=new THREE.Group(); body.position.y=0.95; g.add(body); var t=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.75,8), straw); t.castShadow=true; body.add(t); var h=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8), new THREE.MeshStandardMaterial({ color:0xb8a888, roughness:1 })); h.position.y=0.6; h.castShadow=true; body.add(h);
    var bar=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.07,0.07), wood); bar.position.y=0.25; body.add(bar);
    var hp=new THREE.Sprite(new THREE.SpriteMaterial({ color:0xC7332C, depthTest:false })); hp.scale.set(0.8,0.06,1); hp.position.y=1.95; hp.visible=false; g.add(hp);
    var hpbg=new THREE.Sprite(new THREE.SpriteMaterial({ color:0x000000, opacity:0.6, transparent:true, depthTest:false })); hpbg.scale.set(0.84,0.09,1); hpbg.position.y=1.95; hpbg.visible=false; g.add(hpbg);
    scene.add(g); return { g:g, body:body, hp:hp, hpbg:hpbg, tilt:0, flash:0, bob:0 }; }
  function renderMobs(dt){ if(!skirm) return; var snap=skirm.snapshot(); var t=performance.now()/1000;
    snap.mobs.forEach(function(m){ var me=mobsEnt[m.id]; if(!me) return; if(m.dead){ if(me.g.visible){ me.g.position.y-=dt*0.6; me.g.rotation.x+=dt*1.5; if(me.g.position.y<-1.5) me.g.visible=false; } return; }
      me.g.position.set(X(m.x), 0, Z(m.y)); me.g.rotation.y=Math.atan2(X(P.x)-X(m.x), Z(P.y)-Z(m.y));
      var bob=(m.moving && m.state==='chase')?Math.abs(Math.sin(t*9))*0.08:0; var tiltW=m.state==='knockdown'?-1.35:m.state==='knockback'?-0.35:m.state==='telegraph'?0.25*(1-m.tele/m.teleDur):m.state==='swing'?-0.45:0;
      me.tilt+= (tiltW-me.tilt)*Math.min(1,dt*10); me.body.rotation.x=me.tilt; me.body.position.y=0.95+bob; if(me.flash>0) me.flash-=dt; me.body.children[0].material.emissive.setHex(me.flash>0?0x604020:0x000000);
      var show=m.hp<m.hpMax; me.hp.visible=me.hpbg.visible=show; if(show){ me.hp.scale.x=Math.max(0.01,0.8*m.hp/m.hpMax); }
      /* 예고 존 */
      if(m.state==='telegraph' && m.zone){ drawZone(m.zone, 1-m.tele/m.teleDur, 0xC7332C, 'm'+m.id); } else hideZone('m'+m.id); }); }

  /* ---------- 존(바닥 범위) ---------- */
  var zones={};
  function zoneMesh(id){ if(zones[id]) return zones[id]; var mat=new THREE.MeshBasicMaterial({ color:0xC7332C, transparent:true, opacity:0.22, depthWrite:false, side:THREE.DoubleSide }); var outer=new THREE.Mesh(new THREE.CircleGeometry(1,40), mat); outer.rotation.x=-Math.PI/2; var inner=new THREE.Mesh(new THREE.CircleGeometry(1,40), new THREE.MeshBasicMaterial({ color:0xC7332C, transparent:true, opacity:0.3, depthWrite:false })); inner.rotation.x=-Math.PI/2; inner.position.y=0.01;
    var edge=new THREE.Mesh(new THREE.RingGeometry(0.96,1,48), new THREE.MeshBasicMaterial({ color:0xC7332C, transparent:true, opacity:0.9, depthWrite:false, side:THREE.DoubleSide })); edge.rotation.x=-Math.PI/2; edge.position.y=0.015;
    var rect=new THREE.Mesh(new THREE.PlaneGeometry(1,1), mat.clone()); rect.rotation.x=-Math.PI/2; var rectIn=new THREE.Mesh(new THREE.PlaneGeometry(1,1), inner.material.clone()); rectIn.rotation.x=-Math.PI/2; rectIn.position.y=0.01;
    var g=new THREE.Group(); g.add(outer, inner, edge, rect, rectIn); g.position.y=0.03; g.renderOrder=2; scene.add(g); zones[id]={ g:g, outer:outer, inner:inner, edge:edge, rect:rect, rectIn:rectIn }; return zones[id]; }
  function drawZone(z, fr, col, id){ var zm=zoneMesh(id||'boss'); zm.g.visible=true; [zm.outer,zm.inner,zm.edge,zm.rect,zm.rectIn].forEach(function(m){ m.material.color.setHex(col); });
    if(z.kind==='circle'){ zm.outer.visible=zm.inner.visible=zm.edge.visible=true; zm.rect.visible=zm.rectIn.visible=false; var r=M(z.r); zm.g.position.set(X(z.x), 0.03, Z(z.y)); zm.outer.scale.set(r,r,1); zm.edge.scale.set(r,r,1); zm.inner.scale.set(r*fr+0.001,r*fr+0.001,1); zm.g.rotation.y=0; }
    else { zm.outer.visible=zm.inner.visible=zm.edge.visible=false; zm.rect.visible=zm.rectIn.visible=true; var len=M(z.len), w=M(z.w); zm.g.position.set(X(z.x), 0.03, Z(z.y)); zm.g.rotation.y=-z.a; zm.rect.scale.set(len+M(20), w, 1); zm.rect.position.set((len-M(20))/2, 0, 0); zm.rectIn.scale.set((len+M(20))*fr+0.001, w, 1); zm.rectIn.position.set(-M(20)+(len+M(20))*fr/2, 0.01, 0); } }
  function hideZone(id){ var zm=zones[id||'boss']; if(zm) zm.g.visible=false; }
  /* 플레이어 사거리 링 */
  var reachRing=new THREE.Mesh(new THREE.RingGeometry(M(L.player.reach)-0.03, M(L.player.reach), 64), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.12, depthWrite:false, side:THREE.DoubleSide })); reachRing.rotation.x=-Math.PI/2; reachRing.position.y=0.02; reachRing.visible=false; scene.add(reachRing);

  /* ---------- 파티클(스파크) ---------- */
  var SPN=400, spPos=new Float32Array(SPN*3), spVel=[], spLife=new Float32Array(SPN), spCol=new Float32Array(SPN*3), spI=0;
  var spGeo=new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos,3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol,3));
  var sparks=new THREE.Points(spGeo, new THREE.PointsMaterial({ size:0.09, map:glowTex, vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true })); sparks.frustumCulled=false; scene.add(sparks);
  for(var i=0;i<SPN;i++){ spVel.push(new THREE.Vector3()); spLife[i]=0; spPos[i*3+1]=-99; }
  function burst(p, n, hex){ var c=new THREE.Color(hex||0xF0B070); for(var k=0;k<(n||14);k++){ var i=spI=(spI+1)%SPN; spPos[i*3]=p.x; spPos[i*3+1]=p.y; spPos[i*3+2]=p.z; spVel[i].set((Math.random()-0.5)*5, Math.random()*4+1, (Math.random()-0.5)*5); spLife[i]=0.3+Math.random()*0.35; spCol[i*3]=c.r; spCol[i*3+1]=c.g; spCol[i*3+2]=c.b; } }
  function tickSparks(dt){ for(var i=0;i<SPN;i++){ if(spLife[i]<=0) continue; spLife[i]-=dt; spVel[i].y-=9.8*dt; spPos[i*3]+=spVel[i].x*dt; spPos[i*3+1]+=spVel[i].y*dt; spPos[i*3+2]+=spVel[i].z*dt; if(spLife[i]<=0) spPos[i*3+1]=-99; } spGeo.attributes.position.needsUpdate=true; spGeo.attributes.color.needsUpdate=true; }
  /* 횃불 불똥 */
  var emberT=0;

  /* ---------- 허수아비 페이즈 ---------- */
  function startPhase(i){ phase=i; var d=A.stages[i]; setupPhase(d);
    battle=CB.createBattle({ char:CHAR, dummy:d, rules:R, skills:SK, ult:ULT, seed:Date.now()&0xffff, hooks:hooks, player:PS });
    el.name.textContent=d.name+' 「'+d.lesson+'」'; el.ph.textContent='PHASE '+(i+1)+' / '+A.stages.length; guide(L.beats.phase[i], 4); }
  var hooks={ canHit:function(){ return Bs.dist<=L.player.reach; }, canCounter:function(){ return Bs.dist<=L.player.reachCounter; }, canStart:function(){ return Bs.dist<=L.ai[phase].start; },
    pick:function(pats, i){ if(L.ai[phase].pick!=='range') return pats[i%pats.length]; if(Bs.dist<170) return pats[1]; return i%2 ? pats[2] : pats[0]; }, inZone:function(pat){ return zone ? world.inZone(zone, P.x, P.y) : true; } };

  /* ---------- 피드백 ---------- */
  function toScreen(v){ var p=v.clone().project(cam); var w=el.dg.clientWidth, h=el.dg.clientHeight; return { x:(p.x+1)/2*w, y:(1-p.y)/2*h, z:p.z }; }
  function num(v,text,cls){ var s=toScreen(v); if(s.z>1) return; var d=document.createElement('div'); d.className='dmgnum '+(cls||''); d.style.left=s.x+'px'; d.style.top=s.y+'px'; d.textContent=text; el.dg.appendChild(d); setTimeout(function(){ d.remove(); }, 950); }
  function above(x,y,h){ return v3(x,y,h==null?1.9:h); }
  function guide(html, sec){ el.guide.innerHTML=html; el.guide.classList.add('is-on'); guideT=sec||3; }
  function banner(lb, v, sub, perfect){ el.cLb.textContent=lb; el.cV.textContent=W.fmt(v); el.cSub.textContent=sub||''; el.counter.classList.toggle('perfect',!!perfect); el.counter.classList.add('is-on'); counterT=1.3; }
  function flash(){ el.flash.classList.remove('is-on'); void el.flash.offsetWidth; el.flash.classList.add('is-on'); }
  function vib(ms){ if(!SET.vib) return; try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
  var shakeAmt=0, shakeT=0; function shake(i, d){ shakeAmt=Math.max(shakeAmt, (i||0.004)*40); shakeT=Math.max(shakeT,(d||200)/1000); }
  var zoomPulse=0; function zoomKick(){ zoomPulse=1; }
  function handle(e){
    var s=battle?battle.snapshot():null;
    switch(e.t){
      case 'hit': SFX.play('hit', e.crit||e.counter); var hp=bossHitPos(HITMAP[e.part]||'body'); hp.x+=Math.random()*0.6-0.3; num(hp, W.fmt(e.dmg), e.counter?'counter':e.crit?'crit':''); boss.anim.flash=0.12; burst(hp, e.counter?36:e.crit?22:12); if(!e.counter && s.enemy.state!=='downed') bossPlay('flinch'); if(e.counter){ flash(); vib(40); shake(0.01,260); zoomKick(); } else shake(0.003,90); break;
      case 'attack': ainAttack('light', e.combo); SFX.play('swing'); comboShow(e.combo, false); break;
      case 'whiff': ainAttack('light', 1); SFX.play('swing'); num(above(P.x,P.y,2.1), e.ult?'사거리 밖':'닿지 않는다', 'miss'); break;
      case 'counter': SFX.play('counter', e.perfect); slowmo(e.perfect?0.2:0.35, e.perfect?520:380); banner(e.perfect?'P E R F E C T':'C O U N T E R', lastHit, e.pattern+(e.perfect?' · 완벽한 타이밍':' · 카운터 성공'), e.perfect); bossStop(); bossPlay('stagger'); zone=null; hideZone(); break;
      case 'break': SFX.play('brk'); var bp=bossHitPos(HITMAP[e.part]); num(bp, '부위 파괴 — '+e.name, 'crit'); burst(bp, 40, 0x7B9BD6); vib([30,40,30]); guide('<b>'+e.name+'</b> 파괴. 자세가 무너진다', 2.5); bossDetach(HITMAP[e.part]); bossPlay('stagger'); shake(0.008,300); break;
      case 'downed': SFX.play('down'); guide('<b>격추!</b> 5초 동안 모든 피해 1.5배', 3); bossPlay('down'); zone=null; hideZone(); shake(0.012,400); break;
      case 'up': guide('허수아비가 자세를 되찾았다', 1.5); bossPlay('up'); break;
      case 'telegraph': SFX.play('tele'); zone=world.makeZone({ zone:L.zones[e.pattern] }, Bs.x, Bs.y, P.x, P.y); zone.pattern=e.pattern; bossPlay('tele_'+e.icon, { dur:e.dur }); if(phase===2 && !seen.tele3){ seen.tele3=1; guide('붉은 범위 안에 있으면 맞는다 · 고리가 <b>흰색</b>일 때 붙어서 탭 = 카운터', 3.5); } if(phase===1 && !seen.tele2){ seen.tele2=1; guide('붉은 범위 <b>밖으로 구르면</b> 피한다', 3); } break;
      case 'swing': bossPlay('hit_'+s.enemy.patIcon); shake(0.009,220); setTimeout(function(){ zone=null; hideZone(); }, 180); break;
      case 'miss': num(above(P.x,P.y,2.1), e.out?'범위 밖':'회피', 'miss'); break;
      case 'damaged': SFX.play('hurt', e.guarded); num(above(P.x,P.y,2.1), '-'+W.fmt(e.dmg)+(e.guarded?' 방어':''), 'taken'); ain.hitT=0.18; if(!e.guarded) playOnce('hit',{speed:1.4}); burst(above(P.x,P.y,1.2), 16, 0xD94A45); vib(e.guarded?15:60); shake(e.guarded?0.004:0.012, 300); break;
      case 'early': guide('너무 빨랐다. 예고가 <b>끝나는 순간</b>에 쳐라', 1.6); break;
      case 'ultready': if(e.first) guide('궁극기 준비 완료 — <b>R</b> 을 눌러라', 3.5); break;
      case 'ult': SFX.play('ult'); ainAttack('ult'); slowmo(0.3, 500); banner('T W I L I G H T', lastHit, ULT.name+' · 출혈 3중첩', true); flash(); vib([50,30,80]); shake(0.02,500); burst(bossHitPos('core'), 60, 0xD94A45); break;
      case 'skill': var k=SK[e.index]; if(k.mult===0) guide('<b>'+k.name+'</b> — '+k.desc, 1.4); if(k.dodge) doRoll(); else if(k.mult>0) ainAttack(k.aoe?'smash':'skill'); break;
      case 'nost': guide('스태미나 부족', 1); break;
      case 'guard': if(e.on) SFX.play('guard'); if(e.broke) guide('스태미나 소진 — 방어 해제', 1.5); break;
      case 'dodge': doRoll(); break;
      case 'death': if(e.fatal) deathOverlay(); else guide('마태오 — “다시.”', 2); break;
      case 'smash': ainAttack('smash'); comboShow('SMASH', true); shake(0.01+e.tier*0.004, 220+e.tier*60); break;
      case 'riposte': banner('R I P O S T E', lastHit, '방어 직후 반격 · 자세 +25', true); SFX.play('counter', true); break;
      case 'guardhit': SFX.play('guard'); playOnce('guardHit',{speed:1.6}); break;
      case 'clear': phaseClear(); break;
    }
  }
  function doRoll(){ var ks=curStick()||{sx:0,sy:0}; world.roll(P, ks.sx, ks.sy, L.player.rollLen, L.player.rollDur); SFX.play('roll'); playOnce('roll',{ speed:0.38/L.player.rollDur }); }
  function slowmo(scale, ms){ timeScale=scale; var t0=performance.now(); (function up(){ var k=Math.min(1,(performance.now()-t0)/ms); timeScale=scale+(1-scale)*k*k; if(k<1) requestAnimationFrame(up); else timeScale=1; })(); }
  function autoQuality(){ if(autoLow||!SET.lights||navigator.webdriver) return; var avg=fpsSamples.reduce(function(a,b){ return a+b; },0)/fpsSamples.length; if(avg<24){ autoLow=true; SET.lights=false; renderer.shadowMap.enabled=false; applySettings(); guide('프레임이 낮아 <b>조명을 껐습니다</b> (일시정지 메뉴에서 변경)', 3); } }

  /* ---------- 잡몹 이벤트 ---------- */
  function handleSk(e){
    var m=e.mob!=null ? skirm.mobs.filter(function(x){ return x.id===e.mob; })[0] : null, me=m&&mobsEnt[m.id];
    switch(e.t){
      case 'hit': SFX.play('hit', e.crit||e.smash); num(above(m.x,m.y,1.7), W.fmt(e.dmg), e.smash?'counter':e.crit?'crit':''); burst(above(m.x,m.y,1.2), e.smash?26:10); if(me){ me.flash=0.1; } shake(e.smash?0.008:0.003, 100); break;
      case 'attack': ainAttack('light', e.combo); SFX.play('swing'); comboShow(e.combo,false); break;
      case 'smash': ainAttack('smash'); SFX.play('swing'); comboShow('SMASH',true); slowmo(0.55, 160); break;
      case 'whiff': ainAttack('light', 1); SFX.play('swing'); break;
      case 'kill': SFX.play('brk'); burst(above(m.x,m.y,1.2), 36, 0xC9A45E); quest.mobs++; renderQuest(); SAVE.stat('kills'); dropLoot(m.x, m.y, e.def); gainXp(e.def.xp, e.def.name); break;
      case 'aggro': SFX.play('tele'); break;
      case 'telegraph': SFX.play('tele'); break;
      case 'swing': shake(0.004,120); break;
      case 'damaged': SFX.play('hurt', e.guarded); num(above(P.x,P.y,2.1), '-'+W.fmt(e.dmg)+(e.guarded?' 방어':''), 'taken'); ain.hitT=0.18; if(!e.guarded) playOnce('hit',{speed:1.4}); burst(above(P.x,P.y,1.2), 14, 0xD94A45); vib(e.guarded?15:60); shake(e.guarded?0.004:0.01, 260); break;
      case 'miss': num(above(P.x,P.y,2.1), e.out?'범위 밖':'회피', 'miss'); break;
      case 'dodge': doRoll(); break;
      case 'guard': if(e.on) SFX.play('guard'); if(e.broke) guide('스태미나 소진 — 방어 해제', 1.5); break;
      case 'nost': guide('스태미나 부족', 1); break;
      case 'death': deathOverlay(); break;
    }
  }
  function openGate(silent){ gateOpen=true; world.setSolid(gate.cx, gate.cy, false); gateMesh.visible=false; if(!silent){ guide(L.beats.mobsClear, 3); SFX.play('chains'); } }
  /* ---------- 드랍·경험치·퀘스트·대화·콤보 ---------- */
  function toast(html){ var t=document.createElement('div'); t.className='toast'; t.innerHTML=html; el.toasts.appendChild(t); setTimeout(function(){ t.remove(); }, 1800); }
  function dropLoot(x,y,def){ var T=window.TW_ITEMS; for(var i=0;i<3;i++) spawnPickup(x+(Math.random()*80-40), y+(Math.random()*40-20), 'gold', Math.round(def.gold/3)); (def.drops||[]).forEach(function(dr){ var it=T.get(dr[0]); spawnPickup(x+(Math.random()*80-40), y+(Math.random()*40-20), 'item', dr[1], dr[0], it?it.name:dr[0]); }); }
  var strawSprMat=null;
  function spawnPickup(x,y,kind,amt,id,name){ var sp; if(kind==='gold'){ sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xF0C060, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); sp.scale.set(0.5,0.5,1); } else { strawSprMat=strawSprMat||new THREE.SpriteMaterial({ map:tex('straw'), transparent:true }); sp=new THREE.Sprite(strawSprMat); sp.scale.set(0.5,0.42,1); }
    sp.position.copy(v3(x,y,1.0)); scene.add(sp); pickups.push({ sp:sp, x:x, y:y, kind:kind, amt:amt, id:id, name:name, t:0, taken:false, vy:0 }); }
  function tickPickups(dt){ pickups=pickups.filter(function(p){ if(p.taken) return false; p.t+=dt; if(p.sp.position.y>0.3){ p.vy-=9*dt; p.sp.position.y=Math.max(0.3, p.sp.position.y+p.vy*dt); if(p.sp.position.y<=0.3&&p.vy<0) p.vy=-p.vy*0.4; } p.sp.position.y+=Math.sin(p.t*4)*0.002;
      if(p.t>0.4 && world.dist(P.x,P.y,p.x,p.y)<170){ p.taken=true; scene.remove(p.sp); if(p.kind==='gold'){ SAVE.addGold(p.amt); toast('<b>+'+p.amt+'</b> 골드'); } else { SAVE.addItem(p.id, p.amt); toast(p.name+' <b>×'+p.amt+'</b>'); } SFX.play('ui'); renderProg(); return false; } return true; }); }
  function gainXp(n, why){ var r=SAVE.addXp(n); toast('경험치 <b>+'+n+'</b>'+(why?' · '+why:'')); if(r.leveled){ toast('<b>LEVEL UP</b> — Lv.'+r.lv); SFX.play('clear'); flash(); burst(above(P.x,P.y,1.4), 50, 0x5FAE9B); } renderProg(); }
  function renderProg(){ var sv=SAVE.get(); fill('v-xp', sv.xp/SAVE.need(sv.lv)*100); $('#xp-lv').textContent='LV.'+sv.lv; $('#v-gold').textContent=W.fmt(sv.gold)+' G'; }
  function renderQuest(){ var q=L.beats.quest, prog=[quest.mobs, quest.gate, quest.boss], curI=-1; var html='<div class="quest__t">훈련장 수료</div>'; q.forEach(function(it,i){ var done=prog[i]>=it[1]; if(!done&&curI<0) curI=i; html+='<div class="q'+(done?' done':i===curI?' cur':'')+'"><span>'+it[0]+'</span><span>'+Math.min(prog[i],it[1])+' / '+it[1]+'</span></div>'; }); el.quest.innerHTML=html; }
  function comboShow(n, big){ if(n===0) return; el.comboN.textContent=n; el.combo.classList.toggle('big', !!big); el.combo.classList.add('is-on'); comboT=1.1; }
  var dlgLines=null, dlgI=0, dlgDone=null;
  function dialogue(lines, done){ dlgLines=lines; dlgI=0; dlgDone=done; cine=true; showLine(); }
  function showLine(){ var l=dlgLines[dlgI]; el.dlgWho.textContent=l[0]; el.dlgTxt.textContent=l[1]; el.dlg.classList.add('is-on'); SFX.play('ui'); }
  el.dlg.addEventListener('pointerdown', function(e){ e.stopPropagation(); dlgI++; if(dlgI<dlgLines.length) showLine(); else { el.dlg.classList.remove('is-on'); cine=false; dlgDone&&dlgDone(); } });
  document.addEventListener('keydown', function(e){ if(el.dlg.classList.contains('is-on') && (e.code==='Space'||e.code==='Enter')){ e.preventDefault(); el.dlg.dispatchEvent(new PointerEvent('pointerdown')); } });
  function deathOverlay(){ if(state==='dead') return; state='dead'; battle=null; SFX.play('down'); flash(); shake(0.02,600); ain.hitT=9; ain.dead=true; playOnce('death',{ hold:true, speed:1.1 }); camZoom=1.25;
    setTimeout(function(){ el.ov.classList.add('deathov'); overlay('<div class="ov__k">쓰러졌다</div><div class="ov__t">'+L.name+'</div><div class="ov__line">마태오 — “다시.”</div><div class="ov__hint">문 앞에서 다시 시작한다. 잡은 것과 얻은 것은 남는다.</div><button class="btn btn--primary" data-go>문 앞에서 재도전</button> <a class="btn" href="office.html" style="margin-left:8px">사무실로</a>', function(){ try{ sessionStorage.setItem('tw:retry','gate'); }catch(e){} location.reload(); }); }, 1400); }

  /* ---------- 흐름 ---------- */
  function overlay(html, onBtn){ el.ovBox.innerHTML=html; el.ov.classList.add('is-on'); var b=el.ovBox.querySelector('[data-go]'); if(b) b.addEventListener('click', function(){ el.ov.classList.remove('is-on'); onBtn&&onBtn(); }); }
  var cineCam=null; /* {from,to,look,t,dur} */
  function startFight(){ state='fight'; world.setSolid(gate.cx, gate.cy, true); gateClosed=true; P.x=Math.max(P.x, (gate.cx+1)*map.cell + P.r + 6); gateMesh.visible=true;
    SFX.play('gate'); vib([40,60,40]); shake(0.01,500); guide(L.beats.gate, 2.5);
    cine=true; stick.sx=stick.sy=0;
    var bpos=v3(Bs.x,Bs.y,1.6), pcam=camPos.clone();
    setTimeout(function(){ cineCam={ from:pcam.clone(), to:bpos.clone().add(new THREE.Vector3(-3.5,1.4,4.5)), look:bpos, t:0, dur:1.1 }; SFX.play('chains'); bossPlay('stagger'); }, 500);
    setTimeout(function(){ boss.anim.glow=1.2; banner('B O S S', 0, A.stages[0].name+' · '+L.place, false); el.cV.textContent='허수아비'; SFX.play('phase'); shake(0.012, 600); burst(bossHitPos('core'), 40, 0xD94A45); }, 1700);
    setTimeout(function(){ cineCam={ from:cineCam.to.clone(), to:camPos.clone(), look:null, t:0, dur:0.9, back:true }; }, 3200);
    setTimeout(function(){ cineCam=null; cine=false; el.bosshp.classList.remove('is-off'); el.timerBox.classList.remove('is-off'); fightT=0; startPhase(0); }, 4200); }
  function phaseClear(){ var m=Object.assign({}, battle.metrics); stageResults.push(m); PS=battle.exportPlayer(); bossStop(); zone=null; hideZone(); gainXp(150+phase*100, '페이즈 돌파');
    if (phase < A.stages.length-1){ var next=phase+1; battle=null; SFX.play('phase'); bossPlay('stagger'); flash(); vib([30,30,60]); burst(bossHitPos('core'), 50, next===1?0xC9A45E:0xD94A45); num(bossHitPos('head'), next===1?'사슬이 끊어진다':'핵이 타오른다', 'counter'); setTimeout(function(){ startPhase(next); }, 1400); }
    else { battle=null; state='clear'; quest.boss=1; renderQuest(); gainXp(400, '허수아비 격파'); SAVE.stat('runs'); SFX.play('brk'); setTimeout(function(){ SFX.play('clear'); }, 900); bossPlay('collapse'); playOnce('cheer',{hold:true}); el.timerBox.classList.add('is-off'); var sum=CB.summarize(R, A, stageResults); camZoom=1.15;
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
  /* 카메라 회전: 캔버스 드래그 */
  var drag=null; el.canvas.addEventListener('pointerdown', function(e){ drag={ id:e.pointerId, x:e.clientX, y:e.clientY, moved:0 }; el.canvas.setPointerCapture(e.pointerId); });
  el.canvas.addEventListener('pointermove', function(e){ if(!drag||drag.id!==e.pointerId) return; var dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY; drag.moved+=Math.abs(dx)+Math.abs(dy); dragT=3; camYaw-=dx*0.006; camPitch=Math.max(0.25, Math.min(1.1, camPitch+dy*0.004)); });
  el.canvas.addEventListener('pointerup', function(e){ if(drag && drag.moved<8) tapTarget(e); drag=null; }); el.canvas.addEventListener('pointercancel', function(){ drag=null; });
  el.canvas.addEventListener('wheel', function(e){ camDist=Math.max(4, Math.min(14, camDist+e.deltaY*0.01)); }, { passive:true });
  var ray=new THREE.Raycaster(); function tapTarget(e){ if(!battle) return; var r=el.canvas.getBoundingClientRect(); var m=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(m, cam); var hits=ray.intersectObjects(boss.raycastable, true); if(!hits.length) return; var o=hits[0].object; while(o && !(o.name in HITMAP) && o.parent) o=o.parent; var id=o&&o.name; var rev={}; Object.keys(HITMAP).forEach(function(k){ rev[HITMAP[k]]=k; }); var pid=rev[id]; if(!pid) return; var s=battle.snapshot(); if(!s.enemy.parts.some(function(p){ return p.id===pid; })) return; battle.input('target', pid); var pn=s.enemy.parts.filter(function(p){ return p.id===pid; })[0]; guide('조준: <b>'+pn.name+'</b>', 1.2); }
  /* 스틱 → 카메라 기준 월드 방향 */
  function stickWorld(){ var f=new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)); var r=new THREE.Vector3(-f.z, 0, f.x); var d=f.clone().multiplyScalar(-stick.sy).add(r.clone().multiplyScalar(stick.sx)); return { sx:d.x, sy:d.z }; }
  function keyStick(){ var x=(kd.KeyD||kd.ArrowRight?1:0)-(kd.KeyA||kd.ArrowLeft?1:0), y=(kd.KeyS||kd.ArrowDown?1:0)-(kd.KeyW||kd.ArrowUp?1:0); if(x||y){ var m=Math.hypot(x,y); var f=new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)); var r=new THREE.Vector3(-f.z, 0, f.x); var d=f.clone().multiplyScalar(-y/m).add(r.clone().multiplyScalar(x/m)); return {sx:d.x, sy:d.z}; } return null; }
  var botStick=null, botMode=false;
  function curStick(){ if(botStick) return botStick; if(botMode) return Math.hypot(stick.sx,stick.sy)>0.15?{sx:stick.sx,sy:stick.sy}:null; var ks=keyStick(); if(ks) return ks; if(Math.hypot(stick.sx,stick.sy)>0.15) return stickWorld(); return null; }
  function nearestMob(){ var best=null, bd=1e9; skirm.mobs.forEach(function(m){ if(m.dead) return; var d=world.dist(P.x,P.y,m.x,m.y); if(d<bd){ bd=d; best=m; } }); return best; }
  function attack(){ if(paused||cine) return; if(battle){ if(Bs.dist<=L.player.reach*1.2) world.faceTo(P, Bs.x, Bs.y); battle.input('attack'); } else if(skirm){ var m=nearestMob(); if(m && world.dist(P.x,P.y,m.x,m.y)<=L.player.reach*1.3) world.faceTo(P, m.x, m.y); skirm.input('attack'); } }
  function smashIn(){ if(paused||cine) return; if(battle){ if(Bs.dist<=L.player.reach*1.2) world.faceTo(P, Bs.x, Bs.y); battle.input('smash'); } else if(skirm){ var m=nearestMob(); if(m && world.dist(P.x,P.y,m.x,m.y)<=L.player.reach*1.3) world.faceTo(P, m.x, m.y); skirm.input('smash'); } }
  function guardIn(on){ if(battle) battle.input('guard', on); else if(skirm) skirm.input('guard', on); }
  function dodge(){ if(paused||cine) return; if(battle) battle.input('dodge'); else if(skirm) skirm.input('dodge'); else if(P.rollT<=0) doRoll(); }
  el.actions.addEventListener('pointerdown', function(e){ e.preventDefault(); e.stopPropagation(); var t=e.target.closest('.abtn'); if(!t||paused) return;
    if(t.hasAttribute('data-atk')){ attack(); t.classList.add('is-hold'); holdTimer=setTimeout(function(){ smashIn(); t.classList.remove('is-hold'); }, R.combo.smashHold*1000); }
    else if(t.hasAttribute('data-guard')){ guarding=true; guardIn(true); t.classList.add('is-hold'); }
    else if(t.hasAttribute('data-dodge')) dodge(); else if(t.hasAttribute('data-ult')) battle&&battle.input('ult'); else if(t.hasAttribute('data-skill')) battle&&battle.input('skill', +t.getAttribute('data-skill')); });
  function atkUp(){ if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; } if(guarding){ guarding=false; guardIn(false); } el.actions.querySelectorAll('.is-hold').forEach(function(b){ b.classList.remove('is-hold'); }); }
  el.actions.addEventListener('pointerup', atkUp); el.actions.addEventListener('pointercancel', atkUp); el.actions.addEventListener('pointerleave', atkUp);
  document.addEventListener('keydown', function(e){ if(kd[e.code]) return; kd[e.code]=true; if(paused) return;
    if(e.code==='Space'||e.code==='KeyJ'){ e.preventDefault(); attack(); } else if(e.code==='KeyU') smashIn(); else if(e.code==='KeyK') dodge(); else if(e.code==='KeyL') guardIn(true);
    else if(e.code==='KeyR') battle&&battle.input('ult'); else if(/^Digit[1-4]$/.test(e.code)) battle&&battle.input('skill', +e.code.slice(5)-1);
    else if((e.code==='KeyQ'||e.code==='Tab')&&battle){ e.preventDefault(); var s=battle.snapshot(), ids=s.enemy.parts.map(function(p){return p.id;}), i=ids.indexOf(s.target); battle.input('target', ids[(i+1)%ids.length]); }
    else if(e.code==='KeyE') camYaw-=0.3; else if(e.code==='KeyQ') camYaw+=0.3; });
  document.addEventListener('keyup', function(e){ kd[e.code]=false; if(e.code==='KeyL') guardIn(false); });
  function settingsHTML(){ return '<div class="setrow"><label>밝기</label><input type="range" min="0.6" max="1.8" step="0.05" value="'+SET.bright+'" data-set="bright"></div>'+
    '<div class="setrow"><label>동적 조명</label><button class="btn btn--sm" data-tog="lights">'+(SET.lights?'켜짐':'꺼짐')+'</button><label>진동</label><button class="btn btn--sm" data-tog="vib">'+(SET.vib?'켜짐':'꺼짐')+'</button><label>소리</label><button class="btn btn--sm" data-tog="sound">'+(SET.sound?'켜짐':'꺼짐')+'</button></div>'; }
  el.ovBox.addEventListener('input', function(e){ var k=e.target.getAttribute('data-set'); if(!k) return; SET[k]=+e.target.value; saveSet(); applySettings(); });
  el.ovBox.addEventListener('click', function(e){ var b=e.target.closest('[data-tog]'); if(!b) return; var k=b.getAttribute('data-tog'); SET[k]=!SET[k]; b.textContent=SET[k]?'켜짐':'꺼짐'; saveSet(); applySettings(); if(k==='sound'&&SET.sound) SFX.ambient(true); SFX.play('ui'); });
  $('#btn-pause').addEventListener('click', function(){ paused=!paused; SFX.play('ui'); if(paused) overlay('<div class="ov__k">일시정지</div><div class="ov__t">'+L.name+'</div><div class="ov__hint" style="margin-top:12px">'+(battle?A.stages[phase].hint:L.beats.start)+'</div>'+settingsHTML()+'<button class="btn btn--primary" data-go>계속</button> <a class="btn" href="office.html" style="margin-left:8px">사무실로</a>', function(){ paused=false; }); });

  /* ---------- 시작 ---------- */
  function begin(){
    var mobs=world.marks('m').map(function(mk,i){ return { id:'m'+i, x:mk.x, y:mk.y, def:L.mob }; });
    if(RETRY==='gate'){ mobs=[]; quest.mobs=L.beats.quest[0][1]; }
    skirm=SKM.create({ char:CHAR, rules:R, world:world, player:P, state:PS, mobs:mobs, reach:L.player.reach, cone:1.3 });
    mobs.forEach(function(m){ mobsEnt[m.id]=mkMob(m); });
    world.setSolid(gate.cx, gate.cy, true); gateMesh.visible=true;
    if(RETRY==='gate'){ openGate(true); P.x=(gate.cx+1)*map.cell+P.r+8; P.y=gate.y; }
    setupPhase(A.stages[0]); Object.keys(boss.hits).forEach(function(k){ boss.hits[k].visible=false; });
    applySettings(); el.loading.classList.add('is-off'); SFX.ambient(true); renderQuest(); renderProg(); ain.ready=true;
    overlay('<div class="ov__k">던전 01</div><div class="ov__t">'+L.name+'</div><div class="ov__l">'+L.place+'</div><div class="ov__line">마태오 — “뒷마당에 허수아비를 묶어 뒀다. 살아 있는 것처럼 굴 테니, 살아 있는 것처럼 상대해라.”</div><div class="ov__hint">문을 지나면 전투가 시작된다. 붉은 범위 밖으로 구르고, 고리가 흰색일 때 붙어서 쳐라.</div><button class="btn btn--primary" data-go>입장</button>'+
      '<div class="ov__ctrl">폰: 왼쪽 스틱 이동 · 화면 드래그로 시점 회전 · 큰 버튼 탭 공격(4연타) · 길게 스매시 · 회피 · 방어 · 기술 1~4 · R<br>키보드: WASD 이동 · Q/E 시점 · J 공격 · U 스매시 · K 회피 · L 방어 · 1~4 · R · Tab 조준 전환</div>', function(){ if(RETRY!=='gate') dialogue(L.beats.dialog, function(){ guide(L.beats.start, 4); }); else guide('문 앞에서 다시. 허수아비가 기다린다', 3); });
    last=performance.now(); requestAnimationFrame(frame);
  }

  /* ---------- 스텝 · 렌더 ---------- */
  function step(dt){
    var ks=curStick(); var sx=ks?ks.sx:0, sy=ks?ks.sy:0; if(cine||ain.dead){ sx=sy=0; }
    var s=battle?battle.snapshot():null; P.lockT=(s&&(s.player.guard||s.player.locked))?1:0;
    if(ain.dead) P.moving=false; else world.movePlayer(P, sx, sy, dt, L.player.speed);
    if(state==='explore'){
      if(!seen.sign && world.dist(P.x,P.y,sign.x,sign.y)<110){ seen.sign=1; guide(L.beats.sign, 4); }
      if(!gateOpen && lockedT<=0 && world.dist(P.x,P.y,gate.x,gate.y)<120){ lockedT=3; guide(L.beats.gateLocked, 2.5); SFX.play('guard'); }
      if(gateOpen && Math.floor(P.x/map.cell)>=L.bossRoom.minCx && P.x>gate.x+map.cell*0.6){ quest.gate=1; renderQuest(); startFight(); }
      if(skirm && !skirm.dead){ P.lockT=(skirm.snapshot().player.guard)?1:0; acc+=dt; var n2=0; while(acc>=R.tick && n2<6){ skirm.tick(R.tick); acc-=R.tick; n2++; } skirm.drain().forEach(handleSk); if(skirm.over && !gateOpen) openGate(false); }
    }
    if(lockedT>0) lockedT-=dt; if(comboT>0){ comboT-=dt; if(comboT<=0) el.combo.classList.remove('is-on'); }
    tickPickups(dt);
    if(battle){ var busy=s.enemy.state!=='idle'; world.bossThink(Bs, P, dt, L.ai[phase], busy); acc+=dt; var n=0; while(acc>=R.tick && n<6){ battle.tick(R.tick); acc-=R.tick; n++; } fightT+=dt; battle.drain().forEach(function(e){ if(e.t==='hit') lastHit=e.dmg; handle(e); }); }
    else Bs.dist=world.dist(Bs.x,Bs.y,P.x,P.y);
    if(guideT>0){ guideT-=dt; if(guideT<=0) el.guide.classList.remove('is-on'); } if(counterT>0){ counterT-=dt; if(counterT<=0) el.counter.classList.remove('is-on'); }
  }
  function fill(id, pct){ var b=$('#'+id), f=b&&b.querySelector('.bar__fill'); if(f){ f.style.transition='none'; f.style.width=Math.max(0,Math.min(100,pct))+'%'; } }
  var flickT=0, last=0;
  function updateCamera(dt){
    /* 목표: 플레이어(전투 중엔 플레이어·보스 중간 쪽) 를 바라보며 뒤·위에서 */
    var pp=v3(P.x,P.y,1.2); var look=pp.clone(); if(battle){ var bp=v3(Bs.x,Bs.y,1.4); look.lerp(bp, 0.3); }
    if(dragT>0) dragT-=dt; else if(!cineCam){ var want=null; if(battle){ want=Math.atan2(pp.x-X(Bs.x), pp.z-Z(Bs.y)); } else if(P.moving && P.rollT<=0){ var a=P.aim||0; want=Math.atan2(-Math.cos(a), -Math.sin(a)); }
      if(want!=null){ var dy=want-camYaw; while(dy>Math.PI) dy-=Math.PI*2; while(dy<-Math.PI) dy+=Math.PI*2; camYaw+=dy*Math.min(1,dt*(battle?1.6:0.9)); } }
    var dist=camDist*camZoom; if(camZoom>1) camZoom+= (1-camZoom)*Math.min(1,dt*0.35);
    var z=Math.pow(0.001, dt);
    var target=new THREE.Vector3(look.x+Math.sin(camYaw)*Math.cos(camPitch)*dist, look.y+Math.sin(camPitch)*dist, look.z+Math.cos(camYaw)*Math.cos(camPitch)*dist);
    if(cineCam){ cineCam.t+=dt; var k=Math.min(1,cineCam.t/cineCam.dur); k=k*k*(3-2*k); var to=cineCam.back?target:cineCam.to; camPos.copy(cineCam.from).lerp(to,k); camLook.lerp(cineCam.look||look, cineCam.back?k:Math.min(1,k*1.5)); }
    else { camPos.lerp(target, 1-z); camLook.lerp(look, 1-Math.pow(0.0005,dt)); }
    /* 벽 안쪽으로: 맵 밖으로 나가지 않게 */
    camPos.x=Math.max(-2, Math.min(mapW+2, camPos.x)); camPos.z=Math.max(-2, Math.min(mapD+4, camPos.z)); camPos.y=Math.max(1.2, camPos.y);
    cam.position.copy(camPos); if(shakeT>0){ shakeT-=dt; cam.position.x+=(Math.random()-0.5)*shakeAmt*0.1; cam.position.y+=(Math.random()-0.5)*shakeAmt*0.1; } else shakeAmt=0;
    cam.lookAt(camLook); if(zoomPulse>0){ zoomPulse-=dt*4; cam.fov=50-Math.max(0,zoomPulse)*4; cam.updateProjectionMatrix(); }
    /* 달빛 그림자 카메라를 플레이어 주변으로 */
    moon.position.set(ain.root.position.x-8, 18, ain.root.position.z-6); moon.target.position.copy(ain.root.position); var sc=moon.shadow.camera; sc.left=-14; sc.right=14; sc.top=14; sc.bottom=-14; sc.updateProjectionMatrix();
  }
  function render(dt){
    ainTick(dt); bossTick(dt); renderMobs(dt); tickSparks(dt);
    flickT+=dt; torchLights.forEach(function(t,i){ var f=0.85+Math.sin(flickT*9+i*1.7)*0.08+Math.random()*0.1; t.l.intensity=SET.lights?t.base*f:0; t.fx.material.opacity=0.55*f; t.fx.scale.setScalar(1.2+f*0.2); });
    emberT+=dt; if(emberT>0.12){ emberT=0; torchLights.forEach(function(t){ if(Math.random()<0.5){ var i=spI=(spI+1)%SPN; spPos[i*3]=t.l.position.x+(Math.random()-0.5)*0.2; spPos[i*3+1]=t.l.position.y; spPos[i*3+2]=t.l.position.z+(Math.random()-0.5)*0.2; spVel[i].set((Math.random()-0.5)*0.3, 1.2+Math.random()*0.8+9.8*0.6, (Math.random()-0.5)*0.3); spLife[i]=0.6; spCol[i*3]=1; spCol[i*3+1]=0.6; spCol[i*3+2]=0.25; } }); }
    /* 존 */
    if(zone && battle){ var s=battle.snapshot(), win=s.enemy.state==='telegraph'&&s.enemy.tele<=s.enemy.window, col=win?0xF0E4E4:0xC7332C, fr=s.enemy.state==='telegraph'?1-s.enemy.tele/s.enemy.teleDur:1; drawZone(zone, fr, col, 'boss'); } else hideZone('boss');
    reachRing.visible=!!battle; if(battle){ reachRing.position.set(ain.root.position.x, 0.02, ain.root.position.z); reachRing.material.color.setHex(Bs.dist<=L.player.reach?0xC9A45E:0xFFFFFF); reachRing.material.opacity=Bs.dist<=L.player.reach?0.5:0.12; }
    updateCamera(dt); drawMini();
    if(!battle){ if(skirm){ var sp=skirm.snapshot().player; fill('v-hp', sp.hp/sp.hpMax*100); $('#v-hpv').textContent=W.fmt(Math.round(sp.hp))+' / '+W.fmt(sp.hpMax); fill('v-st', sp.st/sp.stMax*100); $('#v-stv').textContent=Math.round(sp.st)+' / '+sp.stMax; fill('v-ult', sp.ult); $('#v-ultv').textContent=Math.round(sp.ult)+'%'; fill('p-bar', sp.hp/sp.hpMax*100); $('#p-hp').textContent=W.fmt(Math.round(sp.hp)); } return; }
    var s2=battle.snapshot();
    fill('b-hp', s2.enemy.hp/s2.enemy.hpMax*100); el.stack.textContent=s2.enemy.bleed?'출혈 ×'+s2.enemy.bleed:'';
    fill('b-stag', s2.enemy.state==='downed'?100:s2.enemy.posture); el.stag.parentNode.classList.toggle('is-down', s2.enemy.state==='downed');
    el.timer.textContent=CB.fmtTime(fightT);
    fill('v-hp', s2.player.hp/s2.player.hpMax*100); $('#v-hpv').textContent=W.fmt(Math.round(s2.player.hp))+' / '+W.fmt(s2.player.hpMax);
    fill('v-st', s2.player.st/s2.player.stMax*100); $('#v-stv').textContent=Math.round(s2.player.st)+' / '+s2.player.stMax;
    fill('v-ult', s2.player.ult); $('#v-ultv').textContent=Math.round(s2.player.ult)+'%';
    fill('p-bar', s2.player.hp/s2.player.hpMax*100); $('#p-hp').textContent=W.fmt(Math.round(s2.player.hp));
    s2.enemy.parts.forEach(function(p){ var k=HITMAP[p.id], h=boss.hits[k]; if(!h) return; var tg=p.id===s2.target; h.scale.setScalar(tg?0.7:0.45); h.material.opacity=tg?1:0.55; if(p.broken) h.visible=false; });
    var sks=el.actions.querySelectorAll('[data-skill]'); s2.player.cds.forEach(function(cd,i){ var k=sks[i], o=k.querySelector('.sk__cd'); if(cd>0){ o.hidden=false; o.textContent=Math.ceil(cd); k.classList.remove('is-ready'); } else { o.hidden=true; k.classList.toggle('is-ready', s2.player.st>=SK[i].st); } });
    el.actions.querySelector('[data-ult]').classList.toggle('is-ready', s2.player.ult>=R.ult.max); el.actions.querySelector('[data-atk]').classList.toggle('is-ready', Bs.dist<=L.player.reach);
    var lines=[]; if(s2.enemy.bleed) lines.push(['drop','#C9534E','출혈','×'+s2.enemy.bleed]); if(s2.enemy.state==='downed') lines.push(['x','#C9A45E','격추',Math.ceil(s2.enemy.downT)+'s']); if(s2.player.guard) lines.push(['shield','#7B9BD6','방어 중','']); if(s2.player.buffT>0) lines.push(['shield','#5FAE9B','결의',Math.ceil(s2.player.buffT)+'s']); if(s2.player.critNext) lines.push(['bolt','#C9A45E','치명타 확정','']); if(s2.player.locked) lines.push(['x','#8A8A8A','경직','']);
    el.status.innerHTML=lines.map(function(l){ return '<div class="stline"><svg class="ico ico--xs" style="color:'+l[1]+'"><use href="#i-'+l[0]+'"/></svg>'+l[2]+'<b>'+l[3]+'</b></div>'; }).join('');
  }
  function drawMini(){ var c=el.mini, w=c.width, h=c.height; mctx.clearRect(0,0,w,h); var sx=w/map.w, sy=h/map.h;
    for(var y=0;y<map.h;y++) for(var x=0;x<map.w;x++){ var ch=map.rows[y][x]; if(ch==='#'||ch==='|'||(ch==='G'&&gateClosed)){ mctx.fillStyle='#3a3d45'; mctx.fillRect(x*sx,y*sy,sx,sy); } else if(ch==='G'){ mctx.fillStyle='#C9A45E'; mctx.fillRect(x*sx,y*sy,sx,sy); } }
    mctx.fillStyle='#D9544E'; mctx.beginPath(); mctx.arc(Bs.x/map.cell*sx, Bs.y/map.cell*sy, 4, 0, Math.PI*2); mctx.fill(); mctx.fillStyle='#F0E4E4'; mctx.beginPath(); mctx.arc(P.x/map.cell*sx, P.y/map.cell*sy, 3.5, 0, Math.PI*2); mctx.fill(); }
  function frame(now){ requestAnimationFrame(frame); var dt=Math.min(0.1,(now-last)/1000); last=now; if(paused||el.ov.classList.contains('is-on')){ renderer.render(scene, cam); return; }
    fpsSamples.push(1/Math.max(0.001,dt)); if(fpsSamples.length>180){ fpsSamples.shift(); autoQuality(); fpsSamples.length=0; }
    step(dt*timeScale); render(dt*timeScale); renderer.render(scene, cam); }

  window.TW_DUNGEON={ world:world, get battle(){ return battle; }, get skirm(){ return skirm; }, get quest(){ return quest; }, get gateOpen(){ return gateOpen; }, dlg:function(){ var d=document.querySelector('#dlg'); if(d.classList.contains('is-on')) d.dispatchEvent(new PointerEvent('pointerdown')); }, killPlayer:function(){ deathOverlay(); }, P:P, B:Bs, get state(){ return state; }, get phase(){ return phase; }, stick:stick, scene:scene, cam:cam, ain:ain, boss:boss, get camYaw(){ return camYaw; }, set camYaw(v){ camYaw=v; }, setBot:function(v){ botStick=v; }, get botMode(){ return botMode; }, set botMode(v){ botMode=!!v; }, start:function(){ var b=el.ovBox.querySelector('[data-go]'); if(b) b.click(); }, is3d:true };
})();
