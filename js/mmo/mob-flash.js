/* 맞은 몸만 번쩍 (문서 229 §43) — 체력이 줄면 0.14 s 동안 밝게 달아올랐다(제곱으로 빨리) 식는다.
   재질은 종끼리 공유라 N01 몸은 마리마다 복제하되 셰이더 패치(밤 윤곽)와 캐시 열쇠를 그대로 넘겨 프로그램은 늘지 않는다(값만 다르다).
   - 바탕색을 곱해 밝힌다(무늬가 산다) + 발광은 «원래 + 흰빛 조금»(밤에도 보이게)
   - glTF 몸은 발광 세기 기본이 1(색만 검정)이라 «세기를 0.12 쪽으로 섞기» 는 오히려 0.76 짜리 평평한 회색 실루엣이었다(값을 찍어 보고 알았다) */
export const FLASH = { dur: 0.14, color: 5, glow: 0.12 };
export function ownMaterials(THREE, model) {
  const mats = []; model.traverse(o => { if (!o.isMesh) return; const arr = [].concat(o.material).map(m => { if (!m || !m.isMeshStandardMaterial) return m;
      const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; mats.push([c, c.emissive.clone(), c.emissiveIntensity, c.color.clone()]); return c; });
    o.material = Array.isArray(o.material) ? arr : arr[0]; });
  return { mats, t: 0, on: false, white: new THREE.Color(1, .93, .85), tmp: new THREE.Color() };
}
export const flashHit = F => { if (F) F.t = FLASH.dur; };
export function flashTick(F, dt) { if (!F || (F.t <= 0 && !F.on)) return 0; F.t = Math.max(0, F.t - dt); const k0 = F.t / FLASH.dur, k = k0 * k0; F.on = k0 > 0;
  for (const [c, e0, i0, c0] of F.mats) { c.color.copy(c0).multiplyScalar(1 + FLASH.color * k);
    if (k > 0) { c.emissive.copy(e0).multiplyScalar(i0).add(F.tmp.copy(F.white).multiplyScalar(FLASH.glow * k)); c.emissiveIntensity = 1; } else { c.emissive.copy(e0); c.emissiveIntensity = i0; } }
  return k; }
export const disposeFlash = F => F && F.mats.forEach(([c]) => c.dispose());
