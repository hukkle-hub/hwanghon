// Review-only water study. NO authoritative damage, target selection or live
// registration. Length is an artistic raw-asset measure, not the 7m root cone.
import * as T from '../../vendor/three/three.module.js';
import {bindBossSurfaceEmitter} from '../../js/mmo/boss-emitter.js';
import {GILL_SOCKETS} from './leviathan-gill-sockets.mjs';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export function gillWaterPhase(skill,t){
 if(skill?.clip!=='atk_gill'||!Number.isFinite(t)||t<0||t>=skill.duration)return{gather:0,release:0,age:0};
 const hit=skill.hits?.[0]?.at;
 if(!Number.isFinite(hit))return{gather:0,release:0,age:0};
 const age=(t-hit)/1000;
 return{age,gather:age<0?smooth((t-(hit-1050))/700):0,release:age>=0&&age<.85?(1-smooth(age/.85)):0};
}
export function createGillWaterStudy(model,scene,{reduced=false}={}){
 const bound=GILL_SOCKETS.map(spec=>bindBossSurfaceEmitter(model,spec));
 if(bound.some(x=>!x))return null;
 const group=new T.Group();group.name='ReviewOnlyGillWater';group.userData.noCam=true;scene.add(group);
 const steps=reduced?12:24,count=reduced?20:48;
 const origin=new T.Vector3(),normal=new T.Vector3(),up=new T.Vector3(0,1,0),side=new T.Vector3(),vertical=new T.Vector3();
 const streams=bound.map(emitter=>{
  const pos=new Float32Array((steps+1)*2*3),colors=new Float32Array(pos.length),uv=new Float32Array((steps+1)*4),indices=[];
  for(let i=0;i<=steps;i++)for(let edge=0;edge<2;edge++){
   const j=(i*2+edge)*3;colors.set([.48+.5*i/steps,.77+.22*i/steps,.9+.1*i/steps],j);uv.set([i/steps,edge],(i*2+edge)*2);
   if(i<steps&&edge===0){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setIndex(indices);
  const sheet=new T.Mesh(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},power:{value:0}},
   vertexShader:'varying vec2 waterUv; void main(){waterUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 waterUv; uniform float time; uniform float power;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){vec2 p=vec2(waterUv.x*14.-time*9.,waterUv.y*7.);float n=noise(p)+.35*noise(p*2.7);
     float edge=sin(waterUv.y*3.14159),tail=1.-smoothstep(.65,1.,waterUv.x);
     float foam=smoothstep(.74,1.12,n),holes=smoothstep(.16,.55,n);
     vec3 color=mix(vec3(.19,.48,.58),vec3(.85,.98,1.),foam);
     gl_FragColor=vec4(color,power*edge*tail*holes*(.24+.66*foam));
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`}));sheet.frustumCulled=false;group.add(sheet);
  const drops=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:0xe1f6ff,size:.036,transparent:true,opacity:0,depthWrite:false,sizeAttenuation:true}));
  drops.geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));drops.frustumCulled=false;group.add(drops);
  return{emitter,sheet,drops,origin:new T.Vector3()};
 });
 let disposed=false;
 function clear(){group.visible=false;for(const a of streams){a.sheet.visible=false;a.drops.visible=false;}}
 function update(skill,t,{cancelled=false,dying=false}={}){
  clear();if(disposed||cancelled||dying)return;
  const phase=gillWaterPhase(skill,t);if(!phase.gather&&!phase.release)return;
  group.visible=true;
  for(const a of streams){
   a.emitter.worldPosition(origin);a.emitter.worldNormal(normal);a.origin.copy(origin);
   side.crossVectors(normal,up);if(side.lengthSq()<1e-6)side.set(1,0,0);else side.normalize();vertical.crossVectors(side,normal).normalize();
   // A coherent tapered sheet anchored at the surface, breaking into dispersed
   // droplets. Deterministic from clip time; seeking/resetting leaves no trails.
   if(phase.release){
    const length=.18+2.8*smooth(Math.min(1,phase.age/.22));
    const p=a.sheet.geometry.attributes.position;
    for(let i=0;i<=steps;i++){
     const u=i/steps,width=(.07+.48*u)*Math.sin(Math.PI*(.15+.85*u)),wave=Math.sin(u*14-t*.013)*.07*u;
     for(let e=0;e<2;e++){
      const across=(e?1:-1)*width,along=u*length;
      p.setXYZ(i*2+e,origin.x+normal.x*along+side.x*across+vertical.x*wave,origin.y+normal.y*along+side.y*across+vertical.y*wave-.34*u*u,origin.z+normal.z*along+side.z*across+vertical.z*wave);
     }
    }
    p.needsUpdate=true;a.sheet.material.uniforms.time.value=t/1000;a.sheet.material.uniforms.power.value=phase.release*(reduced?.65:.9);a.sheet.visible=true;
   }
   const p=a.drops.geometry.attributes.position;
   for(let i=0;i<count;i++){
    const seed=(i*.61803398875)%1,angle=i*2.39996322973;
    const travel=phase.release?Math.max(0,phase.age-seed*.16):0;
    const radius=phase.release?.03+travel*(.3+seed*.65):(.05+.16*seed)*(1-.3*phase.gather);
    const along=phase.release?travel*(2.3+seed*2):.04;
    const dx=Math.cos(angle+t*.002)*radius,dy=Math.sin(angle+t*.002)*radius;
    p.setXYZ(i,origin.x+normal.x*along+side.x*dx+vertical.x*dy,origin.y+normal.y*along+side.y*dx+vertical.y*dy-1.2*travel*travel,origin.z+normal.z*along+side.z*dx+vertical.z*dy);
   }
   p.needsUpdate=true;a.drops.material.opacity=phase.release*.7+phase.gather*.38;a.drops.visible=true;
  }
 }
 clear();return{group,streams,update,clear,budget:{drawCalls:4,sheetTriangles:steps*4,droplets:count*2},dispose(){if(disposed)return;clear();disposed=true;for(const a of streams)for(const obj of [a.sheet,a.drops]){obj.geometry.dispose();obj.material.dispose();}group.removeFromParent();}};
}
