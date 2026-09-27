/* 황혼 — 무기 궤적 · 칼바람
   날의 세계 좌표를 프레임마다 모아 리본 두 겹을 만든다. 안쪽 띠는 «궤적»(밝고 얇게),
   바깥 띠는 «바람»(넓고 흐리게). 실제 날보다 길게 잡아 궤도가 크게 보이도록 한다.
   자루까지 채우면 부채꼴 «덩어리» 가 되므로 날 구간만 남긴다.
   히트스톱 동안에는 점이 갱신되지 않아 궤적이 그대로 멈췄다가 다시 이어진다.
   솔로(js/game3d.js)와 온라인(js/party-avatar.js)이 같은 연출을 공유한다. */
import * as T from '../vendor/three/three.module.js';

/* P0 전투 질감:
   플레이어 낫은 보스의 0.3 s 링 잔상과 다르다. 짧고 얇게 지나가고, 명중은 접점 반응으로 읽힌다.
   MAX_SEG 는 저FPS에서 두 표본 사이가 큰 삼각형/판으로 벌어지는 것을 막는 재표본 간격(m). */
const TRN=64, MAX_SEG=0.22;
/* 큰 기술 «큼지막» 스위치 — 검수용 A/B (window.TW_BIG_SKILLS=false 로 끔) */
const BIG=()=>typeof window==='undefined'||window.TW_BIG_SKILLS!==false;
const INNER=[0.76,0.70], OUTER=[1.03,1.08], BRIGHT=[0.80,0.18], ALPHA=[0.72,0.16];
/* 꼬리 테이퍼 (문서 121 §2): 꼬리 폭 = 머리의 TAPER_MIN 배, 폭·밝기 곡선 지수, 안쪽 가장자리 밝기(날끝 대비).
   정점색은 «선형» 공간이다 — 화면(sRGB)에서 반으로 보이려면 선형으로는 ~0.2 라서,
   밝기 지수는 감마(≈2.2)만큼 세게, 안쪽 가장자리는 0 에 가깝게 둔다 (0.12 로는 화면에서 0.35 로 보여 판이 그대로였다).
   값은 스매시 «판» 을 줄이는 쪽으로 잡은 시안(근거 없음) */
const TAPER_MIN=0.2, TAPER_W=0.8, TAPER_A=2.2, EDGE_IN=0.0;
export function trailLifetime(power){ return BIG()&&power>=1.5?0.17:0.11; }

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
    case 'opening': return [2.0, 0xFFC878];   /* 카운터 뒤 일시 탭 — 부위 파괴·붙잡기 (docs/design/78) */
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
    const m=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:alpha,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false});   /* v12: 블룸 없는 경로(저사양·bloom 끔)에서 톤매핑 노출 2.2 배가 꼬리의 어두운 정점색까지 끌어올려 «흰 판» 이 됐다 — 궤적은 톤매핑 제외 */
    const mesh=new T.Mesh(g,m); mesh.frustumCulled=false; mesh.renderOrder=3; mesh.visible=false; this.scene.add(mesh); return mesh;
  }
  /* 무기 GLB 규약: 원점 = 자루 끝, +Y 자루 방향. 무기 «로컬» 좌표에서 길이를 재야
     그 순간의 자세에 휘둘리지 않는다. */
  measure(weapon){
    if(!weapon) return; weapon.updateMatrixWorld(true);
    this.bladeRoot=weapon.getObjectByName('AinBladeRoot');this.bladeTip=weapon.getObjectByName('AinBladeTip');
    if(this.bladeRoot&&this.bladeTip){this.measured=true;return;}
    const inv=new T.Matrix4().copy(weapon.matrixWorld).invert(), box=new T.Box3(); let got=false;
    weapon.traverse(o=>{ if(o.isMesh&&o.geometry){ o.geometry.computeBoundingBox(); if(!o.geometry.boundingBox) return;
      const bb=o.geometry.boundingBox.clone(); bb.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,o.matrixWorld)); box.union(bb); got=true; } });
    if(!got){ /* 아직 메시가 안 붙었다 — 몇 번만 더 보고 포기한다 (매 프레임 재측정 방지) */
      this.tries=(this.tries||0)+1; if(this.tries>30) this.measured=true; return; }
    this.tipY=Math.max(0.5, box.max.y); this.baseY=0; this.measured=true;
  }
  set(power, hex){ this.power=power||1; this.hue.setHex(hex==null?0xBFD8E8:hex); }
  _push(weapon){
    weapon.updateMatrixWorld(true);
    const b=this.bladeRoot?this.bladeRoot.getWorldPosition(new T.Vector3()):new T.Vector3(0,this.baseY,0).applyMatrix4(weapon.matrixWorld);
    const t=this.bladeTip?this.bladeTip.getWorldPosition(new T.Vector3()):new T.Vector3(0,this.tipY,0).applyMatrix4(weapon.matrixWorld);
    const prev=this.pts[0];
    if(!prev){ this.pts.unshift({b,t,age:0}); return; }
    /* 프레임이 끊겨도 이전 tip→현재 tip 사이를 최대 22 cm 간격으로 메운다.
       한 프레임에 지나치게 많은 버텍스를 만들지 않도록 8분할 상한. */
    const steps=Math.max(1,Math.min(8,Math.ceil(prev.t.distanceTo(t)/MAX_SEG)));
    for(let i=1;i<=steps;i++){
      const q=i/steps;
      this.pts.unshift({
        b:prev.b.clone().lerp(b,q),
        t:prev.t.clone().lerp(t,q),
        age:0
      });
    }
    if(this.pts.length>TRN)this.pts.length=TRN;
  }
  _write(mesh, under, over, bright){
    const n=this.pts.length;
    if(n<3){ mesh.visible=false; return; }
    mesh.visible=true;
    const pos=mesh.geometry.attributes.position.array, col=mesh.geometry.attributes.color.array;
    const life=trailLifetime(this.power);
    for(let i=0;i<n;i++){
      const e=this.pts[i], b=e.b, t=e.t, k=Math.max(0,1-e.age/Math.max(.001,life)), o=i*6;
      const dx=t.x-b.x, dy=t.y-b.y, dz=t.z-b.z;
      /* 문서 121 §2: 꼬리로 갈수록 날끝 선(over) 쪽으로 가늘어지고 흐려진다.
         나이(age)만으로 흐리면 빠른 동작(스매시 내려찍기)은 점이 다 «젊어서» 균일하게 밝고,
         곧은 경로라 리본이 몸통 너비의 «판» 으로 읽혔다. 머리(i=0)는 예전과 같다. */
      const u=n>1?i/(n-1):0, keep=TAPER_MIN+(1-TAPER_MIN)*Math.pow(1-u,TAPER_W), inner=over-(over-under)*keep;
      pos[o]=b.x+dx*inner; pos[o+1]=b.y+dy*inner; pos[o+2]=b.z+dz*inner;
      pos[o+3]=b.x+dx*over; pos[o+4]=b.y+dy*over; pos[o+5]=b.z+dz*over;
      const a=k*k*bright*this.power*Math.pow(1-u,TAPER_A);
      /* 폭 방향 밝기: 날끝(over) 이 가장 밝고 안쪽으로 흐려진다. 예전엔 거꾸로(안쪽 a, 날끝 .35a)라
         안쪽 가장자리에 딱딱한 밝은 선이 서서 리본이 «판» 으로 읽혔다 (문서 121 §2). */
      col[o]=this.hue.r*a*EDGE_IN; col[o+1]=this.hue.g*a*EDGE_IN; col[o+2]=this.hue.b*a*EDGE_IN;
      col[o+3]=this.hue.r*a;       col[o+4]=this.hue.g*a;       col[o+5]=this.hue.b*a;
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
    const a=this.pts[0].t, b=this.pts[2].t, v=new T.Vector3().subVectors(a,b);
    if(v.lengthSq()<1e-5) return;
    const sp=new T.Sprite(new T.SpriteMaterial({map:glowTexture(),color:this.hue.getHex(),transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:0.5,toneMapped:false}));
    const big=(BIG()&&this.power>=1.6)?1.35:1;
    sp.position.copy(a); sp.scale.set(0.55*big,0.20*big,1); sp.material.opacity=0.32; this.scene.add(sp);   /* v12 보정: 0.9×0.35 → 0.55×0.20 — 스매시 때 노란 구름이 되지 않게 */
    this.streaks.push({o:sp,t:0,v:v.normalize().multiplyScalar(3.4)});
  }
  tick(dt, weapon, swinging){
    this._wind(dt);
    if(!weapon){ this.layers[0].visible=this.layers[1].visible=false; return; }
    if(this.weapon!==weapon){this.weapon=weapon;this.measured=false;this.pts=[];this.hold=0;this.bladeRoot=this.bladeTip=null;}
    if(!this.measured) this.measure(weapon);
    for(const p of this.pts)p.age+=dt;
    if(swinging)this._push(weapon);
    const life=trailLifetime(this.power);
    this.pts=this.pts.filter(p=>p.age<=life).slice(0,TRN);
    /* 자루→날 전체를 채우지 않는다. 날의 바깥 약 25~35%만 얇은 두 겹 리본으로 보인다. */
    const widen=BIG()?1+Math.max(0,this.power-1)*0.05:1;
    this._write(this.layers[0], INNER[0], OUTER[0], BRIGHT[0]);
    this._write(this.layers[1], INNER[1], OUTER[1]*widen, BRIGHT[1]);
    this.windT-=dt;
    if(swinging && this.power>=1.3 && this.windT<=0){ this.windT=0.07; this._spawnWind(); }   /* v12 보정: 0.045 → 0.07 s */
  }
  dispose(){
    for(const m of this.layers){ this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    for(const s of this.streaks){ this.scene.remove(s.o); s.o.material.dispose(); }
    this.layers=[]; this.streaks=[];
  }
}
