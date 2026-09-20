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
export function solveGripCircle(shoulder,palm,axis,reach,scale,upperLength,branch){
 const {center,radius}=gripCircle(palm,axis,reach,scale);
 const d=shoulder.clone().sub(center),axial=d.dot(axis),u=d.clone().addScaledVector(axis,-axial),radial=u.length();
 if(radial<1e-6||radius<1e-6)throw Error('Degenerate Ain grip circle');
 u.multiplyScalar(1/radial);
 const cosine=T.MathUtils.clamp((d.lengthSq()+radius*radius-upperLength*upperLength)/(2*radial*radius),-1,1);
 const tangent=axis.clone().cross(u),elbow=center.clone().addScaledVector(u,radius*cosine).addScaledVector(tangent,branch*radius*Math.sqrt(1-cosine*cosine));
 const reachDirection=center.clone().sub(elbow).normalize(),cross=axis.clone().cross(reachDirection);
 const cy=reach.y/Math.hypot(reach.y,reach.z),cz=reach.z/Math.hypot(reach.y,reach.z);
 const y=reachDirection.clone().multiplyScalar(cy).addScaledVector(cross,-cz),z=reachDirection.clone().multiplyScalar(cz).addScaledVector(cross,cy);
 const rotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(axis,y,z));
 return {elbow,rotation,residual:Math.abs(elbow.distanceTo(shoulder)-upperLength)};
}
