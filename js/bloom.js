/* 블룸 — 밝은 것이 «빛» 으로 보이게. 최소 구성 포스트 패스.
   vendor/three 에 EffectComposer 가 없어 직접 짠다. 세 장: 밝은 부분 뽑기 → 가로 흐림
   → 세로 흐림, 마지막에 원본과 더해 캔버스로. 흐림은 1/4(폰)·1/2(PC) 해상도라 싸다.

   깨지면 «검은 화면» 이다. 그래서:
     · 만들다 실패하면 null 을 돌려준다 — 부르는 쪽은 그냥 평소대로 그린다
     · 설정에서 끌 수 있다 (SET.bloom)
   docs/design/57-bloom.md */
import * as THREE from '../vendor/three/three.module.js';

const QUAD = new THREE.PlaneGeometry(2, 2);
const CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;

/* 밝은 부분만 남긴다. 장면은 이미 톤매핑을 거쳐 0~1 이므로 문턱은 1 보다 작아야 한다. */
const BRIGHT = `varying vec2 vUv; uniform sampler2D tSrc; uniform float thr; uniform float soft;
void main(){ vec3 c=texture2D(tSrc,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722));
 float k=smoothstep(thr, thr+soft, l); gl_FragColor=vec4(c*k, 1.0); }`;

/* 9탭 가우시안 한 축. dir 로 가로/세로를 고른다. */
const BLUR = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 dir;
void main(){ vec4 s=texture2D(tSrc,vUv)*0.227027;
 s+=texture2D(tSrc,vUv+dir*1.3846)*0.316216; s+=texture2D(tSrc,vUv-dir*1.3846)*0.316216;
 s+=texture2D(tSrc,vUv+dir*3.2308)*0.070270; s+=texture2D(tSrc,vUv-dir*3.2308)*0.070270;
 gl_FragColor=s; }`;

/* 합성 + sRGB 인코딩. 렌더 타깃에서 캔버스로 직접 그리므로 three 가 인코딩해 주지 않는다.
   CINE (3D 필드만, 문서 230): 빛줄기 더하기 · 해 쪽 대기 번짐 · 색보정(그림자 차게 · 밝은 데 따뜻하게 · 채도 조금 빼기 · S 곡선) · 가장자리 어둡게 */
const COMP = `varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform float amount;
#ifdef CINE
uniform sampler2D tShaft; uniform vec3 sunCol; uniform vec2 sunUv; uniform float sunK; uniform float aspect;
uniform float shaftAmt; uniform float haze; uniform vec3 shadowTint; uniform vec3 lightTint; uniform float sat; uniform float con; uniform float vig;
#endif
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055, step(vec3(0.0031308),c)); }
void main(){ vec3 c=texture2D(tScene,vUv).rgb + texture2D(tBloom,vUv).rgb*amount;
#ifdef CINE
 vec2 dv=(vUv-sunUv)*vec2(aspect,1.0); float d=length(dv);
 c+=sunCol*(texture2D(tShaft,vUv).rgb*shaftAmt + haze*exp(-d*3.2))*sunK;   /* 빛줄기 + 해 둘레 넓은 번짐(대기 산란 흉내) */
 float l=dot(c,vec3(.2126,.7152,.0722));
 c*=mix(shadowTint, lightTint, smoothstep(.02,.45,l));   /* 갈라 물들이기 */
 c=mix(vec3(l), c, sat);
#endif
 vec3 g=srgb(min(c,vec3(1.6)));
#ifdef CINE
 vec3 q=clamp(g,0.0,1.0); g=mix(g, q*q*(3.0-2.0*q), con);   /* S 곡선 — 중간은 그대로, 양끝을 민다 */
 vec2 e=(vUv-.5)*vec2(aspect*.62,1.0); g*=1.0-vig*smoothstep(.25,.9,dot(e,e)*1.6);
#endif
 gl_FragColor=vec4(g,1.0); }`;

/* 빛줄기 원천: 해 둘레의 밝은 것만(나무·건물 그림자는 어두워 빠진다) */
const SHAFT_SRC = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 sunUv; uniform float aspect; uniform float thr; uniform float rad;
void main(){ vec3 c=texture2D(tSrc,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722));
 float m=smoothstep(thr, thr+.22, l)*(1.0-smoothstep(0.0, rad, length((vUv-sunUv)*vec2(aspect,1.0))));
 gl_FragColor=vec4(vec3(m)*(.35+.65*l),1.0); }`;

/* 해 쪽으로 번지는 방사 흐림 (GPU Gems 3 13 장). 28 탭, 픽셀마다 시작점을 흔들어 띠를 없앤다 */
const SHAFT_BLUR = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 sunUv; uniform float len;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){ vec2 d=(vUv-sunUv)*len/28.0; vec2 uv=vUv-d*h(vUv*311.0); float w=1.0; vec3 s=vec3(0.0); float tot=0.0;
 for(int i=0;i<28;i++){ s+=texture2D(tSrc,uv).rgb*w; tot+=w; w*=.965; uv-=d; }
 gl_FragColor=vec4(s/tot*1.6,1.0); }`;

function pass(frag, uniforms, defines){
  const m = new THREE.ShaderMaterial({ vertexShader:VERT, fragmentShader:frag, uniforms, defines:defines||{},
    depthTest:false, depthWrite:false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(QUAD, m)); return { scene:s, mat:m };
}

export function createBloom(renderer, opt){
  try{
    const o = Object.assign({ div:4, threshold:0.62, soft:0.28, amount:0.85, samples:0 }, opt||{});
    const rtOpt = { minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter,
      format:THREE.RGBAFormat, type:THREE.UnsignedByteType, depthBuffer:true, stencilBuffer:false };
    const blurOpt = Object.assign({}, rtOpt, { depthBuffer:false });
    /* samples: 블룸을 켜면 캔버스 안티에일리어싱이 안 먹는다 — 장면 타깃에 MSAA 를 건다(기본 0, 2D 맵 시제품이 4) */
    const rtScene = new THREE.WebGLRenderTarget(2, 2, Object.assign({}, rtOpt, { samples:o.samples }));
    const rtA = new THREE.WebGLRenderTarget(2, 2, blurOpt);
    const rtB = new THREE.WebGLRenderTarget(2, 2, blurOpt);
    const bright = pass(BRIGHT, { tSrc:{value:null}, thr:{value:o.threshold}, soft:{value:o.soft} });
    const blur   = pass(BLUR,   { tSrc:{value:null}, dir:{value:new THREE.Vector2()} });
    const C = o.cine ? Object.assign({ shaft:2.2, haze:.26, thr:.42, rad:.6, len:.95, shadowTint:[.91,1.0,1.03], lightTint:[1.07,1.01,.88], sat:.88, con:.24, vig:.22 }, o.cine) : null;
    const cu = C ? { tShaft:{value:null}, sunCol:{value:new THREE.Color(1,.8,.6)}, sunUv:{value:new THREE.Vector2(.5,.5)}, sunK:{value:0}, aspect:{value:1},
      shaftAmt:{value:C.shaft}, haze:{value:C.haze}, shadowTint:{value:new THREE.Vector3(...C.shadowTint)}, lightTint:{value:new THREE.Vector3(...C.lightTint)}, sat:{value:C.sat}, con:{value:C.con}, vig:{value:C.vig} } : {};
    const comp   = pass(COMP,   Object.assign({ tScene:{value:null}, tBloom:{value:null}, amount:{value:o.amount} }, cu), C ? { CINE:1 } : null);
    const rtC = C ? new THREE.WebGLRenderTarget(2, 2, blurOpt) : null;
    const sSrc = C && pass(SHAFT_SRC, { tSrc:{value:null}, sunUv:cu.sunUv, aspect:cu.aspect, thr:{value:C.thr}, rad:{value:C.rad} });
    const sBlur = C && pass(SHAFT_BLUR, { tSrc:{value:null}, sunUv:cu.sunUv, len:{value:C.len} });
    let w = 0, h = 0;

    function size(){
      const v = renderer.getDrawingBufferSize(new THREE.Vector2());
      if(v.x === w && v.y === h) return;
      w = Math.max(2, v.x); h = Math.max(2, v.y);
      rtScene.setSize(w, h);
      const bw = Math.max(2, Math.floor(w / o.div)), bh = Math.max(2, Math.floor(h / o.div));
      rtA.setSize(bw, bh); rtB.setSize(bw, bh); if(rtC) rtC.setSize(bw, bh); if(C) cu.aspect.value = w / h;
    }
    function draw(pass_, target){
      renderer.setRenderTarget(target);
      renderer.render(pass_.scene, CAM);
    }
    return {
      amount(v){ comp.mat.uniforms.amount.value = v; },
      dispose(){ rtScene.dispose(); rtA.dispose(); rtB.dispose(); if(rtC) rtC.dispose(); },
      cine: C ? cu : null,
      /* 해 위치(화면 0~1) · 세기(0 이면 빛줄기 패스를 건너뛴다) · 색 */
      sun(x, y, k, col){ if(!C) return; cu.sunUv.value.set(x, y); cu.sunK.value = k; if(col) cu.sunCol.value.copy(col); },
      render(scene, cam){
        size();
        renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, cam);
        bright.mat.uniforms.tSrc.value = rtScene.texture; draw(bright, rtA);
        const bw = rtA.width, bh = rtA.height;
        blur.mat.uniforms.tSrc.value = rtA.texture; blur.mat.uniforms.dir.value.set(1/bw, 0); draw(blur, rtB);
        blur.mat.uniforms.tSrc.value = rtB.texture; blur.mat.uniforms.dir.value.set(0, 1/bh); draw(blur, rtA);
        if(C && cu.sunK.value > 0.001){   /* 빛줄기: 해 둘레 밝은 것 → 방사 흐림 (1/4·1/2 해상도) */
          sSrc.mat.uniforms.tSrc.value = rtScene.texture; draw(sSrc, rtB);
          sBlur.mat.uniforms.tSrc.value = rtB.texture; draw(sBlur, rtC); cu.tShaft.value = rtC.texture; }
        else if(C){ cu.tShaft.value = rtA.texture; }
        comp.mat.uniforms.tScene.value = rtScene.texture;
        comp.mat.uniforms.tBloom.value = rtA.texture;
        renderer.setRenderTarget(null); draw(comp, null);
      }
    };
  }catch(e){
    return null;                                   /* 못 만들면 부르는 쪽이 평소대로 그린다 */
  }
}
