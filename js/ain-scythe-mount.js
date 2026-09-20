import * as T from '../vendor/three/three.module.js';
const bladeCloud=new WeakMap();
// Cache a bounded surface point cloud once, then transform only 160 samples
// per impact. No full triangle scan in the mobile render loop.
export function nearestAinBladePoint(weapon,target){
 weapon.updateWorldMatrix(true,true);let points=bladeCloud.get(weapon);
 if(!points){const all=[],inverse=weapon.matrixWorld.clone().invert();
  weapon.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;if(!p)return;
   const matrix=inverse.clone().multiply(o.matrixWorld);
   for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix);if(v.y>.5&&Math.hypot(v.x,v.z)>.12)all.push(v);}
  });
  points=Array.from({length:Math.min(160,all.length)},(_,i)=>all[Math.floor(i*all.length/Math.min(160,all.length))]);bladeCloud.set(weapon,points);
 }
 let distance=Infinity,point=null;const v=new T.Vector3();
 for(const p of points){v.copy(p).applyMatrix4(weapon.matrixWorld);const d=v.distanceTo(target);if(d<distance){distance=d;point=v.clone();}}
 return point?{point,distance}:null;
}
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
 let radius=0,top=-Infinity,bladeTip,bladeRoot;
 root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
  const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),d=v.clone().sub(anchor),height=d.dot(axis),r=d.clone().addScaledVector(axis,-height).length();
  if(height>.5&&r>radius){radius=r;bladeTip=v.clone();}
  if(height>top){top=height;bladeRoot=v.clone();}
 }});
 if(radius<.3||!bladeTip||!bladeRoot)throw Error('Ain scythe blade landmarks missing');
 return {axis,anchor,residual,bladeTip,bladeRoot};
}
export function mountAinScythe(root){
 const measurement=measureAinScythe(root),mount=new T.Group(),offset=new T.Group();
 mount.name='AinScytheCalibrated';mount.quaternion.setFromUnitVectors(measurement.axis,new T.Vector3(0,1,0));
 offset.position.copy(measurement.anchor).negate();offset.add(root);mount.add(offset);
 for(const [name,p]of [['AinBladeRoot',measurement.bladeRoot],['AinBladeTip',measurement.bladeTip]]){const marker=new T.Object3D();marker.name=name;marker.position.copy(p);offset.add(marker);}
 mount.userData.shaftCalibration={axis:measurement.axis.toArray(),anchor:measurement.anchor.toArray(),residual:measurement.residual};
 return mount;
}

// QA only: closest point on actual blade triangles, not tip-to-target distance
// and not the shaft bounding box. World metre coordinates, read-only geometry.
export function measureAinBladeContact(weapon,target){
 weapon.updateWorldMatrix(true,true);const origin=weapon.getWorldPosition(new T.Vector3()),axis=new T.Vector3(0,1,0).transformDirection(weapon.matrixWorld);
 const triangle=new T.Triangle(),closest=new T.Vector3();let distance=Infinity,point=null;
 weapon.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.position)return;const g=o.geometry,p=g.attributes.position,idx=g.index,count=idx?idx.count:p.count;
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j),vs=[triangle.a,triangle.b,triangle.c];let blade=false;
   for(let j=0;j<3;j++){vs[j].fromBufferAttribute(p,ids[j]).applyMatrix4(o.matrixWorld);const d=vs[j].clone().sub(origin),h=d.dot(axis);if(h>.5&&d.addScaledVector(axis,-h).length()>.12)blade=true;}
   if(!blade)continue;triangle.closestPointToPoint(target,closest);const d=closest.distanceTo(target);if(d<distance){distance=d;point=closest.clone();}
  }
 });return {distance,point};
}
