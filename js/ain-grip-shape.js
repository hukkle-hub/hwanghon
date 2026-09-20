import * as T from '../vendor/three/three.module.js';
export function ainGripCenter(side){return new T.Vector3(.005-(side==='Left'?1:-1)*.022,.052,0);}
// This GLB's fingers spread along local Z; X is palm thickness. The thumb
// occupies the negative-Z edge. Keep this asset-specific, not a generic hand rig.
export function closeAinHandPoint(point,side){
 const sg=side==='Left'?1:-1,v=point.clone();
 if(point.y>.052){
  const angle=Math.min(4.3,(point.y-.052)/.022),radius=.022+sg*(point.x-.005)*.32;
  const blend=T.MathUtils.smootherstep(point.y,.052,.072);
  v.x=T.MathUtils.lerp(point.x,.005-sg*.022+sg*radius*Math.cos(angle),blend);
  v.y=T.MathUtils.lerp(point.y,.052+radius*Math.sin(angle),blend);
 }
 const thumb=T.MathUtils.smootherstep(-point.z,.020,.032)*T.MathUtils.smootherstep(point.y,.020,.047);
 if(thumb>0){
  const pivot=new T.Vector3(0,.025,-.020),opposed=point.clone().sub(pivot).applyAxisAngle(new T.Vector3(1,0,0),1.05).add(pivot);
  const center=ainGripCenter(side),dx=sg*(v.x-center.x),dy=v.y-center.y;
  let angle=Math.atan2(dy,dx);if(point.y>.052&&angle<0)angle+=Math.PI*2;
  const targetAngle=-1+4*T.MathUtils.smootherstep(point.y,.020,.085);
  const radius=T.MathUtils.lerp(Math.max(.014,Math.hypot(dx,dy)),Math.max(.015,.020+sg*(point.x-.005)*.20),thumb);
  angle=T.MathUtils.lerp(angle,targetAngle,thumb);
  v.x=center.x+sg*radius*Math.cos(angle);v.y=center.y+radius*Math.sin(angle);v.z=T.MathUtils.lerp(v.z,opposed.z,thumb);
 }
 // Keep the opposed thumb surface outside the measured ~11 mm shaft.
 // The two source hands are asymmetric; a mirrored thumb offset is not enough.
 const center=ainGripCenter(side),dx=v.x-center.x,dy=v.y-center.y,r=Math.hypot(dx,dy);
 if(point.y>.02&&r<.014&&r>1e-8){v.x=center.x+dx*.014/r;v.y=center.y+dy*.014/r;}
 return v;
}

// Resolve triangle/shaft chords, not just vertex/shaft distance. Keep the source
// triangle budget: move shared hand vertices a few millimetres instead of adding
// a high-density hand mesh. UV-seam copies share the same correction.
export function resolveAinGripSurface(g,delta,inverse,forward,side){
 const p=g.attributes.position,index=g.index,center=ainGripCenter(side),sg=side==='Left'?1:-1,groups=new Map(),byIndex=new Map();
 for(let i=0;i<p.count;i++){
  const original=new T.Vector3().fromBufferAttribute(p,i);
  if(original.x*sg<.26||original.x*sg>.40||original.y<.75||original.y>1.01||Math.abs(original.z)>.12)continue;
  const local=original.clone().applyMatrix4(inverse);if(local.y<.02)continue;
  const key=original.toArray().map(v=>Math.round(v*1e6)).join(',');
  let group=groups.get(key);if(!group){const value=original.clone().add(new T.Vector3().fromArray(delta,i*3)).applyMatrix4(inverse);group={value,start:value.clone(),indices:[]};groups.set(key,group);}
  group.indices.push(i);byIndex.set(i,group);
 }
 const faces=[];for(let i=0;i<index.count;i+=3){const tri=[byIndex.get(index.getX(i)),byIndex.get(index.getX(i+1)),byIndex.get(index.getX(i+2))];if(tri.every(Boolean))faces.push(tri);}
 for(let pass=0;pass<10;pass++){
  let corrected=0;
  for(const tri of faces){
   let nearest;
   for(let k=0;k<3;k++){
    const a=tri[k].value,b=tri[(k+1)%3].value,ax=a.x-center.x,ay=a.y-center.y,dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
    const t=len>1e-14?T.MathUtils.clamp(-(ax*dx+ay*dy)/len,0,1):0,x=ax+t*dx,y=ay+t*dy,r=Math.hypot(x,y);
    if(!nearest||r<nearest.r)nearest={a:tri[k],b:tri[(k+1)%3],t,x,y,r};
   }
   if(nearest.r>=.0128||nearest.r<1e-8)continue;
   const {a,b,t,x,y,r}=nearest,w0=1-t,w1=t,amount=(.0128-r)/(w0*w0+w1*w1);
   a.value.x+=x/r*amount*w0;a.value.y+=y/r*amount*w0;b.value.x+=x/r*amount*w1;b.value.y+=y/r*amount*w1;corrected++;
  }
  if(!corrected)break;
 }
 let maximum=0;
 for(const group of groups.values()){
  maximum=Math.max(maximum,group.value.distanceTo(group.start));
  const world=group.value.clone().applyMatrix4(forward);
  for(const i of group.indices)delta.set(world.clone().sub(new T.Vector3().fromBufferAttribute(p,i)).toArray(),i*3);
 }
 return maximum;
}
