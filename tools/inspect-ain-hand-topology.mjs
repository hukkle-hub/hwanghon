import{readFile}from'node:fs/promises';import * as T from '../vendor/three/three.module.js';import{GLTFLoader}from'../vendor/three/GLTFLoader.js';import{repairAinBind}from'../js/ain-bind-repair.js';
const bytes=await readFile('art/3d/ain_anim.glb'),l=new GLTFLoader();l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));const asset=await l.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');repairAinBind(asset.scene);
asset.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const g=mesh.geometry,p=g.attributes.position,index=g.index;
 for(const sg of [1,-1]){
  const ids=new Set(),parent=new Map(),weld=new Map();const find=i=>parent.get(i)===i?i:(parent.set(i,find(parent.get(i))),parent.get(i));const join=(a,b)=>parent.set(find(a),find(b));
  for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i);if(v.x*sg<.26||v.x*sg>.40||v.y<.75||v.y>1.01||Math.abs(v.z)>.12)continue;ids.add(i);parent.set(i,i);const key=v.toArray().map(x=>Math.round(x*1e5)).join(',');if(weld.has(key))join(i,weld.get(key));else weld.set(key,i);}
  for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)].filter(j=>ids.has(j));for(let k=1;k<tri.length;k++)join(tri[0],tri[k]);}
  const components=new Map();for(const i of ids){const key=find(i);if(!components.has(key))components.set(key,[]);components.get(key).push(i);}
  for(const verts of components.values()){if(verts.length<4)continue;const box=new T.Box3();for(const i of verts)box.expandByPoint(new T.Vector3().fromBufferAttribute(p,i));console.log(sg,verts.length,box.min.toArray(),box.max.toArray());}
  const j=mesh.skeleton.bones.findIndex(b=>b.name.endsWith((sg===1?'Left':'Right')+'Hand')),inv=mesh.skeleton.boneInverses[j],bins={};for(const i of ids){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(inv),key=Math.floor(v.y/.02),bin=bins[key]||={n:0,xmin:9,xmax:-9,zmin:9,zmax:-9,zsum:0};bin.n++;bin.xmin=Math.min(bin.xmin,v.x);bin.xmax=Math.max(bin.xmax,v.x);bin.zmin=Math.min(bin.zmin,v.z);bin.zmax=Math.max(bin.zmax,v.z);bin.zsum+=v.z;}console.log(sg,JSON.stringify(bins));
 }
});
