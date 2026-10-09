/* 휴대폰 무게 재기 (문서 211) — ?debug=1 이면 화면 왼쪽 위에 초당 프레임 · 느린 1% 프레임 시간 · 그리기 호출 · 삼각형을 띄운다.
   호출·삼각형은 «한 프레임 전체 합»(renderer.info.autoReset 끔 → 프레임 시작에 begin() 으로 비움) — 그림자 패스 포함.
   예전 2D 표시는 화면 합성(bloom) 뒤라 마지막 패스(호출 1 · 삼각형 0k)만 보여 줬다.
   30초마다 요약 한 줄(평균 · 가장 낮은 1초)을 남긴다 — 폰 화면을 찍어 보내기 좋게. */
export function createPerfMeter({ renderer, el = null, extra = () => '' }) {
  const ft = [], win = []; let last = performance.now(), acc = 0, n = 0, calls = 0, tris = 0, fps = 0, p1 = 0, summary = '';
  renderer.info.autoReset = false;
  const meter = {
    begin() { renderer.info.reset(); },
    end() {
      const now = performance.now(), dt = now - last; last = now; ft.push(dt); if (ft.length > 300) ft.shift();
      const r = renderer.info.render; calls = r.calls; tris = r.triangles; acc += dt; n++;
      if (acc < 1000) return;
      fps = n * 1000 / acc; acc = 0; n = 0;
      const s = [...ft].sort((a, b) => b - a); p1 = s[Math.floor(s.length * 0.01)] || 0;
      win.push(fps); if (win.length >= 30) { summary = '30초 평균 ' + (win.reduce((a, b) => a + b, 0) / win.length).toFixed(0) + ' · 가장 낮은 1초 ' + Math.min(...win).toFixed(0); win.length = 0; }
      if (el) el.textContent = 'fps ' + fps.toFixed(0) + ' · 느린 1% ' + p1.toFixed(0) + 'ms\n콜 ' + calls + ' · 삼각형 ' + (tris / 1000).toFixed(0) + 'k\n픽셀비 ' + renderer.getPixelRatio().toFixed(2) + extra() + (summary ? '\n' + summary : '');   /* 짧은 줄 여럿 — 폰 가로 폭에서 미니맵·안내 띠를 덮지 않게 */
    },
    get stats() { return { fps: +fps.toFixed(1), p1: +p1.toFixed(1), calls, tris, summary }; },
  };
  return meter;
}
