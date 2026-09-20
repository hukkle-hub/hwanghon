import * as T from '../vendor/three/three.module.js';
// Measure the straight handle, excluding the blade, butt ornament and collars.
// The delivered Hi3D GLB is NOT Y-axis centred. Do not rewrite its geometry.
export function measureAinScythe(root){
 root.updateMatrixWorld(true);const bands=Array.from({length:11},(_,i)=>({y:.2+i*.1,box:new T.Box3(),count:0}));
 root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
  const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
  for(const b of bands)if(Math.abs(v.y-b.y)<.025){b.box.expandByPoint(v);b.count++;}
 }});
 const points=bands.filter(b=>b.count>8).map(b=>b.box.getCenter(new T.Vector3()));
 if(points.length<7)throw Error('Ain scythe handle calibration needs the expected source asset');
 const mean=points.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/points.length);
 const yy=points.reduce((s,p)=>s+(p.y-mean.y)**2,0);
 const sx=points.reduce((s,p)=>s+(p.y-mean.y)*(p.x-mean.x),0)/yy;
 const sz=points.reduce((s,p)=>s+(p.y-mean.y)*(p.z-mean.z),0)/yy;
 const axis=new T.Vector3(sx,1,sz).normalize(),anchor=new T.Vector3(mean.x+sx*(.75-mean.y),.75,mean.z+sz*(.75-mean.y));
 const residual=Math.max(...points.map(p=>p.clone().sub(anchor).cross(axis).length()));
 if(residual>.006)throw Error('Ain scythe handle is no longer a straight calibrated shaft');
 return {axis,anchor,residual};
}
export function mountAinScythe(root){
 const measurement=measureAinScythe(root),mount=new T.Group(),offset=new T.Group();
 mount.name='AinScytheCalibrated';mount.quaternion.setFromUnitVectors(measurement.axis,new T.Vector3(0,1,0));
 offset.position.copy(measurement.anchor).negate();offset.add(root);mount.add(offset);
 mount.userData.shaftCalibration={axis:measurement.axis.toArray(),anchor:measurement.anchor.toArray(),residual:measurement.residual};
 return mount;
}
