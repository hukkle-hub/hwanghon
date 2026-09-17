/* 황혼 — 던전 01 (Three.js 3D 렌더러)
   월드 규칙(world-sim.js)·전투 규칙(combat.js)·잡몹(skirmish.js)·레벨(dungeon.js)·저장(save.js)은 그대로. 이 파일은 3D 렌더링·입력·연출·흐름만 담당.
   좌표: world-sim 의 저장 좌표 (x, y) → 3D (x/SCALE, 0, y/DEPTH/SCALE). 1 m = SCALE px. */
import * as THREE from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
(function(){
  var W=window.TW_WORLD, DG=window.TW_DUNGEONS, CB=window.TW_COMBAT, SIM=window.TW_WORLDSIM, L=(function(){ var id=null; try{ id=new URLSearchParams(location.search).get('d'); }catch(e){} return window.TW_LEVELS[id]||window.TW_LEVELS.d01; })(), $=function(s){return document.querySelector(s);};
  var A=DG.ARENAS[L.arena], R=DG.RULES, CHAR=(function(c){ return window.TW_GEAR ? Object.assign({}, c, { stats:Object.assign({}, c.stats, TW_GEAR.stats(c)) }) : c; })(W.CHARS[A.char]), SK=DG.SKILLS[A.char], ULT=DG.SKILLS[A.char+'Ult'], DEPTH=SIM.DEPTH;
  var SCALE=50; /* px per m */
  var MOBILE=Math.min(window.innerWidth, window.innerHeight)<=640;
  var world=SIM.createWorld({rows:L.rows, cell:L.cell}), map=world.map;
  var P=world.add('p',{x:world.marks('S')[0].x, y:world.marks('S')[0].y, r:L.player.r, rollT:0, lockT:0, aim:0, face:'down'});
  var Bs=world.add('b',{x:world.marks('B')[0].x, y:world.marks('B')[0].y, r:L.bossR||60, dist:999, faceX:1});
  var gate=world.marks('G')[0], sign=world.marks('s')[0];
  var state='explore', phase=0, battle=null, paused=false, stageResults=[], zone=null, fightT=0, acc=0, guideT=0, counterT=0, lastHit=0, seen={}, gateClosed=false;
  var stick={sx:0,sy:0,id:null,ox:0,oy:0}, holdTimer=null, guarding=false, kd={};
  var SFX=window.TW_SFX, SAVE=window.TW_SAVE, SKM=window.TW_SKIRMISH, timeScale=1, cine=false, fpsSamples=[], autoLow=false;
  var skirm=null, mobsEnt={}, PS={ hp:CHAR.stats.hp, st:R.stamina.max, ult:0 }, quest={ mobs:0, gate:0, boss:0, record:0, fragment:0 }, pickups=[], gateOpen=false, comboT=0, lockedT=0;
  var RETRY=(function(){ try{ var v=sessionStorage.getItem('tw:retry'); sessionStorage.removeItem('tw:retry'); return v; }catch(e){ return null; } })();
  var SET=(function(){ try{ return Object.assign({ bright:1, lights:true, vib:true, sound:true, quality:'auto' }, JSON.parse(localStorage.getItem('tw:settings')||'{}')); }catch(e){ return { bright:1, lights:true, vib:true, sound:true, quality:'auto' }; } })();
  function saveSet(){ try{ localStorage.setItem('tw:settings', JSON.stringify(SET)); }catch(e){} }
  var el={ dg:$('#dg'), flash:$('#flash'), bosshp:$('#bosshp'), name:$('#b-name'), stack:$('#b-stack'), ph:$('#b-ph'), timerBox:$('#bttimer'), timer:$('#b-timer'), counter:$('#counter'), cLb:$('#c-lb'), cV:$('#c-v'), cSub:$('#c-sub'), status:$('#status'), guide:$('#guide'), stickEl:$('#stick'), actions:$('#actions'), ov:$('#ov'), ovBox:$('#ov-box'), mini:$('#mini'), loading:$('#loading'), quest:$('#quest'), combo:$('#combo'), comboN:$('#combo-n'), toasts:$('#toasts'), dlg:$('#dlg'), dlgWho:$('#dlg-who'), dlgTxt:$('#dlg-txt'), stag:$('#b-stag'), canvas:$('#game3d') };
  var mctx=el.mini.getContext('2d');
  /* 로딩 화면·제목을 레벨에 맞춤 */
  (function(){ try{ document.title='황혼 — '+L.code+' '+L.name+' (3D)'; var k=$('.loading__k'), t=$('.loading__t'), pl=$('.loading__p'), a=$('.loading__art'); if(k) k.textContent=L.code; if(t) t.textContent=L.name; var ml=$('.mini__lb'); if(ml) ml.textContent=L.name; if(pl) pl.textContent=L.place; if(a&&L.env==='swamp') a.style.backgroundImage='url(art/'+(L.bg||'boss-marsh')+'.webp)'; }catch(e){} })();
  var HITMAP={}; Object.keys(A.parts3d||{}).forEach(function(k){ HITMAP[k]=k; });   /* 부위 id → 3D 부위 키 (아레나 parts3d 기준) */

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
  /* 저사양(안전) 모드: 셰이더 실패·컨텍스트 끊김·검은 화면이 감지되면 sessionStorage tw:safe=1 로 다시 시작한다 */
  var SAFE=(function(){ try{ return sessionStorage.getItem('tw:safe')==='1'; }catch(e){ return false; } })();
  var DIAG={ errors:[], gpu:'?', gl2:false, maxTex:0, maxFU:0, black:0, started:0 };
  var renderer=new THREE.WebGLRenderer({ canvas:el.canvas, antialias:!MOBILE && !SAFE, powerPreference:'high-performance' });
  try{ var _gl=renderer.getContext(), _dbg=_gl.getExtension('WEBGL_debug_renderer_info'); DIAG.gpu=_dbg?_gl.getParameter(_dbg.UNMASKED_RENDERER_WEBGL):'(unmasked 불가)'; DIAG.gl2=!!renderer.capabilities.isWebGL2; DIAG.maxTex=_gl.getParameter(_gl.MAX_TEXTURE_SIZE); DIAG.maxFU=_gl.getParameter(_gl.MAX_FRAGMENT_UNIFORM_VECTORS); }catch(e){ DIAG.errors.push('GL info: '+e.message); }
  renderer.debug.onShaderError=function(gl, program, vs, fs){ var msg=''; try{ msg=(gl.getProgramInfoLog(program)||'')+' | '+(gl.getShaderInfoLog(fs)||'')+' | '+(gl.getShaderInfoLog(vs)||''); }catch(e){} DIAG.errors.push('SHADER '+msg.slice(0,400)); console.error('shader error', msg); safeMode('shader'); };
  el.canvas.addEventListener('webglcontextlost', function(e){ e.preventDefault(); DIAG.errors.push('WEBGL CONTEXT LOST'); fatal('그래픽 장치 연결이 끊겼습니다', '메모리 부족이나 GPU 오류입니다. 저사양 모드로 다시 시작해 보세요.'); }, false);
  window.addEventListener('error', function(e){ DIAG.errors.push('JS '+(e.message||'')+' @'+String(e.filename||'').split('/').pop()+':'+(e.lineno||0)); });
  function safeMode(why){ DIAG.errors.push('safeMode: '+why); if(SAFE) return; try{ sessionStorage.setItem('tw:safe','1'); var st=JSON.parse(localStorage.getItem('tw:settings')||'{}'); st.lights=false; st.quality='low'; localStorage.setItem('tw:settings', JSON.stringify(st)); }catch(e){} location.reload(); }
  function diagText(){ var avg=fpsSamples.length?Math.round(fpsSamples.reduce(function(a,b){ return a+b; },0)/fpsSamples.length):0, inf=renderer.info; var c=renderer.domElement;
    return ['build '+(window.TW&&TW.BUILD||'?')+' · '+(SAFE?'저사양 모드':'일반 모드')+' · 화질 '+SET.quality+' · 조명 '+(SET.lights?'켬':'끔'), 'GPU: '+DIAG.gpu, 'WebGL'+(DIAG.gl2?'2':'1')+' · 최대 텍스처 '+DIAG.maxTex+' · 프래그먼트 유니폼 '+DIAG.maxFU, '캔버스 '+c.width+'×'+c.height+' (배율 '+renderer.getPixelRatio().toFixed(2)+', 화면 '+innerWidth+'×'+innerHeight+')', 'FPS '+avg+' · 드로우콜 '+inf.render.calls+' · 삼각형 '+inf.render.triangles+' · 텍스처 '+inf.memory.textures+' · 지오메트리 '+inf.memory.geometries+' · 프로그램 '+(inf.programs?inf.programs.length:0), '로드 '+loadN+'/4 · 검은 프레임 '+DIAG.black+' · 시작 후 '+(DIAG.started?Math.round((performance.now()-DIAG.started)/1000)+'s':'-'), 'UA: '+navigator.userAgent.slice(0,90)].concat(DIAG.errors.length?['오류 '+DIAG.errors.length+'건:'].concat(DIAG.errors.slice(-6)):['오류 없음']).join('\n'); }
  function fatal(t, sub){ overlay('<div class="ov__k">오류</div><div class="ov__t">'+t+'</div><div class="ov__hint">'+sub+'</div><div class="xs t-faint" style="text-align:left;line-height:1.7;margin:0 0 14px;word-break:break-all">'+diagText().replace(/\n/g,'<br>')+'</div><button class="btn btn--primary" data-go>저사양 모드로 다시 시작</button> <a class="btn" href="office.html" style="margin-left:8px">사무실로</a>', function(){ try{ sessionStorage.removeItem('tw:safe'); }catch(e){} safeMode('fatal'); }); }
  function showDiag(){ overlay('<div class="ov__k">진단</div><div class="ov__t">'+L.name+'</div><div class="xs t-dim" style="text-align:left;line-height:1.75;margin:10px 0 14px;word-break:break-all">'+diagText().replace(/\n/g,'<br>')+'</div><button class="btn btn--primary" data-go>계속</button> <button class="btn" data-safe style="margin-left:8px">'+(SAFE?'일반 모드로':'저사양 모드로')+' 다시 시작</button>', function(){ paused=false; }); var b=el.ovBox.querySelector('[data-safe]'); if(b) b.onclick=function(){ try{ if(SAFE){ sessionStorage.removeItem('tw:safe'); var st=JSON.parse(localStorage.getItem('tw:settings')||'{}'); st.lights=true; st.quality='auto'; localStorage.setItem('tw:settings', JSON.stringify(st)); location.reload(); } else safeMode('manual'); }catch(e){ location.reload(); } }; }
  /* 폰 GPU 보호: 큰 텍스처는 올리기 전에 줄인다 (8192² 한 장이 268MB) */
  var TEX_MAX=SAFE?1024:(MOBILE?2048:4096);
  function capTextures(root){ var seen=new Set(); root.traverse(function(o){ if(!o.isMesh) return; [].concat(o.material).forEach(function(m){ ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'].forEach(function(k){ var t=m[k]; if(!t||!t.image||seen.has(t)) return; seen.add(t); var im=t.image, w=im.width||im.videoWidth, h=im.height; if(!(w>TEX_MAX||h>TEX_MAX)) return; try{ var sc=TEX_MAX/Math.max(w,h), c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w*sc)); c.height=Math.max(1,Math.round(h*sc)); c.getContext('2d').drawImage(im,0,0,c.width,c.height); t.image=c; t.needsUpdate=true; DIAG.errors.push('tex '+w+'x'+h+' → '+c.width+' ('+k+')'); }catch(e){ DIAG.errors.push('tex cap fail '+e.message); } }); }); }); }
  renderer.setPixelRatio(Math.min(SAFE?0.75:SET.quality==='high'?2:SET.quality==='low'?0.9:(MOBILE?1.25:2), devicePixelRatio)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.45*SET.bright;
  renderer.shadowMap.enabled=!SAFE && !(MOBILE && SET.quality==='low'); renderer.shadowMap.type=MOBILE?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
  var scene=new THREE.Scene(); scene.background=new THREE.Color(0x0B0C0F); scene.fog=new THREE.FogExp2(0x0a0b0e, 0.032);
  var cam=new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  var camYaw=-Math.PI*0.5, camPitch=0.50, camDist=L.camDist?(MOBILE?L.camDist-0.8:L.camDist):(MOBILE?6.2:7.0), dragT=0, camLook=new THREE.Vector3(), camPos=new THREE.Vector3(), camFree=false, camZoom=1;
  function resize(){ var w=el.dg.clientWidth||innerWidth, h=el.dg.clientHeight||innerHeight; renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  /* ---------- 로딩 화면: 모든 텍스처·GLB 를 한 매니저로 세어 진행률 표시 ---------- */
  var LM=new THREE.LoadingManager(), ldDone=false;
  var TIPS=['<b>붉은 범위</b> 밖으로 구르면 피해를 받지 않는다.','고리가 <b>흰색</b>이 되는 순간 붙어서 치면 <b>카운터</b>.','<b>방어</b> 중에 맞으면 경직만 받고 체력은 지킨다.','4연타 뒤에 <b>길게</b> 누르면 스매시.','부위를 부수면 <b>파편</b>이 떨어진다. 줍자.','허수아비는 <b>3단계</b>로 깨어난다. 단계마다 패턴이 는다.','골드와 경험치는 죽어도 남는다. <b>격벽</b> 앞에서 다시.'];
  function ldSet(f, txt){ if(ldDone) return; var fill=document.getElementById('ld-fill'), pct=document.getElementById('ld-pct'), tx=document.getElementById('ld-txt'); if(fill) fill.style.width=Math.round(f*100)+'%'; if(pct) pct.textContent=Math.round(f*100)+'%'; if(tx&&txt) tx.textContent=txt; }
  function ldErr(msg){ var l=document.getElementById('loading'); if(l) l.classList.add('is-err'); ldSet(1, msg); }
  (function tips(){ var el=document.getElementById('ld-tip'), i=Math.floor(Math.random()*TIPS.length); if(!el) return; el.innerHTML=TIPS[i]; setInterval(function(){ if(ldDone) return; el.classList.add('is-fade'); setTimeout(function(){ i=(i+1)%TIPS.length; el.innerHTML=TIPS[i]; el.classList.remove('is-fade'); }, 300); }, 3000); })();
  LM.onProgress=function(url, n, total){ var f=0.08+0.9*(n/Math.max(total,1)); var what=/boss/.test(url)?'허수아비 깨우는 중':/ain_/.test(url)?'아인 준비 중':/props/.test(url)?'벙커 구조물 배치 중':'벙커 자산 불러오는 중'; ldSet(f, what+' · '+n+'/'+total); };
  LM.onError=function(url){ console.warn('load fail', url); };
  var TL=new THREE.TextureLoader(LM); function tex(n, rep){ var t=TL.load('art/env/'+n+'.webp'); t.colorSpace=THREE.SRGBColorSpace; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); } t.anisotropy=4; return t; }
  function texLin(n, rep){ var t=TL.load('art/env/'+n+'.webp'); if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); } return t; }
  function canvasTex(draw, size){ var c=document.createElement('canvas'); c.width=c.height=size||128; draw(c.getContext('2d'), c.width); var t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
  var glowTex=canvasTex(function(g,s){ var r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.35,'rgba(255,255,255,.55)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,s,s); });
  var ringTex=canvasTex(function(g,s){ g.strokeStyle='#fff'; g.lineWidth=s*0.08; g.beginPath(); g.arc(s/2,s/2,s*0.42,0,Math.PI*2); g.stroke(); }, 128);

  /* 조명 */
  var hemi=new THREE.HemisphereLight(0x6a7080, 0x2a2622, 0.8); scene.add(hemi);
  var moon=new THREE.DirectionalLight(0xa8b4d0, 1.1); moon.position.set(-8, 18, -6); moon.castShadow=true; moon.shadow.mapSize.set(MOBILE?1024:2048, MOBILE?1024:2048); moon.shadow.camera.near=1; moon.shadow.camera.far=60; moon.shadow.bias=-0.0015; scene.add(moon); scene.add(moon.target);
  var pLight=new THREE.PointLight(0xE0D0B8, 3.0, 10, 1.4); scene.add(pLight);
  var coreLight=new THREE.PointLight(0xE04A3C, 3.0, 9, 1.4); scene.add(coreLight);
    function applySettings(){ SFX.enabled=SET.sound; renderer.toneMappingExposure=1.45*SET.bright;  pLight.visible=SET.lights; coreLight.visible=SET.lights; hemi.intensity=SET.lights?0.8:1.5; lamps.forEach(function(t){ t.l.visible=SET.lights; }); }

  /* ---------- 환경: 지하 벙커 훈련실 (콘크리트·배관·매단 등·격벽) ---------- */
  function noiseTex(draw, size, srgb){ var c=document.createElement('canvas'); c.width=c.height=size||256; var g=c.getContext('2d'); draw(g, c.width); var t=new THREE.CanvasTexture(c); if(srgb!==false) t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t; }
  function grain(g, s, base, amp, n){ for(var i=0;i<n;i++){ var v=base+(Math.random()-0.5)*amp; g.fillStyle='rgb('+(v|0)+','+(v|0)+','+((v+4)|0)+')'; g.fillRect(Math.random()*s, Math.random()*s, 2+Math.random()*6, 2+Math.random()*6); } }
  var concreteFloor=noiseTex(function(g,s){ g.fillStyle='#4a4a4e'; g.fillRect(0,0,s,s); grain(g,s,74,40,9000); g.strokeStyle='rgba(20,20,24,.7)'; g.lineWidth=3; g.strokeRect(0,0,s,s); g.beginPath(); g.moveTo(s/2,0); g.lineTo(s/2,s); g.moveTo(0,s/2); g.lineTo(s,s/2); g.stroke();
    for(var i=0;i<14;i++){ g.fillStyle='rgba(30,26,24,'+(0.12+Math.random()*0.2)+')'; g.beginPath(); g.ellipse(Math.random()*s,Math.random()*s,20+Math.random()*60,10+Math.random()*30,Math.random()*3,0,Math.PI*2); g.fill(); } }, 512);
  var concreteWall=noiseTex(function(g,s){ g.fillStyle='#55555a'; g.fillRect(0,0,s,s); grain(g,s,84,36,7000); g.fillStyle='rgba(15,15,18,.55)'; for(var y=0;y<s;y+=s/4){ g.fillRect(0,y,s,3); } for(var i=0;i<10;i++){ var x=Math.random()*s; g.fillStyle='rgba(20,18,16,'+(0.1+Math.random()*0.25)+')'; g.fillRect(x,0,3+Math.random()*10,s); }
    for(var k=0;k<6;k++){ g.fillStyle='rgba(60,40,28,'+(0.15+Math.random()*0.2)+')'; g.fillRect(Math.random()*s, Math.random()*s*0.5, 6+Math.random()*30, 40+Math.random()*120); } }, 512);
  var metalTex=noiseTex(function(g,s){ g.fillStyle='#3a3b40'; g.fillRect(0,0,s,s); grain(g,s,60,30,4000); for(var i=0;i<30;i++){ g.fillStyle='rgba(120,70,40,'+(0.1+Math.random()*0.3)+')'; g.beginPath(); g.ellipse(Math.random()*s,Math.random()*s,4+Math.random()*20,3+Math.random()*10,0,0,Math.PI*2); g.fill(); } }, 256);
  var doorTex=noiseTex(function(g,s){ g.fillStyle='#3c3d42'; g.fillRect(0,0,s,s); grain(g,s,64,26,3000); g.fillStyle='#1e1f23'; g.fillRect(s*0.47,0,s*0.06,s); for(var i=0;i<8;i++){ g.fillStyle='#8a8288'; g.beginPath(); g.arc(s*0.1+ (i%2)*s*0.8, s*0.12+Math.floor(i/2)*s*0.25, 5, 0, Math.PI*2); g.fill(); }
    g.save(); g.translate(s/2,s*0.62); g.rotate(-0.6); for(var k=-6;k<6;k++){ g.fillStyle=k%2?'#c9a43a':'#141414'; g.fillRect(k*s*0.08,-s*0.05,s*0.08,s*0.1); } g.restore(); g.fillStyle='rgba(0,0,0,.35)'; g.fillRect(0,s*0.57,s,4); g.fillRect(0,s*0.67,s,4); }, 256);
  var fenceTex=noiseTex(function(g,s){ g.clearRect(0,0,s,s); g.strokeStyle='rgba(150,150,160,.85)'; g.lineWidth=2; for(var i=-s;i<s*2;i+=s/8){ g.beginPath(); g.moveTo(i,0); g.lineTo(i+s,s); g.stroke(); g.beginPath(); g.moveTo(i,s); g.lineTo(i+s,0); g.stroke(); } }, 128);
  var noticeTex=noiseTex(function(g,s){ g.fillStyle='#2b2b30'; g.fillRect(0,0,s,s); g.fillStyle='#d8d0b8'; g.fillRect(s*0.15,s*0.12,s*0.7,s*0.76); g.fillStyle='#3a3a3a'; for(var i=0;i<9;i++){ g.fillRect(s*0.22, s*0.2+i*s*0.07, s*(0.3+Math.random()*0.26), 4); } g.fillStyle='#a51c1c'; g.fillRect(s*0.22,s*0.14,s*0.3,6); }, 128);
  var cellW=M(map.cell), cellD=M(map.cell/DEPTH), mapW=M(map.pw), mapD=M(map.ph/DEPTH), CEIL=L.env==='swamp'?14:5.2, SPOT_H=Math.min(CEIL-0.2, 6.5), zoneScale=1, bossSlow=1, mist=[];
  var lamps=[], LAMP_MAX=SAFE?2:(MOBILE?4:99);
  function buildBunker(){
    var fmat=new THREE.MeshStandardMaterial({ map:concreteFloor, roughness:0.62, metalness:0.05, color:0xbdbdc2 }); fmat.map.repeat.set(mapW/4.4, mapD/4.4);
    var g=new THREE.PlaneGeometry(mapW, mapD); g.rotateX(-Math.PI/2); var ground=new THREE.Mesh(g, fmat); ground.position.set(mapW/2, 0, mapD/2); ground.receiveShadow=true; scene.add(ground);
    /* 천장 */
    var cmat=new THREE.MeshStandardMaterial({ map:concreteWall, roughness:0.95, color:0x6a6a70, side:THREE.DoubleSide }); cmat.map=concreteWall.clone(); cmat.map.needsUpdate=true; cmat.map.repeat.set(mapW/6, mapD/6);
    var ceil=new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapD), cmat); ceil.rotation.x=Math.PI/2; ceil.position.set(mapW/2, CEIL, mapD/2); scene.add(ceil);
    /* 천장 보 */
    var beamMat=new THREE.MeshStandardMaterial({ color:0x3b3b40, roughness:0.85 }); for(var bx=cellW*3; bx<mapW; bx+=cellW*4){ var beam=new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, mapD), beamMat); beam.position.set(bx, CEIL-0.3, mapD/2); scene.add(beam); }
    /* 배관 (긴 벽 따라) */
    var pipeMat=new THREE.MeshStandardMaterial({ map:metalTex, roughness:0.6, metalness:0.6, color:0x9a8a80 }); pipeMat.map.repeat.set(8,1);
    [[0.22,CEIL-0.55, cellD*0.55],[0.16,CEIL-1.0, cellD*0.55],[0.22,CEIL-0.55, mapD-cellD*0.55]].forEach(function(p){ var pipe=new THREE.Mesh(new THREE.CylinderGeometry(p[0],p[0],mapW-cellW*2,10), pipeMat); pipe.rotation.z=Math.PI/2; pipe.position.set(mapW/2, p[1], p[2]); scene.add(pipe); });
    /* 벽 (인스턴스) */
    var wallMat=new THREE.MeshStandardMaterial({ map:concreteWall, roughness:0.92, color:0xa8a8ae }); var wallGeo=new THREE.BoxGeometry(cellW, CEIL+0.4, cellD);
    var walls=new THREE.InstancedMesh(wallGeo, wallMat, map.w*map.h); var n=0, mtx=new THREE.Matrix4();
    var postGeo=new THREE.CylinderGeometry(0.05,0.05,2.0,6), postMat=new THREE.MeshStandardMaterial({ color:0x50525a, roughness:0.5, metalness:0.7 }), railGeo=new THREE.BoxGeometry(0.05, 0.05, cellD), meshMat=new THREE.MeshStandardMaterial({ map:fenceTex, transparent:true, alphaTest:0.3, side:THREE.DoubleSide, roughness:0.5, metalness:0.6, color:0xc0c0c8 }); meshMat.map.repeat.set(2,3); fenceGeo={ post:postGeo, postMat:postMat, rail:railGeo, meshMat:meshMat };
    var pillarMat=new THREE.MeshStandardMaterial({ map:concreteWall, roughness:0.9, color:0x9a9aa0 }), pillarGeo=new THREE.BoxGeometry(0.7, CEIL, 0.7);
    var sprMat={}; function sprite(k, h, x, z, asp){ var m=sprMat[k]||(sprMat[k]=new THREE.SpriteMaterial({ map:tex(k), transparent:true, alphaTest:0.2 })); var s=new THREE.Sprite(m); s.scale.set(h*asp, h, 1); s.center.set(0.5,0); s.position.set(x, 0, z); scene.add(s); return s; }
    function lamp(x,z,color,inten){ var shade=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.32,0.22,10,1,true), new THREE.MeshStandardMaterial({ color:0x2a2a2e, roughness:0.6, metalness:0.5, side:THREE.DoubleSide })); shade.position.set(x, 3.7, z); scene.add(shade);
      var cord=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,CEIL-3.8,4), postMat); cord.position.set(x, (CEIL+3.8)/2, z); scene.add(cord);
      var bulb=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6), new THREE.MeshBasicMaterial({ color:color })); bulb.position.set(x, 3.62, z); scene.add(bulb);
      var lt=new THREE.PointLight(color, SET.lights?inten:0, 13, 1.25); lt.position.set(x, 3.55, z); if(lamps.length<LAMP_MAX) scene.add(lt); /* 폰: 포인트라이트 수 제한 (셰이더 유니폼·성능) */
      var fl=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:color, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.5 })); fl.scale.set(1.6,1.6,1); fl.position.set(x, 3.6, z); scene.add(fl); lamps.push({ l:lt, base:inten, fx:fl, x:x, z:z }); }
    for(var y=0;y<map.h;y++) for(var x=0;x<map.w;x++){ var ch=map.rows[y][x], cx=X((x+0.5)*map.cell), cz=Z((y+0.5)*map.cell);
      if(ch==='#'){ mtx.makeTranslation(cx, (CEIL+0.4)/2, cz); walls.setMatrixAt(n++, mtx); }
      else if(ch==='s'){ var nb=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.7,0.06), new THREE.MeshStandardMaterial({ map:noticeTex, roughness:0.8 })); nb.position.set(cx, 1.5, cz-cellD*0.45); scene.add(nb); var np=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.6,5), postMat); np.position.set(cx, 0.8, cz-cellD*0.45); scene.add(np); }
      else if(ch==='t'){ lamp(cx, cz, 0xFFB868, 7); }
    }
    walls.count=n; walls.instanceMatrix.needsUpdate=true; walls.castShadow=true; walls.receiveShadow=true; scene.add(walls);
    /* 보스 원 바닥 표식 + 비상등(붉은) */
    var bm=world.marks('B')[0]; var ring=new THREE.Mesh(new THREE.PlaneGeometry(11.2, 11.2), new THREE.MeshBasicMaterial({ map:tex('ring'), transparent:true, opacity:0.55, depthWrite:false })); ring.rotation.x=-Math.PI/2; ring.position.set(X(bm.x), 0.02, Z(bm.y)); scene.add(ring);
    [[X(bm.x)-6, Z(bm.y)-7],[X(bm.x)+6, Z(bm.y)+7]].forEach(function(p){ var rl=new THREE.PointLight(0xE03A30, SET.lights?3:0, 12, 1.3); rl.position.set(p[0], 3.2, p[1]); if(!MOBILE) scene.add(rl); var rf=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xE03A30, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.6 })); rf.scale.set(1.2,1.2,1); rf.position.copy(rl.position); scene.add(rf); lamps.push({ l:rl, base:3, fx:rf, red:true }); });
    /* 격벽(강철 문) */
    gateMesh=new THREE.Group(); gateMesh.position.set(X(gate.x), 0, Z(gate.y)); scene.add(gateMesh);
    var frame=new THREE.Mesh(new THREE.BoxGeometry(cellW*1.3, 0.5, 0.7), pillarMat); frame.rotation.y=Math.PI/2; frame.position.set(X(gate.x), CEIL-0.25, Z(gate.y)); scene.add(frame);
  }
  /* ---------- 환경: 갈대습지 (야외 · 황혼 · 안개 · 갈대 벽 · 얕은 물 · 죽은 나무 · 무너진 망루 · 등불) ---------- */
  function buildSwamp(){
    scene.background=new THREE.Color(0x10161a); scene.fog=new THREE.FogExp2(0x131a1c, SAFE?0.05:(MOBILE?0.040:0.034));
    hemi.color.setHex(0x7d8fa0); hemi.groundColor.setHex(0x2a2e22); hemi.intensity=0.95; moon.color.setHex(0xb8c6d8); moon.intensity=0.9;
    var skyTex=canvasTex(function(g,s){ var gr=g.createLinearGradient(0,0,0,s); gr.addColorStop(0,'#0b0f16'); gr.addColorStop(0.5,'#182028'); gr.addColorStop(0.72,'#3a2e28'); gr.addColorStop(0.8,'#241f1c'); gr.addColorStop(1,'#141312'); g.fillStyle=gr; g.fillRect(0,0,s,s); }, 256);
    var sky=new THREE.Mesh(new THREE.SphereGeometry(95, 24, 12), new THREE.MeshBasicMaterial({ map:skyTex, side:THREE.BackSide, fog:false, depthWrite:false })); sky.position.set(mapW/2, -6, mapD/2); scene.add(sky);
    var moonSp=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xc24a44, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, fog:false, opacity:0.9 })); moonSp.scale.set(16,16,1); moonSp.position.set(mapW/2-28, 30, -46); scene.add(moonSp);
    /* 바닥: 진흙 + 풀 */
    var mudTex=noiseTex(function(g,s){ g.fillStyle='#2e2c20'; g.fillRect(0,0,s,s); grain(g,s,52,34,9000); g.strokeStyle='rgba(96,116,52,.6)'; g.lineWidth=1; for(var i=0;i<1100;i++){ var x=Math.random()*s, y=Math.random()*s, h=4+Math.random()*11; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(Math.random()-0.5)*5, y-h); g.stroke(); } g.fillStyle='rgba(16,20,18,.55)'; for(var j=0;j<40;j++){ g.beginPath(); g.ellipse(Math.random()*s, Math.random()*s, 8+Math.random()*22, 4+Math.random()*10, Math.random()*3, 0, 6.28); g.fill(); } }, 512);
    var fmat=new THREE.MeshStandardMaterial({ map:mudTex, roughness:0.96, color:0x9c9c8c }); fmat.map.repeat.set(mapW/4.5, mapD/4.5);
    var ground=new THREE.Mesh(new THREE.PlaneGeometry(mapW+40, mapD+40), fmat); ground.rotation.x=-Math.PI/2; ground.position.set(mapW/2, 0, mapD/2); ground.receiveShadow=true; scene.add(ground);
    /* 갈대 (교차 평면 인스턴스) */
    var reedMat=new THREE.MeshStandardMaterial({ map:getReedTex(), transparent:true, alphaTest:0.42, side:THREE.DoubleSide, roughness:0.92, color:0xbdb59a });
    var cells=[]; for(var y=0;y<map.h;y++) for(var x=0;x<map.w;x++){ var ch=map.rows[y][x]; if(ch==='#') cells.push([x,y,2,2.7,1]); else if(ch==='r') cells.push([x,y,3,1.7,0]); }
    var nInst=0; cells.forEach(function(c){ nInst+=c[2]; });
    var pg=new THREE.PlaneGeometry(1.5,1); pg.translate(0,0.5,0);
    var reedA=new THREE.InstancedMesh(pg, reedMat, nInst), reedB=new THREE.InstancedMesh(pg, reedMat, nInst); var mtx=new THREE.Matrix4(), q=new THREE.Quaternion(), sc=new THREE.Vector3(), pos=new THREE.Vector3(), k=0;
    var baseGeo=new THREE.BoxGeometry(cellW*0.95, 0.5, cellD*0.95), baseMat=new THREE.MeshStandardMaterial({ color:0x171c15, roughness:1 }); var nBase=cells.filter(function(c){ return c[4]; }).length; var bases=new THREE.InstancedMesh(baseGeo, baseMat, Math.max(1,nBase)); var kb=0;
    cells.forEach(function(c){ var cx=X((c[0]+0.5)*map.cell), cz=Z((c[1]+0.5)*map.cell);
      if(c[4]){ mtx.makeTranslation(cx, 0.25, cz); bases.setMatrixAt(kb++, mtx); }
      for(var i=0;i<c[2];i++){ var h=c[3]*(0.85+Math.random()*0.35), w=1.1+Math.random()*0.5; pos.set(cx+(Math.random()-0.5)*cellW*0.8, 0, cz+(Math.random()-0.5)*cellD*0.8); var yaw=Math.random()*Math.PI; q.setFromAxisAngle(new THREE.Vector3(0,1,0), yaw); sc.set(w,h,1); mtx.compose(pos,q,sc); reedA.setMatrixAt(k,mtx); q.setFromAxisAngle(new THREE.Vector3(0,1,0), yaw+Math.PI/2); mtx.compose(pos,q,sc); reedB.setMatrixAt(k,mtx); k++; } });
    reedA.count=reedB.count=k; bases.count=kb; reedA.instanceMatrix.needsUpdate=reedB.instanceMatrix.needsUpdate=bases.instanceMatrix.needsUpdate=true; reedA.castShadow=reedB.castShadow=!MOBILE; scene.add(reedA); scene.add(reedB); scene.add(bases);
    /* 얕은 물 */
    var waterMat=new THREE.MeshStandardMaterial({ color:0x0c1a20, roughness:0.18, metalness:0.45, transparent:true, opacity:0.92, emissive:0x04100f });
    var wg=new THREE.PlaneGeometry(cellW*1.02, cellD*1.02); wg.rotateX(-Math.PI/2); var wCells=[]; for(var wy=0;wy<map.h;wy++) for(var wx=0;wx<map.w;wx++) if(map.rows[wy][wx]==='~') wCells.push([wx,wy]);
    var water=new THREE.InstancedMesh(wg, waterMat, Math.max(1,wCells.length)); wCells.forEach(function(c,i){ mtx.makeTranslation(X((c[0]+0.5)*map.cell), 0.035, Z((c[1]+0.5)*map.cell)); water.setMatrixAt(i,mtx); }); water.count=wCells.length; water.instanceMatrix.needsUpdate=true; water.receiveShadow=true; scene.add(water);
    /* 죽은 나무 · 등불 · 망루 · 표지 */
    var woodMat=new THREE.MeshStandardMaterial({ color:0x2a231c, roughness:0.95 }), plankMat=new THREE.MeshStandardMaterial({ color:0x4a3a28, roughness:0.9 });
    function tree(x,z){ var g=new THREE.Group(); var tr=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.38,5.6,7), woodMat); tr.position.y=2.8; tr.castShadow=true; g.add(tr); for(var i=0;i<3;i++){ var br=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.1,2.2,5), woodMat); br.position.set(0, 3.2+i*0.7, 0); br.rotation.z=(i%2?1:-1)*(0.8+Math.random()*0.3); br.rotation.y=i*2.1; br.position.x+=Math.sin(br.rotation.y)*0.9*(i%2?-1:1); br.position.z+=Math.cos(br.rotation.y)*0.9; g.add(br); } g.position.set(x,0,z); g.rotation.y=Math.random()*6.28; g.rotation.z=(Math.random()-0.5)*0.12; scene.add(g); }
    function lantern(x,z){ var post=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,2.3,6), woodMat); post.position.set(x,1.15,z); scene.add(post); var arm=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.05,0.05), woodMat); arm.position.set(x+0.22,2.25,z); scene.add(arm);
      var box=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.3,0.22), new THREE.MeshBasicMaterial({ color:0xffc070 })); box.position.set(x+0.42,2.0,z); scene.add(box);
      var lt=new THREE.PointLight(0xffb060, SET.lights?6:0, 12, 1.3); lt.position.set(x+0.42,2.0,z); if(lamps.length<LAMP_MAX) scene.add(lt);
      var fl=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xffb060, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.5 })); fl.scale.set(1.8,1.8,1); fl.position.copy(lt.position); scene.add(fl); lamps.push({ l:lt, base:6, fx:fl, x:x, z:z }); }
    function tower(x,z){ var g=new THREE.Group(); [[-0.9,-0.9],[0.9,-0.9],[-0.9,0.9],[0.9,0.9]].forEach(function(p,i){ var h=i===1?3.2:6.0; var po=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.17,h,7), woodMat); po.position.set(p[0], h/2, p[1]); po.castShadow=true; g.add(po); });
      var pf=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.18,2.6), plankMat); pf.position.set(0.15,4.7,0); pf.rotation.z=0.14; pf.rotation.x=-0.06; g.add(pf); [[-1.25,0,0],[0,1.25,1.57]].forEach(function(r){ var rail=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.06,0.06), plankMat); rail.position.set(r[0],5.6,r[1]); rail.rotation.y=r[2]; g.add(rail); });
      for(var i=0;i<4;i++){ var st=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.05,0.25), plankMat); st.position.set(0.15, 0.9+i*1.0, 1.05); g.add(st); }
      g.position.set(x,0,z); g.rotation.y=-0.4; scene.add(g); }
    function signpost(x,z){ var np=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,1.7,5), woodMat); np.position.set(x,0.85,z); scene.add(np); var pl=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.5,0.05), new THREE.MeshStandardMaterial({ map:noticeTex, roughness:0.85 })); pl.position.set(x,1.35,z); pl.rotation.y=-0.5; scene.add(pl);
      var cloth=new THREE.Mesh(new THREE.PlaneGeometry(0.35,0.9), new THREE.MeshStandardMaterial({ color:0x8a2a24, side:THREE.DoubleSide, roughness:1 })); cloth.position.set(x+0.5,1.2,z+0.2); cloth.rotation.y=0.6; scene.add(cloth); }
    for(var ty=0;ty<map.h;ty++) for(var tx=0;tx<map.w;tx++){ var c2=map.rows[ty][tx], cx2=X((tx+0.5)*map.cell), cz2=Z((ty+0.5)*map.cell);
      if(c2==='T') tree(cx2, cz2); else if(c2==='t') lantern(cx2, cz2); else if(c2==='w') tower(cx2, cz2); else if(c2==='s') signpost(cx2, cz2-cellD*0.3); }
    /* 망루 통로 봉쇄(통나무 잔해) — gateMesh 를 숨기면 열린다 */
    gateMesh=new THREE.Group(); gateMesh.position.set(X(gate.x), 0, Z(gate.y)); scene.add(gateMesh);
    [[0.22,0.24,0],[0.2,0.62,0.12],[0.17,0.95,-0.1]].forEach(function(l){ var lg=new THREE.Mesh(new THREE.CylinderGeometry(l[0],l[0]*0.9,cellD*1.15,8), woodMat); lg.rotation.x=Math.PI/2; lg.rotation.z=l[2]*0.5; lg.position.set(l[2],l[1],0); lg.castShadow=true; gateMesh.add(lg); });
    for(var si=0;si<5;si++){ var sp=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.7,5), plankMat); sp.position.set((Math.random()-0.5)*0.4, 1.2, (si-2)*cellD*0.2); sp.rotation.z=(Math.random()-0.5)*0.8; sp.rotation.x=(Math.random()-0.5)*0.8; gateMesh.add(sp); }
    [[-cellD*0.62],[cellD*0.62]].forEach(function(p){ var po=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,3.4,7), woodMat); po.position.set(X(gate.x), 1.7, Z(gate.y)+p[0]); po.castShadow=true; scene.add(po); }); var lintel=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.25,cellD*1.35), plankMat); lintel.position.set(X(gate.x), 3.3, Z(gate.y)); lintel.rotation.x=0.05; scene.add(lintel);
    /* 보스 분지: 바닥 표식 · 뼈 · 붉은 빛 */
    var bm=world.marks('B')[0], bx=X(bm.x), bz=Z(bm.y); var ring=new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map:tex('ring'), transparent:true, opacity:0.32, depthWrite:false, color:0xd08070 })); ring.rotation.x=-Math.PI/2; ring.position.set(bx, 0.03, bz); scene.add(ring);
    var boneMat=new THREE.MeshStandardMaterial({ color:0x9a8e74, roughness:0.7 }); for(var bi=0;bi<10;bi++){ var a=bi/10*6.28, r=4.5+Math.random()*3; var bn=new THREE.Mesh(new THREE.ConeGeometry(0.08+Math.random()*0.08, 0.9+Math.random()*1.2, 5), boneMat); bn.position.set(bx+Math.cos(a)*r, 0.4, bz+Math.sin(a)*r*1.4); bn.rotation.set((Math.random()-0.5)*1.4, 0, (Math.random()-0.5)*1.4); scene.add(bn); }
    [[bx-4.5, bz-7],[bx+4.5, bz+7]].forEach(function(p){ var rl=new THREE.PointLight(0xE03A30, SET.lights?3:0, 12, 1.3); rl.position.set(p[0], 2.6, p[1]); if(!MOBILE) scene.add(rl); var rf=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xE03A30, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.55 })); rf.scale.set(1.4,1.4,1); rf.position.copy(rl.position); scene.add(rf); lamps.push({ l:rl, base:3, fx:rf, red:true }); });
    /* 안개 덩어리 */
    for(var mi=0;mi<(MOBILE?8:14);mi++){ var ms=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0x93a39c, transparent:true, opacity:0.085, depthWrite:false })); ms.scale.set(9+Math.random()*5, 3.5+Math.random()*1.5, 1); var mx=Math.random()*mapW, mz=Math.random()*mapD; ms.position.set(mx, 0.9, mz); ms.userData={ x:mx, z:mz }; scene.add(ms); mist.push(ms); }
    fenceGeo=null;
  }

  if(L.env==='swamp') buildSwamp(); else buildBunker();
  var gateMesh, fenceGeo;
  /* ---------- 허수아비 (Hi3D 생성 통나무 골렘 + 리깅·클립) ---------- */
  var boss=(function(){
    var root=new THREE.Group(); root.position.set(X(Bs.x), 0, Z(Bs.y)); scene.add(root);
    var body=new THREE.Group(); root.add(body);
    var hits={}; Object.keys(A.parts3d||{}).forEach(function(k){ var sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:ringTex, color:0xC9A45E, transparent:true, depthTest:false, opacity:0.9 })); sp.scale.set(0.5,0.5,1); sp.visible=false; sp.renderOrder=5; scene.add(sp); hits[k]=sp; });
    /* 부위 → 뼈 + 오프셋(뼈 로컬 기준 대략: 앞쪽 = 모델 +Z) */
    var PART=JSON.parse(JSON.stringify(A.parts3d||{ body:{ bone:'Spine', off:[0,0.1,0.3], r:0.7 }, head:{ bone:'Head', off:[0,0.15,0.05], r:0.4 }, core:{ bone:'Spine2', off:[0,0.05,0.42], r:0.32 } }));
    var coreGlow=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xFF6A3C, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.7 })); coreGlow.scale.set(0.9,0.9,1); scene.add(coreGlow);
    var eyeGlow=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xFF8A4C, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.5 })); eyeGlow.scale.set(0.5,0.3,1); scene.add(eyeGlow);
    var anim={ lean:0, leanT:0, shake:0, down:0, collapse:0, glow:1, flash:0, tele:null, teleT:0, teleDur:1, swing:0, swingKind:null, walk:0 };
    return { root:root, body:body, hits:hits, anim:anim, PART:PART, bones:{}, model:null, mixer:null, clips:{}, act:null, base:'idle', oneshot:null, coreGlow:coreGlow, eyeGlow:eyeGlow, mats:[], raycastable:[] };
  })();
  var bossSpot=new THREE.SpotLight(0xffe0c0, 60, 14, 0.55, 0.6, 1.2); bossSpot.position.set(X(Bs.x), SPOT_H, Z(Bs.y)); bossSpot.target=boss.root; scene.add(bossSpot); scene.add(bossSpot.target);
  var debris=[];
  function bossAttachParts(){ var iron=new THREE.MeshStandardMaterial({ color:0x55555c, roughness:0.5, metalness:0.8 }), chainMat=new THREE.MeshStandardMaterial({ color:0x9a9298, roughness:0.4, metalness:0.9 }), straw=new THREE.MeshStandardMaterial({ map:strawTex, roughness:1, color:0xc8b890 });
    function mk(bone, build, key){ var b=boss.bones[bone]; if(!b) return; var g=new THREE.Group(); build(g); g.traverse(function(o){ if(o.isMesh) o.castShadow=true; }); b.add(g); boss.pieces[key]=g; }
    boss.pieces={};
    mk('Spine1', function(g){ [[0.55],[-0.55]].forEach(function(a){ var c=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.045,6,28), chainMat); c.position.set(0,0.25,0.05); c.rotation.z=a[0]; c.rotation.x=0.2; g.add(c); }); var h=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.04,6,24), chainMat); h.position.y=0.05; h.rotation.x=Math.PI/2; g.add(h); }, 'chain');
    ['LeftArm','RightArm'].forEach(function(bn,i){ mk(bn, function(g){ var band=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.34,0.16,12,1,true), iron); band.position.y=0.05; g.add(band); var tuft=new THREE.Mesh(new THREE.SphereGeometry(0.32,10,8), straw); tuft.scale.set(1.2,0.6,1); tuft.position.y=0.18; g.add(tuft); }, i?'shr':'shl'); }); }
  function tickDebris(dt){ for(var i=debris.length-1;i>=0;i--){ var d=debris[i]; d.t+=dt; d.vy-=9.8*dt; d.g.position.y+=d.vy*dt; d.g.position.x+=d.vx*dt; d.g.position.z+=d.vz*dt; d.g.rotation.x+=d.rx*dt; d.g.rotation.z+=d.rz*dt; if(d.g.position.y<0.05){ d.g.position.y=0.05; d.vy=-d.vy*0.3; d.vx*=0.6; d.vz*=0.6; d.rx*=0.5; d.rz*=0.5; } if(d.t>4){ scene.remove(d.g); debris.splice(i,1); } } }
  function bossCollectPieces(){ boss.pieces={}; boss.model.traverse(function(o){ if(/^piece_/.test(o.name)){ boss.pieces[o.name.slice(6)]=o; } }); }
  function bossLoad(done){ loader.load(A.model||'art/3d/boss_anim.glb', function(g){ boss.model=g.scene; if(A.scale) boss.model.scale.setScalar(A.scale); capTextures(boss.model); boss.model.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; o.frustumCulled=false; o.material=o.material.clone(); o.material.userData.base=o.material.color.clone(); if(o.material.emissive) o.material.userData.emis=o.material.emissive.clone(); boss.mats.push(o.material); boss.raycastable.push(o); } if(o.isBone){ var n=o.name.replace(/^mixamorig:?/,''); boss.bones[n]=o; } });
      boss.body.add(boss.model); boss.mixer=new THREE.AnimationMixer(boss.model); g.animations.forEach(function(c){ boss.clips[c.name]=c; }); if(A.pieces==='nodes') bossCollectPieces(); else bossAttachParts(); bossBase('idle'); done(); }, undefined, function(e){ console.warn('boss load fail', e); done(); }); }
  function bossAction(n){ var c=boss.clips[n]; if(!c||!boss.mixer) return null; return boss.mixer.clipAction(c); }
  function bossBase(n){ var a=bossAction(n); if(!a) return; if(boss.base===n && boss.act===a) return; var prev=boss.act; a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.enabled=true; a.setEffectiveWeight(1); a.timeScale=n==='walk'?1.1:0.8; if(prev&&prev!==a) a.crossFadeFrom(prev, 0.25, true); a.play(); boss.act=a; boss.base=n; }
  function bossOnce(n, o){ o=o||{}; var a=bossAction(n); if(!a) return; if(boss.oneshot){ boss.oneshot.fadeOut(0.08); } a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished=!!o.hold; a.timeScale=o.speed||1; a.enabled=true; a.setEffectiveWeight(1); a.fadeIn(0.08); a.play(); if(boss.act) boss.act.fadeOut(0.08); boss.oneshot=a; boss.oneshotEnd=a.getClip().duration/(o.speed||1)-(o.hold?0:0.1); boss.oneshotT=0; boss.hold=!!o.hold; boss.oneshotName=n; }
  function bossHitPos(k){ var p=boss.PART[k]||boss.PART.body; var b=boss.bones[p.bone]; var v=new THREE.Vector3(); if(b){ b.getWorldPosition(v); var fwd=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), boss.root.rotation.y); var right=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), boss.root.rotation.y); v.add(right.multiplyScalar(p.off[0])).add(new THREE.Vector3(0,p.off[1],0)).add(fwd.multiplyScalar(p.off[2])); } else { v.copy(boss.root.position); v.y+=1.8; } return v; }
  function setupPhase(d){
    var k=d.kind; var tint=new THREE.Color((A.tint||{})[k]||0xffffff); boss.mats.forEach(function(m){ m.color.copy(m.userData.base||new THREE.Color(1,1,1)).multiply(tint); });   /* 텍스처 없는 재질은 기본색 × 색조 */
    Object.keys(boss.hits).forEach(function(kk){ boss.hits[kk].visible=false; });
    d.parts.forEach(function(p){ var h=boss.hits[HITMAP[p.id]]; if(h){ h.visible=true; h.material.color.setHex(p.weak?0xD94A45:p.breakable?0x7B9BD6:0xC9A45E); } });
    if(boss.pieces && A.pieces!=='nodes'){ var ids=d.parts.map(function(p){ return p.id; }); Object.keys(boss.pieces).forEach(function(pid){ var pc=boss.pieces[pid]; var want=ids.indexOf(pid)>=0; pc.visible=want; if(want && !pc.parent){ /* 재부착 */ var bn=boss.bones[boss.PART[pid].bone]; if(bn){ pc.position.set(0,0,0); pc.rotation.set(0,0,0); bn.add(pc); } } }); }
    boss.anim.glow=(A.glow||{})[k]||1; coreLight.intensity=1.5+boss.anim.glow*2.5;
  }
  var ATK=A.atk||{ hammer:{ clip:'atk_hammer', hitFrac:0.42 }, bolt:{ clip:'atk_bolt', hitFrac:0.45 }, scythe:{ clip:'atk_scythe', hitFrac:0.5 } };
  function bossPlay(n, o){ var a=boss.anim; o=o||{};
    if(n==='flinch'){ a.shake=0.2; a.flash=0.12; if(!a.tele && !boss.oneshot) bossOnce('hit',{speed:1.6}); }
    else if(n==='stagger'){ a.shake=0.6; a.flash=0.2; bossOnce('stagger',{speed:1.1}); a.tele=null; }
    else if(n==='down'){ a.down=1; bossOnce('down',{hold:true, speed:1.3}); a.tele=null; }
    else if(n==='up'){ a.down=0; bossOnce('up',{speed:1.2}); }
    else if(n==='collapse'){ a.collapse=1; bossOnce('death',{hold:true, speed:0.9}); }
    else if(n.indexOf('tele_')===0){ var kind=n.slice(5), spec=ATK[kind]||ATK[Object.keys(ATK)[0]], c=boss.clips[spec.clip]; a.tele=kind; a.teleT=o.dur||1; a.teleDur=o.dur||1; if(c){ var ts=(spec.hitFrac*c.duration)/Math.max(0.15,a.teleDur); bossOnce(spec.clip,{speed:Math.max(0.35,Math.min(2.2,ts))}); } }
    else if(n.indexOf('hit_')===0){ a.tele=null; a.swing=0.4; a.swingKind=n.slice(4); if(boss.oneshot && boss.oneshot.timeScale<1){ boss.oneshot.timeScale=1.4; } } }
  var FLASHC=new THREE.Color(0x40160e);
  function bossStop(){ boss.anim.tele=null; }
  function bossTick(dt){ var a=boss.anim, t=performance.now()/1000; if(!boss.mixer) return;
    if(a.shake>0) a.shake-=dt; if(a.flash>0) a.flash-=dt; if(a.tele){ a.teleT-=dt; } if(a.swing>0) a.swing-=dt;
    if(boss.oneshot){ boss.oneshotT+=dt*boss.oneshot.timeScale/boss.oneshot.timeScale; var dur=boss.oneshot.getClip().duration/boss.oneshot.timeScale; if(!boss.hold && boss.oneshot.time>=boss.oneshot.getClip().duration-0.05){ boss.oneshot.fadeOut(0.2); boss.oneshot=null; if(boss.act){ boss.act.reset(); boss.act.fadeIn(0.2); boss.act.play(); } } }
    a.walk += ((Bs.moving?1:0) - a.walk)*Math.min(1,dt*6);
    if(!boss.oneshot){ bossBase(a.walk>0.5?'walk':'idle'); }
    boss.mixer.update(dt);
    var sh=a.shake>0 ? Math.sin(t*60)*0.05*a.shake : 0; boss.body.position.x=sh;
    var g=a.glow*(0.8+Math.sin(t*3)*0.2)+(a.flash>0?1.5:0); boss.mats.forEach(function(m){ if(m.emissive){ var be=m.userData.emis; if(be) m.emissive.copy(be); else m.emissive.setHex(0); if(a.flash>0) m.emissive.add(FLASHC); } });
    coreLight.intensity=SET.lights?(1.5+g*2.5):0;
    boss.root.position.x=X(Bs.x); boss.root.position.z=Z(Bs.y); var want=Math.atan2(X(P.x)-X(Bs.x), Z(P.y)-Z(Bs.y)); var dy=want-boss.root.rotation.y; while(dy>Math.PI) dy-=Math.PI*2; while(dy<-Math.PI) dy+=Math.PI*2; boss.root.rotation.y+=dy*Math.min(1,dt*(a.tele?1.2:3));
    bossSpot.position.set(boss.root.position.x+1.5, SPOT_H, boss.root.position.z+2); bossSpot.intensity=SET.lights?60:0;
    var cp=bossHitPos('core'); coreLight.position.copy(cp).add(new THREE.Vector3(0,0.1,0.5)); boss.coreGlow.position.copy(cp); boss.coreGlow.material.opacity=0.35+g*0.3; boss.coreGlow.scale.setScalar(0.7+g*0.3);
    var hp=bossHitPos('head'); boss.eyeGlow.position.copy(hp).add(new THREE.Vector3(0,-0.05,0.18)); boss.eyeGlow.material.opacity=0.2+g*0.3;
    Object.keys(boss.hits).forEach(function(k){ var h=boss.hits[k]; if(!h.visible) return; h.position.copy(bossHitPos(k)); }); }
  function bossDetach(id){ var h=boss.hits[id]; if(h) h.visible=false; if(boss.PART[id]) boss.PART[id].broken=true;
    var pc=boss.pieces&&boss.pieces[id]; if(pc && pc.parent){ var wp=new THREE.Vector3(), wq=new THREE.Quaternion(); pc.getWorldPosition(wp); pc.getWorldQuaternion(wq); pc.parent.remove(pc); pc.position.copy(wp); pc.quaternion.copy(wq); pc.scale.setScalar(1); scene.add(pc); var a=Math.random()*6.28; debris.push({ g:pc, t:0, vy:2.5+Math.random()*1.5, vx:Math.cos(a)*2.2, vz:Math.sin(a)*2.2, rx:(Math.random()-0.5)*6, rz:(Math.random()-0.5)*6 }); } }

  var strawTex=tex('straw',[2,2]);
  /* ---------- Hi3D 소품 (art/3d/props) ---------- */
  var PROPS={ dummy_a:{h:1.8}, dummy_b:{h:1.8}, dummy_c:{h:1.8}, blast_door:{h:CEIL-0.6}, fan:{h:1.7}, tank_glow:{h:3.0}, console:{h:1.6}, pillar:{h:CEIL}, barrel:{h:1.0}, crate:{h:0.9}, rubble:{h:0.45}, wall_panel:{h:3.2} };
  var propTpl={};
  function loadProps(done){ var names=(L.props3d||Object.keys(PROPS)).filter(function(n){ return !!PROPS[n]; }), left=names.length; if(!left){ done(); return; } names.forEach(function(n){ loader.load('art/3d/props/'+n+'.glb', function(g){ var root=g.scene; capTextures(root); root.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); var b=new THREE.Box3().setFromObject(root); root.userData.box=b; propTpl[n]=root; if(--left===0) done(); }, undefined, function(){ console.warn('prop load fail', n); if(--left===0) done(); }); }); }
  function spawn(n, x, z, o){ o=o||{}; var t=propTpl[n]; if(!t) return null; var c=t.clone(); var b=t.userData.box; var h=PROPS[n].h, sc=h/(b.max.y-b.min.y); var g=new THREE.Group(); c.scale.setScalar(sc); c.position.set(-(b.min.x+b.max.x)/2*sc, -b.min.y*sc, -(b.min.z+b.max.z)/2*sc); g.add(c); g.position.set(x, o.y||0, z); g.rotation.y=o.rot||0; if(o.sx) c.scale.x=sc*o.sx; if(o.sz) c.scale.z=sc*o.sz; scene.add(g); g.userData.size={ w:(b.max.x-b.min.x)*sc, h:h, d:(b.max.z-b.min.z)*sc }; return g; }
  function placeProps(){ if(L.env==='swamp') placePropsSwamp(); else placePropsBunker(); }
  function placePropsSwamp(){ [[6,4],[14,10],[24,3],[33,12],[36,3],[31,7]].forEach(function(p){ spawn('rubble', X(map.cell*(p[0]+0.5)), Z(map.cell*(p[1]+0.5)), { rot:Math.random()*6.28 }); }); }
  function placePropsBunker(){
    for(var y=0;y<map.h;y++) for(var x=0;x<map.w;x++){ var ch=map.rows[y][x], cx=X((x+0.5)*map.cell), cz=Z((y+0.5)*map.cell);
      if(ch==='|' && fenceGeo){ var fp=new THREE.Mesh(fenceGeo.post, fenceGeo.postMat); fp.position.set(cx, 1.0, cz-cellD/2); fp.castShadow=true; scene.add(fp); var r1=new THREE.Mesh(fenceGeo.rail, fenceGeo.postMat); r1.position.set(cx, 1.95, cz); scene.add(r1); var mp=new THREE.Mesh(new THREE.PlaneGeometry(cellD, 1.9), fenceGeo.meshMat); mp.rotation.y=Math.PI/2; mp.position.set(cx, 0.98, cz); scene.add(mp); }
      else if(ch==='b') spawn('barrel', cx, cz, { rot:Math.random()*6.28 });
      else if(ch==='c') spawn('crate', cx, cz, { rot:(Math.random()-0.5)*0.6 });
      else if(ch==='p'){ var pl=spawn('pillar', cx, cz, {}); if(pl){ var ps=pl.userData.size; pl.children[0].scale.x*=1.0/Math.max(0.1,ps.w); pl.children[0].scale.z*=1.0/Math.max(0.1,ps.d); } }
    }
    /* 격벽: 문 모델을 셀 폭에 맞춤 */
    var door=spawn('blast_door', X(gate.x), Z(gate.y), {}); if(door){ var dz=door.userData.size; if(dz.w>=dz.d){ door.rotation.y=Math.PI/2; door.children[0].scale.x*=(cellD*1.02)/Math.max(0.1,dz.w); } else { door.children[0].scale.z*=(cellD*1.02)/Math.max(0.1,dz.d); } scene.remove(door); gateMesh.add(door); door.position.set(0,0,0); }
    /* 장식: 보스 방 */
    var bm=world.marks('B')[0], bx=X(bm.x), bz=Z(bm.y);
    [[bx-7.5, bz-6.5],[bx+7.5, bz+6.5]].forEach(function(p,i){ var t=spawn('tank_glow', p[0], p[1], { rot:i?0.6:-0.6 }); var pl=new THREE.PointLight(0x9a5cff, SET.lights?2.5:0, 9, 1.4); pl.position.set(p[0], 1.6, p[1]); if(!MOBILE) scene.add(pl); lamps.push({ l:pl, base:2.5, fx:null, red:false, purple:true }); });
    [[bx-4, Z(map.cell*0.5)+0.55, 0],[bx+4, Z(map.cell*0.5)+0.55, 0],[bx, Z(map.cell*(map.h-0.5))-0.55, Math.PI]].forEach(function(p){ spawn('fan', p[0], p[1], { rot:p[2], y:2.2 }); });
    for(var i=0;i<6;i++){ var wx=X(map.cell*(15+i*3)); var wp=spawn('wall_panel', wx, Z(map.cell*0.5)+0.35, {}); if(wp&&wp.userData.size.d>wp.userData.size.w) wp.rotation.y=Math.PI/2; var wp2=spawn('wall_panel', wx+1.5, Z(map.cell*(map.h-0.5))-0.35, { rot:Math.PI }); if(wp2&&wp2.userData.size.d>wp2.userData.size.w) wp2.rotation.y=-Math.PI/2; }
    /* 장식: 앞방 */
    spawn('console', X(map.cell*2.2), Z(map.cell*1.4), { rot:0.4 }); spawn('console', X(map.cell*9.5), Z(map.cell*13.5), { rot:Math.PI-0.3 });
    [[3,13.2],[8.5,1.5],[20,13.3],[30,1.6]].forEach(function(p){ spawn('rubble', X(map.cell*p[0]), Z(map.cell*p[1]), { rot:Math.random()*6.28 }); });
  }

  /* ---------- 아인 (GLB + 애니메이션) ---------- */
  var ain={ root:new THREE.Group(), mixer:null, clips:{}, base:'idle', cur:null, act:null, oneshot:null, hitT:0, ready:false, model:null, dead:false };
  ain.root.position.copy(v3(P.x,P.y)); scene.add(ain.root);
  var loader=new GLTFLoader(LM); var loadN=0;
  /* 제작 자유도: 장착한 주무기가 제작품이면 재료에 따라 낫의 색·광택·발광·크기를 바꾼다 (gear.js lookOf) */
  function applyWeaponLook(wr){ try{ var G=window.TW_GEAR; if(!G) return; var main=G.state().equipped.main; var look=main&&G.lookOf(main); if(!look) return;
      wr.traverse(function(o){ if(!o.isMesh) return; var m=o.material=o.material.clone(); if(look.tint){ var t=new THREE.Color(look.tint); m.color=m.color?m.color.lerp(t,0.55):t; }
        if(look.metal!=null) m.metalness=look.metal; if(look.rough) m.roughness=Math.max(0.05, Math.min(1, (m.roughness||0.5)+look.rough));
        if(look.glow&&m.emissive){ m.emissive=new THREE.Color(look.glowColor||'#ff4a2a'); m.emissiveIntensity=look.glow*0.9; } m.needsUpdate=true; });
      if(look.scale&&look.scale!==1) wr.scale.multiplyScalar(look.scale);
      if(look.glow>0.5){ var sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:new THREE.Color(look.glowColor||'#ff4a2a'), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.35*look.glow })); sp.scale.set(0.9,0.9,1); sp.position.set(-0.2, 0.75, 0); wr.add(sp); }
    }catch(e){ console.warn('weapon look', e); } }
  function loaded(){ loadN++; if(loadN>=4){ ldSet(1, '입장'); ldDone=true; placeProps(); begin(); } }
  loadProps(loaded); bossLoad(loaded);
  loader.load('art/3d/ain_anim.glb', function(g){ ain.model=g.scene; capTextures(ain.model); ain.model.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; o.frustumCulled=false; } }); ain.root.add(ain.model);
    ain.mixer=new THREE.AnimationMixer(ain.model); g.animations.forEach(function(c){ ain.clips[c.name]=c; });
    ['attack1','attack2','attack3','smash','ult','hit','hit2','death','roll','dodgeB','dodgeL','dodgeR','pickup','cheer'].forEach(function(n){ var c=ain.clips[n]; if(!c) return; });
    var slot=null; ain.model.traverse(function(o){ if(o.isBone && /RightHandSlot/.test(o.name)) slot=o; }); ain.slot=slot;
    loader.load('art/3d/ain_scythe_tex.glb', function(w){ capTextures(w.scene); var wr=new THREE.Group(); w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); w.scene.position.set(0,-0.75,0); wr.add(w.scene); if(slot){ slot.add(wr); var ws=new THREE.Vector3(); slot.getWorldScale(ws); wr.scale.set(1/ws.x,1/ws.y,1/ws.z); } ain.weapon=wr; applyWeaponLook(wr); loaded(); }, undefined, function(){ loaded(); });
    setBase('idle'); loaded(); }, undefined, function(err){ ldErr('아인 모델 로드 실패: '+(err&&err.message||err)); });
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

  /* ---------- 잡몹 (훈련 인형 자리표시자) ---------- */
  var dummyKinds=['dummy_a','dummy_b','dummy_c'], dummyI=0;
  var reedTex=null; function getReedTex(){ if(reedTex) return reedTex; reedTex=noiseTex(function(g,s){ g.clearRect(0,0,s,s); for(var i=0;i<70;i++){ var x=Math.random()*s, w=2+Math.random()*3, h=s*(0.55+Math.random()*0.45), c=110+Math.random()*60; g.strokeStyle='rgb('+(c|0)+','+((c+20)|0)+','+((c-50)|0)+')'; g.lineWidth=w; g.beginPath(); g.moveTo(x,s); g.quadraticCurveTo(x+(Math.random()-0.5)*18, s-h*0.5, x+(Math.random()-0.5)*30, s-h); g.stroke(); if(Math.random()<0.5){ g.fillStyle='rgba(150,120,70,.9)'; g.fillRect(x+(Math.random()-0.5)*30-2, s-h-10, 4, 12); } } }, 256, true); reedTex.wrapS=reedTex.wrapT=THREE.ClampToEdgeWrapping; return reedTex; }
  var mobMats={};
  function mkMobLook(look, body, mats){
    if(look==='stalker'){ mobMats.stalk=mobMats.stalk||new THREE.MeshStandardMaterial({ color:0x2e3a26, roughness:0.95 }); var b=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,1.45,8), mobMats.stalk.clone()); b.position.y=0.75; b.castShadow=true; body.add(b); mats.push(b.material);
      var hd=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8), b.material); hd.position.y=1.62; body.add(hd);
      var rm=new THREE.MeshStandardMaterial({ map:getReedTex(), transparent:true, alphaTest:0.4, side:THREE.DoubleSide, roughness:0.9, color:0xa8a888 }); [0,Math.PI/2].forEach(function(r){ var pl=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.7), rm); pl.position.y=1.15; pl.rotation.y=r; body.add(pl); });
      var eye=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xff4a3a, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.8 })); eye.scale.set(0.35,0.2,1); eye.position.set(0,1.62,0.2); body.add(eye); return 2.15; }
    if(look==='husk'){ mobMats.mud=mobMats.mud||new THREE.MeshStandardMaterial({ color:0x2a2620, roughness:0.98 }); var d=new THREE.Mesh(new THREE.SphereGeometry(1,12,8), mobMats.mud.clone()); d.scale.set(1.15,0.62,1.15); d.position.y=0.42; d.castShadow=true; body.add(d); mats.push(d.material);
      var bm=new THREE.MeshStandardMaterial({ color:0x9a8e74, roughness:0.7 }); for(var i=0;i<6;i++){ var a=i/6*6.28, sp=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.55,6), bm); sp.position.set(Math.cos(a)*0.65, 0.85, Math.sin(a)*0.65); sp.rotation.set(Math.sin(a)*0.6, 0, -Math.cos(a)*0.6); body.add(sp); }
      var crack=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.35,0.6), new THREE.MeshBasicMaterial({ color:0xff4a2a })); crack.position.set(0,0.75,0.55); crack.rotation.x=0.5; body.add(crack);
      var cg=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xff5a3a, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.5 })); cg.scale.set(0.8,0.8,1); cg.position.set(0,0.8,0.5); body.add(cg); return 1.5; }
    return null; }
  function mkMob(m){ var g=new THREE.Group(); g.position.copy(v3(m.x,m.y)); var body=new THREE.Group(); g.add(body);
    var kind=dummyKinds[(dummyI++)%dummyKinds.length]; var t=propTpl[kind]; var mats=[]; var hpY=2.15;
    var lookH=m.def&&m.def.look ? mkMobLook(m.def.look, body, mats) : null; if(lookH){ hpY=lookH; t=null; }
    else if(t){ var c=t.clone(); var b=t.userData.box; var sc=1.8/(b.max.y-b.min.y); c.scale.setScalar(sc); c.position.set(-(b.min.x+b.max.x)/2*sc, -b.min.y*sc, -(b.min.z+b.max.z)/2*sc); c.traverse(function(o){ if(o.isMesh){ o.material=o.material.clone(); mats.push(o.material); } }); body.add(c); }
    else if(!lookH){ var t2=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,1.5,8), new THREE.MeshStandardMaterial({ color:0x6a7a9a })); t2.position.y=0.75; body.add(t2); mats.push(t2.material); }
    var hp=new THREE.Sprite(new THREE.SpriteMaterial({ color:0xC7332C, depthTest:false })); hp.scale.set(0.8,0.06,1); hp.position.y=hpY; hp.visible=false; g.add(hp);
    var hpbg=new THREE.Sprite(new THREE.SpriteMaterial({ color:0x000000, opacity:0.6, transparent:true, depthTest:false })); hpbg.scale.set(0.84,0.09,1); hpbg.position.y=hpY; hpbg.visible=false; g.add(hpbg);
    scene.add(g); return { g:g, body:body, hp:hp, hpbg:hpbg, mats:mats, tilt:0, flash:0, bob:0 }; }
  function renderMobs(dt){ if(!skirm) return; var snap=skirm.snapshot(); var t=performance.now()/1000;
    snap.mobs.forEach(function(m){ var me=mobsEnt[m.id]; if(!me) return; if(m.dead){ if(me.g.visible){ me.g.position.y-=dt*0.6; me.g.rotation.x+=dt*1.5; if(me.g.position.y<-1.5) me.g.visible=false; } return; }
      me.g.position.set(X(m.x), 0, Z(m.y)); me.g.rotation.y=Math.atan2(X(P.x)-X(m.x), Z(P.y)-Z(m.y));
      var bob=(m.moving && m.state==='chase')?Math.abs(Math.sin(t*9))*0.08:0; var tiltW=m.state==='knockdown'?-1.35:m.state==='knockback'?-0.35:m.state==='telegraph'?0.25*(1-m.tele/m.teleDur):m.state==='swing'?-0.45:0;
      me.tilt+= (tiltW-me.tilt)*Math.min(1,dt*10); me.body.rotation.x=me.tilt; me.body.position.y=bob; if(me.flash>0) me.flash-=dt; me.mats.forEach(function(mt){ if(mt.emissive) mt.emissive.setHex(me.flash>0?0x804020:0x000000); });
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
  function scaledZone(z){ if(!z||zoneScale===1) return z; var o=Object.assign({}, z); if(o.r) o.r=Math.round(o.r*zoneScale); if(o.len) o.len=Math.round(o.len*zoneScale); if(o.w) o.w=Math.round(o.w*zoneScale); return o; }
  var hooks={ canHit:function(){ return Bs.dist<=L.player.reach; }, canCounter:function(){ return Bs.dist<=L.player.reachCounter; }, canStart:function(){ return Bs.dist<=L.ai[phase].start; },
    pick:function(pats, i){ var mode=L.ai[phase].pick; if(mode==='auto'){ var near=Bs.dist<240; var c=pats.filter(function(p){ return !p.range||p.range==='any'||(near?p.range!=='far':p.range!=='near'); }); if(!c.length) c=pats; return c[i%c.length]; } if(mode!=='range') return pats[i%pats.length]; if(Bs.dist<170) return pats[1]; return i%2 ? pats[2] : pats[0]; }, inZone:function(pat){ return zone ? world.inZone(zone, P.x, P.y) : true; } };

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
      case 'break': SFX.play('brk'); var bp=bossHitPos(HITMAP[e.part]); num(bp, '부위 파괴 — '+e.name, 'crit'); burst(bp, 40, 0x7B9BD6); vib([30,40,30]); guide('<b>'+e.name+'</b> 파괴. 자세가 무너진다', 2.5); bossDetach(HITMAP[e.part]); dropPart(e.part); bossPlay('stagger'); shake(0.008,300); var pdef=A.stages[phase].parts.filter(function(p){ return p.id===e.part; })[0]; if(pdef&&pdef.onBreak){ if(pdef.onBreak.slow) bossSlow=Math.min(bossSlow, pdef.onBreak.slow); if(pdef.onBreak.zoneScale) zoneScale=Math.min(zoneScale, pdef.onBreak.zoneScale); } break;
      case 'downed': SFX.play('down'); guide('<b>격추!</b> 5초 동안 모든 피해 1.5배', 3); bossPlay('down'); zone=null; hideZone(); shake(0.012,400); break;
      case 'up': guide((A.hudName||'허수아비')+'가 자세를 되찾았다', 1.5); bossPlay('up'); break;
      case 'telegraph': SFX.play('tele'); zone=world.makeZone({ zone:scaledZone(L.zones[e.pattern]) }, Bs.x, Bs.y, P.x, P.y); zone.pattern=e.pattern; bossPlay('tele_'+e.icon, { dur:e.dur }); if(phase===2 && !seen.tele3){ seen.tele3=1; guide('붉은 범위 안에 있으면 맞는다 · 고리가 <b>흰색</b>일 때 붙어서 탭 = 카운터', 3.5); } if(phase===1 && !seen.tele2){ seen.tele2=1; guide('붉은 범위 <b>밖으로 구르면</b> 피한다', 3); } break;
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
  var runXp=0, runLuck=1;
  function dropLoot(x,y,def){ var T=window.TW_ITEMS, LT=window.TW_LOOT; var d=LT?LT.mobDrops(def.id, runLuck):{ gold:def.gold, items:def.drops||[] };
    var g=d.gold||0; for(var i=0;i<3&&g>0;i++) spawnPickup(x+(Math.random()*80-40), y+(Math.random()*40-20), 'gold', Math.round(g/3));
    d.items.forEach(function(dr){ var it=T.get(dr[0]); spawnPickup(x+(Math.random()*90-45), y+(Math.random()*44-22), 'item', dr[1], dr[0], it?it.name:dr[0]); }); }
  /* 부위 파괴 보너스 드랍: 보스와 플레이어 사이로 떨어진다 */
  function dropPart(partId){ var T=window.TW_ITEMS, LT=window.TW_LOOT; if(!LT) return; var items=LT.partDrops(runLuck, A.id, partId); var bx=Bs.x+(P.x-Bs.x)*0.35, by=Bs.y+(P.y-Bs.y)*0.35;
    items.forEach(function(dr){ var it=T.get(dr[0]); spawnPickup(bx+(Math.random()*100-50), by+(Math.random()*50-25), 'item', dr[1], dr[0], it?it.name:dr[0]); }); if(items.length) toast('부위 파괴 보상 <b>'+items.length+'</b>종'); }
  var strawSprMat=null, artTexCache={};
  /* 아이템 고유 이미지(art/items/<id>.svg)를 128px 캔버스 텍스처로 — 드랍 빌보드에 쓴다 */
  function artTex(id){ var src=window.TW_ITEMS&&TW_ITEMS.artOf(id); if(!src) return null; if(artTexCache[src]) return artTexCache[src]; var c=document.createElement('canvas'); c.width=c.height=128; var t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; artTexCache[src]=t; var im=new Image(); im.onload=function(){ c.getContext('2d').drawImage(im,0,0,128,128); t.needsUpdate=true; }; im.src=src; return t; }
  function spawnPickup(x,y,kind,amt,id,name){ var sp; if(kind==='gold'){ sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xF0C060, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); sp.scale.set(0.5,0.5,1); } else { var it=window.TW_ITEMS&&TW_ITEMS.get(id), rc=it?TW_ITEMS.RARITY[it.rarity].color:'#ffffff'; var gear=window.TW_LOOT&&TW_LOOT.isGear(id); if(gear||(it&&it.rarity!=='common')){ sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:new THREE.Color(rc), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); sp.scale.set(gear?0.9:0.6, gear?0.9:0.6, 1); } else { sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0x9AA0AC, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.5 })); sp.scale.set(0.5,0.5,1); }
      var at=artTex(id); if(at){ var g=new THREE.Group(); g.add(sp); var art=new THREE.Sprite(new THREE.SpriteMaterial({ map:at, transparent:true, depthWrite:false })); var as=gear?0.62:0.46; art.scale.set(as,as,1); art.position.z=0.01; g.add(art); sp=g; } }
    sp.position.copy(v3(x,y,1.0)); scene.add(sp); pickups.push({ sp:sp, x:x, y:y, kind:kind, amt:amt, id:id, name:name, t:0, taken:false, vy:0 }); }
  function tickPickups(dt){ pickups=pickups.filter(function(p){ if(p.taken) return false; p.t+=dt; if(p.sp.position.y>0.3){ p.vy-=9*dt; p.sp.position.y=Math.max(0.3, p.sp.position.y+p.vy*dt); if(p.sp.position.y<=0.3&&p.vy<0) p.vy=-p.vy*0.4; } p.sp.position.y+=Math.sin(p.t*4)*0.002;
      if(p.t>0.4 && world.dist(P.x,P.y,p.x,p.y)<170){ p.taken=true; scene.remove(p.sp); if(p.kind==='gold'){ SAVE.addGold(p.amt); toast('<b>+'+p.amt+'</b> 골드'); } else { var it=window.TW_ITEMS&&TW_ITEMS.get(p.id), gear=window.TW_LOOT&&TW_LOOT.isGear(p.id); if(gear&&window.TW_GEAR) TW_GEAR.addGear(p.id); else if(window.TW_GEAR) TW_GEAR.addItem(p.id, p.amt); else SAVE.addItem(p.id, p.amt); noteQuestItem(p.id); var col=it?TW_ITEMS.RARITY[it.rarity].color:'#EBD6D6'; var art=it&&TW_ITEMS.artOf(p.id); toast((art?'<img class="tico" src="'+art+'" alt="">':'')+(gear?'<b style="color:'+col+'">장비 획득</b> · ':'')+'<span style="color:'+col+'">'+p.name+'</span> <b>×'+p.amt+'</b>'); if(gear||(it&&(it.rarity==='hero'||it.rarity==='legend'||it.rarity==='myth'))) SFX.play('clear'); } SFX.play('ui'); renderProg(); return false; } return true; }); }
  function gainXp(n, why){ runXp+=n; var r=SAVE.addXp(n); toast('경험치 <b>+'+n+'</b>'+(why?' · '+why:'')); if(r.leveled){ toast('<b>LEVEL UP</b> — Lv.'+r.lv); SFX.play('clear'); flash(); burst(above(P.x,P.y,1.4), 50, 0x5FAE9B); } renderProg(); }
  function renderProg(){ var sv=SAVE.get(); fill('v-xp', sv.xp/SAVE.need(sv.lv)*100); $('#xp-lv').textContent='LV.'+sv.lv; $('#v-gold').textContent=W.fmt(SAVE.wallet?SAVE.wallet():sv.gold)+' G'; }
  function renderQuest(){ var q=L.beats.quest, curI=-1; var html='<div class="quest__t">'+(L.beats.questTitle||'임무')+'</div>'; q.forEach(function(it,i){ var key=it[2]||['mobs','gate','boss'][i], val=quest[key]||0, done=val>=it[1], opt=!!it[3]; if(!done&&curI<0&&!opt) curI=i; html+='<div class="q'+(done?' done':i===curI?' cur':'')+(opt?' opt':'')+'"><span>'+(opt?'선택 · ':'')+it[0]+'</span><span>'+Math.min(val,it[1])+' / '+it[1]+'</span></div>'; }); el.quest.innerHTML=html; }
  function noteQuestItem(id){ if(id==='q_record'&&!quest.record){ quest.record=1; renderQuest(); guide('<b>정찰대의 기록</b> 회수 — 선택 목표 달성', 2.5); } if(id==='q_fragment'&&!quest.fragment){ quest.fragment=1; renderQuest(); guide('<b>핵심 파편</b> 획득 — 선택 목표 달성', 2.5); } }
  function comboShow(n, big){ if(n===0) return; el.comboN.textContent=n; el.combo.classList.toggle('big', !!big); el.combo.classList.add('is-on'); comboT=1.1; }
  var dlgLines=null, dlgI=0, dlgDone=null;
  function dialogue(lines, done){ dlgLines=lines; dlgI=0; dlgDone=done; cine=true; showLine(); }
  function showLine(){ var l=dlgLines[dlgI]; el.dlgWho.textContent=l[0]; el.dlgTxt.textContent=l[1]; el.dlg.classList.add('is-on'); SFX.play('ui'); }
  el.dlg.addEventListener('pointerdown', function(e){ e.stopPropagation(); dlgI++; if(dlgI<dlgLines.length) showLine(); else { el.dlg.classList.remove('is-on'); cine=false; dlgDone&&dlgDone(); } });
  document.addEventListener('keydown', function(e){ if(el.dlg.classList.contains('is-on') && (e.code==='Space'||e.code==='Enter')){ e.preventDefault(); el.dlg.dispatchEvent(new PointerEvent('pointerdown')); } });
  function deathOverlay(){ if(state==='dead') return; state='dead'; battle=null; SFX.play('down'); flash(); shake(0.02,600); ain.hitT=9; ain.dead=true; playOnce('death',{ hold:true, speed:1.1 }); camZoom=1.25;
    setTimeout(function(){ el.ov.classList.add('deathov'); var DD=L.beats.death||{}; overlay('<div class="ov__k">'+(DD.k||'쓰러졌다')+'</div><div class="ov__t">'+L.name+'</div><div class="ov__line">'+(DD.line||'마태오 — “다시.”')+'</div><div class="ov__hint">'+(DD.hint||'격벽 앞에서 다시 시작한다. 잡은 것과 얻은 것은 남는다.')+'</div><button class="btn btn--primary" data-go>'+(DD.btn||'격벽 앞에서 재도전')+'</button> <a class="btn" href="office.html" style="margin-left:8px">사무실로</a>', function(){ try{ sessionStorage.setItem('tw:retry','gate'); }catch(e){} location.reload(); }); }, 1400); }

  /* ---------- 흐름 ---------- */
  function overlay(html, onBtn){ el.ovBox.innerHTML=html; el.ov.classList.add('is-on'); var b=el.ovBox.querySelector('[data-go]'); if(b) b.addEventListener('click', function(){ el.ov.classList.remove('is-on'); onBtn&&onBtn(); }); }
  var cineCam=null; /* {from,to,look,t,dur} */
  function startFight(){ state='fight'; world.setSolid(gate.cx, gate.cy, true); gateClosed=true; P.x=Math.max(P.x, (gate.cx+1)*map.cell + P.r + 6); gateMesh.visible=true;
    SFX.play('gate'); vib([40,60,40]); shake(0.01,500); guide(L.beats.gate, 2.5);
    cine=true; stick.sx=stick.sy=0;
    var bpos=v3(Bs.x,Bs.y,1.6), pcam=camPos.clone();
    setTimeout(function(){ cineCam={ from:pcam.clone(), to:bpos.clone().add(new THREE.Vector3(-3.5,1.4,4.5)), look:bpos, t:0, dur:1.1 }; SFX.play('chains'); bossPlay('stagger'); }, 500);
    setTimeout(function(){ boss.anim.glow=1.2; banner('B O S S', 0, A.stages[0].name+' · '+L.place, false); el.cV.textContent=A.hudName||'허수아비'; SFX.play('phase'); shake(0.012, 600); burst(bossHitPos('core'), 40, 0xD94A45); }, 1700);
    setTimeout(function(){ cineCam={ from:cineCam.to.clone(), to:camPos.clone(), look:null, t:0, dur:0.9, back:true }; }, 3200);
    setTimeout(function(){ cineCam=null; cine=false; el.bosshp.classList.remove('is-off'); el.timerBox.classList.remove('is-off'); fightT=0; startPhase(0); }, 4200); }
  function phaseClear(){ var m=Object.assign({}, battle.metrics); stageResults.push(m); PS=battle.exportPlayer(); bossStop(); zone=null; hideZone(); gainXp(150+phase*100, '페이즈 돌파');
    if (phase < A.stages.length-1){ var next=phase+1; battle=null; SFX.play('phase'); bossPlay('stagger'); flash(); vib([30,30,60]); burst(bossHitPos('core'), 50, next===1?0xC9A45E:0xD94A45); var enTxt=(L.beats.enter||[])[next]||(next===1?'사슬이 끊어진다':'핵이 타오른다'); if(enTxt) num(bossHitPos('head'), enTxt, 'counter'); setTimeout(function(){ startPhase(next); }, 1400); }
    else { battle=null; state='clear'; quest.boss=1; renderQuest(); gainXp(A.id==='tutorial'?400:900, A.stages[A.stages.length-1].name+' 격파'); SAVE.stat('runs'); SFX.play('brk'); setTimeout(function(){ SFX.play('clear'); }, 900); bossPlay('collapse'); playOnce('cheer',{hold:true}); el.timerBox.classList.add('is-off'); var sum=CB.summarize(R, A, stageResults); camZoom=1.15; runLuck=window.TW_LOOT?TW_LOOT.luckOf(sum):1;
      setTimeout(function(){ overlay('<div class="ov__k">던전 클리어</div><div class="ov__t">'+L.name+'</div><div class="ov__l">'+A.stages[A.stages.length-1].name+' 격파</div>'+
        '<div class="ov__stats"><div>등급<b class="g-'+sum.rank+'">'+sum.rank+'</b></div><div>시간<b>'+sum.op.time+'</b></div><div>카운터<b>'+sum.op.counterRate+'</b></div><div>부위 파괴<b>'+sum.breaks+'/'+sum.breakable+'</b></div><div>받은 피해<b>'+sum.op.dmgTaken+'</b></div></div>'+
        '<button class="btn btn--primary" data-go>정산으로</button>', function(){ finish(sum); }); }, 1800); } }
  function collectAll(){ var got=0; pickups.forEach(function(p){ if(p.taken) return; p.taken=true; scene.remove(p.sp); got++; if(p.kind==='gold') SAVE.addGold(p.amt); else if(window.TW_LOOT&&TW_LOOT.isGear(p.id)&&window.TW_GEAR) TW_GEAR.addGear(p.id); else if(window.TW_GEAR) TW_GEAR.addItem(p.id, p.amt); else SAVE.addItem(p.id, p.amt); noteQuestItem(p.id); }); pickups=[]; return got; }   /* 정산 전 남은 전리품 자동 회수 (마영전식 종료 정산) */
  function finish(sum){ var T=window.TW_ITEMS, LT=window.TW_LOOT; collectAll(); var prev0=null; try{ prev0=JSON.parse(localStorage.getItem('tw:arena:'+A.id)||'null'); }catch(e){}
    var rw=LT?LT.clearRewards(A.id, sum, !(prev0&&prev0.cleared)):{ gold:sum.gold, mats:sum.mats.map(function(m){ var it=T.get(m[0]); return [m[0], m[1], it?it.rarity:'common']; }), craft:[], bonus:[], all:sum.mats };
    if(LT){ LT.grant(rw.all); } else rw.all.forEach(function(m){ SAVE.addItem(m[0], m[1]); }); SAVE.addGold(rw.gold);   /* 클리어 보상 실제 지급 */
    var res={ arena:A.id, at:new Date().toISOString(), op:sum.op, mastery:sum.mastery, gold:rw.gold, mats:rw.mats, craft:rw.craft, bonus:rw.bonus, xp:runXp, rank:sum.rank, time:sum.time, counterRate:sum.counterRate, perfect:sum.perfect, dmgTaken:sum.dmgTaken, breaks:sum.breaks, breakable:sum.breakable,
      meta:[ ['작전 모드',L.code||'던전 01'], ['난이도',L.diff||('튜토리얼 · '+L.place)], ['작전 시간', new Date().toLocaleString('ko-KR',{hour12:false})] ],
      objectives:L.beats.quest.filter(function(it){ return it[3]; }).map(function(it){ return [it[0], (quest[it[2]]||0)>=it[1]]; }),
      praise:(L.praise||{S:'완벽한 타이밍이었다.',A:'날카롭다.',B:'기본은 됐다.',C:'살아남긴 했다.'})[sum.rank] };
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
  var ray=new THREE.Raycaster(); function tapTarget(e){ if(!battle) return; var r=el.canvas.getBoundingClientRect(); var m=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(m, cam); var hits=ray.intersectObjects(boss.raycastable, true); if(!hits.length) return; var pt=hits[0].point; var best=null, bd=1e9; Object.keys(boss.PART).forEach(function(k){ var d=bossHitPos(k).distanceTo(pt)/boss.PART[k].r; if(d<bd){ bd=d; best=k; } }); var pid=best; if(!pid) return; var s=battle.snapshot(); if(!s.enemy.parts.some(function(p){ return p.id===pid; })) return; battle.input('target', pid); var pn=s.enemy.parts.filter(function(p){ return p.id===pid; })[0]; guide('조준: <b>'+pn.name+'</b>', 1.2); }
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
  $('#btn-pause').addEventListener('click', function(){ paused=!paused; SFX.play('ui'); if(paused) overlay('<div class="ov__k">일시정지</div><div class="ov__t">'+L.name+'</div><div class="ov__hint" style="margin-top:12px">'+(battle?A.stages[phase].hint:L.beats.start)+'</div>'+settingsHTML()+'<button class="btn btn--primary" data-go>계속</button> <button class="btn" data-diag style="margin-left:8px">진단</button> <a class="btn" href="office.html" style="margin-left:8px">사무실로</a>', function(){ paused=false; }); var db=el.ovBox.querySelector('[data-diag]'); if(db) db.onclick=showDiag; });

  /* ---------- 시작 ---------- */
  function begin(){
    var mobs=[]; Object.keys(L.mobs||{ m:L.mob }).forEach(function(ch){ var def=L.mobs?L.mobs[ch]:L.mob; world.marks(ch).forEach(function(mk){ mobs.push({ id:'m'+mobs.length, x:mk.x, y:mk.y, def:def }); }); });
    if(RETRY==='gate'){ mobs=[]; quest.mobs=L.beats.quest[0][1]; }
    skirm=SKM.create({ char:CHAR, rules:R, world:world, player:P, state:PS, mobs:mobs, reach:L.player.reach, cone:1.3 });
    mobs.forEach(function(m){ mobsEnt[m.id]=mkMob(m); });
    world.setSolid(gate.cx, gate.cy, true); gateMesh.visible=true;
    if(RETRY==='gate'){ openGate(true); P.x=(gate.cx+1)*map.cell+P.r+8; P.y=gate.y; }
    setupPhase(A.stages[0]); Object.keys(boss.hits).forEach(function(k){ boss.hits[k].visible=false; });
    /* 선택 목표·채집: 정찰대의 기록(q) · 채집 지점(f) */
    if(RETRY!=='gate'){ world.marks('q').forEach(function(mk){ spawnPickup(mk.x, mk.y, 'item', 1, 'q_record', '정찰대의 기록'); }); world.marks('f').forEach(function(mk){ spawnPickup(mk.x, mk.y, 'item', 3, 'm_fiber', '갈대 섬유'); if(Math.random()<0.6) spawnPickup(mk.x+34, mk.y+10, 'item', 1, 'm_dew', '붉은 이슬'); }); }
    applySettings(); el.loading.classList.add('is-off'); SFX.ambient(true); renderQuest(); renderProg(); ain.ready=true; DIAG.started=performance.now(); if(SAFE) guide('<b>저사양 모드</b>로 실행 중 (일시정지 → 진단에서 해제)', 4);
    overlay('<div class="ov__k">'+(L.code||'던전 01')+'</div><div class="ov__t">'+L.name+'</div><div class="ov__l">'+L.place+'</div><div class="ov__line">'+(L.beats.intro||'')+'</div><div class="ov__hint">'+(L.beats.introHint||'')+'</div><button class="btn btn--primary" data-go>입장</button>'+
      '<div class="ov__ctrl">폰: 왼쪽 스틱 이동 · 화면 드래그로 시점 회전 · 큰 버튼 탭 공격(4연타) · 길게 스매시 · 회피 · 방어 · 기술 1~4 · R<br>키보드: WASD 이동 · Q/E 시점 · J 공격 · U 스매시 · K 회피 · L 방어 · 1~4 · R · Tab 조준 전환</div>', function(){ if(RETRY!=='gate') dialogue(L.beats.dialog, function(){ guide(L.beats.start, 4); }); else guide((L.beats.death&&L.beats.death.btn?L.beats.death.btn.replace(' 재도전',''):'격벽 앞')+'에서 다시. '+(A.hudName||'허수아비')+'가 기다린다', 3); });
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
    if(battle){ var busy=s.enemy.state!=='idle'; world.bossThink(Bs, P, dt, bossSlow<1?Object.assign({}, L.ai[phase], { speed:L.ai[phase].speed*bossSlow }):L.ai[phase], busy); acc+=dt; var n=0; while(acc>=R.tick && n<6){ battle.tick(R.tick); acc-=R.tick; n++; } fightT+=dt; battle.drain().forEach(function(e){ if(e.t==='hit') lastHit=e.dmg; handle(e); }); }
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
    camPos.x=Math.max(-2, Math.min(mapW+2, camPos.x)); camPos.z=Math.max(-2, Math.min(mapD+4, camPos.z)); camPos.y=Math.max(1.2, Math.min(CEIL-0.4, camPos.y));
    cam.position.copy(camPos); if(shakeT>0){ shakeT-=dt; cam.position.x+=(Math.random()-0.5)*shakeAmt*0.1; cam.position.y+=(Math.random()-0.5)*shakeAmt*0.1; } else shakeAmt=0;
    cam.lookAt(camLook); if(zoomPulse>0){ zoomPulse-=dt*4; cam.fov=50-Math.max(0,zoomPulse)*4; cam.updateProjectionMatrix(); }
    /* 달빛 그림자 카메라를 플레이어 주변으로 */
    moon.position.set(ain.root.position.x-8, 18, ain.root.position.z-6); moon.target.position.copy(ain.root.position); var sc=moon.shadow.camera; sc.left=-14; sc.right=14; sc.top=14; sc.bottom=-14; sc.updateProjectionMatrix();
  }
  function render(dt){
    ainTick(dt); bossTick(dt); renderMobs(dt); tickSparks(dt); tickDebris(dt);
    flickT+=dt; lamps.forEach(function(t,i){ var f=t.red ? 0.6+Math.max(0,Math.sin(flickT*2.2+i))*0.6 : t.purple ? 0.85+Math.sin(flickT*4+i)*0.15 : (0.92+Math.sin(flickT*13+i*1.7)*0.03+(Math.random()<0.02?-0.35:0)); t.l.intensity=SET.lights?t.base*f:0; if(t.fx) t.fx.material.opacity=(t.red?0.5:0.45)*f; });
    emberT+=dt; if(emberT>0.5){ emberT=0; if(L.env==='swamp'){ /* 반딧불: 바닥에서 떠올랐다 가라앉는 포물선 */ for(var fi=0;fi<2;fi++){ var ii=spI=(spI+1)%SPN; spPos[ii*3]=ain.root.position.x+(Math.random()-0.5)*14; spPos[ii*3+1]=0.3+Math.random()*0.5; spPos[ii*3+2]=ain.root.position.z+(Math.random()-0.5)*14; spVel[ii].set((Math.random()-0.5)*0.4, 9.8*1.4, (Math.random()-0.5)*0.4); spLife[ii]=2.8; spCol[ii*3]=0.65; spCol[ii*3+1]=0.95; spCol[ii*3+2]=0.35; } } else { /* 천장에서 떨어지는 먼지 */ for(var di=0;di<3;di++){ var i=spI=(spI+1)%SPN; spPos[i*3]=ain.root.position.x+(Math.random()-0.5)*10; spPos[i*3+1]=CEIL-0.3; spPos[i*3+2]=ain.root.position.z+(Math.random()-0.5)*10; spVel[i].set(0, 9.8*2.2-0.4, 0); spLife[i]=2.2; spCol[i*3]=0.5; spCol[i*3+1]=0.48; spCol[i*3+2]=0.45; } } }
    mist.forEach(function(m,i){ m.position.x=m.userData.x+Math.sin(flickT*0.12+i*1.3)*1.8; m.position.z=m.userData.z+Math.cos(flickT*0.09+i)*1.2; });
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
    for(var y=0;y<map.h;y++) for(var x=0;x<map.w;x++){ var ch=map.rows[y][x]; if(ch==='#'||ch==='|'||(ch==='G'&&gateClosed)){ mctx.fillStyle=L.env==='swamp'?'#2f3d2a':'#3a3d45'; mctx.fillRect(x*sx,y*sy,sx,sy); } else if(ch==='~'){ mctx.fillStyle='#1b2a30'; mctx.fillRect(x*sx,y*sy,sx,sy); } else if(ch==='G'){ mctx.fillStyle='#C9A45E'; mctx.fillRect(x*sx,y*sy,sx,sy); } }
    mctx.fillStyle='#D9544E'; mctx.beginPath(); mctx.arc(Bs.x/map.cell*sx, Bs.y/map.cell*sy, 4, 0, Math.PI*2); mctx.fill(); mctx.fillStyle='#F0E4E4'; mctx.beginPath(); mctx.arc(P.x/map.cell*sx, P.y/map.cell*sy, 3.5, 0, Math.PI*2); mctx.fill(); }
  function frame(now){ requestAnimationFrame(frame); var dt=Math.min(0.1,(now-last)/1000); last=now; if(paused||el.ov.classList.contains('is-on')){ renderer.render(scene, cam); return; }
    fpsSamples.push(1/Math.max(0.001,dt)); if(fpsSamples.length>180){ fpsSamples.shift(); autoQuality(); fpsSamples.length=0; }
    step(dt*timeScale); render(dt*timeScale); renderer.render(scene, cam); blackWatch(); }
  /* 검은 화면 감시: 시작 후 25초 동안 1초마다 화면 중앙을 읽어 완전히 검으면 3회 연속 시 저사양 모드로 재시작 */
  var bwN=0, bwLast=0, bwHits=0, bwPx=new Uint8Array(4*32*32);
  function blackWatch(){ if(!DIAG.started||navigator.webdriver&&!window.TW_BW_TEST) return; var t=performance.now(); if(t-DIAG.started>25000||t-bwLast<1000) return; bwLast=t; try{ var gl=renderer.getContext(), c=renderer.domElement; gl.readPixels((c.width>>1)-16, (c.height>>1)-16, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, bwPx); var mx=0, mn=255; for(var i=0;i<bwPx.length;i+=4){ var v=(bwPx[i]*3+bwPx[i+1]*6+bwPx[i+2])/10; if(v>mx) mx=v; if(v<mn) mn=v; } /* 화면 중앙 32×32 가 완전히 균일(배경색만)하면 아무것도 그려지지 않은 것 */ if(mx-mn<3){ bwHits++; DIAG.black++; if(bwHits>=3){ DIAG.errors.push('EMPTY FRAME x3 (lum '+Math.round(mn)+'~'+Math.round(mx)+')'); if(!SAFE) safeMode('black'); else fatal('화면이 그려지지 않습니다', '저사양 모드에서도 검게 나옵니다. 아래 진단 정보를 알려 주세요.'); } } else bwHits=0; }catch(e){ DIAG.errors.push('readPixels '+e.message); } }

  window.TW_DUNGEON={ world:world, get battle(){ return battle; }, get skirm(){ return skirm; }, get quest(){ return quest; }, get gateOpen(){ return gateOpen; }, dlg:function(){ var d=document.querySelector('#dlg'); if(d.classList.contains('is-on')) d.dispatchEvent(new PointerEvent('pointerdown')); }, killPlayer:function(){ deathOverlay(); }, P:P, B:Bs, get state(){ return state; }, get phase(){ return phase; }, stick:stick, scene:scene, cam:cam, ain:ain, boss:boss, get camYaw(){ return camYaw; }, set camYaw(v){ camYaw=v; }, setBot:function(v){ botStick=v; }, applySettings:function(set){ Object.assign(SET, set||{}); applySettings(); }, get diag(){ return DIAG; }, diagText:diagText, showDiag:showDiag, SAFE:SAFE, get botMode(){ return botMode; }, set botMode(v){ botMode=!!v; }, start:function(){ var b=el.ovBox.querySelector('[data-go]'); if(b) b.click(); }, is3d:true };
})();
