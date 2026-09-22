import * as T from '../vendor/three/three.module.js';
const V=()=>new T.Vector3();

// With a neutral wrist, an elbow lies on a circle around the weapon shaft.
// Intersect that circle with the upper-arm sphere; do not bend the wrist to
// compensate for an unreachable shaft. All inputs are in world coordinates.
export function gripCircle(palm,axis,reach,scale){
 return {center:palm.clone().addScaledVector(axis,-reach.x*scale),radius:Math.hypot(reach.y,reach.z)*scale};
}
export function gripReachShift(shoulder,palm,axis,reach,scale,upperLength){
 const {center,radius}=gripCircle(palm,axis,reach,scale);
 const toShoulder=shoulder.clone().sub(center),radial=toShoulder.clone().addScaledVector(axis,-toShoulder.dot(axis));
 if(radial.lengthSq()<1e-10)return V();
 const closest=center.add(radial.setLength(radius)),toward=shoulder.clone().sub(closest),distance=toward.length();
 return distance>upperLength*.90?toward.multiplyScalar((distance-upperLength*.90)/distance):V();
}
// 검수용 계측기 — 이 풀이가 특이점 근처에 가는지 감시한다 (게임 동작에 영향 없음).
// tools/3d/swing-measure.html 이 읽는다.
export const GRIP_DIAG={minRadial:Infinity,maxCos:0,tangent:0,calls:0,
 reset(){this.minRadial=Infinity;this.maxCos=0;this.tangent=0;this.calls=0;}};

// 팔꿈치는 자루 축 둘레의 원과 위팔 구의 교점이다.
//
// 64·66·67번 문서에서 이 함수의 «팔꿈치 특이점» 을 휘두름 크기의 천장으로
// 지목했었다. **재 보니 틀렸다.** 전 전투 클립을 훑은 결과
// (tools/3d/swing-measure.html 의 cond):
//     radial 최소 0.127~0.254 (0 근처에 간 적 없음)
//     |cos| 최대 0.934~0.949 (접선 근접 0 회)
// 즉 이 풀이는 내내 «잘 조건화» 돼 있다. 특이점 보정을 넣어 봤지만 한 번도
// 작동하지 않아서 도로 뺐다.
//
// 진짜 천장은 두 가지였다:
//   · 키 사이 보간이 키마다 속도를 0 으로 떨어뜨린 것 (ain-two-hand.js 의 path)
//   · 관절 각속도 상한 (tests/ain-two-hand 의 8°/표본 ≈ 2900°/s)
// docs/design/68-grip-ik-truth.md
export function solveGripCircle(shoulder,palm,axis,reach,scale,upperLength,branch){
 const {center,radius}=gripCircle(palm,axis,reach,scale);
 const d=shoulder.clone().sub(center),axial=d.dot(axis),u=d.clone().addScaledVector(axis,-axial),radial=u.length();
 if(radial<1e-6||radius<1e-6)throw Error('Degenerate Ain grip circle');
 GRIP_DIAG.calls++; if(radial<GRIP_DIAG.minRadial)GRIP_DIAG.minRadial=radial;
 const dir=u.clone().multiplyScalar(1/radial);
 const cosine=T.MathUtils.clamp((d.lengthSq()+radius*radius-upperLength*upperLength)/(2*radial*radius),-1,1);
 if(Math.abs(cosine)>GRIP_DIAG.maxCos)GRIP_DIAG.maxCos=Math.abs(cosine);
 if(Math.abs(cosine)>0.995)GRIP_DIAG.tangent++;
 const tangent=axis.clone().cross(dir),elbow=center.clone().addScaledVector(dir,radius*cosine).addScaledVector(tangent,branch*radius*Math.sqrt(1-cosine*cosine));
 const reachDirection=center.clone().sub(elbow).normalize(),cross=axis.clone().cross(reachDirection);
 const cy=reach.y/Math.hypot(reach.y,reach.z),cz=reach.z/Math.hypot(reach.y,reach.z);
 const y=reachDirection.clone().multiplyScalar(cy).addScaledVector(cross,-cz),z=reachDirection.clone().multiplyScalar(cz).addScaledVector(cross,cy);
 const rotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(axis,y,z));
 return {elbow,rotation,residual:Math.abs(elbow.distanceTo(shoulder)-upperLength)};
}
