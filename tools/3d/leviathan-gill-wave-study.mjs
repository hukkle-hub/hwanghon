// Review-only water front driven by the same metre-space contact/clock as the
// candidate hit window. Existing production effects and v79 study are preserved.
import * as T from '../../vendor/three/three.module.js';
import {loadCjs} from '../../js/mmo/cjs-browser.js';
export async function createGillWaveStudy(scene,{reduced=false}={}){
 const [profile,contact,wave]=await Promise.all([
  fetch(new URL('../../art/review/part1/leviathan-gill-contact.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Missing gill profile');return r.json()}),
  loadCjs(new URL('../../server/field-surface-contact.cjs',import.meta.url).href),
  loadCjs(new URL('../../server/field-surface-wave.cjs',import.meta.url).href),
 ]);
 const bound=contact.bindSurfaceContactProfile(profile);if(!bound)throw Error('Invalid gill profile');
 const group=new T.Group();group.name='ReviewOnlyGillWave';group.scale.setScalar(1/profile.scale);
 group.position.fromArray(profile.offset).multiplyScalar(-1/profile.scale);scene.add(group);
 const segments=reduced?24:48,rows=8;
 const streams=profile.surfaces.map(()=>{
  const geometry=new T.BufferGeometry(),positions=new Float32Array((segments+1)*(rows+1)*3),uv=new Float32Array((segments+1)*(rows+1)*2),index=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=segments;i++){
   const n=j*(segments+1)+i;uv.set([j/rows,i/segments],n*2);
   if(j<rows&&i<segments)index.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);
  }
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setIndex(index);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},opacity:{value:0}},
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 vUv; uniform float time; uniform float opacity;
   float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
   void main(){vec2 p=vec2(vUv.x*32.-time*9.,vUv.y*60.);float tex=n(p),fine=n(p*2.3);
    float crest=smoothstep(.82,1.,vUv.x),foam=smoothstep(.5,.8,tex*.7+fine*.3);
    float body=smoothstep(.05,.35,vUv.x)*(.08+.55*foam),edge=.4+.6*sin(vUv.y*3.14159);
    vec3 color=mix(vec3(.13,.4,.52),vec3(.9,.99,1.),max(crest*.7,foam));
    gl_FragColor=vec4(color,opacity*edge*max(body,crest*(.35+.55*fine)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;group.add(mesh);return mesh;
 });
 let disposed=false;
 function clear(){group.visible=false}
 function update(skill,t,state={}){
  clear();if(disposed)return;
  const f=wave.surfaceWaveFrame(skill,t,state);if(!f.front||!f.opacity)return;
  const cones=bound.contacts(skill,skill.hits[0]);if(cones.length!==streams.length)return;
  group.visible=true;
  cones.forEach((c,index)=>{
   const mesh=streams[index],p=mesh.geometry.attributes.position;
   for(let j=0;j<=rows;j++)for(let i=0;i<=segments;i++){
    const u=j/rows,radius=c.range*f.front*u,angle=c.yaw+c.angle*(i/segments-.5);
    // Preserve exact horizontal footprint, arc downward from the launch gill.
    // Small vertical ripples do not secretly enlarge the damaging sector.
    const y=c.origin.y*(1-radius/c.range)+.16*(radius/c.range)+Math.sin(i*.7-t*.013)*.14*Math.sin(u*Math.PI*.75);
    p.setXYZ(j*(segments+1)+i,c.origin.x+Math.sin(angle)*radius,y,c.origin.z+Math.cos(angle)*radius);
   }
   p.needsUpdate=true;mesh.material.uniforms.time.value=t/1000;mesh.material.uniforms.opacity.value=f.opacity;
  });
 }
 clear();return{group,streams,update,clear,budget:{drawCalls:2,triangles:segments*rows*4},dispose(){if(disposed)return;disposed=true;clear();streams.forEach(m=>{m.geometry.dispose();m.material.dispose()});group.removeFromParent()}};
}
