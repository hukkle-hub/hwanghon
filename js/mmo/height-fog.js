/* 높이 안개 (문서 230 §6) — 엘든 링 림그레이브처럼 땅 · 골짜기에 깔리는 안개. 높은 건물 꼭대기 · 산등성이는 위로 솟아 맑다.
   three 의 공용 안개 조각(ShaderChunk)을 고친다 — 모든 표준 재질 + 안개 쓰는 사용자 셰이더(연기 · 먼지 · 물거품)가 함께.
   세계 높이는 mvPosition 과 시점 행렬로 되돌린다: y = dot(viewMatrix[1].xyz, mvPosition.xyz) + cameraPosition.y
   (사용자 셰이더엔 transformed 가 없어 그걸로는 못 쓴다). 밀도 k·exp(-(y - y0)/H) 를 카메라→점 광선으로 적분(닫힌 꼴)해 선형 안개와 합친다.
   값은 상수(#define)로 굽는다 — 재질이 컴파일되기 전에 한 번 부른다. 끄기: install 을 안 부르면 three 원래 안개 그대로 */
export const HFOG = { on: false, k: 0, h: 0, y0: 0, max: 0, lt: 0 };
export function heightFogOd(k, h, y0, camY, ptY, d) {   /* 셰이더와 같은 식 — 시험용 */
  const ec = Math.exp(-(camY - y0) / h), ep = Math.exp(-(ptY - y0) / h), dy = ptY - camY;
  return Math.max(0, k * d * (Math.abs(dy) > .01 ? h * (ec - ep) / dy : ec));
}
/* n0: 지금 안개 시작 거리 — 날씨가 안개를 당기면(fogNear ↓) 깔린 안개도 n0 / fogNear 만큼(1~4 배) 짙어진다. 값을 #define 으로 굽기 때문에 날씨는 three 가 이미 모든 재질에 넘기는 fogNear 로 전한다 (문서 230 §15) */
export function installHeightFog(THREE, { k = .01, h = 5, y0 = 0, max = .75, lt = .12, n0 = 0 } = {}) {
  if (HFOG.on) return HFOG; const C = THREE.ShaderChunk, f = x => (+x).toFixed(5);
  C.fog_pars_vertex = C.fog_pars_vertex.replace('varying float vFogDepth;', 'varying float vFogDepth; varying float vFogWY;');
  C.fog_vertex = C.fog_vertex.replace('vFogDepth = - mvPosition.z;', 'vFogDepth = - mvPosition.z; vFogWY = dot( viewMatrix[ 1 ].xyz, mvPosition.xyz ) + cameraPosition.y;');
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', `varying float vFogDepth; varying float vFogWY;
	#define HF_K ${f(k)}
	#define HF_H ${f(h)}
	#define HF_Y0 ${f(y0)}
	#define HF_MAX ${f(max)}
	#define HF_LT ${f(lt)}
	#define HF_N0 ${f(n0)}`);
  C.fog_fragment = C.fog_fragment.replace('gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );', `{ float hfDy = vFogWY - cameraPosition.y, hfEc = exp( - ( cameraPosition.y - HF_Y0 ) / HF_H ), hfEp = exp( - ( vFogWY - HF_Y0 ) / HF_H );
		float hfKk = HF_K;
		#ifndef FOG_EXP2
		if ( HF_N0 > 0.0 ) hfKk *= clamp( HF_N0 / max( fogNear, 0.5 ), 1.0, 4.0 );
		#endif
		float hfOd = hfKk * vFogDepth * ( abs( hfDy ) > 0.01 ? HF_H * ( hfEc - hfEp ) / hfDy : hfEc );
		float hf = min( 1.0 - exp( - max( hfOd, 0.0 ) ), HF_MAX );
		gl_FragColor.rgb = mix( mix( gl_FragColor.rgb, fogColor, fogFactor ), fogColor * clamp( HF_LT / max( dot( fogColor, vec3( .2126, .7152, .0722 ) ), 1e-3 ), 1.2, 5.0 ), hf * ( 1.0 - fogFactor ) ); }   /* 깔린 안개는 하늘빛을 받아 먼 안개보다 밝다 — 안개색을 밝기 HF_LT 쪽으로(1.2~5 배). 해 질 녘 안개색은 선형 (0.04, 0.016, 0.04) 로 거의 검정이라 같은 색 · 2.4 배로는 땅과 구별이 안 됐다(재 보니 땅 (69,51,51) ↔ 안개 (73,54,57)) */`);
  if (!/vFogWY/.test(C.fog_fragment) || !/vFogWY/.test(C.fog_vertex)) throw new Error('height-fog: three 안개 조각 모양이 바뀌었다');
  return Object.assign(HFOG, { on: true, k, h, y0, max, lt, n0 });
}
