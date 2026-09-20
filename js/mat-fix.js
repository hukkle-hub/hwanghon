/* 황혼 — 구운 메시 보정 (재질 · 법선)
   캐릭터 GLB 가 pbrMetallicRoughness 를 안 쓰고 나와서, glTF 규격 기본값인
   metalness=1 · roughness=1 로 로드된다. PBR 에서 metalness 1 은 «확산광이 0 인
   순수 금속» 이다 — 피부도 천도 머리카락도 전부 뿌연 쇳덩이로 그려졌다.
   디렉터가 «얼굴 일그러짐» 이라고 지적한 것의 실제 원인이다 (docs/design/33 §4).

     before: Ain_Mesh  rough 1  metal 1   ← 얼굴이 회색 마스크
     after : Ain_Mesh  rough .75 metal 0  ← 눈·코·입이 보인다

   법선도 같이 본다. 데시메이션이 정점을 쪼개 놓아 «같은 자리, 다른 법선» 이 생기고
   턱선·귀 옆에 검은 금이 간다. 위치가 같은 정점끼리 법선을 평균 내 메운다
   (정점을 합치지 않으므로 UV·스킨 가중치는 그대로다).

     TW_MATFIX.repair(THREE, root)  →  { materials:n, normals:n, skipped:n }

   굽는 쪽(tools/3d/)이 고쳐지면 이 보정막은 «고칠 것이 없다» 고 보고한다. */
(function(){
  'use strict';

  /* 규격 기본값 그대로 나온 재질만 고친다 — 일부러 금속으로 만든 장비는 건드리지 않는다 */
  function isDefaultPBR(m){ return m && m.isMeshStandardMaterial && m.metalness===1 && m.roughness===1; }

  function fixMaterials(root, opts){
    var metal=opts.metalness==null?0:opts.metalness, rough=opts.roughness==null?0.75:opts.roughness;
    var n=0, skipped=0, seen=new Set();
    root.traverse(function(o){
      if(!(o.isMesh||o.isSkinnedMesh)) return;
      var list=Array.isArray(o.material)?o.material:[o.material];
      list.forEach(function(m){
        if(!m||seen.has(m.uuid)) return; seen.add(m.uuid);
        if(!isDefaultPBR(m)){ skipped++; return; }
        m.metalness=metal; m.roughness=rough; m.needsUpdate=true; n++;
      });
    });
    return {fixed:n, skipped:skipped};
  }

  /* 같은 위치의 정점끼리 법선을 평균 낸다. 위치를 격자에 반올림해 묶는다. */
  function smoothNormals(geom, tol){
    var pos=geom.attributes.position, nor=geom.attributes.normal;
    if(!pos||!nor) return 0;
    var q=1/(tol||1e-4), bucket=new Map(), i, key, a;
    for(i=0;i<pos.count;i++){
      key=Math.round(pos.getX(i)*q)+'|'+Math.round(pos.getY(i)*q)+'|'+Math.round(pos.getZ(i)*q);
      a=bucket.get(key); if(a) a.push(i); else bucket.set(key,[i]);
    }
    var merged=0;
    bucket.forEach(function(idx){
      if(idx.length<2) return;
      var x=0,y=0,z=0,k;
      for(k=0;k<idx.length;k++){ x+=nor.getX(idx[k]); y+=nor.getY(idx[k]); z+=nor.getZ(idx[k]); }
      var l=Math.hypot(x,y,z); if(l<1e-6) return;
      x/=l; y/=l; z/=l;
      for(k=0;k<idx.length;k++) nor.setXYZ(idx[k],x,y,z);
      merged++;
    });
    if(merged) nor.needsUpdate=true;
    return merged;
  }

  function repair(THREE, root, opts){
    opts=opts||{};
    var out={materials:0, skipped:0, normals:0, meshes:0};
    if(!root) return out;
    var m=fixMaterials(root, opts); out.materials=m.fixed; out.skipped=m.skipped;
    if(opts.smooth!==false){
      root.traverse(function(o){
        if(!(o.isMesh||o.isSkinnedMesh)||!o.geometry) return;
        /* 큰 메시만 — 작은 소품은 각진 것이 의도일 수 있다 */
        if(o.geometry.attributes.position.count<2000) return;
        out.meshes++; out.normals+=smoothNormals(o.geometry, opts.tolerance||1e-4);
      });
    }
    return out;
  }

  window.TW_MATFIX={ repair:repair, smoothNormals:smoothNormals, isDefaultPBR:isDefaultPBR };
})();
