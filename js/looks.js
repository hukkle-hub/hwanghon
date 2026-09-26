/* 황혼 — 장비 외형 (3D). 장착한 장비가 아인의 모습을 바꾼다: 주무기 모델 교체, 보조·부무기는 허리·등에 걸침, 방어구·장신구는 뼈에 붙는 조각.
   window.TW_LOOKS = { WEAPON, ARMOR, attach(THREE, loader, model, equipped, opts) }
   · 무기 GLB 규약: 원점 = 자루 끝, +Y 자루 방향, 오른손 그립 0.75 m (tools/3d/build_weapons.py)
   · 뼈 로컬 축(아인 리그, viewer 로 측정): 몸통·머리 = x 오른쪽 · y 위 · z 앞 / 팔·다리 = y 뼈 방향(아래) · -z 앞
   · 제작품(c_…)은 기본형 외형 + gear.js lookOf 색조 (game3d.applyWeaponLook) */
(function(){
  var WEAPON={
    w_red_tension:    { glb:'art/3d/gear/w_red_tension_hi3d.glb?v=2030h2', grip:0.75 },
    w_marsh_scythe:    { glb:'art/3d/ain_scythe_tex.glb', grip:0.75 },
    w_rust_executioner:{ glb:'art/3d/gear/w_rust_executioner.glb', grip:0.75 },
    w_marsh_blade:     { glb:'art/3d/gear/w_marsh_blade.glb', grip:0.75 },
    w_ruin_spear:      { glb:'art/3d/gear/w_ruin_spear.glb', grip:0.75 },
    w_rust_sword:      { glb:'art/3d/gear/w_rust_sword.glb', grip:0.75 },
    /* 보조(왼 허리)·부무기(등) */
    w_ash_dirk:        { glb:'art/3d/gear/w_ash_dirk.glb', bone:'Hips', pos:[0.17,-0.04,0.05], rot:[Math.PI*0.95,0,0.35] },
    w_hook_scythe:     { glb:'art/3d/gear/w_hook_scythe.glb', bone:'Spine2', pos:[0.08,-0.02,-0.11], rot:[0.1,0,2.5], scale:0.75 }
  };
  /* 캐릭터 고유 무기: 아인 외 캐릭터는 인벤토리 주무기(낫) 대신 자기 무기를 든다. off = 왼손 슬롯(쌍수) */
  var DUAL={ w_ryu_dagger:true, w_ryu_shiv:true, w_ryu_twinfang:true };   /* 쌍수: 같은 모델을 왼손 슬롯에도 */
  /* 체격 스케일 (아인 = 1): 조각 크기·오프셋에 곱함. body-metrics 실측 (키·가슴폭·팔뚝·정강이) */
  var CHARFIT={ kain:{ h:1.107, head:0.97, chest:1.12, gloves:1.3, legs:1.1, boots:1.1, acc:1.1 }, ryu:{ h:1.06, head:0.98, chest:1.07, gloves:0.92, legs:1.04, boots:1.04, acc:1.03 }, sera:{ h:1.024, head:0.95, chest:1.03, gloves:1.0, legs:1.02, boots:1.02, acc:1.0 } };
  /* FIT-BEGIN — tools/3d/armor-fit.html 로 잰 값(docs/design/83). 장비 자리 로컬(미터)에서 몸의 [가운데, 폭] (2~98 %).
     아인 자리에 맞춰 만든 장비를 다른 캐릭터로 옮길 때: 위치 = c캐릭터 + (p − c아인)·r, 크기 × r, r = 폭 비(0.85~1.4).
     발(…Sole)은 [가운데, 폭, 발바닥 기울기°] — 장화는 발바닥에 앉히고 기울기 차만큼 돌린다 */
  var BODYFIT={"ain":{"Head":[[-0.003,0.039,-0.007],[0.196,0.202,0.183]],"Torso":[[0.014,0.134,0.001],[0.238,0.296,0.252]],"Neck":[[-0.015,-0.018,0.006],[0.055,0.044,0.036]],"LeftLeg":[[0.004,0.145,0.02],[0.103,0.398,0.129]],"RightLeg":[[-0.002,0.182,0.022],[0.101,0.334,0.127]],"LeftForeArm":[[-0.005,0.089,0.016],[0.122,0.184,0.078]],"RightForeArm":[[-0.001,0.097,0.015],[0.11,0.184,0.087]],"LeftSole":[[0.006,0.42,-0.054],[0.086,0.147,0.228],-17.3],"RightSole":[[-0.005,0.42,-0.053],[0.087,0.147,0.226],-15.8],"LeftHand":[[0.008,0.072,-0.002],[0.058,0.11,0.082]]},"kain":{"Head":[[-0.001,0.053,0.034],[0.176,0.246,0.22]],"Torso":[[0.009,0.137,0.01],[0.351,0.414,0.323]],"Neck":[[-0.004,0.011,-0.118],[0.145,0.119,0.096]],"LeftLeg":[[0.077,0.216,0.034],[0.153,0.403,0.177]],"RightLeg":[[-0.075,0.219,0.037],[0.153,0.406,0.174]],"LeftForeArm":[[-0.029,0.078,-0.019],[0.145,0.241,0.163]],"RightForeArm":[[0.031,0.079,-0.013],[0.141,0.237,0.157]],"LeftSole":[[0.129,0.482,-0.062],[0.146,0.137,0.293],-1.6],"RightSole":[[-0.127,0.484,-0.062],[0.148,0.135,0.292],-1.4],"LeftHand":[[-0.012,-0.022,-0.083],[0.097,0.189,0.121]]},"ryu":{"Head":[[-0.014,0.062,0.066],[0.162,0.21,0.2]],"Torso":[[-0.002,0.13,0.028],[0.276,0.393,0.299]],"Neck":[[0.004,0.039,-0.077],[0.161,0.101,0.112]],"LeftLeg":[[0.034,0.192,-0.003],[0.142,0.386,0.139]],"RightLeg":[[-0.03,0.182,-0.01],[0.127,0.388,0.165]],"LeftForeArm":[[-0.024,0.037,-0.043],[0.125,0.209,0.105]],"RightForeArm":[[0.051,0.059,-0.039],[0.127,0.238,0.105]],"LeftSole":[[0.066,0.461,-0.098],[0.127,0.134,0.262],-6.6],"RightSole":[[-0.071,0.456,-0.093],[0.137,0.142,0.259],-8.4],"LeftHand":[[0.003,-0.031,-0.107],[0.063,0.225,0.099]]},"sera":{"Head":[[0.005,0.022,0.058],[0.187,0.253,0.183]],"Torso":[[0.003,0.161,0.05],[0.238,0.309,0.267]],"Neck":[[0.004,0.029,-0.025],[0.106,0.059,0.029]],"LeftLeg":[[-0.041,0.132,-0.081],[0.082,0.374,0.11]],"RightLeg":[[0.041,0.13,-0.082],[0.081,0.387,0.112]],"LeftForeArm":[[0.012,0.032,-0.075],[0.092,0.211,0.099]],"RightForeArm":[[-0.007,0.034,-0.077],[0.103,0.219,0.109]],"LeftSole":[[-0.056,0.411,-0.146],[0.074,0.177,0.218],-22.6],"RightSole":[[0.053,0.415,-0.146],[0.068,0.17,0.22],-21.1],"LeftHand":[[0.008,-0.072,-0.132],[0.069,0.17,0.084]]}};
  /* FIT-END */
  var SLOT_OF={ a_hood:'head', a_reed_cuirass:'chest', a_black_greaves:'legs', a_steel_gauntlet:'gloves', a_ranger_boots:'boots', acc_charm:'acc', acc_blood_ring:'acc', acc_band:'acc',
    a_sluice_helm:'head', a_sluice_cuirass:'chest', a_sluice_greaves:'legs', a_sluice_gauntlet:'gloves', a_sluice_boots:'boots',
    a_ward_mask:'head', a_ward_coat:'chest', a_ward_greaves:'legs', a_ward_gloves:'gloves', a_ward_boots:'boots' };
  WEAPON.w_kain_greatsword={ glb:'art/3d/gear/w_kain_greatsword.glb', grip:0.75 };
  /* 카인 하위·상위 대검(docs/design/82): 모루의 대검과 같은 규약 — 1.6 m, 자루 끝 0.55, 손 0.75 */
  WEAPON.w_kain_scrap={ glb:'art/3d/gear/w_kain_scrap.glb', grip:0.75 };
  WEAPON.w_kain_crusher={ glb:'art/3d/gear/w_kain_crusher.glb', grip:0.75 };
  WEAPON.w_ryu_dagger={ glb:'art/3d/gear/w_ash_dirk.glb', grip:0.10 };
  /* 시약병은 목(반지름 2.7 cm, 0.16~0.18 m)을 쥔다 — 던지는 손. 바닥(0.05)을 쥐면 반지름 6.7 cm 몸통이 손을 삼켰다(docs/design/93) */
  WEAPON.w_sera_flask={ glb:'art/3d/gear/w_sera_flask.glb', grip:0.17 };
  /* 류 상·하위 쌍단검: 전용 모델(docs/design/82, Tripo → gear_post --pca). 손 = 자루 끝에서 0.05 m (0.08 은 확대 렌더에서 주먹이 코등이에 붙고 자루가 뒤로 삐져나와 내렸다) */
  WEAPON.w_ryu_shiv={ glb:'art/3d/gear/w_ryu_shiv.glb', grip:0.05 };
  WEAPON.w_ryu_twinfang={ glb:'art/3d/gear/w_ryu_twinfang.glb', grip:0.05 };
  /* 세라 하위·상위 시약: 전용 모델(docs/design/82). 흐린 시약병 0.22 m · 정제 촉매 0.26 m */
  WEAPON.w_sera_vial={ glb:'art/3d/gear/w_sera_vial.glb', grip:0.19 };
  WEAPON.w_sera_reagent={ glb:'art/3d/gear/w_sera_reagent.glb', grip:0.12 };
  var MAT={ leather:['leather',0xd0a878,0.8,0.05], olive:['olive',0xc8d0a0,0.85,0], black:['steel',0x484a54,0.5,0.7], steel:['steel',0xe0e4ea,0.35,0.9], cloth:['cloth',0xa8a2b0,1.0,0], brass:[null,0xc09a48,0.4,0.9], bone:[null,0xb0a488,0.7,0], red:[null,0x8a2420,0.5,0.2], copper:[null,0xb86a38,0.4,0.9], darkleather:['leather',0x8a6a50,0.85,0.05], reed:['cloth',0xd8c890,0.9,0] };
  /* 조각: [뼈, 종류, 크기, 위치, 회전, 재질, 옵션] — 크기/위치 m, 회전 rad. 뼈 로컬: 몸통·머리 z=앞 / 팔·다리 y=뼈 방향(아래) z=뒤
     몸 치수(뷰어 측정): 머리 r≈0.12(머리카락 포함 ≈0.16) · 가슴 앞 z 0.16 · 정강이 r≈0.06 · 팔뚝 r≈0.04 · 발 길이 0.22
     shell = 구 껍질 [r, phiStart, phiLength, thetaLength] (phi: π/2 = 앞) / cylPart = [r위, r아래, 높이, thetaStart, thetaLength] (theta 0 = 앞) */
  var ARMOR={
    a_hood:[ ['Head','glb','art/3d/gear/a_hood.glb',[0,-0.02,0.0],[0,0,0],1] ],
    a_reed_cuirass:[ ['Spine1','glb','art/3d/gear/a_reed_cuirass.glb',[0,0.02,0.02],[0,0,0],1] ],
    a_black_greaves:[ ['LeftLeg','glb','art/3d/gear/a_black_greaves_L.glb',[0,0.17,0],[Math.PI,0,0],1.02], ['RightLeg','glb','art/3d/gear/a_black_greaves_R.glb',[0,0.17,0],[Math.PI,0,0],1.02] ],
    /* «장갑» 슬롯인데 오른팔에만 붙어 한쪽만 맨팔이었다. 왼팔은 x 를 뒤집어 거울로 쓴다. */
    a_steel_gauntlet:[ ['RightForeArm','glb','art/3d/gear/a_steel_gauntlet.glb',[0,0.2,0],[Math.PI,0,0],1],
                       ['LeftForeArm','glb','art/3d/gear/a_steel_gauntlet.glb',[0,0.2,0],[Math.PI,0,0],[-1,1,1]] ],
    /* 장화는 발목에서 둘로(tools/3d/glb_cut.py): 정강이 쪽은 다리 뼈, 발 쪽은 발 뼈 — 대기 자세만 돼도 발목이 굽어 한 덩어리 장화 코 위로
       캐릭터 신발이 뚫고 나왔다(docs/design/83). 발 쪽은 다리 뼈 기준 값을 바인드 자세 관계로 발 뼈에 옮긴다(via) */
    a_ranger_boots:[ ['RightLeg','glb','art/3d/gear/a_ranger_boots_R_shaft.glb',[0,0.25,0],[Math.PI,0,0],0.97], ['LeftLeg','glb','art/3d/gear/a_ranger_boots_L_shaft.glb',[0,0.25,0],[Math.PI,0,0],0.97],
      ['RightLeg','glb','art/3d/gear/a_ranger_boots_R_foot.glb',[0,0.25,0],[Math.PI,0,0],0.97,{via:'RightFoot'}], ['LeftLeg','glb','art/3d/gear/a_ranger_boots_L_foot.glb',[0,0.25,0],[Math.PI,0,0],0.97,{via:'LeftFoot'}] ],
    /* «수문지기» 중갑(d03)·«방역» 경갑(d07) — Tripo(docs/design/82) → gear_post --armor(정면 +Z). 다리·손·발은 오른쪽 한 짝을 거울로 왼쪽에.
       자리·크기는 같은 부위 기존 조각(후드·흉갑·각반·건틀릿·장화)에 맞췄고, 다른 캐릭터로는 BODYFIT 이 옮긴다(docs/design/83) */
    a_sluice_helm:[ ['Head','glb','art/3d/gear/a_sluice_helm.glb',[0,0.02,0.0],[0,0,0],1] ],
    a_sluice_cuirass:[ ['Spine1','glb','art/3d/gear/a_sluice_cuirass.glb',[0,0.05,0.02],[0,0,0],1] ],
    a_sluice_greaves:[ ['RightLeg','glb','art/3d/gear/a_sluice_greaves.glb',[0,0.17,0],[Math.PI,0,0],1.02], ['LeftLeg','glb','art/3d/gear/a_sluice_greaves.glb',[0,0.17,0],[Math.PI,0,0],[-1.02,1.02,1.02]] ],
    a_sluice_gauntlet:[ ['RightForeArm','glb','art/3d/gear/a_sluice_gauntlet.glb',[0,0.15,0],[Math.PI,0,0],1], ['LeftForeArm','glb','art/3d/gear/a_sluice_gauntlet.glb',[0,0.15,0],[Math.PI,0,0],[-1,1,1]] ],
    a_sluice_boots:[ ['RightLeg','glb','art/3d/gear/a_sluice_boots_shaft.glb',[0,0.25,0],[Math.PI,0,0],0.97], ['LeftLeg','glb','art/3d/gear/a_sluice_boots_shaft.glb',[0,0.25,0],[Math.PI,0,0],[-0.97,0.97,0.97]],
      ['RightLeg','glb','art/3d/gear/a_sluice_boots_foot.glb',[0,0.25,0],[Math.PI,0,0],0.97,{via:'RightFoot'}], ['LeftLeg','glb','art/3d/gear/a_sluice_boots_foot.glb',[0,0.25,0],[Math.PI,0,0],[-0.97,0.97,0.97],{via:'LeftFoot'}] ],
    a_ward_mask:[ ['Head','glb','art/3d/gear/a_ward_mask.glb',[0,-0.02,0.0],[0,0,0],1] ],
    /* 무릎까지 오는 코트는 뼈 하나에 붙이면 걸을 때 다리·팔이 뚫는다 → 캐릭터마다 몸에 입혀 스킨 무게까지 구운 파일(tools/3d/garment-fit.mjs,
       docs/design/84)을 몸 뼈대에 그대로 묶는다. {char} 는 캐릭터 id */
    a_ward_coat:[ ['Spine1','garment','art/3d/gear/a_ward_coat_{char}.glb'] ],
    a_ward_greaves:[ ['RightLeg','glb','art/3d/gear/a_ward_greaves.glb',[0,0.17,0],[Math.PI,0,0],1.02], ['LeftLeg','glb','art/3d/gear/a_ward_greaves.glb',[0,0.17,0],[Math.PI,0,0],[-1.02,1.02,1.02]] ],
    a_ward_gloves:[ ['RightForeArm','glb','art/3d/gear/a_ward_gloves.glb',[0,0.15,0],[Math.PI,0,0],1], ['LeftForeArm','glb','art/3d/gear/a_ward_gloves.glb',[0,0.15,0],[Math.PI,0,0],[-1,1,1]] ],
    a_ward_boots:[ ['RightLeg','glb','art/3d/gear/a_ward_boots_shaft.glb',[0,0.25,0],[Math.PI,0,0],0.97], ['LeftLeg','glb','art/3d/gear/a_ward_boots_shaft.glb',[0,0.25,0],[Math.PI,0,0],[-0.97,0.97,0.97]],
      ['RightLeg','glb','art/3d/gear/a_ward_boots_foot.glb',[0,0.25,0],[Math.PI,0,0],0.97,{via:'RightFoot'}], ['LeftLeg','glb','art/3d/gear/a_ward_boots_foot.glb',[0,0.25,0],[Math.PI,0,0],[-0.97,0.97,0.97],{via:'LeftFoot'}] ],
    acc_charm:[ ['Neck','glb','art/3d/gear/acc_charm.glb',[0,-0.01,0.0],[0,0,0],1] ],
    acc_blood_ring:[ ['LeftHand','glb','art/3d/gear/acc_blood_ring.glb',[0.012,0.06,0],[0,0,0],1] ],
    acc_band:[ ['LeftHand','glb','art/3d/gear/acc_band.glb',[0.012,0.06,0],[0,0,0],1] ]
  };
  var texCache={};
  function tex(THREE, name){ if(!name) return null; var k=name; if(texCache[k]) return texCache[k]; var t=new THREE.TextureLoader().load('art/3d/tex/'+name+'.png'); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2); texCache[k]=t; return t; }
  function material(THREE, key, tint, mix){ var m=MAT[key]||MAT.leather; var mt=new THREE.MeshStandardMaterial({ map:tex(THREE, m[0]), color:m[1], roughness:m[2], metalness:m[3], side:THREE.DoubleSide }); if(tint) mt.color.lerp(new THREE.Color(tint), mix==null?0.5:mix); return mt; }
  function geometry(THREE, kind, s, o){ o=o||{};
    switch(kind){
      case 'box': return new THREE.BoxGeometry(s[0],s[1],s[2]);
      case 'sphere': return new THREE.SphereGeometry(s[0],16,12);
      case 'shell': return new THREE.SphereGeometry(s[0],24,16,s[1],s[2],0,s[3]);
      case 'ring': return new THREE.TorusGeometry(s[0],s[1],8,28);
      case 'cyl': { var g=new THREE.CylinderGeometry(s[0],s[1],s[2],20,1,true); if(o.sx||o.sz) g.scale(o.sx||1,1,o.sz||1); return g; }
      case 'cylPart': { var g2=new THREE.CylinderGeometry(s[0],s[1],s[2],20,1,true,s[3],s[4]); if(o.sx||o.sz) g2.scale(o.sx||1,1,o.sz||1); return g2; }
      case 'capsule': return new THREE.CapsuleGeometry(s[0],s[1],4,12);
      case 'lathe': { var pts=s.map(function(p){ return new THREE.Vector2(p[0],p[1]); }); var open=o.open||0; var g3=new THREE.LatheGeometry(pts, 28, open/2, Math.PI*2-open); g3.rotateY(-Math.PI/2); return g3; }
    }
    return new THREE.BoxGeometry(0.05,0.05,0.05);
  }
  /* 다시 리깅한 캐릭터(tools/3d/rerig-meshy.mjs, docs/design/77)는 관절이 옮겨졌다. 장비 자리는 옛 관절에 맞춰
     잡은 값이라, glb 가 뼈마다 남긴 «옛 관절 자리»(rerigAnchor, 뼈 로컬)에 빈 노드를 두고 거기에 붙인다 —
     바인드 자세에서 장비가 메시에 대해 전과 똑같은 자리에 온다. */
  /* 새 몸(docs/design/80)은 옛 몸의 장비 자리를 gearAnchor 로 따로 적어 둔다(tools/3d/gear-anchor.mjs) */
  /* 손바닥 중심(손 뼈 로컬): 손 뼈에 무게 0.6 이상 실린 몸 정점의 바인드 자세 중심 (docs/design/93).
     카인·류·세라는 다시 리깅하며 손 관절이 손목 쪽으로 옮겨졌고 옛 관절 자리(rerigAnchor)는 손바닥에서 12~19 cm 떨어져 있었다 —
     무기가 손 밖에 떠 있었다. 손가락 뼈가 없는 리그라 손 모양은 못 바꾸지만, 손잡이는 손바닥 안에 넣을 수 있다 */
  function palmOf(hand){ if(!hand||!THREE) return null;
    /* 쥔 손 모프(js/hand-grip.js, docs/design/94)가 있으면 주먹 구멍 가운데 — 손가락이 감는 축 */
    if(hand.userData.gripPoint) return hand.userData.gripPoint;
    if(hand.userData._palm!==undefined) return hand.userData._palm;
    var top=hand; while(top.parent) top=top.parent; var s=new THREE.Vector3(), v=new THREE.Vector3(), n=0;
    top.traverse(function(o){ if(!o.isSkinnedMesh||(o.userData&&o.userData.look)) return; var bi=o.skeleton.bones.indexOf(hand); if(bi<0) return;
      var inv=o.skeleton.boneInverses[bi], P=o.geometry.attributes.position, SI=o.geometry.attributes.skinIndex, SW=o.geometry.attributes.skinWeight; if(!SI||!SW) return;
      for(var i=0;i<P.count;i++){ var w=0; for(var k=0;k<4;k++) if(SI.getComponent(i,k)===bi) w+=SW.getComponent(i,k); if(w<0.6) continue;
        s.add(v.fromBufferAttribute(P,i).applyMatrix4(o.bindMatrix).applyMatrix4(inv)); n++; } });
    hand.userData._palm=n?s.divideScalar(n):null; return hand.userData._palm; }
  /* 손 그립 노드: 손 뼈 자식, 자리 = 손바닥 중심(고정), 방향 = 손 자리 뼈(HandSlot)의 손 기준 회전(클립이 돌린다).
     자리 뼈 아래에 두면 자리 뼈가 돌 때 16 cm 지렛대로 무기가 손 밖으로 휘돌았다 — 이제 손바닥을 중심으로 돈다 */
  function gripOf(slot){ var hand=slot.parent, palm=hand&&hand.isBone&&palmOf(hand); if(!palm) return null;
    var n=new THREE.Object3D(), base=THREE.Object3D.prototype.updateMatrix; n.name=slot.name+'Grip'; n.userData.gripOf=slot; n.position.copy(palm);
    n.updateMatrix=function(){ this.quaternion.copy(slot.quaternion); base.call(this); }; hand.add(n); return n; }
  function anchorOf(o){ var a=o.userData&&(o.userData.gearAnchor||o.userData.rerigAnchor); if(!a||!THREE) return o;
    if(!o.userData._anchor&&/HandSlot$/.test(o.name)){ var gn=gripOf(o); if(gn) o.userData._anchor=gn; }
    if(!o.userData._anchor){ var n=new THREE.Object3D(); n.name=o.name+'Anchor'; n.position.set(a[0],a[1],a[2]); o.add(n); o.userData._anchor=n; }
    return o.userData._anchor; }
  function bonesOf(model){ var b={}; model.traverse(function(o){ if(o.isBone) b[o.name.replace(/^mixamorig:?/,'')]=anchorOf(o); }); return b; }
  /* 바인드 자세에서 뼈(또는 장비 자리 노드)의 월드 행렬 — 스킨 메시의 boneInverses 로. 애니메이션 중에 붙여도 같은 값이 나온다 */
  function bindOf(node){ var bone=node.isBone?node:node.parent, M=null; if(!MODEL||!bone) return null;
    MODEL.traverse(function(o){ if(M||!o.isSkinnedMesh) return; var i=o.skeleton.bones.indexOf(bone); if(i>=0) M=o.skeleton.boneInverses[i].clone().invert(); });
    if(M&&node!==bone){ node.updateMatrix(); M.multiply(node.matrix); }
    return M; }
  function fitScale(bone){ var ws=new THREE.Vector3(); bone.getWorldScale(ws); return 1/(ws.x||1); }
  /* 장비 조각이 덮는 몸 부위(BODYFIT 열쇠): 흉갑 = 몸통 전체, 장화 = 정강이+발, 나머지 = 붙는 뼈 */
  var BOOT_EXTRA={ sera:1.12 };
  function regionOf(slot, bone){ return slot==='chest'?'Torso':slot==='boots'?bone.replace('Leg','Sole'):bone; }
  /* 아인 자리에 맞춘 [위치, 축별 배율] → 이 캐릭터 몸에 맞춘 값. 잰 값이 없으면 옛 체격 배율(CHARFIT) 하나로 */
  function fitPiece(charId, slot, bone, pos){ var A=BODYFIT.ain, X=BODYFIT[charId], key=regionOf(slot, bone);
    if(charId==='ain'||!X||!A||!A[key]||!X[key]){ var f=(CHARFIT[charId]||{})[slot]||1; return [[pos[0]*f,pos[1]*f,pos[2]*f],[f,f,f],0]; }
    if(slot==='boots'){
      /* 장화: 정강이 전체로 옮기면 굽 높은 세라 신발이 장화 코 위로 뚫고 나왔다(-22° 대 아인 -17°), 카인은 발이 평평하다(-2°).
         발바닥 아래 끝에 장화 바닥을 맞추고, 발 길이·높이 비로 키운다 */
      /* 길이·높이 중 큰 쪽(세라 굽 신발은 높이 1.2 배). 세라는 신발 발목 둘레까지 커서 그래도 검은 신발이 장화 코 위로 보여 1.12 배 더 */
      var a=A[key], x=X[key], rr=Math.min(1.4, Math.max(0.9, x[1][2]/a[1][2], x[1][1]/a[1][1])*(BOOT_EXTRA[charId]||1));
      return [[x[0][0]+(pos[0]-a[0][0]), (x[0][1]+x[1][1]/2)-((a[0][1]+a[1][1]/2)-pos[1])*rr, x[0][2]+(pos[2]-a[0][2])],[rr,rr,rr],((x[2]||0)-(a[2]||0))*Math.PI/180]; }
    var ca=A[key][0], sa=A[key][1], cx=X[key][0], sx=X[key][1];
    /* 머리 장비는 머리칼을 덮어야 한다 — 머리칼이 몸 메시와 한 덩어리라 숨길 수 없어, 아인보다 작게 줄이지 않고 6 % 여유를 준다
       (카인 머리는 폭이 아인보다 좁게 재지는데 뻗친 머리칼 끝이 후드 옆을 뚫고 나왔다) */
    var lo=slot==='head'?1.06:0.85;
    var r=[0,1,2].map(function(i){ return Math.min(1.4, Math.max(lo, sx[i]/sa[i]*(slot==='head'?1.06:1))); });
    return [[0,1,2].map(function(i){ return cx[i]+(pos[i]-ca[i])*r[i]; }), r, 0]; }
  /* 옷(스킨): glb 정점은 이 캐릭터 몸 메시의 바인드 공간, JOINTS_0 은 extras.joints(뼈 이름) 번호 → 몸 skeleton 번호로 바꿔 묶는다 */
  function buildGarment(THREE, id, p, tint, charId, mix){ var body=null; if(!MODEL||!LOADER) return null;
    MODEL.traverse(function(o){ if(!body&&o.isSkinnedMesh&&o.skeleton) body=o; }); if(!body) return null;
    var holder=new THREE.Group(); holder.userData.look=id; holder.userData.garment=true; body.parent.add(holder);
    var bodies=[]; MODEL.traverse(function(o){ if(o.isSkinnedMesh&&o.skeleton===body.skeleton) bodies.push(o); });
    LOADER.load(p[2].replace('{char}', charId||'ain'), function(w){ if(!holder.parent) return;
      var names=body.skeleton.bones.map(function(b){ return b.name.replace(/^mixamorig:?/,''); });
      w.scene.traverse(function(o){ if(!o.isMesh) return; var G=o.geometry, J=(o.userData.joints)||[], si=G.attributes.skinIndex; if(!si) return;
        var map=J.map(function(n){ var i=names.indexOf(n); return i<0?0:i; });
        for(var i=0;i<si.count;i++) for(var c=0;c<4;c++) si.setComponent(i,c,map[si.getComponent(i,c)]||0);
        var mat=o.material; if(tint){ mat=mat.clone(); mat.color.lerp(new THREE.Color(tint), mix); }
        var sm=new THREE.SkinnedMesh(G, mat); sm.castShadow=true; sm.frustumCulled=false; sm.userData.look=id;
        sm.position.copy(body.position); sm.quaternion.copy(body.quaternion); sm.scale.copy(body.scale);
        holder.add(sm); sm.bind(body.skeleton, body.bindMatrix);
        /* 코트 밑에 깔린 몸 삼각형 숨기기 — 캐릭터 자기 옷이 코트를 뚫고 나오지 않게. 지오메트리는 공유될 수 있어 새로 만들어 끼운다 */
        (o.userData.hide||[]).forEach(function(b64, mi){ var m=bodies[mi]; if(!m||!m.geometry.index) return; hideUnder(THREE, m, b64); }); }); });
    return holder; }
  function hideUnder(THREE, m, b64){ var bits=Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0); }), g0=m.userData._origGeo||m.geometry, I=g0.index.array, keep=[];
    for(var t=0;t<I.length;t+=3){ var a=I[t],b=I[t+1],c=I[t+2]; if((bits[a>>3]>>(a&7))&1 && (bits[b>>3]>>(b&7))&1 && (bits[c>>3]>>(c&7))&1) continue; keep.push(a,b,c); }
    var g=new THREE.BufferGeometry(); Object.keys(g0.attributes).forEach(function(k){ g.setAttribute(k, g0.attributes[k]); }); g.morphAttributes=g0.morphAttributes;
    g.setIndex(keep); g0.groups.forEach(function(gr){ g.addGroup(gr.start, gr.count, gr.materialIndex); }); g.boundingSphere=g0.boundingSphere; g.boundingBox=g0.boundingBox;
    m.userData._origGeo=g0; m.geometry=g; }
  function restoreBodies(model){ model.traverse(function(o){ if(o.isSkinnedMesh&&o.userData._origGeo){ o.geometry.dispose&&o.geometry.setIndex&&0; o.geometry=o.userData._origGeo; delete o.userData._origGeo; } }); }
  function buildArmor(THREE, id, bones, tint, charId, mix){ mix=mix==null?0.35:mix; var spec=ARMOR[id]; if(!spec) return []; var made=[]; var slot=SLOT_OF[id];
    spec.forEach(function(p){ if(p[1]==='garment'){ var gh=buildGarment(THREE, id, p, tint, charId, mix==null?0.35:mix); if(gh) made.push(gh); return; }
      var bone=bones[p[0]]; if(!bone) return; var k=fitScale(bone), ft=fitPiece(charId, slot, p[0], p[3]), q=ft[0], r=ft[1], o6=p[1]==='glb'&&p[6]||{};
      /* 발바닥 기울기 차(ft[2])는 쓰지 않는다 — 발 조각을 발 뼈에 옮기면 각 캐릭터 발 각도를 이미 따른다.
         카인(발 -2° 대 아인 -17°)에 기울기를 더하면 ±방향 모두 장화 코가 들리거나 신발이 튀어나왔다(렌더 비교) */
      var tilt=0;
      if(p[1]==='glb'){ var g=new THREE.Group(); g.userData.look=id; g.position.set(q[0]*k,q[1]*k,q[2]*k); g.rotation.set(p[4][0]+tilt,p[4][1],p[4][2]);
        /* p[5] 가 배열이면 축별 배율 — 거울(왼팔 건틀릿)에 쓴다. 조각 회전은 0·π 뿐이라 축별 배율 r 을 그대로 곱해도 된다 */
        var sc=p[5]==null?1:p[5]; if(!Array.isArray(sc)) sc=[sc,sc,sc]; g.scale.set(k*sc[0]*r[0],k*sc[1]*r[1],k*sc[2]*r[2]);
        var host=bone, via=o6.via&&bones[o6.via];
        if(via){ var B0=bindOf(bone), B1=bindOf(via); if(B0&&B1){ g.updateMatrix(); B1.invert().multiply(B0).multiply(g.matrix).decompose(g.position,g.quaternion,g.scale); host=via; } }
        host.add(g); made.push(g);
        var mirrored=Array.isArray(sc)&&(sc[0]*sc[1]*sc[2]<0);
        if(LOADER) LOADER.load(p[2], function(w){ w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false;
          if(mirrored){ o.material=o.material.clone(); o.material.side=THREE.DoubleSide; } if(tint){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(tint),mix); } } }); g.add(w.scene); }); return; }
      var mesh=new THREE.Mesh(geometry(THREE,p[1],p[2],p[6]), material(THREE,p[5],tint,mix)); mesh.castShadow=true; mesh.position.set(q[0]*k,q[1]*k,q[2]*k); mesh.rotation.set(p[4][0],p[4][1],p[4][2]); mesh.scale.set(k*r[0],k*r[1],k*r[2]); mesh.userData.look=id; bone.add(mesh); made.push(mesh); });
    return made; }
  var THREE=null, LOADER=null, MODEL=null;
  /* equipped: gear.js state().equipped ({main, sub, off, head, chest, legs, gloves, boots, acc, …}). opts: { onMain(wr), onMainFail(), tintOf(id) → hex|null, lookOf(id), baseOf(id) } */
  function attach(T, loader, model, equipped, opts){ THREE=T; LOADER=loader; MODEL=model; opts=opts||{}; var bones=bonesOf(model), out={ pieces:[], weapons:{} };
    var baseOf=opts.baseOf||function(id){ return id; };
    /* 섞는 세기 — 제작품 색조는 «살짝»(기본값), 염색은 «확실히»(외형 화면이 0.75 를 준다) */
    var mixOf=opts.mixOf||function(){ return null; };
    /* 이전 조각 제거 (옷은 몸 메시 옆에 붙어 있다) */ var gone=[]; model.traverse(function(o){ if(o.userData&&o.userData.garment) gone.push(o); }); gone.forEach(function(o){ o.parent&&o.parent.remove(o); }); restoreBodies(model);
    Object.keys(bones).forEach(function(k){ var b=bones[k]; for(var i=b.children.length-1;i>=0;i--){ var c=b.children[i]; if(c.userData&&c.userData.look) b.remove(c); } });
    var mainId=equipped.main, mainBase=baseOf(mainId), spec=WEAPON[mainBase]||WEAPON.w_marsh_scythe, slot=bones.RightHandSlot||bones.RightHand;
    if(mainId&&opts.charId==='ain'&&window.TW_GEAR&&TW_GEAR.weaponSkin&&TW_GEAR.weaponSkin('ain')==='red_tension') spec=WEAPON.w_red_tension;
    // Explicit local QA skin. No inventory/stat/save mutation, no override for other characters.
    if(opts.charId==='ain' && typeof location!=='undefined' && ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('gearPreview')==='red_tension') spec=WEAPON.w_red_tension;
    if(DUAL[mainBase]&&bones.LeftHandSlot){ var osp=WEAPON[mainBase]; loader.load(osp.glb, function(w){ var g2=new THREE.Group(); g2.userData.look='offhand'; w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; if(osp.tint){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(osp.tint), osp.mix||0.5); } } }); w.scene.position.set(0,-(osp.grip||0.1),0); g2.add(w.scene); bones.LeftHandSlot.add(g2); g2.scale.setScalar(fitScale(bones.LeftHandSlot)); out.weapons.offhand=g2; }); }
    if(slot){ loader.load(spec.glb, function(w){ var wr=new THREE.Group(); wr.userData.look=mainId||'main'; w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; if(spec.tint){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(spec.tint), spec.mix||0.5); } } }); var prepared=opts.prepareMain&&opts.prepareMain(w.scene,spec); if(prepared)wr.add(prepared);else{w.scene.position.set(0,-(spec.grip||0.75),0);wr.add(w.scene);} slot.add(wr); wr.scale.setScalar(fitScale(slot)); out.weapons.main=wr; opts.onMain&&opts.onMain(wr, w); }, undefined, function(){ opts.onMainFail&&opts.onMainFail(); }); }
    else opts.onMainFail&&opts.onMainFail();
    ['sub','off'].forEach(function(sl){ var id=equipped[sl]; if(!id) return; var sp=WEAPON[baseOf(id)]; if(!sp||!sp.bone||!bones[sp.bone]) return; var bone=bones[sp.bone];
      loader.load(sp.glb, function(w){ var g=new THREE.Group(); g.userData.look=id; w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); g.add(w.scene); var k=fitScale(bone); g.position.set(sp.pos[0]*k,sp.pos[1]*k,sp.pos[2]*k); g.rotation.set(sp.rot[0],sp.rot[1],sp.rot[2]); g.scale.setScalar(k*(sp.scale||1)); var tint=opts.tintOf&&opts.tintOf(id); if(tint){ var mx=mixOf(id); mx=mx==null?0.55:mx; w.scene.traverse(function(o){ if(o.isMesh){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(tint),mx); } }); } bone.add(g); out.weapons[sl]=g; }); });
    ['head','chest','legs','gloves','boots','acc','acc2'].forEach(function(sl){ var id=equipped[sl]; if(!id) return; var tint=opts.tintOf&&opts.tintOf(id); out.pieces=out.pieces.concat(buildArmor(THREE, baseOf(id), bones, tint, opts.charId, mixOf(id))); });
    return out; }
  /* 장비가 실제로 붙는 자리 — 양손 IK 가 무기 손잡이를 겨눌 때 같은 점을 써야 한다 */
  function anchor(T, bone){ THREE=THREE||T; return anchorOf(bone); }
  function palm(T, hand){ THREE=THREE||T; return palmOf(hand); }
  window.TW_LOOKS={ WEAPON:WEAPON, ARMOR:ARMOR, SLOT_OF:SLOT_OF, MAT:MAT, attach:attach, buildArmor:buildArmor, bonesOf:bonesOf, anchor:anchor, palm:palm };
})();
