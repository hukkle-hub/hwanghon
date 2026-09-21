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

/* 합성 + sRGB 인코딩. 렌더 타깃에서 캔버스로 직접 그리므로 three 가 인코딩해 주지 않는다. */
const COMP = `varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform float amount;
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055, step(vec3(0.0031308),c)); }
void main(){ vec3 c=texture2D(tScene,vUv).rgb + texture2D(tBloom,vUv).rgb*amount;
 gl_FragColor=vec4(srgb(min(c,vec3(1.6))),1.0); }`;

function pass(frag, uniforms){
  const m = new THREE.ShaderMaterial({ vertexShader:VERT, fragmentShader:frag, uniforms,
    depthTest:false, depthWrite:false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(QUAD, m)); return { scene:s, mat:m };
}

export function createBloom(renderer, opt){
  try{
    const o = Object.assign({ div:4, threshold:0.62, soft:0.28, amount:0.85 }, opt||{});
    const rtOpt = { minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter,
      format:THREE.RGBAFormat, type:THREE.UnsignedByteType, depthBuffer:true, stencilBuffer:false };
    const blurOpt = Object.assign({}, rtOpt, { depthBuffer:false });
    const rtScene = new THREE.WebGLRenderTarget(2, 2, rtOpt);
    const rtA = new THREE.WebGLRenderTarget(2, 2, blurOpt);
    const rtB = new THREE.WebGLRenderTarget(2, 2, blurOpt);
    const bright = pass(BRIGHT, { tSrc:{value:null}, thr:{value:o.threshold}, soft:{value:o.soft} });
    const blur   = pass(BLUR,   { tSrc:{value:null}, dir:{value:new THREE.Vector2()} });
    const comp   = pass(COMP,   { tScene:{value:null}, tBloom:{value:null}, amount:{value:o.amount} });
    let w = 0, h = 0;

    function size(){
      const v = renderer.getDrawingBufferSize(new THREE.Vector2());
      if(v.x === w && v.y === h) return;
      w = Math.max(2, v.x); h = Math.max(2, v.y);
      rtScene.setSize(w, h);
      const bw = Math.max(2, Math.floor(w / o.div)), bh = Math.max(2, Math.floor(h / o.div));
      rtA.setSize(bw, bh); rtB.setSize(bw, bh);
    }
    function draw(pass_, target){
      renderer.setRenderTarget(target);
      renderer.render(pass_.scene, CAM);
    }
    return {
      amount(v){ comp.mat.uniforms.amount.value = v; },
      dispose(){ rtScene.dispose(); rtA.dispose(); rtB.dispose(); },
      render(scene, cam){
        size();
        renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, cam);
        bright.mat.uniforms.tSrc.value = rtScene.texture; draw(bright, rtA);
        const bw = rtA.width, bh = rtA.height;
        blur.mat.uniforms.tSrc.value = rtA.texture; blur.mat.uniforms.dir.value.set(1/bw, 0); draw(blur, rtB);
        blur.mat.uniforms.tSrc.value = rtB.texture; blur.mat.uniforms.dir.value.set(0, 1/bh); draw(blur, rtA);
        comp.mat.uniforms.tScene.value = rtScene.texture;
        comp.mat.uniforms.tBloom.value = rtA.texture;
        renderer.setRenderTarget(null); draw(comp, null);
      }
    };
  }catch(e){
    return null;                                   /* 못 만들면 부르는 쪽이 평소대로 그린다 */
  }
}
