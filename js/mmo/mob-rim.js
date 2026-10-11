/* 밤 몬스터 윤곽 (문서 229 §32) — 영웅은 밤 달빛 윤곽(§24)으로 보이게 됐는데 몬스터는 밤에 검은 덩어리라, 싸울 상대가 오히려 안 보였다.
   영웅 패치(hero-rim)를 같이 쓰면 버프 몸빛까지 몬스터에 붙는다 → 따로(유니폼 · 캐시 키). 영웅보다 약하게(밤 0.2 · 영웅 0.32) — 영웅이 먼저 눈에 띄게.
   N01 몸 GLB 는 종마다 한 번 받아 마리마다 복제(재질은 공유)하므로, 받은 장면에 한 번 걸면 모든 마리에 먹는다 */
export const MOB_RIM = { uK: { value: 0 }, uC: { value: null }, n: 0 };
export const mobRimK = lampK => 0.2 * Math.max(0, Math.min(1, (lampK - 0.6) / 1.3));
export function mobRim(THREE, obj) {
  if (!MOB_RIM.uC.value) MOB_RIM.uC.value = new THREE.Color(0xb8c4ff);
  obj.traverse(o => { if (!o.isMesh) return;
    for (const m of [].concat(o.material)) { if (!m || !m.isMeshStandardMaterial || m.userData.mobRim) continue; m.userData.mobRim = true; MOB_RIM.n++;
      const prevBC = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.call(m) : '';
      m.onBeforeCompile = (sh, r) => { if (prevBC) prevBC.call(m, sh, r); sh.uniforms.uMobRimK = MOB_RIM.uK; sh.uniforms.uMobRimC = MOB_RIM.uC;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uMobRimK; uniform vec3 uMobRimC;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
#ifndef FLAT_SHADED
  vec3 mn = normalize(vNormal);
#else
  vec3 mn = normal;
#endif
  float mf = 1.0 - clamp(abs(dot(mn, normalize(vViewPosition))), 0.0, 1.0);
  totalEmissiveRadiance += uMobRimK * (uMobRimC * pow(mf, 3.0) * 0.7 + diffuseColor.rgb * uMobRimC * 0.25); }`); };
      m.customProgramCacheKey = () => 'mob-rim' + prevKey; m.needsUpdate = true; } });
}
