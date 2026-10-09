/* 서버 CommonJS 모듈을 브라우저에서 그대로 읽는다 (문서 206 §6) — 3D 필드가 «서버와 같은» 지배형 AI(server/field-dominator.cjs)를 돌리려고.
   AI 를 브라우저용으로 다시 쓰면 두 벌이 갈라진다. 상대 경로 require('./x.cjs') 만 따라간다 (순수 표·규칙 모듈만 — node 내장은 거절). */
const cache = new Map();
export function loadCjs(url) {
  const abs = new URL(url, location.href).href;
  if (cache.has(abs)) return cache.get(abs);
  const task = (async () => {
    const res = await fetch(abs); if (!res.ok) throw Error("모듈을 못 읽었다 " + res.status + " " + abs);   /* 없는 모듈(서버 합치기 전 등)은 실패로 — HTML 404 를 코드로 돌리지 않는다 */
    const src = await res.text(), deps = {};
    for (const [, rel] of src.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) deps[rel] = await loadCjs(new URL(rel, abs).href);
    const module = { exports: {} };
    new Function('module', 'exports', 'require', src + '\n//# sourceURL=' + abs)(module, module.exports, n => { if (!(n in deps)) throw Error('브라우저에서 읽을 수 없는 모듈: ' + n + ' (' + abs + ')'); return deps[n]; });
    return module.exports;
  })();
  cache.set(abs, task); return task;
}
