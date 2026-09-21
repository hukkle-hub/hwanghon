/* tools/3d/check-hair-contract.mjs 가 아는 답을 내는지 — 검사기 자체의 회귀 방지.
   세라 맨몸은 눈으로 확인한 「후드 쓰면 깔끔하게 민머리」 (docs/img/45-hood.png) 이고,
   아인 맨몸은 통짜 메시라 못 숨긴다. 검사기가 이 둘을 갈라야 한다. */
import {test} from 'node:test';
import assert from 'node:assert';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (...f) => {
  try { return {code: 0, out: execFileSync(process.execPath,
    [join(ROOT, 'tools/3d/check-hair-contract.mjs'), ...f], {cwd: ROOT, encoding: 'utf8'})}; }
  catch (e) { return {code: e.status, out: (e.stdout || '') + (e.stderr || '')}; }
};

test('세라 맨몸은 네 항목을 전부 통과한다', () => {
  const r = run('art/3d/sera_body.glb');
  assert.equal(r.code, 0, r.out);
  for (const n of ['1 분리', '2 독점', '3 스킨', '4 두피'])
    assert.match(r.out, new RegExp('✔ ' + n), `${n} 이 통과가 아니다\n${r.out}`);
});

test('두피 검사는 메시 이음매를 구멍으로 세지 않는다', () => {
  /* 용접 전에는 세라가 178 개로 걸렸다. Body_SKIN 과 Face_SKIN 의 이음매였다. */
  const r = run('art/3d/sera_body.glb', 'art/3d/kain_body.glb', 'art/3d/ryu_body.glb');
  assert.equal(r.code, 0, r.out);
  assert.equal(r.out.match(/정수리 열린 모서리 0개/g)?.length, 3, r.out);
});

test('통짜 메시는 1 번에서 걸린다', () => {
  const r = run('art/3d/ain_anim.glb');
  assert.equal(r.code, 1);
  assert.match(r.out, /✘ 1 분리/);
  assert.match(r.out, /pbr_material/);
});
