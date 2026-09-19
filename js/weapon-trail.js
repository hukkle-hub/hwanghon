/* 황혼 — 무기 궤적 · 칼바람
   날의 세계 좌표를 프레임마다 모아 리본 두 겹을 만든다. 안쪽 띠는 «궤적»(밝고 얇게),
   바깥 띠는 «바람»(넓고 흐리게). 실제 날보다 길게 잡아 궤도가 크게 보이도록 한다.
   자루까지 채우면 부채꼴 «덩어리» 가 되므로 날 구간만 남긴다.
   히트스톱 동안에는 점이 갱신되지 않아 궤적이 그대로 멈췄다가 다시 이어진다.
   솔로(js/game3d.js)와 온라인(js/party-avatar.js)이 같은 연출을 공유한다. */
import * as T from '../vendor/three/three.module.js';

const TRN=18;                                   /* 궤적 마디 수 */
const INNER=[0.58,0.50], OUTER=[1.34,1.95], BRIGHT=[0.72,0.22], ALPHA=[0.7,0.26];

let GLOW=null;
function glowTexture(){
  if(GLOW) return GLOW;
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d').createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.45)'); g.addColorStop(1,'rgba(255,255,255,0)');
  const x=c.getContext('2d'); x.fillStyle=g; x.fillRect(0,0,64,64);
  GLOW=new T.CanvasTexture(c); return GLOW;
}

/* 동작 종류 → 궤적 세기·색 */
export function trailStyle(kind, extra){
  switch(kind){
    case 'exec':    return [2.2, 0xFFB08A];
    case 'ult':     return [2.0, (extra|0)||0xC89A4A];
    case 'counter': return [1.8, 0xFFF1C8];
    case 'skill':   return [1.6, (extra|0)||0xC89A4A];
    case 'smash':   return [1.5, 0xE8D0A0];
    default:        return [1.0, 0xBFD8E8];
  }
}

export class WeaponTrail{
  constructor(scene){
    this.scene=scene; this.pts=[]; this.hold=0; this.power=1; this.hue=new T.Color(0xBFD8E8);
    this.tipY=1.25; this.baseY=0.2; this.measured=false; this.windT=0; this.streaks=[];
    this.layers=[0,1].map(i=>this._ribbon(ALPHA[i]));
  }
  _ribbon(alpha){
    const g=new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(TRN*2*3),3));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(TRN*2*3),3));
    const idx=[]; for(let i=0;i<TRN-1;i++){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
    g.setIndex(idx); g.setDrawRange(0,0);
    const m=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:alpha,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
    const mesh=new T.Mesh(g,m); mesh.frustumCulled=false; mesh.renderOrder=3; mesh.visible=false; this.scene.add(mesh); return mesh;
  }
  /* 무기 GLB 규약: 원점 = 자루 끝, +Y 자루 방향. 무기 «로컬» 좌표에서 길이를 재야
     그 순간의 자세에 휘둘리지 않는다. */
  measure(weapon){
    if(!weapon) return; weapon.updateMatrixWorld(true);
    const inv=new T.Matrix4().copy(weapon.matrixWorld).invert(), box=new T.Box3(); let got=false;
    weapon.traverse(o=>{ if(o.isMesh&&o.geometry){ o.geometry.computeBoundingBox(); if(!o.geometry.boundingBox) return;
      const bb=o.geometry.boundingBox.clone(); bb.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,o.matrixWorld)); box.union(bb); got=true; } });
    if(!got) return;
    this.tipY=Math.max(0.5, box.max.y); this.baseY=0; this.measured=true;
  }
  set(power, hex){ this.power=power||1; this.hue.setHex(hex==null?0xBFD8E8:hex); }
  _push(weapon){
    weapon.updateMatrixWorld(true);
    const b=new T.Vector3(0,this.baseY,0).applyMatrix4(weapon.matrixWorld);
    const t=new T.Vector3(0,this.tipY,0).applyMatrix4(weapon.matrixWorld);
    this.pts.unshift([b,t]); if(this.pts.length>TRN) this.pts.pop();
  }
  _write(mesh, under, over, bright){
    const n=this.pts.length;
    if(n<3){ mesh.visible=false; return; }
    mesh.visible=true;
    const pos=mesh.geometry.attributes.position.array, col=mesh.geometry.attributes.color.array;
    for(let i=0;i<n;i++){
      const [b,t]=this.pts[i], k=1-i/(n-1), o=i*6;
      const dx=t.x-b.x, dy=t.y-b.y, dz=t.z-b.z;
      pos[o]=b.x+dx*under; pos[o+1]=b.y+dy*under; pos[o+2]=b.z+dz*under;
      pos[o+3]=b.x+dx*over; pos[o+4]=b.y+dy*over; pos[o+5]=b.z+dz*over;
      const a=k*k*bright*this.power;
      col[o]=this.hue.r*a;      col[o+1]=this.hue.g*a;      col[o+2]=this.hue.b*a;
      col[o+3]=this.hue.r*a*.35; col[o+4]=this.hue.g*a*.35; col[o+5]=this.hue.b*a*.35;
    }
    mesh.geometry.attributes.position.needsUpdate=true; mesh.geometry.attributes.color.needsUpdate=true;
    mesh.geometry.setDrawRange(0,(n-1)*6);
  }
  /* 큰 동작에서는 날 끝에서 바람 줄기가 떨어져 나간다 */
  _wind(dt){
    for(let i=this.streaks.length-1;i>=0;i--){
      const s=this.streaks[i]; s.t+=dt; const k=Math.min(1,s.t/0.34);
      s.o.position.addScaledVector(s.v, dt); s.o.material.opacity=0.5*(1-k);
      s.o.scale.set(0.9+k*1.6, 0.35+k*0.25, 1);
      if(k>=1){ this.scene.remove(s.o); s.o.material.dispose(); this.streaks.splice(i,1); }
    }
  }
  _spawnWind(){
    if(this.pts.length<3) return;
    const a=this.pts[0][1], b=this.pts[2][1], v=new T.Vector3().subVectors(a,b);
    if(v.lengthSq()<1e-5) return;
    const sp=new T.Sprite(new T.SpriteMaterial({map:glowTexture(),color:this.hue.getHex(),transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:0.5}));
    sp.position.copy(a); sp.scale.set(0.9,0.35,1); this.scene.add(sp);
    this.streaks.push({o:sp,t:0,v:v.normalize().multiplyScalar(3.4)});
  }
  tick(dt, weapon, swinging){
    this._wind(dt);
    if(!weapon){ this.layers[0].visible=this.layers[1].visible=false; return; }
    if(!this.measured) this.measure(weapon);
    if(swinging){ this._push(weapon); this.hold=0.16; }
    else if(this.hold>0){ this.hold-=dt; if(this.pts.length) this.pts.pop(); }
    else if(this.pts.length) this.pts.pop();
    this._write(this.layers[0], INNER[0], OUTER[0], BRIGHT[0]);
    this._write(this.layers[1], INNER[1], OUTER[1], BRIGHT[1]);
    this.windT-=dt;
    if(swinging && this.power>=1.3 && this.windT<=0){ this.windT=0.045; this._spawnWind(); }
  }
  dispose(){
    for(const m of this.layers){ this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    for(const s of this.streaks){ this.scene.remove(s.o); s.o.material.dispose(); }
    this.layers=[]; this.streaks=[];
  }
}
