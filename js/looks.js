/* 황혼 — 장비 외형 (3D). 장착한 장비가 아인의 모습을 바꾼다: 주무기 모델 교체, 보조·부무기는 허리·등에 걸침, 방어구·장신구는 뼈에 붙는 조각.
   window.TW_LOOKS = { WEAPON, ARMOR, attach(THREE, loader, model, equipped, opts) }
   · 무기 GLB 규약: 원점 = 자루 끝, +Y 자루 방향, 오른손 그립 0.75 m (tools/3d/build_weapons.py)
   · 뼈 로컬 축(아인 리그, viewer 로 측정): 몸통·머리 = x 오른쪽 · y 위 · z 앞 / 팔·다리 = y 뼈 방향(아래) · -z 앞
   · 제작품(c_…)은 기본형 외형 + gear.js lookOf 색조 (game3d.applyWeaponLook) */
(function(){
  var WEAPON={
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
  var DUAL={ w_ryu_dagger:true };   /* 쌍수: 같은 모델을 왼손 슬롯에도 */
  /* 체격 스케일 (아인 = 1): 조각 크기·오프셋에 곱함. body-metrics 실측 (키·가슴폭·팔뚝·정강이) */
  var CHARFIT={ kain:{ h:1.107, head:0.97, chest:1.12, gloves:1.3, legs:1.1, boots:1.1, acc:1.1 }, ryu:{ h:1.06, head:0.98, chest:1.07, gloves:0.92, legs:1.04, boots:1.04, acc:1.03 }, sera:{ h:1.024, head:0.95, chest:1.03, gloves:1.0, legs:1.02, boots:1.02, acc:1.0 } };
  var SLOT_OF={ a_hood:'head', a_reed_cuirass:'chest', a_black_greaves:'legs', a_steel_gauntlet:'gloves', a_ranger_boots:'boots', acc_charm:'acc', acc_blood_ring:'acc', acc_band:'acc' };
  WEAPON.w_kain_greatsword={ glb:'art/3d/gear/w_kain_greatsword.glb', grip:0.75 };
  WEAPON.w_ryu_dagger={ glb:'art/3d/gear/w_ash_dirk.glb', grip:0.10 };
  WEAPON.w_sera_flask={ glb:'art/3d/gear/w_sera_flask.glb', grip:0.05 };
  var MAT={ leather:['leather',0xd0a878,0.8,0.05], olive:['olive',0xc8d0a0,0.85,0], black:['steel',0x484a54,0.5,0.7], steel:['steel',0xe0e4ea,0.35,0.9], cloth:['cloth',0xa8a2b0,1.0,0], brass:[null,0xc09a48,0.4,0.9], bone:[null,0xb0a488,0.7,0], red:[null,0x8a2420,0.5,0.2], copper:[null,0xb86a38,0.4,0.9], darkleather:['leather',0x8a6a50,0.85,0.05], reed:['cloth',0xd8c890,0.9,0] };
  /* 조각: [뼈, 종류, 크기, 위치, 회전, 재질, 옵션] — 크기/위치 m, 회전 rad. 뼈 로컬: 몸통·머리 z=앞 / 팔·다리 y=뼈 방향(아래) z=뒤
     몸 치수(뷰어 측정): 머리 r≈0.12(머리카락 포함 ≈0.16) · 가슴 앞 z 0.16 · 정강이 r≈0.06 · 팔뚝 r≈0.04 · 발 길이 0.22
     shell = 구 껍질 [r, phiStart, phiLength, thetaLength] (phi: π/2 = 앞) / cylPart = [r위, r아래, 높이, thetaStart, thetaLength] (theta 0 = 앞) */
  var ARMOR={
    a_hood:[ ['Head','glb','art/3d/gear/a_hood.glb',[0,-0.02,0.0],[0,0,0],1] ],
    a_reed_cuirass:[ ['Spine1','glb','art/3d/gear/a_reed_cuirass.glb',[0,0.02,0.02],[0,0,0],1] ],
    a_black_greaves:[ ['LeftLeg','glb','art/3d/gear/a_black_greaves_L.glb',[0,0.17,0],[Math.PI,0,0],1.02], ['RightLeg','glb','art/3d/gear/a_black_greaves_R.glb',[0,0.17,0],[Math.PI,0,0],1.02] ],
    a_steel_gauntlet:[ ['RightForeArm','glb','art/3d/gear/a_steel_gauntlet.glb',[0,0.2,0],[Math.PI,0,0],1] ],
    a_ranger_boots:[ ['LeftLeg','glb','art/3d/gear/a_ranger_boots_L.glb',[0,0.25,0],[Math.PI,0,0],0.97], ['RightLeg','glb','art/3d/gear/a_ranger_boots_R.glb',[0,0.25,0],[Math.PI,0,0],0.97] ],
    acc_charm:[ ['Neck','glb','art/3d/gear/acc_charm.glb',[0,-0.01,0.0],[0,0,0],1] ],
    acc_blood_ring:[ ['LeftHand','glb','art/3d/gear/acc_blood_ring.glb',[0.012,0.06,0],[0,0,0],1] ],
    acc_band:[ ['LeftHand','glb','art/3d/gear/acc_band.glb',[0.012,0.06,0],[0,0,0],1] ]
  };
  var texCache={};
  function tex(THREE, name){ if(!name) return null; var k=name; if(texCache[k]) return texCache[k]; var t=new THREE.TextureLoader().load('art/3d/tex/'+name+'.png'); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2); texCache[k]=t; return t; }
  function material(THREE, key, tint){ var m=MAT[key]||MAT.leather; var mt=new THREE.MeshStandardMaterial({ map:tex(THREE, m[0]), color:m[1], roughness:m[2], metalness:m[3], side:THREE.DoubleSide }); if(tint) mt.color.lerp(new THREE.Color(tint), 0.5); return mt; }
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
  function bonesOf(model){ var b={}; model.traverse(function(o){ if(o.isBone) b[o.name.replace(/^mixamorig:?/,'')]=o; }); return b; }
  function fitScale(bone){ var ws=new THREE.Vector3(); bone.getWorldScale(ws); return 1/(ws.x||1); }
  function buildArmor(THREE, id, bones, tint, charId){ var spec=ARMOR[id]; if(!spec) return []; var made=[]; var fit=CHARFIT[charId]||{}, f=fit[SLOT_OF[id]]||1;
    spec.forEach(function(p){ var bone=bones[p[0]]; if(!bone) return; var k=fitScale(bone)*f;
      if(p[1]==='glb'){ var g=new THREE.Group(); g.userData.look=id; g.position.set(p[3][0]*k,p[3][1]*k,p[3][2]*k); g.rotation.set(p[4][0],p[4][1],p[4][2]); g.scale.setScalar(k*(p[5]||1)); bone.add(g); made.push(g);
        if(LOADER) LOADER.load(p[2], function(w){ w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; if(tint){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(tint),0.35); } } }); g.add(w.scene); }); return; }
      var mesh=new THREE.Mesh(geometry(THREE,p[1],p[2],p[6]), material(THREE,p[5],tint)); mesh.castShadow=true; mesh.position.set(p[3][0]*k,p[3][1]*k,p[3][2]*k); mesh.rotation.set(p[4][0],p[4][1],p[4][2]); mesh.scale.setScalar(k); mesh.userData.look=id; bone.add(mesh); made.push(mesh); });
    return made; }
  var THREE=null, LOADER=null;
  /* equipped: gear.js state().equipped ({main, sub, off, head, chest, legs, gloves, boots, acc, …}). opts: { onMain(wr), onMainFail(), tintOf(id) → hex|null, lookOf(id), baseOf(id) } */
  function attach(T, loader, model, equipped, opts){ THREE=T; LOADER=loader; opts=opts||{}; var bones=bonesOf(model), out={ pieces:[], weapons:{} };
    var baseOf=opts.baseOf||function(id){ return id; };
    /* 이전 조각 제거 */ Object.keys(bones).forEach(function(k){ var b=bones[k]; for(var i=b.children.length-1;i>=0;i--){ var c=b.children[i]; if(c.userData&&c.userData.look) b.remove(c); } });
    var mainId=equipped.main, mainBase=baseOf(mainId), spec=WEAPON[mainBase]||WEAPON.w_marsh_scythe, slot=bones.RightHandSlot||bones.RightHand;
    if(DUAL[mainBase]&&bones.LeftHandSlot){ var osp=WEAPON[mainBase]; loader.load(osp.glb, function(w){ var g2=new THREE.Group(); g2.userData.look='offhand'; w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); w.scene.position.set(0,-(osp.grip||0.1),0); g2.add(w.scene); bones.LeftHandSlot.add(g2); g2.scale.setScalar(fitScale(bones.LeftHandSlot)); out.weapons.offhand=g2; }); }
    if(slot){ loader.load(spec.glb, function(w){ var wr=new THREE.Group(); wr.userData.look=mainId||'main'; w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); w.scene.position.set(0,-(spec.grip||0.75),0); wr.add(w.scene); slot.add(wr); wr.scale.setScalar(fitScale(slot)); out.weapons.main=wr; opts.onMain&&opts.onMain(wr, w); }, undefined, function(){ opts.onMainFail&&opts.onMainFail(); }); }
    else opts.onMainFail&&opts.onMainFail();
    ['sub','off'].forEach(function(sl){ var id=equipped[sl]; if(!id) return; var sp=WEAPON[baseOf(id)]; if(!sp||!sp.bone||!bones[sp.bone]) return; var bone=bones[sp.bone];
      loader.load(sp.glb, function(w){ var g=new THREE.Group(); g.userData.look=id; w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); g.add(w.scene); var k=fitScale(bone); g.position.set(sp.pos[0]*k,sp.pos[1]*k,sp.pos[2]*k); g.rotation.set(sp.rot[0],sp.rot[1],sp.rot[2]); g.scale.setScalar(k*(sp.scale||1)); var tint=opts.tintOf&&opts.tintOf(id); if(tint) w.scene.traverse(function(o){ if(o.isMesh){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(tint),0.55); } }); bone.add(g); out.weapons[sl]=g; }); });
    ['head','chest','legs','gloves','boots','acc','acc2'].forEach(function(sl){ var id=equipped[sl]; if(!id) return; var tint=opts.tintOf&&opts.tintOf(id); out.pieces=out.pieces.concat(buildArmor(THREE, baseOf(id), bones, tint, opts.charId)); });
    return out; }
  window.TW_LOOKS={ WEAPON:WEAPON, ARMOR:ARMOR, MAT:MAT, attach:attach, buildArmor:buildArmor, bonesOf:bonesOf };
})();
