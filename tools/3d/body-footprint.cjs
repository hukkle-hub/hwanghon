/* Review-only conservative convex XZ envelope. No damage or live movement rules.
 * Points must be finite, CCW and convex. Radius is the target capsule radius. */
function convexHull(points){
 const p=points.map(v=>({x:v.x,z:v.z}));
 if(p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.z)))throw Error('Non-finite footprint');
 p.sort((a,b)=>a.x-b.x||a.z-b.z);
 const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
 const half=a=>{const h=[];for(const v of a){while(h.length>1&&cross(h[h.length-2],h[h.length-1],v)<=0)h.pop();h.push(v)}return h};
 if(p.length<3)return p;
 return [...half(p).slice(0,-1),...half(p.reverse()).slice(0,-1)];
}
function bindBodyFootprint(profile){
 const h=profile?.hull;
 if(profile?.reviewOnly!==true||!Array.isArray(h)||h.length<3)return null;
 let canonical;try{canonical=convexHull(h)}catch{return null}
 if(canonical.length!==h.length||canonical.some((v,i)=>v.x!==h[i].x||v.z!==h[i].z))return null;
 function query(p){
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z))throw Error('Non-finite target');
  let inside=true,best=null;
  for(let i=0;i<h.length;i++){
   const a=h[i],b=h[(i+1)%h.length],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
   if(dx*(p.z-a.z)-dz*(p.x-a.x)<-1e-10)inside=false;
   const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l2));
   const x=a.x+dx*u,z=a.z+dz*u,d=Math.hypot(p.x-x,p.z-z);
   if(!best||d<best.d){const len=Math.sqrt(l2);best={x,z,d,nx:dz/len,nz:-dx/len}}
  }
  return{...best,inside,signedDistance:inside?-best.d:best.d};
 }
 function resolve(p,radius=.22,margin=.03){
  if(!Number.isFinite(radius)||radius<0||!Number.isFinite(margin)||margin<0)throw Error('Invalid radius');
  const q=query(p),clearance=radius+margin;
  if(!q.inside&&q.d>=clearance)return{x:p.x,z:p.z,moved:0};
  const nx=q.inside||q.d<1e-12?q.nx:(p.x-q.x)/q.d,nz=q.inside||q.d<1e-12?q.nz:(p.z-q.z)/q.d;
  const x=q.x+nx*(clearance+1e-8),z=q.z+nz*(clearance+1e-8);
  return{x,z,moved:Math.hypot(x-p.x,z-p.z)};
 }
 function move(from,to,radius=.22,margin=.03){
  const start=resolve(from,radius,margin);query(to);
  const dx=to.x-start.x,dz=to.z-start.z,clearance=radius+margin;
  let enter=0,exit=1;
  for(let i=0;i<h.length;i++){
   const a=h[i],b=h[(i+1)%h.length],ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez),nx=ez/len,nz=-ex/len;
   const dist=nx*(start.x-a.x)+nz*(start.z-a.z)-clearance,velocity=nx*dx+nz*dz;
   if(Math.abs(velocity)<1e-12){if(dist>0)return{x:to.x,z:to.z,moved:0};continue}
   const at=-dist/velocity;if(velocity<0)enter=Math.max(enter,at);else exit=Math.min(exit,at);
   if(enter>exit)return{x:to.x,z:to.z,moved:0};
  }
  // Expanded half-planes are deliberately conservative at convex corners.
  // Stop at first contact. Sliding and moving-body response are NOT implemented.
  if(exit<0||enter>1)return{x:to.x,z:to.z,moved:0};
  const u=Math.max(0,enter-1e-7),x=start.x+dx*u,z=start.z+dz*u;
  return{x,z,moved:Math.hypot(to.x-x,to.z-z)};
 }
 function slide(from,to,radius=.22,margin=.03){
  let p=resolve(from,radius,margin);query(to);
  const clearance=radius+margin,skin=1e-8;
  const planes=h.map((a,i)=>{const b=h[(i+1)%h.length],len=Math.hypot(b.x-a.x,b.z-a.z);return{a,nx:(b.z-a.z)/len,nz:-(b.x-a.x)/len}});
  const distance=(v,q)=>v.nx*(q.x-v.a.x)+v.nz*(q.z-v.a.z)-clearance;
  // resolve() uses rounded corners; the sweep uses conservative mitred corners.
  // Reconcile an initial position inside that extra corner region before sweeping.
  let closest=planes[0];for(const v of planes)if(distance(v,p)>distance(closest,p))closest=v;
  const initial=distance(closest,p);
  if(initial<=0)p={x:p.x+closest.nx*(skin-initial),z:p.z+closest.nz*(skin-initial)};
  let dx=to.x-p.x,dz=to.z-p.z,contacts=0;
  for(let pass=0;pass<4&&Math.hypot(dx,dz)>1e-10;pass++){
   let enter=0,exit=1,normal=null,miss=false;
   for(const v of planes){
    const d=distance(v,p),velocity=v.nx*dx+v.nz*dz;
    if(Math.abs(velocity)<1e-12){if(d>0){miss=true;break}continue}
    const at=-d/velocity;
    if(velocity<0&&at>=enter){enter=at;normal=v}else if(velocity>0)exit=Math.min(exit,at);
    if(enter>exit){miss=true;break}
   }
   if(miss||exit<0||enter>1||!normal){p={x:p.x+dx,z:p.z+dz};break}
   p={x:p.x+dx*enter+normal.nx*skin,z:p.z+dz*enter+normal.nz*skin};
   dx*=1-enter;dz*=1-enter;
   const inward=Math.min(0,dx*normal.nx+dz*normal.nz);
   dx-=normal.nx*inward;dz-=normal.nz*inward;contacts++;
  }
  return{x:p.x,z:p.z,moved:Math.hypot(to.x-p.x,to.z-p.z),contacts};
 }
 return{query,resolve,move,slide,hull:h.map(v=>({...v}))};
}
module.exports={convexHull,bindBodyFootprint};
