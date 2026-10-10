/* 휴대폰 무게 재기 코스 (문서 220 §17) — ?bench=1. 정해진 장면(출발점 세 방향 · 사냥터 · 길 문 앞)을 차례로 보며
   장면마다 warm 초 예열 뒤 hold 초 동안 프레임을 센다. 끝나면 한 줄 요약(평균 · 가장 낮은 1초 · 장면별)을 돌려준다 —
   디렉터가 폰에서 열고 결과 카드를 복사해 보내면 된다(헤드리스는 초당 1~2 프레임이라 실제 값을 못 잰다).
   시계는 벽시계(ms) — 여기서는 «기기가 실제로 몇 프레임을 그리나» 가 재려는 값이다. */
export function createBench(views, { warm = 2000, hold = 8000, apply = () => {} } = {}) {
  let i = -1, t0 = 0, frames = 0, secStart = 0, secFrames = 0, secs = [], done = false, lastT = 0, hitch = 0, worst = 0; const out = [];   /* hitch: 120 ms 넘게 멈춘 프레임 수 · worst: 가장 긴 프레임(ms) */
  function next(now) { i++; if (i >= views.length) { done = true; return; } apply(views[i]); t0 = now; frames = 0; secs = []; secStart = now + warm; secFrames = 0; hitch = 0; worst = 0; lastT = 0; }
  return {
    get done() { return done; }, get index() { return i; }, get view() { return i >= 0 && i < views.length ? views[i] : null; }, get results() { return out.slice(); },
    tick(now) { if (done) return; if (i < 0) { next(now); return; }
      const el = now - t0; if (el < warm) { lastT = now; return; }
      frames++; if (lastT) { const d = now - lastT; if (d > 120) hitch++; if (d > worst) worst = d; } lastT = now; secFrames++; if (now - secStart >= 1000) { secs.push(secFrames * 1000 / (now - secStart)); secStart = now; secFrames = 0; }
      if (el >= warm + hold) { const fps = frames * 1000 / (el - warm); out.push({ name: views[i].name, fps: +fps.toFixed(1), low: +(secs.length ? Math.min(...secs) : fps).toFixed(1), hitch, worst: +worst.toFixed(0) }); next(now); } },
    summary(info = '') { if (!out.length) return ''; const avg = out.reduce((a, r) => a + r.fps, 0) / out.length, low = Math.min(...out.map(r => r.low));
      const hit = out.reduce((a, r) => a + (r.hitch || 0), 0), worstAll = Math.max(...out.map(r => r.worst || 0));
      return `평균 ${avg.toFixed(0)} fps · 가장 낮은 1초 ${low.toFixed(0)} · 멈춤 ${hit}회 (가장 긴 프레임 ${worstAll} ms)\n` + out.map(r => `${r.name} ${r.fps.toFixed(0)} (최저 ${r.low.toFixed(0)}${r.hitch ? ' · 멈춤 ' + r.hitch : ''})`).join(' · ') + (info ? '\n' + info : ''); },
  };
}
