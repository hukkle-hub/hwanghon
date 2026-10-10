import * as T from '../../vendor/three/three.module.js';
// Fit every padded point, including depth, in narrow/mobile review panels.
// A fixed camera distance previously cropped both upper arms at aspect < 0.5.
export function frameReviewCamera(camera,points,direction,padding=.12){
 const box=new T.Box3().setFromPoints(points).expandByScalar(padding),target=box.getCenter(new T.Vector3()),dir=direction.clone().normalize(),right=new T.Vector3(0,1,0).cross(dir).normalize(),up=dir.clone().cross(right).normalize(),tv=Math.tan(T.MathUtils.degToRad(camera.fov)/2)*.90,th=tv*camera.aspect;
 let distance=.1;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).sub(target);distance=Math.max(distance,p.dot(dir)+Math.max(Math.abs(p.dot(right))/th,Math.abs(p.dot(up))/tv));}
 camera.position.copy(target).addScaledVector(dir,distance);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return{box,target,distance};
}
