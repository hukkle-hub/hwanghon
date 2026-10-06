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
    a_ward_mask:'head', a_ward_coat:'chest', a_ward_greaves:'legs', a_ward_gloves:'gloves', a_ward_boots:'boots',
    a_clave_helm:'head', a_clave_cuirass:'chest', a_clave_gauntlet:'gloves', a_clave_greaves:'legs' };
  /* hand2: 두 손 잡기 때 왼손 주먹 자리 = 오른손에서 칼날 쪽으로 [최소, 최대] m (docs/design/95).
     오른손(0.75)은 폼멜(0.56~0.68) 바로 위라 폼멜 쪽엔 7 cm 뿐 — 왼손은 칼날 쪽. 최소 = 주먹 폭 11 cm, 최대 = 코등이 − 5 cm.
     잰 값: 대검 손잡이 0.69~1.00 · 코등이 1.02 / 고철 ~1.10 · 1.12 / 분쇄 ~1.04 · 1.06 */
  WEAPON.w_kain_greatsword={ glb:'art/3d/gear/w_kain_greatsword.glb', grip:0.75, hand2:[0.11,0.20] };
  /* 카인 하위·상위 대검(docs/design/82): 모루의 대검과 같은 규약 — 1.6 m, 자루 끝 0.55, 손 0.75 */
  WEAPON.w_kain_scrap={ glb:'art/3d/gear/w_kain_scrap.glb', grip:0.75, hand2:[0.11,0.30] };
  WEAPON.w_kain_crusher={ glb:'art/3d/gear/w_kain_crusher.glb', grip:0.75, hand2:[0.11,0.24] };
  /* 클레이브 전리품: 모바일 LOD까지 검증된 대검을 바탕으로 재질·붉은 코어를 따로 입힌다. 셔터 방패는 Spine2 뒤 절차형 실루엣. */
  WEAPON.w_clave_blade={ glb:'art/3d/gear/w_kain_crusher.glb', grip:0.75, hand2:[0.11,0.24], special:'claveBlade' };
  WEAPON.x_clave_shutter={ build:buildClaveShutter, bone:'Spine2', pos:[0,0.07,-0.16], rot:[0,0,0], scale:0.70, special:'claveShutter' };
  WEAPON.w_ryu_dagger={ glb:'art/3d/gear/w_ash_dirk.glb', grip:0.10 };
  /* 시약병은 목(반지름 2.7 cm, 0.16~0.18 m)을 쥔다 — 던지는 손. 바닥(0.05)을 쥐면 반지름 6.7 cm 몸통이 손을 삼켰다(docs/design/93) */
  WEAPON.w_sera_flask={ glb:'art/3d/gear/w_sera_flask.glb', grip:0.17 };
  /* 류 상·하위 쌍단검: 전용 모델(docs/design/82, Tripo → gear_post --pca). 손 = 자루 끝에서 0.05 m (0.08 은 확대 렌더에서 주먹이 코등이에 붙고 자루가 뒤로 삐져나와 내렸다) */
  WEAPON.w_ryu_shiv={ glb:'art/3d/gear/w_ryu_shiv.glb', grip:0.05 };
  WEAPON.w_ryu_twinfang={ glb:'art/3d/gear/w_ryu_twinfang.glb', grip:0.05 };
  /* 세라 하위·상위 시약: 전용 모델(docs/design/82). 흐린 시약병 0.22 m · 정제 촉매 0.26 m */
  WEAPON.w_sera_vial={ glb:'art/3d/gear/w_sera_vial.glb', grip:0.19 };
  WEAPON.w_sera_reagent={ glb:'art/3d/gear/w_sera_reagent.glb', grip:0.12 };
  var MAT={ leather:['leather',0xd0a878,0.8,0.05], olive:['olive',0xc8d0a0,0.85,0], black:['steel',0x484a54,0.5,0.7], steel:['steel',0xe0e4ea,0.35,0.9], cloth:['cloth',0xa8a2b0,1.0,0], brass:[null,0xc09a48,0.4,0.9], bone:[null,0xb0a488,0.7,0], red:[null,0x8a2420,0.5,0.2], copper:[null,0xb86a38,0.4,0.9], darkleather:['leather',0x8a6a50,0.85,0.05], reed:['cloth',0xd8c890,0.9,0],
    claveDark:['steel',0x414750,0.32,0.92], claveGlow:[null,0x661710,0.25,0.65,0xff321e,1.35] };
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
  /* 클레이브 세트는 수문지기 판금의 검증된 핏을 재사용하되, 세로 슬릿·셔터 가로살을 더해 한눈에 다른 전리품으로 읽히게 한다. */
  ARMOR.a_clave_helm=[ ['Head','glb','art/3d/gear/a_sluice_helm.glb',[0,0.02,0],[0,0,0],1],
    ['Head','box',[0.022,0.21,0.018],[0,0.025,0.172],[0,0,0],'claveGlow'] ];
  ARMOR.a_clave_cuirass=[ ['Spine1','glb','art/3d/gear/a_sluice_cuirass.glb',[0,0.05,0.02],[0,0,0],1],
    ['Spine1','box',[0.29,0.018,0.018],[0,0.045,0.185],[0,0,0],'claveGlow'],
    ['Spine1','box',[0.25,0.014,0.016],[0,0.105,0.19],[0,0,0],'claveGlow'],
    ['Spine1','box',[0.20,0.012,0.014],[0,0.158,0.185],[0,0,0],'claveGlow'] ];
  ARMOR.a_clave_gauntlet=[ ['RightForeArm','glb','art/3d/gear/a_sluice_gauntlet.glb',[0,0.15,0],[Math.PI,0,0],1], ['LeftForeArm','glb','art/3d/gear/a_sluice_gauntlet.glb',[0,0.15,0],[Math.PI,0,0],[-1,1,1]],
    ['RightForeArm','box',[0.022,0.115,0.008],[0,0.15,-0.071],[0,0,0],'claveGlow'], ['LeftForeArm','box',[0.022,0.115,0.008],[0,0.15,-0.071],[0,0,0],'claveGlow'] ];
  ARMOR.a_clave_greaves=[ ['RightLeg','glb','art/3d/gear/a_sluice_greaves.glb',[0,0.17,0],[Math.PI,0,0],1.02], ['LeftLeg','glb','art/3d/gear/a_sluice_greaves.glb',[0,0.17,0],[Math.PI,0,0],[-1.02,1.02,1.02]],
    ['RightLeg','box',[0.024,0.145,0.008],[0,0.18,-0.078],[0,0,0],'claveGlow'], ['LeftLeg','box',[0.024,0.145,0.008],[0,0.18,-0.078],[0,0,0],'claveGlow'] ];
  var texCache={};
  function tex(THREE, name){ if(!name) return null; var k=name; if(texCache[k]) return texCache[k]; var t=new THREE.TextureLoader().load('art/3d/tex/'+name+'.png'); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2);t.userData=t.userData||{};t.userData.lookShared=true; texCache[k]=t; return t; }
  function material(THREE, key, tint, mix){ var m=MAT[key]||MAT.leather; var mt=new THREE.MeshStandardMaterial({ map:tex(THREE, m[0]), color:m[1], roughness:m[2], metalness:m[3], emissive:m[4]||0, emissiveIntensity:m[5]||0, side:THREE.DoubleSide }); if(tint) mt.color.lerp(new THREE.Color(tint), mix==null?0.5:mix); return mt; }
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
  function buildClaveShutter(THREE, enh){
    var g=new THREE.Group(), dark=material(THREE,'claveDark'), edge=material(THREE,'black'), hot=material(THREE,'claveGlow');
    hot.emissiveIntensity=1.15+Math.max(0,(enh||0)-6)*0.16;
    function box(size,pos,mat){ var m=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),mat);m.position.set(pos[0],pos[1],pos[2]);m.castShadow=true;g.add(m);return m; }
    function instancedBoxes(rows,mat){var geo=new THREE.BoxGeometry(1,1,1),m=new THREE.InstancedMesh(geo,mat,rows.length),d=new THREE.Object3D();for(var j=0;j<rows.length;j++){d.position.set(rows[j][1][0],rows[j][1][1],rows[j][1][2]);d.scale.set(rows[j][0][0],rows[j][0][1],rows[j][0][2]);d.updateMatrix();m.setMatrixAt(j,d.matrix);}m.instanceMatrix.needsUpdate=true;m.castShadow=true;g.add(m);return m;}
    /* 통판이 아니라 실제 셔터처럼 틈을 둔다 — 몸과 갑옷이 보이면서 후면 실루엣은 크게 달라진다. */
    var slats=[];for(var i=0;i<9;i++)slats.push([[0.72,0.076,0.065],[0,-0.48+i*0.12,0.045]]);instancedBoxes(slats,dark);
    instancedBoxes([[[0.058,1.16,0.11],[-0.39,0,0]],[[0.058,1.16,0.11],[0.39,0,0]]],edge);
    box([0.026,1.05,0.03],[0,0,0.095],hot);
    var roller=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.84,18),edge);roller.rotation.z=Math.PI/2;roller.position.set(0,0.63,0);roller.castShadow=true;g.add(roller);
    var crest=new THREE.Mesh(new THREE.OctahedronGeometry(0.085,0),hot);crest.scale.set(1,1.35,0.38);crest.position.set(0,0.16,0.13);g.add(crest);
    g.userData.claveShutter=true;return g;
  }
  function cloneMats(mesh, fn){ var many=Array.isArray(mesh.material),src=many?mesh.material:[mesh.material],out=src.map(function(m){var c=m.clone();fn(c);return c;});mesh.material=many?out:out[0]; }
  function styleClave(THREE, root, enh){ var e=Math.max(0,Math.min(10,enh||0)),ember=0.05+(e>=7?0.07:e*.004);
    root.traverse(function(o){if(!o.isMesh)return;cloneMats(o,function(m){if(m.color)m.color.lerp(new THREE.Color(0x25282e),0.42);if('metalness'in m)m.metalness=Math.max(0.78,m.metalness||0);if('roughness'in m)m.roughness=Math.min(0.38,m.roughness==null?0.38:m.roughness);if(m.emissive){m.emissive.set(0x5a0a05);m.emissiveIntensity=ember;}});}); }
  function addClaveBladeCore(THREE, wr, enh, reduced){ var e=Math.max(0,Math.min(10,enh||0)),mat=new THREE.MeshBasicMaterial({color:e>=10?0xffe2c0:0xff3b22,transparent:true,opacity:e>=9?0.82:0.62,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
    var core=new THREE.Mesh(new THREE.BoxGeometry(0.028,0.74,0.035),mat);core.position.set(0,0.45,0.045);core.userData.claveCore=true;wr.add(core);
    if(reduced)mat.opacity=e>=9?0.77:0.59;else core.onBeforeRender=function(){var t=(typeof performance!=='undefined'?performance.now():Date.now())*.004;mat.opacity=(e>=9?0.72:0.54)+Math.sin(t)*0.10;}; }
  function tierOf(n){return n>=10?3:n>=9?2:n>=7?1:0;}
  /* PointsMaterial.size 는 화면 픽셀이다. 예전 0.048/0.072는 직교 카메라에서 1px도 안 되어 +10도 보이지 않았다. */
  var PRESTIGE_SPARKS=[[4,1.2,0xd6652f,0.48],[6,1.6,0xd6652f,0.74],[9,2.0,0xff3b24,0.78],[12,2.6,0xffead8,0.82]];
  function prestigeSpec(enh,source){var tier=tierOf(Math.max(0,Math.min(10,Number(enh)||0)));if(!source&&!tier)return null;var p=PRESTIGE_SPARKS[tier];return {tier:tier,count:p[0],size:p[1],color:p[2],opacity:p[3]};}
  function prestigeBadge(equipped,enhBySlot){equipped=equipped||{};enhBySlot=enhBySlot||{};var max=0;
    Object.keys(equipped).forEach(function(sl){if(/^([awx])_clave_/.test(equipped[sl]||''))max=Math.max(max,Math.max(0,Math.min(10,Number(enhBySlot[sl])||0)));});
    var full=['head','chest','gloves','legs'].every(function(sl){return /^a_clave_/.test(equipped[sl]||'');}),shutter=equipped.off==='x_clave_shutter',spec=prestigeSpec(max,full||shutter);
    return spec&&spec.tier?{boss:'clave',tier:spec.tier,enh:max,label:'클레이브 +'+max}:null; }
  function addPrestigeAura(THREE, model, equipped, enhOf, reduced){
    var clave=function(id){return /^([awx])_clave_/.test(id||'');},ids=[],max=0;
    Object.keys(equipped).forEach(function(sl){var id=equipped[sl];if(!clave(id))return;ids.push(id);max=Math.max(max,Number(enhOf(id,sl))||0);});
    var full=['head','chest','gloves','legs'].every(function(sl){return /^a_clave_/.test(equipped[sl]||'');}),shutter=equipped.off==='x_clave_shutter',spec=prestigeSpec(max,full||shutter);
    if(!spec)return null;var tier=spec.tier,col=spec.color;
    var g=new THREE.Group();g.userData.lookAura=true;g.userData.prestige={boss:'clave',tier:tier,full:full,shutter:shutter,sparks:spec.count,sparkSize:spec.size,reduced:!!reduced};model.add(g);
    var crestMat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:tier?0.72:0.38,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
    /* 바닥 고리는 공격 예고와 겹친다. 광휘의 중심은 등/가슴 높이에 붙인 작은 반응로 문장으로 바꾼다. */
    var crest=new THREE.Mesh(new THREE.OctahedronGeometry(0.045+tier*0.012,0),crestMat);crest.scale.set(1,1.55,0.5);crest.position.set(0,1.12,-0.34);g.add(crest);
    if(reduced)crestMat.opacity=tier?0.68:0.35;else crest.onBeforeRender=function(){var t=(typeof performance!=='undefined'?performance.now():Date.now())*.004;crest.rotation.y=t*0.35;crestMat.opacity=(tier?0.58:0.30)+(Math.sin(t)+1)*(tier?0.10:0.05);};
    var n=spec.count;
    if(n){var pos=new Float32Array(n*3);for(var i=0;i<n;i++){var a=i/n*Math.PI*2;pos[i*3]=Math.cos(a)*(0.22+(i%3)*0.055);pos[i*3+1]=0.28+(i*0.37)%1.35;pos[i*3+2]=Math.sin(a)*(0.22+(i%3)*0.055);}var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      var pm=new THREE.PointsMaterial({color:col,size:spec.size,transparent:true,opacity:spec.opacity,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:false,toneMapped:false}),pts=new THREE.Points(geo,pm);g.add(pts);
      if(!reduced)pts.onBeforeRender=function(){var t=(typeof performance!=='undefined'?performance.now():Date.now())*.001;pts.rotation.y=t*(tier>=2?0.7:0.38);pts.position.y=Math.sin(t*2.2)*0.035;pm.opacity=(tier?0.67:0.4)+Math.sin(t*3.1)*0.13;}; }
    return g;
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
    LOADER.load(p[2].replace('{char}', charId||'ain'), function(w){ if(!holder.parent){disposeLook(w.scene);return;}
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
  function restoreBodies(model){ model.traverse(function(o){ if(o.isSkinnedMesh&&o.userData._origGeo){var cut=o.geometry,orig=o.userData._origGeo;o.geometry=orig;delete o.userData._origGeo;if(cut&&cut!==orig&&cut.dispose)cut.dispose();} }); }
  /* GLTF 장비와 절차형 광휘는 attach 때마다 새 객체다. 떼기만 하면 모바일 GPU 버퍼가 남으므로,
     몸/공용 텍스처는 건드리지 않고 외형 루트가 소유한 기하·재질·GLTF 텍스처만 한 번씩 버린다. */
  function disposeLook(root){if(!root||!root.traverse)return;var gs=new Set(),ms=new Set(),ts=new Set();root.traverse(function(o){if(o.geometry&&o.geometry.dispose)gs.add(o.geometry);var a=Array.isArray(o.material)?o.material:[o.material];a.forEach(function(m){if(!m||!m.dispose)return;ms.add(m);Object.keys(m).forEach(function(k){var t=m[k];if(t&&t.isTexture&&!(t.userData&&t.userData.lookShared)&&t.dispose)ts.add(t);});});});gs.forEach(function(g){g.dispose();});ms.forEach(function(m){m.dispose();});ts.forEach(function(t){t.dispose();});}
  function dropLook(o){if(!o)return;o.parent&&o.parent.remove(o);disposeLook(o);}
  function buildArmor(THREE, id, bones, tint, charId, mix, enh){ mix=mix==null?0.35:mix; var spec=ARMOR[id]; if(!spec) return []; var made=[]; var slot=SLOT_OF[id];
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
        if(LOADER) LOADER.load(p[2], function(w){ if(!g.parent){disposeLook(w.scene);return;}w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false;
          if(mirrored){ o.material=o.material.clone(); o.material.side=THREE.DoubleSide; } if(tint){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(tint),mix); } } });if(/^a_clave_/.test(id))styleClave(THREE,w.scene,enh);g.add(w.scene); }); return; }
      var mesh=new THREE.Mesh(geometry(THREE,p[1],p[2],p[6]), material(THREE,p[5],tint,mix));if(p[5]==='claveGlow')mesh.material.emissiveIntensity=1.05+tierOf(enh||0)*0.28;mesh.castShadow=true; mesh.position.set(q[0]*k,q[1]*k,q[2]*k); mesh.rotation.set(p[4][0],p[4][1],p[4][2]); mesh.scale.set(k*r[0],k*r[1],k*r[2]); mesh.userData.look=id; bone.add(mesh); made.push(mesh); });
    return made; }
  var THREE=null, LOADER=null, MODEL=null;
  function clearLooks(model,bones){var gone=[];model.traverse(function(o){if(o.userData&&o.userData.garment)gone.push(o);});gone.forEach(dropLook);restoreBodies(model);
    var rootChildren=model.children||[];for(var ri=rootChildren.length-1;ri>=0;ri--)if(rootChildren[ri].userData&&rootChildren[ri].userData.lookAura)dropLook(rootChildren[ri]);
    Object.keys(bones||{}).forEach(function(k){var b=bones[k];for(var i=b.children.length-1;i>=0;i--){var c=b.children[i];if(c.userData&&c.userData.look)dropLook(c);}});}
  function detach(model){if(!model)return;model.userData=model.userData||{};model.userData._lookRev=(model.userData._lookRev||0)+1;clearLooks(model,bonesOf(model));}
  /* equipped: gear.js state().equipped ({main, sub, off, head, chest, legs, gloves, boots, acc, …}). opts: { onMain(wr), onMainFail(), tintOf(id), baseOf(id), enhOf(id,slot) } */
  function attach(T, loader, model, equipped, opts){ THREE=T; LOADER=loader; MODEL=model; opts=opts||{};equipped=Object.assign({},equipped||{});
    var preview=false,previewEnh=0;
    if(typeof location!=='undefined'&&['localhost','127.0.0.1'].includes(location.hostname)){var qp=new URLSearchParams(location.search);preview=qp.get('gearPreview')==='clave'&&opts.charId==='kain';previewEnh=Math.max(0,Math.min(10,Number(qp.get('enh'))||0));}
    /* 로컬 QA 전용 — 저장·소유권·스탯을 건드리지 않고 한 프레임에서 세트 핏만 본다. */
    if(preview)equipped=Object.assign({},equipped,{main:'w_clave_blade',off:'x_clave_shutter',head:'a_clave_helm',chest:'a_clave_cuirass',gloves:'a_clave_gauntlet',legs:'a_clave_greaves'});
    model.userData=model.userData||{};var bones=bonesOf(model),out={pieces:[],weapons:{}},rev=(model.userData._lookRev||0)+1;model.userData._lookRev=rev;
    var alive=function(){return model.userData._lookRev===rev;},baseOf=opts.baseOf||function(id){return id;},mixOf=opts.mixOf||function(){return null;};
    var enhOf=function(id,sl){return preview&&/^([awx])_clave_/.test(id||'')?previewEnh:(opts.enhOf?opts.enhOf(id,sl):0)||0;};
    /* 이전 조각 제거 (옷은 몸 메시 옆에 붙어 있다) */ clearLooks(model,bones);
    var reduced=opts.reduced==null&&typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)').matches:!!opts.reduced;
    function prepScene(scene,sp,id,enh){scene.traverse(function(o){if(o.isMesh){o.castShadow=true;o.frustumCulled=false;if(sp.tint)cloneMats(o,function(m){m.color&&m.color.lerp(new THREE.Color(sp.tint),sp.mix||0.5);});}});if(sp.special==='claveBlade')styleClave(THREE,scene,enh);}
    var mainId=equipped.main,mainBase=baseOf(mainId),spec=WEAPON[mainBase]||WEAPON.w_marsh_scythe,slot=bones.RightHandSlot||bones.RightHand,mainEnh=enhOf(mainId,'main');
    if(mainId&&opts.charId==='ain'&&window.TW_GEAR&&TW_GEAR.weaponSkin&&TW_GEAR.weaponSkin('ain')==='red_tension')spec=WEAPON.w_red_tension;
    if(opts.charId==='ain'&&typeof location!=='undefined'&&['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('gearPreview')==='red_tension')spec=WEAPON.w_red_tension;
    if(DUAL[mainBase]&&bones.LeftHandSlot){var osp=WEAPON[mainBase];loader.load(osp.glb,function(w){if(!alive()){disposeLook(w.scene);return;}var g2=new THREE.Group();g2.userData.look='offhand';prepScene(w.scene,osp,mainId,mainEnh);w.scene.position.set(0,-(osp.grip||0.1),0);g2.add(w.scene);bones.LeftHandSlot.add(g2);g2.scale.setScalar(fitScale(bones.LeftHandSlot));out.weapons.offhand=g2;});}
    function mountMain(scene,payload){if(!alive()){disposeLook(scene);return;}var wr=new THREE.Group();wr.userData.look=mainId||'main';prepScene(scene,spec,mainId,mainEnh);var prepared=opts.prepareMain&&opts.prepareMain(scene,spec);if(prepared)wr.add(prepared);else{scene.position.set(0,-(spec.grip||0.75),0);wr.add(scene);}if(spec.special==='claveBlade')addClaveBladeCore(THREE,wr,mainEnh,reduced);slot.add(wr);wr.scale.setScalar(fitScale(slot));slot.userData.hand2=spec.hand2||null;out.weapons.main=wr;opts.onMain&&opts.onMain(wr,payload);}
    if(slot){if(spec.build){var ms=spec.build(THREE,mainEnh);mountMain(ms,{scene:ms,animations:[]});}else loader.load(spec.glb,function(w){mountMain(w.scene,w);},undefined,function(){if(alive())opts.onMainFail&&opts.onMainFail();});}else opts.onMainFail&&opts.onMainFail();
    ['sub','off'].forEach(function(sl){var id=equipped[sl];if(!id)return;var sp=WEAPON[baseOf(id)];if(!sp||!sp.bone||!bones[sp.bone])return;var bone=bones[sp.bone],enh=enhOf(id,sl);
      function mountOff(scene){if(!alive()){disposeLook(scene);return;}var g=new THREE.Group();g.userData.look=id;prepScene(scene,sp,id,enh);g.add(scene);var k=fitScale(bone);g.position.set(sp.pos[0]*k,sp.pos[1]*k,sp.pos[2]*k);g.rotation.set(sp.rot[0],sp.rot[1],sp.rot[2]);g.scale.setScalar(k*(sp.scale||1));var tint=opts.tintOf&&opts.tintOf(id);if(tint){var mx=mixOf(id);mx=mx==null?0.55:mx;scene.traverse(function(o){if(o.isMesh)cloneMats(o,function(m){m.color&&m.color.lerp(new THREE.Color(tint),mx);});});}bone.add(g);out.weapons[sl]=g;}
      if(sp.build)mountOff(sp.build(THREE,enh));else loader.load(sp.glb,function(w){mountOff(w.scene);});});
    ['head','chest','legs','gloves','boots','acc','acc2'].forEach(function(sl){var id=equipped[sl];if(!id)return;var tint=opts.tintOf&&opts.tintOf(id);out.pieces=out.pieces.concat(buildArmor(THREE,baseOf(id),bones,tint,opts.charId,mixOf(id),enhOf(id,sl)));});
    out.aura=addPrestigeAura(THREE,model,equipped,enhOf,reduced);return out; }
  /* 장비가 실제로 붙는 자리 — 양손 IK 가 무기 손잡이를 겨눌 때 같은 점을 써야 한다 */
  function anchor(T, bone){ THREE=THREE||T; return anchorOf(bone); }
  function palm(T, hand){ THREE=THREE||T; return palmOf(hand); }
  window.TW_LOOKS={ WEAPON:WEAPON, ARMOR:ARMOR, SLOT_OF:SLOT_OF, MAT:MAT, PRESTIGE_SPARKS:PRESTIGE_SPARKS, prestigeSpec:prestigeSpec, prestigeBadge:prestigeBadge, attach:attach, detach:detach, buildArmor:buildArmor, bonesOf:bonesOf, anchor:anchor, palm:palm };
})();
