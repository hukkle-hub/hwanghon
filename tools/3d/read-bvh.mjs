// Small, strict offline BVH reader. Channel order is significant; units are
// preserved (the repository's CMU extracts already use metres).
import * as T from '../../vendor/three/three.module.js';
export function readBVH(text) {
 const tokens=text.match(/[^\s{}]+|[{}]/g)||[];let at=0,channels=0;
 const take=()=>{if(at>=tokens.length)throw Error('Truncated BVH');return tokens[at++];};
 const need=s=>{if(take()!==s)throw Error('Expected '+s);};
 const number=()=>{const n=Number(take());if(!Number.isFinite(n))throw Error('Non-finite BVH');return n;};
 const nodes=[],byName={};
 function joint(kind,parent){
  const name=kind==='End'?(need('Site'),parent.name+'_end'):take();
  if(byName[name])throw Error('Duplicate BVH bone '+name);
  const b=new T.Bone();b.name=name;parent?.add(b);need('{');need('OFFSET');b.position.set(number(),number(),number());
  const data={bone:b,offset:b.position.clone(),channels:[],start:channels};nodes.push(data);byName[name]=b;
  if(kind!=='End'){need('CHANNELS');const count=number();if(!Number.isInteger(count)||count<0||count>6)throw Error('Invalid channel count');for(let i=0;i<count;i++){const c=take();if(!/^[XYZ](position|rotation)$/.test(c)||data.channels.includes(c))throw Error('Invalid channel '+c);data.channels.push(c);}channels+=count;}
  while(tokens[at]!=='}'){const child=take();if(child!=='JOINT'&&child!=='End')throw Error('Invalid BVH joint');joint(child,b);}need('}');return b;
 }
 need('HIERARCHY');need('ROOT');const root=joint('ROOT');need('MOTION');need('Frames:');const count=number();need('Frame');need('Time:');const frameTime=number();
 if(!Number.isInteger(count)||count<1||frameTime<=0)throw Error('Invalid BVH timing');
 if(tokens.length-at!==count*channels)throw Error('BVH frame/channel mismatch');
 const frames=Array.from({length:count},()=>Array.from({length:channels},number));
 const axes={X:new T.Vector3(1,0,0),Y:new T.Vector3(0,1,0),Z:new T.Vector3(0,0,1)};
 function frame(i){for(const n of nodes){n.bone.position.copy(n.offset);n.bone.quaternion.identity();n.channels.forEach((c,k)=>{const v=frames[i][n.start+k];if(c.endsWith('position'))n.bone.position[c[0].toLowerCase()]+=v;else n.bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axes[c[0]],v*Math.PI/180));});}root.updateMatrixWorld(true);}
 function pose(time){
  if(!Number.isFinite(time))throw Error('Invalid pose time');const f=Math.max(0,Math.min(count-1,time/frameTime)),a=Math.floor(f),b=Math.min(count-1,a+1),u=f-a;
  frame(a);if(u){const first=nodes.map(n=>[n.bone.position.clone(),n.bone.quaternion.clone()]);frame(b);nodes.forEach((n,i)=>{n.bone.position.lerpVectors(first[i][0],n.bone.position,u);n.bone.quaternion.slerpQuaternions(first[i][1],n.bone.quaternion.clone(),u);});root.updateMatrixWorld(true);}
 }
 root.updateMatrixWorld(true);return {root,byName,nodes,frames,frameTime,duration:(count-1)*frameTime,pose};
}
