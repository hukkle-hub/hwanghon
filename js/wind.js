/* 황혼 — 바람 (머리카락·옷자락) + 던전별 성격
   머리카락은 Head, 옷자락은 Spine2·UpLeg 에 스킨돼 있고 전용 뼈가 없다. 뼈를 새로 심는
   대신 «자유롭게 늘어진 정점» 만 골라 정점 셰이더에서 민다.

   자유도(aFlex)는 로드할 때 한 번 계산한다 — 뼈에 딱 붙은 살·갑옷은 0, 뼈에서 떨어져
   아래로 늘어진 머리끝·옷자락은 1 에 가깝다.

     머리카락: 두개골 밖으로 나온(반지름) × 머리 관절보다 아래(높이)
     옷자락  : 제 뼈 선분에서 멀리 떨어진(거리) × 골반보다 아래(높이)

     TW_WIND.prepare(THREE, root)        → aFlex 부착 (기하마다 한 번)
     TW_WIND.bind(THREE, root, profile)  → 재질에 바람을 심고 핸들 반환
     TW_WIND.profile('marsh')            → 던전별 바람
     handle.update(dt, worldMatrix)      → 매 프레임

   바람 방향은 «월드» 다. 캐릭터가 도는 대로 바람도 따라 돌면 안 되므로, 매 프레임
   모델의 월드 회전의 역을 곱해 물체 공간으로 넣어 준다. */
(function(){
  'use strict';
  var STRIP=function(n){ return String(n).replace(/^mixamorig:?/,''); };
  var CLOTH={Hips:1,Spine:1,Spine1:1,Spine2:1,LeftUpLeg:1,RightUpLeg:1,LeftLeg:1,RightLeg:1};

  /* 던전마다 다른 공기. dir 은 월드 XZ, amp 는 미터, gust 는 [주기초, 배율] */
  var PROFILE={
    /* 지하 벙커 — 거의 무풍. 환기구에서 이따금 미풍 */
    tutorial:{ dir:[0.7,0.3], amp:0.008, freq:0.9, gust:[7.0,1.8], sway:0.004, name:'정체된 공기' },
    /* 갈대습지 — 트인 습지, 한 방향으로 꾸준히 분다 */
    marsh:   { dir:[-0.9,0.45], amp:0.032, freq:1.5, gust:[3.4,2.1], sway:0.016, name:'습지의 맞바람' },
    /* 정화장 — 지하. 물 위를 스치는 찬 기류 */
    sewage:  { dir:[0.35,-0.94], amp:0.012, freq:1.1, gust:[5.5,1.6], sway:0.006, name:'수면의 찬 기류' },
    /* 변전소 — 팬이 도는 곳. 짧고 빠른 맥동 */
    relay:   { dir:[0.85,0.53], amp:0.014, freq:3.1, gust:[1.7,1.5], sway:0.007, name:'송풍기 맥동' },
    /* 식물원 — 유리 지붕 아래, 방향이 감기는 약한 소용돌이 */
    grove:   { dir:[-0.5,-0.87], amp:0.018, freq:0.8, gust:[6.2,1.9], sway:0.012, swirl:0.35, name:'온실의 소용돌이' },
    /* 끊어진 수송로 — 탁 트인 고가. 가장 세다 */
    road:    { dir:[0.97,-0.25], amp:0.044, freq:1.9, gust:[2.6,2.4], sway:0.022, name:'고가의 강풍' },
    /* 폐병원 — 죽은 공기. 아주 가끔 소름 끼치게 훅 */
    ward:    { dir:[-0.3,0.95], amp:0.006, freq:0.55, gust:[9.0,4.2], sway:0.003, name:'멎은 공기' }
  };
  var DEFAULT={ dir:[1,0], amp:0.018, freq:1.3, gust:[4,1.8], sway:0.01, name:'바람' };
  function profile(id){ var p=PROFILE[id]||DEFAULT; return JSON.parse(JSON.stringify(p)); }

  /* --- aFlex: 어느 정점이 자유로운가 --- */
  function boneSegments(THREE, mesh){
    /* 뼈의 «바인드» 위치를 메시 로컬 공간에서 구한다 (boneInverse 의 역) */
    var sk=mesh.skeleton, seg=[], i, m=new THREE.Matrix4(), p=new THREE.Vector3();
    for(i=0;i<sk.bones.length;i++){
      m.copy(sk.boneInverses[i]).invert(); p.setFromMatrixPosition(m);
      /* 다시 리깅한 캐릭터(docs/design/77): 바람 보정값은 옛 관절 자리 기준으로 맞춘 것이라
         glb 가 남긴 옛 자리(rerigAnchor, 뼈 로컬)를 쓴다 — 옷자락 판정이 전과 같게 된다 */
      var an=sk.bones[i].userData&&sk.bones[i].userData.rerigAnchor;
      if(an) p.set(an[0],an[1],an[2]).applyMatrix4(m);
      seg.push({ name:STRIP(sk.bones[i].name), head:p.clone(), tail:null });
    }
    for(i=0;i<sk.bones.length;i++){
      var b=sk.bones[i], child=null;
      for(var k=0;k<b.children.length;k++) if(b.children[k].isBone){ child=b.children[k]; break; }
      var j=child?sk.bones.indexOf(child):-1;
      seg[i].tail=j>=0?seg[j].head.clone():seg[i].head.clone().add(new THREE.Vector3(0,0.12,0));
    }
    return seg;
  }
  function distToSeg(p,a,b,tmp){
    tmp.copy(b).sub(a); var L2=tmp.lengthSq();
    if(L2<1e-9) return p.distanceTo(a);
    var t=Math.max(0,Math.min(1,(p.x-a.x)*tmp.x+(p.y-a.y)*tmp.y+(p.z-a.z)*tmp.z)/L2);
    return Math.hypot(p.x-(a.x+tmp.x*t), p.y-(a.y+tmp.y*t), p.z-(a.z+tmp.z*t));
  }
  var CLAMP=function(v){ return v<0?0:v>1?1:v; };
  var HAIR_GAIN=0.35;   /* 머리카락 진폭 보정 — 옷자락 대비. §5.2 참고 */

  /* 임계값은 «메시에서» 뽑는다. 캐릭터마다 바인드 공간·체격이 달라 고정값은 안 먹는다.
     머리카락은 «늘어진 가닥» 이 아니다 — 네 캐릭터 모두 두피에 붙은 짧은 머리이고,
     Head 정점은 두개골 밑(1.49)에서 정수리(1.68)까지 고작 19cm 안에 다 들어 있다.
     그래서 «아래로 늘어진 만큼» 으로는 아무것도 못 고른다(최대 자유도 0.095 였다).
     실제 게임의 짧은 머리처럼 «머리 껍질이 목을 축으로 기운다» 로 간다:
     자유도 = 머리 관절에서 먼 만큼. 대신 얼굴은 반드시 빼야 한다 — 앞쪽 원뿔을 막는다. */
  function prepare(THREE, root, opts){
    opts=opts||{};
    var made=0;
    root.traverse(function(o){
      if(!o.isSkinnedMesh||!o.geometry||!o.skeleton) return;
      var g=o.geometry;
      if(g.getAttribute('aFlex')) return;
      var seg=boneSegments(THREE,o), byName={};
      seg.forEach(function(s,i){ byName[s.name]=i; });
      var head=byName.Head!=null?seg[byName.Head].head:null;
      var hips=byName.Hips!=null?seg[byName.Hips].head:null;
      /* 앞이 어느 쪽인가 — 발끝이 발보다 앞에 있다. 네 캐릭터 모두 +z (0.11~0.12) */
      var fz=1; if(byName.LeftToeBase!=null&&byName.LeftFoot!=null)
        fz=seg[byName.LeftToeBase].head.z-seg[byName.LeftFoot].head.z<0?-1:1;
      var pos=g.attributes.position, si=g.attributes.skinIndex, sw=g.attributes.skinWeight;
      if(!si||!sw||!hips) return;
      g.computeBoundingBox();
      var bb=g.boundingBox, topY=bb.max.y, dom=new Int32Array(pos.count);
      var v=new THREE.Vector3(), tmp=new THREE.Vector3(), i, k;
      /* 1) 지배 뼈 · 머리 반지름 표본 */
      var headR=[], headTop=-Infinity, hcx=0, hcz=0, hcn=0;
      for(i=0;i<pos.count;i++){
        var bi=0,bw=-1;
        for(k=0;k<4;k++){ var w=sw.getComponent(i,k); if(w>bw){ bw=w; bi=si.getComponent(i,k); } }
        dom[i]=bi;
        if(head&&seg[bi]&&seg[bi].name==='Head'){
          headR.push(Math.hypot(pos.getX(i)-head.x, pos.getY(i)-head.y, pos.getZ(i)-head.z));
          if(pos.getY(i)>headTop) headTop=pos.getY(i);
          hcx+=pos.getX(i); hcz+=pos.getZ(i); hcn++;
        }
      }
      headR.sort(function(a,b){ return a-b; });
      /* 머리 반지름 — 관절(목)에서 정점까지. 40% 지점이 목·두피, 95% 지점이 바깥 머리칼 */
      var rIn=headR.length?headR[Math.floor(headR.length*0.40)]:0.06;
      var rOut=headR.length?headR[Math.floor(headR.length*0.95)]:0.14;
      if(rOut-rIn<1e-3) rOut=rIn+1e-3;
      var headH=Math.max(0.05,(headTop>-Infinity?headTop:0)-(head?head.y:0));
      /* 앞뒤 기준은 «관절» 이 아니라 머리 무게중심이다. 세라·류는 머리통이 목 관절보다
         6cm 앞에 있어, 관절 기준으로 재면 뒤통수까지 «얼굴» 로 잡혀 통째로 막혔다. */
      var hcZ=hcn?hcz/hcn:(head?head.z:0);
      /* 2) 자유도 */
      var flex=new Float32Array(pos.count), n=0;
      var clothSpan=Math.max(0.20,(hips.y-bb.min.y)*0.85);
      for(i=0;i<pos.count;i++){
        var s=seg[dom[i]]; if(!s){ continue; }
        v.set(pos.getX(i),pos.getY(i),pos.getZ(i));
        var f=0;
        if(s.name==='Head'&&head){
          /* 목에서 멀수록 크게 — 껍질이 기우는 모양이 된다 */
          var dh=Math.hypot(v.x-head.x, v.y-head.y, v.z-head.z);
          f=CLAMP((dh-rIn)/(rOut-rIn));
          /* 얼굴 차단: 앞쪽이면서 정수리보다 아래인 곳. 여기가 움직이면 «얼굴 일그러짐» 이다.
             앞으로 0.35 반지름 이상 나온 지점부터 완전히 0 으로 눌러 버린다. */
          var fwd=(v.z-hcZ)*fz/Math.max(1e-4,rOut);
          var up=(v.y-head.y)/headH;
          if(up<0.80) f*=1-CLAMP(fwd/0.18);
          /* 머리는 옷자락과 «같은 세기로 밀면 안 된다». 치맛단은 80cm 를 늘어뜨리지만
             머리통은 위아래로 19cm 뿐이라, 10cm 를 밀면 머리 껍질이 두피에서 떨어져
             정수리에 틈이 벌어진다(실제로 벌어졌다). 짧은 머리답게 3~4cm 로 줄인다. */
          f*=HAIR_GAIN;
        } else if(CLOTH[s.name]){
          var d=distToSeg(v,s.head,s.tail,tmp), down=hips.y-v.y;
          if(down>0) f=CLAMP((d-0.075)/0.070)*CLAMP(down/clothSpan)*CLAMP(down/clothSpan);
        }
        flex[i]=f; if(f>0.02) n++;
      }
      g.setAttribute('aFlex', new THREE.BufferAttribute(flex,1));
      g.userData.windVerts=n;
      g.userData.windCal={ hcZ:+hcZ.toFixed(4), rIn:+rIn.toFixed(4), rOut:+rOut.toFixed(4), headH:+headH.toFixed(3), fz:fz, clothSpan:+clothSpan.toFixed(3) };
      made++;
    });
    return made;
  }

  /* --- 재질에 바람 심기 --- */
  var HEAD=[
    'attribute float aFlex;',
    'uniform vec3 uWind;',      /* 물체 공간 방향 × 세기 */
    'uniform float uWindT;',
    'uniform float uWindFreq;',
    'uniform float uSway;'
  ].join('\n');
  var BODY=[
    '#include <skinning_vertex>',
    'if(aFlex > 0.002){',
    '  float ph = uWindT*uWindFreq + transformed.y*2.7 + transformed.x*1.9 + transformed.z*1.1;',
    '  float s  = sin(ph)*0.66 + sin(ph*1.87 + 1.3)*0.34;',
    '  transformed += uWind * (aFlex * (0.55 + 0.45*s));',
    /* 결을 살짝 흔들어 «천이 일렁이는» 느낌 — 바람 축과 직각으로 */
    '  transformed.y += uSway * aFlex * sin(ph*0.83 + 2.1);',
    '}'
  ].join('\n');

  function bind(THREE, root, prof, opts){
    prof=prof||DEFAULT; opts=opts||{};
    var uni={ uWind:{value:new THREE.Vector3()}, uWindT:{value:0},
              uWindFreq:{value:prof.freq}, uSway:{value:prof.sway||0} };
    var bound=0, cloned=[];
    root.traverse(function(o){
      if(!o.isSkinnedMesh||!o.geometry||!o.geometry.getAttribute('aFlex')) return;
      if(!o.geometry.userData.windVerts) return;            /* 흔들 것이 없으면 건너뛴다 */
      var mats=Array.isArray(o.material)?o.material:[o.material];
      o.material=Array.isArray(o.material)?mats.map(w):w(mats[0]);
      function w(m){
        if(!m) return m;
        var c=m.clone(); c.userData.wind=true;
        c.onBeforeCompile=function(sh){
          sh.uniforms.uWind=uni.uWind; sh.uniforms.uWindT=uni.uWindT;
          sh.uniforms.uWindFreq=uni.uWindFreq; sh.uniforms.uSway=uni.uSway;
          sh.vertexShader=HEAD+'\n'+sh.vertexShader.replace('#include <skinning_vertex>', BODY);
        };
        c.customProgramCacheKey=function(){ return 'tw-wind'; };
        bound++; cloned.push(c); return c;
      }
    });
    var t=0, gust=0, dir=new THREE.Vector3(prof.dir[0],0,prof.dir[1]).normalize();
    var inv=new THREE.Matrix3(), world=new THREE.Vector3();
    var handle={
      profile:prof, bound:bound, uniforms:uni, materials:cloned,
      update:function(dt, obj){
        t+=dt; uni.uWindT.value=t;
        /* 돌풍: 주기마다 부드럽게 부풀었다 가라앉는다 */
        var gp=prof.gust?prof.gust[0]:4, gm=prof.gust?prof.gust[1]:1.8;
        var phase=(t%gp)/gp, bump=Math.pow(Math.sin(phase*Math.PI),6);
        gust=1+(gm-1)*bump;
        world.copy(dir);
        if(prof.swirl){ var a=t*prof.swirl; world.set(dir.x*Math.cos(a)-dir.z*Math.sin(a),0,dir.x*Math.sin(a)+dir.z*Math.cos(a)); }
        world.multiplyScalar(prof.amp*gust);
        /* 월드 → 물체 공간 (캐릭터가 돌아도 바람은 제 방향을 지킨다) */
        if(obj&&obj.matrixWorld){ inv.setFromMatrix4(obj.matrixWorld).invert(); world.applyMatrix3(inv); }
        uni.uWind.value.copy(world);
      },
      setProfile:function(p){ prof=p||DEFAULT; dir.set(prof.dir[0],0,prof.dir[1]).normalize();
        uni.uWindFreq.value=prof.freq; uni.uSway.value=prof.sway||0; handle.profile=prof; }
    };
    return handle;
  }

  globalThis.TW_WIND={ HAIR_GAIN:HAIR_GAIN, prepare:prepare, bind:bind, profile:profile, PROFILE:PROFILE, DEFAULT:DEFAULT };
})();
