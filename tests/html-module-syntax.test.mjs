/* 큰 HTML 의 인라인 모듈 스크립트 문법 검사 — world3d.html 에 `} BUFF.tick(dt);` 를 if/else 사이에 끼워 넣어 페이지 전체가 SyntaxError 로 안 열렸는데 npm test 는 통과했다(문서 229 §31).
   문자열 비교 시험은 문법을 보지 않는다 → 스크립트를 떼어 node --check 로 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
const PAGES = fs.readdirSync('.').filter(f => f.endsWith('.html')).sort();   /* 루트 페이지 전부 — 인라인 모듈이 있는 것만 검사, world3d 는 꼭 있어야 */
export function moduleScripts(html) { return [...html.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim()); }
for (const page of PAGES) test(page + ': 인라인 모듈 스크립트가 문법상 맞다', () => {
  const scripts = moduleScripts(fs.readFileSync(page, 'utf8')); if (page === 'world3d.html') assert.ok(scripts.length, 'world3d 모듈 스크립트'); if (!scripts.length) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsyn-'));
  scripts.forEach((src, i) => { const f = path.join(dir, `${path.basename(page, '.html')}-${i}.mjs`); fs.writeFileSync(f, src);
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { assert.fail(page + ' 스크립트 ' + i + ' 문법 오류:\n' + String(e.stderr).split('\n').slice(0, 6).join('\n')); } });
  fs.rmSync(dir, { recursive: true, force: true });
});
