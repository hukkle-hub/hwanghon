/* N01 5급 갈아 끼운 손 피부 (문서 229 §29) — 보행자·질주자·파쇄자 손은 CC0 손으로 갈아 끼워 재질에 무늬가 없고 색 하나뿐이었다
   (`*CC0Hands_PBR` · `CC0ArticulatedHands_PBR`, baseColorTexture 없음). 같은 조명에서 재 보니 보행자 얼굴 (122,117,119) 인데 손 (123,125,147) —
   파랑이 24 높아 «푸르스름한 흰 장갑»이었다. 불러올 때 손 재질만: 얼굴 톤으로 따뜻하게·조금 어둡게 + 피부 얼룩 무늬(핏기·멍·감염 실핏줄) + 덜 매끈하게.
   GLB 는 그대로(다시 굽지 않는다). 무늬는 손 UV 위 — 몸짓에 따라 헤엄치지 않는다 */
export const SKIN = { n: 0 };
let tex = null;
function mottle(THREE) {
  if (tex) return tex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#f2ece8'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { const x = r() * S, y = r() * S, rad = 4 + r() * 22, k = r();   /* 핏기(붉음) · 멍(보라) · 창백(희게) */
    const col = k < .45 ? 'rgba(170,96,92,' : k < .7 ? 'rgba(112,92,128,' : 'rgba(255,250,246,'; const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, col + (.10 + r() * .12) + ')'); gr.addColorStop(1, col + '0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  g.strokeStyle = 'rgba(70,50,80,.22)'; g.lineWidth = 1;   /* 감염 실핏줄 — 몸 텍스처의 목 핏줄과 같은 결 */
  for (let i = 0; i < 26; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (r() - .5) * 26; y += (r() - .5) * 26; g.lineTo(x, y); } g.stroke(); }
  tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2); return tex;
}
export const HAND_RE = /CC0.*Hands/i;
/* 몸 장면 하나(공유 GLTF scene)에 한 번. 손 재질이 아니면 손대지 않는다 */
export function fixN01Skin(THREE, root) {
  const seen = new Set();
  root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m || seen.has(m) || !HAND_RE.test(m.name || '') || m.map) continue; seen.add(m);
    m.color.setRGB(.40, .31, .27);   /* 선형 — 이전 [0.42, 0.36, 0.35] 보다 덜 푸르게(파랑 −23 %). [0.43, 0.31, 0.245] 는 질주자 손이 주황(햇볕 탄 살)으로 갔다 — 감염체는 창백한 쪽 */
    m.map = mottle(THREE); m.roughness = .78; m.needsUpdate = true; SKIN.n++; } });
  return root;
}
