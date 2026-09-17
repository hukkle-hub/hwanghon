/* 황혼 — 장비 외형 (3D). 장착한 장비가 아인의 모습을 바꾼다: 주무기 모델 교체, 보조·부무기는 허리·등에 걸침, 방어구·장신구는 뼈에 붙는 조각.
   window.TW_LOOKS = { WEAPON, ARMOR, attach(THREE, loader, model, equipped, opts) }
   · 무기 GLB 규약: 원점 = 자루 끝, +Y 자루 방향, 오른손 그립 0.75 m (tools/3d/build_weapons.py)
   · 뼈 로컬 축(아인 리그, viewer 로 측정): 몸통·머리 = x 오른쪽 · y 위 · z 앞 / 팔·다리 = y 뼈 방향(아래) · -z 앞
   · 제작품(c_…)은 기본형 외형 + gear.js lookOf 색조 (game3d.applyWeaponLook) */
(function(){
  var WEAPON={
    w_marsh_scythe:    { glb:'art/3d/ain_scythe_tex.glb', grip:0.75 },
    w_rust_executioner:{ glb:'art/3d/weapons/w_rust_executioner.glb', grip:0.75 },
    w_marsh_blade:     { glb:'art/3d/weapons/w_marsh_blade.glb', grip:0.75 },
    w_ruin_spear:      { glb:'art/3d/weapons/w_ruin_spear.glb', grip:0.75 },
    w_rust_sword:      { glb:'art/3d/weapons/w_rust_sword.glb', grip:0.75 },
    /* 보조(왼 허리)·부무기(등) */
    w_ash_dirk:        { glb:'art/3d/weapons/w_ash_dirk.glb', bone:'Hips', pos:[0.17,-0.04,0.05], rot:[Math.PI*0.95,0,0.35] },
    w_hook_scythe:     { glb:'art/3d/weapons/w_hook_scythe.glb', bone:'Spine2', pos:[0.08,-0.02,-0.11], rot:[0.1,0,2.5], scale:0.75 }
  };
  var MAT={ leather:[0x4a3220,0.9,0], reed:[0x4f6630,0.9,0], black:[0x1a1b20,0.45,0.7], steel:[0x8a919c,0.35,0.9], cloth:[0x2e2e34,1.0,0], brass:[0x9c7a36,0.4,0.9], bone:[0x9a8e74,0.7,0], red:[0x7a1e1a,0.6,0.2], copper:[0xa05a30,0.4,0.9] };
  /* 조각: [뼈, 종류, 크기, 위치, 회전, 재질] — 크기/위치 m, 회전 rad */
  var ARMOR={
    a_hood:[ ['Head','hood',[0.118],[0,0.085,-0.02],[0.12,0,0],'cloth'], ['Head','cylOpen',[0.10,0.16,0.12],[0,-0.06,-0.02],[0,0,0],'cloth'] ],
    a_reed_cuirass:[ ['Spine1','box',[0.22,0.17,0.05],[0,0.04,0.08],[0.08,0,0],'leather'], ['Spine1','box',[0.21,0.16,0.045],[0,0.04,-0.075],[-0.05,0,0],'leather'],
                     ['Spine1','box',[0.035,0.19,0.012],[-0.06,0.04,0.108],[0,0,0.3],'reed'], ['Spine1','box',[0.035,0.19,0.012],[0.06,0.04,0.108],[0,0,-0.3],'reed'],
                     ['Spine','box',[0.24,0.04,0.16],[0,0.03,0.0],[0,0,0],'reed'], ['Spine','box',[0.04,0.04,0.02],[0,0.03,0.085],[0,0,0],'brass'] ],
    a_black_greaves:[ ['LeftLeg','box',[0.085,0.26,0.035],[0,0.2,-0.045],[0,0,0],'black'], ['RightLeg','box',[0.085,0.26,0.035],[0,0.2,-0.045],[0,0,0],'black'],
                      ['LeftLeg','sphere',[0.045],[0,0.04,-0.04],[0,0,0],'black'], ['RightLeg','sphere',[0.045],[0,0.04,-0.04],[0,0,0],'black'],
                      ['LeftLeg','box',[0.08,0.015,0.04],[0,0.13,-0.05],[0,0,0],'steel'], ['RightLeg','box',[0.08,0.015,0.04],[0,0.13,-0.05],[0,0,0],'steel'] ],
    a_steel_gauntlet:[ ['RightForeArm','cylOpen',[0.036,0.048,0.19],[0,0.16,0],[0,0,0],'steel'], ['RightForeArm','box',[0.06,0.12,0.015],[0,0.15,-0.045],[0,0,0],'steel'], ['RightForeArm','box',[0.06,0.12,0.015],[0,0.15,0.045],[0,0,0],'black'],
                       ['RightHand','box',[0.065,0.045,0.04],[0,0.03,0.0],[0,0,0],'steel'], ['RightHand','box',[0.07,0.015,0.045],[0,0.055,-0.01],[0,0,0],'brass'] ],
    a_ranger_boots:[ ['LeftFoot','box',[0.075,0.13,0.06],[0,0.07,0.0],[0,0,0],'leather'], ['RightFoot','box',[0.075,0.13,0.06],[0,0.07,0.0],[0,0,0],'leather'],
                     ['LeftLeg','cylOpen',[0.05,0.055,0.10],[0,0.33,0],[0,0,0],'leather'], ['RightLeg','cylOpen',[0.05,0.055,0.10],[0,0.33,0],[0,0,0],'leather'],
                     ['LeftLeg','box',[0.095,0.018,0.09],[0,0.355,0],[0,0,0],'reed'], ['RightLeg','box',[0.095,0.018,0.09],[0,0.355,0],[0,0,0],'reed'] ],
    acc_charm:[ ['Neck','torus',[0.065,0.005],[0,0.0,0.0],[Math.PI/2.4,0,0],'steel'], ['Neck','box',[0.028,0.04,0.01],[0,-0.045,0.065],[0,0,0],'leather'], ['Neck','sphere',[0.007],[0,-0.045,0.072],[0,0,0],'red'] ],
    acc_blood_ring:[ ['LeftHand','torus',[0.012,0.004],[0.012,0.06,0],[0,0,Math.PI/2],'brass'], ['LeftHand','sphere',[0.006],[0.012,0.06,0.012],[0,0,0],'red'] ],
    acc_band:[ ['LeftHand','torus',[0.012,0.004],[0.012,0.06,0],[0,0,Math.PI/2],'copper'] ]
  };
  function material(THREE, key, tint){ var m=MAT[key]||MAT.leather; var mt=new THREE.MeshStandardMaterial({ color:m[0], roughness:m[1], metalness:m[2], side:THREE.DoubleSide }); if(tint) mt.color.lerp(new THREE.Color(tint), 0.5); return mt; }
  function geometry(THREE, kind, s){
    switch(kind){
      case 'box': return new THREE.BoxGeometry(s[0],s[1],s[2]);
      case 'sphere': return new THREE.SphereGeometry(s[0],14,10);
      case 'torus': return new THREE.TorusGeometry(s[0],s[1],6,20);
      case 'cylOpen': return new THREE.CylinderGeometry(s[0],s[1],s[2],14,1,true);
      case 'hood': { var g=new THREE.SphereGeometry(s[0],18,12,Math.PI*0.62,Math.PI*1.76); g.rotateY(-Math.PI/2); return g; }
    }
    return new THREE.BoxGeometry(0.05,0.05,0.05);
  }
  function bonesOf(model){ var b={}; model.traverse(function(o){ if(o.isBone) b[o.name.replace(/^mixamorig:?/,'')]=o; }); return b; }
  function fitScale(bone){ var ws=new THREE.Vector3(); bone.getWorldScale(ws); return 1/(ws.x||1); }
  function buildArmor(THREE, id, bones, tint){ var spec=ARMOR[id]; if(!spec) return []; var made=[];
    spec.forEach(function(p){ var bone=bones[p[0]]; if(!bone) return; var mesh=new THREE.Mesh(geometry(THREE,p[1],p[2]), material(THREE,p[5],tint)); mesh.castShadow=true; var k=fitScale(bone); mesh.position.set(p[3][0]*k,p[3][1]*k,p[3][2]*k); mesh.rotation.set(p[4][0],p[4][1],p[4][2]); mesh.scale.setScalar(k); mesh.userData.look=id; bone.add(mesh); made.push(mesh); });
    return made; }
  var THREE=null;
  /* equipped: gear.js state().equipped ({main, sub, off, head, chest, legs, gloves, boots, acc, …}). opts: { onMain(wr), onMainFail(), tintOf(id) → hex|null, lookOf(id), baseOf(id) } */
  function attach(T, loader, model, equipped, opts){ THREE=T; opts=opts||{}; var bones=bonesOf(model), out={ pieces:[], weapons:{} };
    var baseOf=opts.baseOf||function(id){ return id; };
    /* 이전 조각 제거 */ Object.keys(bones).forEach(function(k){ var b=bones[k]; for(var i=b.children.length-1;i>=0;i--){ var c=b.children[i]; if(c.userData&&c.userData.look) b.remove(c); } });
    var mainId=equipped.main, mainBase=baseOf(mainId), spec=WEAPON[mainBase]||WEAPON.w_marsh_scythe, slot=bones.RightHandSlot||bones.RightHand;
    if(slot){ loader.load(spec.glb, function(w){ var wr=new THREE.Group(); wr.userData.look=mainId||'main'; w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); w.scene.position.set(0,-(spec.grip||0.75),0); wr.add(w.scene); slot.add(wr); wr.scale.setScalar(fitScale(slot)); out.weapons.main=wr; opts.onMain&&opts.onMain(wr, w); }, undefined, function(){ opts.onMainFail&&opts.onMainFail(); }); }
    else opts.onMainFail&&opts.onMainFail();
    ['sub','off'].forEach(function(sl){ var id=equipped[sl]; if(!id) return; var sp=WEAPON[baseOf(id)]; if(!sp||!sp.bone||!bones[sp.bone]) return; var bone=bones[sp.bone];
      loader.load(sp.glb, function(w){ var g=new THREE.Group(); g.userData.look=id; w.scene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); g.add(w.scene); var k=fitScale(bone); g.position.set(sp.pos[0]*k,sp.pos[1]*k,sp.pos[2]*k); g.rotation.set(sp.rot[0],sp.rot[1],sp.rot[2]); g.scale.setScalar(k*(sp.scale||1)); var tint=opts.tintOf&&opts.tintOf(id); if(tint) w.scene.traverse(function(o){ if(o.isMesh){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(tint),0.55); } }); bone.add(g); out.weapons[sl]=g; }); });
    ['head','chest','legs','gloves','boots','acc','acc2'].forEach(function(sl){ var id=equipped[sl]; if(!id) return; var tint=opts.tintOf&&opts.tintOf(id); out.pieces=out.pieces.concat(buildArmor(THREE, baseOf(id), bones, tint)); });
    return out; }
  window.TW_LOOKS={ WEAPON:WEAPON, ARMOR:ARMOR, MAT:MAT, attach:attach, buildArmor:buildArmor, bonesOf:bonesOf };
})();
