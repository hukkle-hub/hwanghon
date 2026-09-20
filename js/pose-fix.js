/* 황혼 — 자세 교정 (임시 보정막)
   아인·카인의 idle·idle2·run 에서 «오른팔이 몸을 가로질러 왼쪽으로» 넘어간다.
   그래서 메뉴·로비에서 늘 오른팔이 없어 보이고, 낫·대검이 오른손 슬롯을 따라가므로
   왼손 옆에서 떠 있는 것처럼 보였다 (디렉터 지적, docs/design/33 §4).

   원인은 굽는 쪽이다 — tools/3d/retarget_ain.py 의 char_frame() 이 Hips 회전에서
   «오른쪽» 축을 구하는데, 소스 클립(Unarmed_Idle·Running_A)에서 그 축이 뒤집힌다.
   같은 rh=(0.30,…) 목표가 반대쪽에 찍히고, 팔이 닿지 않는 곳으로 뻗는다.

     바인드   R -0.300   ← 정상
     walk     R -0.300   ← 정상
     idle     R +0.209   ← 몸을 가로질렀다
     run      R +0.286

   이 컨테이너에 Blender 가 없어 GLB 를 다시 구울 수 없다. 로드 시점에 깨진 클립의
   오른팔 트랙을 «정상인 walk» 에서 가져와 갈아 끼운다.

   중요: 이름으로 찍어 고치지 않는다. 클립을 실제로 평가해 손이 어느 쪽에 있는지 재고,
   바인드와 좌우가 뒤집힌 클립만 고친다. 나중에 파이프라인을 다시 구우면 이 보정막은
   «고칠 것이 없다» 고 보고하고 아무 일도 하지 않는다 — 지워도 되는 시점을 스스로 알려 준다.

     TW_POSE.repair(THREE, gltf)  →  { checked, fixed:['idle','run'], from:'walk' }
*/
(function(){
  'use strict';
  var STRIP=function(n){ return String(n).replace(/^mixamorig:?/,''); };
  var ARM=['RightShoulder','RightArm','RightForeArm','RightHand','RightHandSlot'];
  var SUSPECT=['idle','idle2','run'], SOURCE='walk';
  var CHAIN=['Hips','Spine','Spine1','Spine2','RightShoulder','RightArm','RightForeArm','RightHand'];

  /* 트랙 이름: "mixamorig:RightArm.quaternion" 또는 "RightArm.quaternion" */
  function parse(name){
    var i=name.lastIndexOf('.'); if(i<0) return null;
    return { bone:STRIP(name.slice(0,i)), prop:name.slice(i+1) };
  }
  function trackMap(clip){
    var m={}; clip.tracks.forEach(function(t){ var p=parse(t.name); if(!p) return;
      (m[p.bone]||(m[p.bone]={}))[p.prop]=t; });
    return m;
  }
  /* 트랙에서 t 시점 값을 꺼낸다 (키 사이 보간 없이 가장 가까운 앞 키 — 부호 판정에는 충분) */
  function valueAt(track, t, size){
    var times=track.times, k=0;
    for(var i=0;i<times.length;i++){ if(times[i]<=t) k=i; else break; }
    return Array.prototype.slice.call(track.values, k*size, k*size+size);
  }

  function bones(THREE, gltf){
    var by={}; gltf.scene.traverse(function(o){ if(o.isBone) by[STRIP(o.name)]=o; });
    return by;
  }

  /* 클립을 t 에서 평가해 RightHand 의 «몸 기준 x» 를 낸다. Hips 부터 체인만 곱한다. */
  function handX(THREE, by, map, t){
    var m=new THREE.Matrix4(), acc=new THREE.Matrix4().identity();
    var q=new THREE.Quaternion(), v=new THREE.Vector3(), s=new THREE.Vector3(1,1,1);
    for(var i=0;i<CHAIN.length;i++){
      var name=CHAIN[i], b=by[name]; if(!b) continue;
      var tr=map&&map[name];
      v.copy(b.position); q.copy(b.quaternion);
      if(tr&&tr.position){ var p=valueAt(tr.position,t,3); v.set(p[0],p[1],p[2]); }
      if(tr&&tr.quaternion){ var r=valueAt(tr.quaternion,t,4); q.set(r[0],r[1],r[2],r[3]); }
      acc.multiply(m.compose(v,q,s));
    }
    return new THREE.Vector3().setFromMatrixPosition(acc).x;
  }

  /* walk 의 한 뼈 트랙을 대상 클립 길이에 맞춰 만든다.
     hold=true 면 t=0 값을 붙잡은 2-키 상수 트랙 (대기 자세), 아니면 주기를 맞춰 다시 샘플 */
  function rebuild(THREE, src, boneName, prop, duration, hold){
    var size=prop==='quaternion'?4:3;
    var Track=prop==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;
    var full=(src&&src.name)||'mixamorig:'+boneName;
    var name=full.slice(0,full.lastIndexOf('.'))+'.'+prop;
    if(hold||!src||src.times.length<2){
      var v=src?valueAt(src,0,size):null; if(!v) return null;
      return new Track(name,[0,duration],v.concat(v));
    }
    /* run: walk 의 주기를 run 길이에 맞춰 늘린다 — 팔 흔들림이 남는다 */
    var span=src.times[src.times.length-1]||1, k=duration/span, times=[], vals=[];
    for(var i=0;i<src.times.length;i++){
      times.push(src.times[i]*k);
      for(var j=0;j<size;j++) vals.push(src.values[i*size+j]);
    }
    return new Track(name, times, vals);
  }

  function repair(THREE, gltf){
    var out={ checked:[], fixed:[], from:SOURCE, reason:'' };
    if(!gltf||!gltf.animations||!gltf.animations.length){ out.reason='클립 없음'; return out; }
    var by=bones(THREE,gltf); if(!by.RightHand){ out.reason='오른손 뼈 없음'; return out; }
    var clips={}; gltf.animations.forEach(function(c){ clips[c.name]=c; });
    var src=clips[SOURCE]; if(!src){ out.reason='기준 클립(walk) 없음'; return out; }

    var restX=handX(THREE,by,null,0);                 /* 바인드 포즈 */
    var srcMap=trackMap(src), srcX=handX(THREE,by,srcMap,0);
    /* 기준 클립부터 바인드와 같은 쪽이어야 한다. 아니면 무엇이 옳은지 알 수 없으니 손대지 않는다 */
    if(!(restX*srcX>0)){ out.reason='기준 클립도 반대쪽 — 판단 보류'; return out; }

    SUSPECT.forEach(function(nm){
      var clip=clips[nm]; if(!clip) return;
      var x=handX(THREE,by,trackMap(clip),0);
      out.checked.push({clip:nm, x:+x.toFixed(3), rest:+restX.toFixed(3)});
      if(restX*x>0) return;                            /* 같은 쪽이면 정상 */

      var hold=(nm!=='run'), map=trackMap(clip);
      ARM.forEach(function(bn){
        if(!by[bn]) return;
        ['quaternion','position'].forEach(function(prop){
          var t=rebuild(THREE, srcMap[bn]&&srcMap[bn][prop], bn, prop, clip.duration, hold);
          if(!t) return;
          /* 같은 뼈·같은 속성의 기존 트랙을 걷어내고 새 것을 넣는다 */
          clip.tracks=clip.tracks.filter(function(old){ var p=parse(old.name); return !(p&&p.bone===bn&&p.prop===prop); });
          clip.tracks.push(t);
        });
      });
      clip.resetDuration&&clip.resetDuration();
      out.fixed.push(nm);
    });
    return out;
  }

  (typeof window!=='undefined'?window:globalThis).TW_POSE={ repair:repair, SUSPECT:SUSPECT, SOURCE:SOURCE, ARM:ARM };
})();
