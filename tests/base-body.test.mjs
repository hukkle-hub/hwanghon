/* 속옷 차림 기본 체형 — 옷을 갈아입으려면 먼저 몸이 있어야 한다 (docs/design/40).
   «파일이 있다» 로는 부족하다. 실제로 글턴을 뜯어 뼈대·재질·크기를 재고,
   캐릭터 골격과 같은 비율인지 확인한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHARS = ['ain', 'kain', 'ryu', 'sera'];

function glb(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
    if (t === 0x4E4F534A) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString('utf8'));
    else if (t === 0x004E4942) bin = b.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  return {g: json, bin, bytes: b.length};
}
function positions({g, bin}, acc) {
  const a = g.accessors[acc], bv = g.bufferViews[a.bufferView];
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0), st = bv.byteStride || 12, out = [];
  for (let i = 0; i < a.count; i++) {
    const o = base + i * st;
    out.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)]);
  }
  return out;
}
function height(m) {
  let lo = Infinity, hi = -Infinity;
  for (const me of m.g.meshes)
    for (const pr of me.primitives)
      for (const p of positions(m, pr.attributes.POSITION)) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
  return hi - lo;
}

test('네 캐릭터 모두 기본 체형이 있다', () => {
  for (const c of CHARS)
    assert.ok(fs.existsSync(path.join(ROOT, `art/3d/${c}_body.glb`)), `${c}_body.glb 없음`);
});

test('몸과 속옷이 따로 있고, 둘 다 뼈에 매여 있다', () => {
  for (const c of CHARS) {
    const m = glb(`art/3d/${c}_body.glb`);
    const names = m.g.meshes.map(x => x.name);
    assert.ok(names.some(n => /_body$/.test(n)), `${c}: 몸 메시 없음 (${names})`);
    assert.ok(names.some(n => /_underwear$/.test(n)), `${c}: 속옷 메시 없음 (${names})`);
    for (const me of m.g.meshes)
      for (const pr of me.primitives) {
        assert.ok(pr.attributes.JOINTS_0 != null, `${c}/${me.name}: 관절 가중치 없음 — 움직이면 안 따라온다`);
        assert.ok(pr.attributes.NORMAL != null, `${c}/${me.name}: 법선 없음`);
      }
  }
});

test('살결과 속옷이 서로 다른 재질이다', () => {
  for (const c of CHARS) {
    const {g} = glb(`art/3d/${c}_body.glb`);
    const skin = g.materials.find(x => x.name === 'skin_' + c);
    const wear = g.materials.find(x => x.name === 'wear_' + c);
    assert.ok(skin, `${c}: 살 재질 없음`);
    assert.ok(wear, `${c}: 속옷 재질 없음`);
    const s = skin.pbrMetallicRoughness.baseColorFactor;
    // 살색은 붉은 쪽이 밝고, 회색도 검정도 아니어야 한다 (카인이 수염 때문에 검게 나온 적 있다)
    assert.ok(s[0] >= s[1] && s[1] >= s[2], `${c}: 살색이 살색이 아니다 ${s}`);
    assert.ok(s[0] > 0.20, `${c}: 살색이 너무 어둡다 ${s}`);
    assert.ok(s[0] - s[2] > 0.02, `${c}: 살색에 붉은 기가 없다 ${s}`);
    const w = wear.pbrMetallicRoughness.baseColorFactor;
    assert.ok(Math.max(w[0], w[1], w[2]) < 0.2, `${c}: 속옷이 어둡지 않다 ${w}`);
  }
});

test('키가 그 캐릭터 골격과 같다', () => {
  for (const c of CHARS) {
    const dressed = height(glb(`art/3d/${c}_anim.glb`));
    const bare = height(glb(`art/3d/${c}_body.glb`));
    // 옷·머리카락·부츠만큼 차이가 나지만, 사람이 바뀔 만큼은 아니어야 한다
    assert.ok(Math.abs(bare - dressed) < 0.12,
      `${c}: 입은 키 ${dressed.toFixed(3)} vs 맨몸 ${bare.toFixed(3)} — 비율이 어긋났다`);
  }
});

test('캐릭터마다 체형이 다르다 — 골격에서 나온 값이므로', () => {
  const hs = CHARS.map(c => height(glb(`art/3d/${c}_body.glb`)));
  const uniq = new Set(hs.map(h => h.toFixed(2)));
  assert.ok(uniq.size >= 3, `키가 다 같다: ${hs.map(h => h.toFixed(3))}`);
  assert.ok(Math.max(...hs) - Math.min(...hs) > 0.10, '가장 큰 사람과 작은 사람 차이가 10 cm 도 안 난다');
});

test('움직임 클립이 따라온다 — 외형 화면에서 자세를 고를 수 있어야 한다', () => {
  for (const c of CHARS) {
    const {g} = glb(`art/3d/${c}_body.glb`);
    const names = (g.animations || []).map(a => a.name);
    for (const need of ['idle', 'walk', 'attack1'])
      assert.ok(names.includes(need), `${c}: ${need} 클립 없음`);
  }
});

test('전화기로 받을 만한 크기다', () => {
  for (const c of CHARS) {
    const kb = fs.statSync(path.join(ROOT, `art/3d/${c}_body.glb`)).size / 1024;
    assert.ok(kb < 2200, `${c}: ${kb.toFixed(0)} KB — 너무 무겁다`);
  }
});

test('바탕이 된 CC0 메시와 만든 도구가 저장소에 있다', () => {
  const obj = path.join(ROOT, 'art/3d/base/mh_base.obj');
  assert.ok(fs.existsSync(obj), 'CC0 기본 메시가 없다 — 다시 구울 수 없다');
  const head = fs.readFileSync(obj, 'utf8').slice(0, 900);
  assert.match(head, /CC0/, '출처·라이선스 머리말이 지워졌다');
  assert.ok(fs.existsSync(path.join(ROOT, 'tools/3d/build_body.py')), '굽는 도구가 없다');
});
