/* 밤에 영웅이 검은 그림자 (문서 229 §24) — 밤 노출 1.75 에도 영웅 몸·갑옷이 거의 검었다(달빛 0.22 · 금속 지도에 비출 환경 없음).
   보스 윤곽광(boss-stage rimify)처럼 «가장자리 달빛 + 앞면 살짝 밝힘»을 영웅 재질에만 더한다 — 빛을 하나 더 두면 장면 전체 셰이더가 무거워진다.
   세기는 시간대 lampK 로(낮 0 · 황혼 1 → 약하게 · 밤 1.9 → 또렷이). 장비는 나중에 붙으니 world3d watchLooks 가 새 메시마다 부른다.
   법선은 기하 법선(vNormal) — 법선 지도까지 넣으니 몸 전체가 반짝이 가루처럼 얼룩졌다.
   앞서 붙은 패치(wind.js 천 흔들림 등)는 이어 부른다 */
export const HERO_RIM = { uK: { value: 0 }, uC: { value: null }, n: 0 };
export const heroRimK = lampK => 0.32 * Math.max(0, Math.min(1, (lampK - 0.6) / 1.3));   /* 새벽·황혼(≤ 0.6~1) 거의 0 · 밤 1.9 → 0.32 (0.5 는 은빛 조각상) */
export function heroRim(THREE, obj) {
  if (!HERO_RIM.uC.value) HERO_RIM.uC.value = new THREE.Color(0x9fb4ff);
  obj.traverse(o => { if (!o.isMesh) return;
    for (const m of [].concat(o.material)) { if (!m || !m.isMeshStandardMaterial || m.userData.heroRim) continue; m.userData.heroRim = true; HERO_RIM.n++;
      const prevBC = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.call(m) : '';
      m.onBeforeCompile = (sh, r) => { if (prevBC) prevBC.call(m, sh, r); sh.uniforms.uHeroRimK = HERO_RIM.uK; sh.uniforms.uHeroRimC = HERO_RIM.uC;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHeroRimK; uniform vec3 uHeroRimC;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
#ifndef FLAT_SHADED
  vec3 hn = normalize(vNormal);
#else
  vec3 hn = normal;
#endif
  float hf = 1.0 - clamp(abs(dot(hn, normalize(vViewPosition))), 0.0, 1.0);
  totalEmissiveRadiance += uHeroRimK * (uHeroRimC * pow(hf, 3.0) * 0.6 + diffuseColor.rgb * uHeroRimC * 0.35); }`); };
      m.customProgramCacheKey = () => 'hero-rim' + prevKey; m.needsUpdate = true; } });
}
