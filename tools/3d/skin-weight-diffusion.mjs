// Offline weight authoring only. Weld coincident UV splits for the solver, not
// the mesh: positions, topology, normals and UV bytes are never changed.
export function diffuseWeights(points, triangles, weights, mask, iterations=32){
 if(points.length!==weights.length||points.length!==mask.length)throw Error('Weight vertex count mismatch');
 if(!Number.isInteger(iterations)||iterations<0||iterations>200)throw Error('Invalid iteration count');
 const groups=[],lookup=new Map(),groupOf=[];
 for(let i=0;i<points.length;i++){
  if(points[i].length!==3||!points[i].every(Number.isFinite)||!Number.isFinite(mask[i])||mask[i]<0||mask[i]>1)throw Error('Invalid vertex/mask');
  const sum=weights[i].reduce((s,[j,w])=>{if(!Number.isInteger(j)||j<0||!Number.isFinite(w)||w<0)throw Error('Invalid influence');return s+w;},0);
  if(Math.abs(sum-1)>1e-5)throw Error('Weights must sum to one');
  const key=points[i].map(v=>Math.round(v*1e6)).join(',');
  if(!lookup.has(key)){lookup.set(key,groups.length);groups.push({vertices:[],neighbors:new Set(),mask:1,point:points[i]});}
  const index=lookup.get(key),g=groups[index];g.vertices.push(i);g.mask=Math.min(g.mask,mask[i]);groupOf.push(index);
 }
 if(triangles.length%3)throw Error('Expected triangles');
 for(let i=0;i<triangles.length;i+=3){
  const tri=triangles.slice(i,i+3).map(v=>{if(!Number.isInteger(v)||v<0||v>=points.length)throw Error('Invalid triangle');return groupOf[v];});
  for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3];if(a!==b){groups[a].neighbors.add(b);groups[b].neighbors.add(a);}}
 }
 const initial=groups.map(g=>{const w=new Map();for(const i of g.vertices)for(const[j,v]of weights[i])w.set(j,(w.get(j)||0)+v/g.vertices.length);return w;});
 // Tiny edges must not receive the same influence as a neighbour centimetres
 // away. Equal-neighbour smoothing produces spikes on irregular tessellation.
 const neighbors=groups.map(g=>{const list=[...g.neighbors].map(n=>[n,1/Math.max(1e-12,g.point.reduce((s,v,k)=>s+(v-groups[n].point[k])**2,0))]);const sum=list.reduce((s,[,v])=>s+v,0);return list.map(([n,v])=>[n,v/sum]);});
 let current=initial;
 for(let step=0;step<iterations;step++)current=groups.map((g,i)=>{
  if(!g.mask||!g.neighbors.size)return initial[i];
  const w=new Map();for(const[j,v]of current[i])w.set(j,v*.5);
  for(const[n,k]of neighbors[i])for(const[j,v]of current[n])w.set(j,(w.get(j)||0)+v*.5*k);
  return w;
 });
 return groupOf.map((g,i)=>{
  if(mask[i]===0)return weights[i].map(a=>a.slice());
  const blended=new Map();for(const[j,w]of initial[g])blended.set(j,w*(1-groups[g].mask));for(const[j,w]of current[g])blended.set(j,(blended.get(j)||0)+w*groups[g].mask);
  const list=[...blended].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=list.reduce((s,[,w])=>s+w,0);
  return list.map(([j,w])=>[j,w/sum]);
 });
}
