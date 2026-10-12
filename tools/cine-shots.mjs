/* 게임 화면 = 회색 상자(graybox) — AI 실사화 입력 뽑기 (문서 230 §3)
   «블렌더 상자 장면 → 힉스필드가 실사로» 영상(머니스웨거)의 흐름을 우리 쪽에 맞춘 것: 블렌더 대신 3D 필드 자체가 구도·카메라를 정하고,
   AI 는 질감·빛만 입힌다. HUD·이름표를 숨긴 깨끗한 1920x1080 장면 + 장면마다 프롬프트(cine-shots.json)를 쓴다.
     node tools/serve.cjs &
     node tools/cine-shots.mjs [out=docs/gpt/cine] [zones=namsan,gangnam] [tod=dusk]
   크레딧이 있으면 이 PNG 를 힉스필드 image-to-image / image-to-video 시작 프레임으로 넣는다(같은 구도로 실사 키아트 · 예고편 컷). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const A = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const OUT = A.out || 'docs/gpt/cine', ZONES = (A.zones || 'namsan,gangnam').split(','), TOD = A.tod || 'dusk', PORT = A.port || 8777;
/* 해를 등지고(역광) 낮게 · 옆으로 비껴 · 내려다보며 — 영화에서 흔한 세 구도 */
export const SHOTS = [
  { id: 'backlit-low', off: 0, back: 4.2, up: 1.1, look: 6, note: 'low angle, hero silhouetted against the setting sun, light shafts through debris' },
  { id: 'three-quarter', off: 0.6, back: 5, up: 1.6, look: 4, note: 'three-quarter side view, rim light on the hero, layered haze in depth' },
  { id: 'establishing', off: 2.6, back: 14, up: 7, look: 0, note: 'high establishing shot of the ruined district at dusk, atmospheric perspective' },
];
const STYLE = 'photoreal cinematic still, post-apocalyptic Korea at dusk, overgrown ruined city, volumetric god rays, golden haze, wet ground reflections, anamorphic lens, film grain, keep exact composition and camera of the input frame';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), list = [];
for (const z of ZONES) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); p.on('pageerror', e => console.log('ERR', z, e.message));
  await p.goto(`http://127.0.0.1:${PORT}/world3d.html?zone=${z}&offline=1&tod=${TOD}`);
  await p.waitForFunction(() => window.__W3D && window.__W3D.frames > 20, null, { timeout: 300000 });
  for (const s of SHOTS) {
    const f0 = await p.evaluate(s => { const W = window.__W3D, f = new W.cam.position.constructor(); W.cam.getWorldDirection(f);
      window.__H = window.__H || W.cam.position.clone().addScaledVector(f, 6); const h = window.__H, a = Math.atan2(W.sunDir.x, W.sunDir.z) + s.off;
      document.getElementById('hud').style.visibility = 'hidden'; document.querySelectorAll('.tag,#regionCard,#areaBan').forEach(t => t.style.visibility = 'hidden');
      W.view([h.x - Math.sin(a) * s.back, h.y + s.up, h.z - Math.cos(a) * s.back], [h.x + Math.sin(a) * 40, h.y + s.look, h.z + Math.cos(a) * 40]); return W.frames; }, s);
    await p.waitForFunction(f => window.__W3D.frames > f + 12, f0, { timeout: 300000 });   /* 헤드리스는 초당 1~2 프레임 — 벽시계 말고 프레임을 센다 */
    const file = `${z}-${s.id}.png`; await p.screenshot({ path: `${OUT}/${file}` });
    list.push({ file, zone: z, tod: TOD, shot: s.id, prompt: `${STYLE}; ${s.note}` }); console.log(file); }
  await p.close(); }
fs.writeFileSync(`${OUT}/cine-shots.json`, JSON.stringify(list, null, 1)); await b.close();
