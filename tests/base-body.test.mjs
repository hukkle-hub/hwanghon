/* 속옷 차림 기본 체형 — 가져온 에셋(CC0 VRoid)을 캐릭터 골격에 얹은 결과 (docs/design/42).
   «파일이 있다» 로는 부족하다. 글턴을 뜯어 재질·뼈·크기를 재고,
   캐릭터마다 «다른 사람» 인지 확인한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHARS = ['ain', 'kain', 'ryu', 'sera'];
/* 몸체가 두 갈래다. 아인은 지피티가 Hi3D 로 뽑아 온 «그 사람 자신» 이고 (docs/design/41),
   나머지 셋은 CC0 에셋을 골격에 얹은 임시다 (docs/design/42). 공통 계약은 똑같이 건다. */
const KIND = {ain: 'hi3d', kain: 'vroid', ryu: 'vroid', sera: 'vroid'};
const VROID = CHARS.filter(c => KIND[c] === 'vroid');

function glb(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
    if (t === 0x4E4F534A) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString('utf8'));
    else if (t === 0x004E4942) bin = b.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  return {g: json, bin};
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
function imageBytes(m, match) {
  for (const im of m.g.images || []) {
    if (!match.test(im.name || '')) continue;
    const bv = m.g.bufferViews[im.bufferView];
    return m.bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  }
  return null;
}

test('네 캐릭터 모두 기본 체형이 있다', () => {
  for (const c of CHARS)
    assert.ok(fs.existsSync(path.join(ROOT, `art/3d/${c}_body.glb`)), `${c}_body.glb 없음`);
});

test('옷은 «가져오지 않았다» — 옷 재질이 한 조각도 남아 있으면 안 된다', () => {
  for (const c of VROID) {
    const {g} = glb(`art/3d/${c}_body.glb`);
    const cloth = (g.materials || []).filter(m => /_CLOTH$/.test(m.name || ''));
    assert.equal(cloth.length, 0, `${c}: 옷이 남았다 — ${cloth.map(m => m.name)}`);
    assert.ok((g.materials || []).some(m => /_SKIN$/.test(m.name || '')), `${c}: 살 재질이 없다`);
  }
});

test('움직이면 살이 따라온다 — 모든 조각이 뼈에 매여 있다', () => {
  for (const c of CHARS) {
    const {g} = glb(`art/3d/${c}_body.glb`);
    for (const me of g.meshes)
      for (const pr of me.primitives) {
        assert.ok(pr.attributes.JOINTS_0 != null, `${c}/${me.name}: 관절 가중치 없음`);
        assert.ok(pr.attributes.NORMAL != null, `${c}/${me.name}: 법선 없음`);
      }
  }
});

test('키가 그 캐릭터 골격과 같다', () => {
  /* 예전엔 14 cm 까지 봐줬더니 VRoid 머리카락이 두개골 위로 더 올라가
     아인이 175 cm 로 나왔는데도 통과했다. 3 cm 로 조인다. */
  for (const c of CHARS) {
    const dressed = height(glb(`art/3d/${c}_anim.glb`));
    const bare = height(glb(`art/3d/${c}_body.glb`));
    assert.ok(Math.abs(bare - dressed) < 0.03,
      `${c}: 입은 키 ${(dressed * 100).toFixed(1)} vs 맨몸 ${(bare * 100).toFixed(1)} cm — 비율이 어긋났다`);
  }
});

test('뼈대가 그 캐릭터 리그와 완전히 같다 — 장비·바람·초상이 그대로 돌아야 한다', () => {
  for (const c of CHARS) {
    const a = glb(`art/3d/${c}_anim.glb`), b = glb(`art/3d/${c}_body.glb`);
    const an = a.g.skins[0].joints.map(i => a.g.nodes[i].name).sort();
    const bn = b.g.skins[0].joints.map(i => b.g.nodes[i].name).sort();
    assert.deepEqual(bn, an, `${c}: 뼈 구성이 다르다`);
  }
});

test('캐릭터마다 체형이 다르다 — 골격에서 나온 값이므로', () => {
  const hs = CHARS.map(c => height(glb(`art/3d/${c}_body.glb`)));
  assert.ok(new Set(hs.map(h => h.toFixed(2))).size >= 3, `키가 다 같다: ${hs.map(h => h.toFixed(3))}`);
  assert.ok(Math.max(...hs) - Math.min(...hs) > 0.10, '가장 큰 사람과 작은 사람 차이가 10 cm 도 안 난다');
});

test('머리색이 캐릭터마다 다르다 — 가져온 에셋의 청록이 그대로 남으면 안 된다', () => {
  const seen = VROID.map(c => {
    const b = imageBytes(glb(`art/3d/${c}_body.glb`), /Hair/i);
    assert.ok(b, `${c}: 머리카락 텍스처가 없다`);
    return b.length + ':' + b.slice(0, 64).toString('hex');
  });
  assert.ok(new Set(seen).size >= seen.length,
    '가져온 에셋을 쓴 캐릭터끼리 머리카락 그림이 같다 — 색을 물들이지 못했다');
});

test('움직임 클립이 따라온다 — 외형 화면에서 자세를 고를 수 있어야 한다', () => {
  for (const c of CHARS) {
    const {g} = glb(`art/3d/${c}_body.glb`);
    const names = (g.animations || []).map(a => a.name);
    for (const need of ['idle', 'walk', 'attack1'])
      assert.ok(names.includes(need), `${c}: ${need} 클립 없음`);
  }
});

test('전화기로 받을 만한 크기다 — 옷 입은 본체보다 무거우면 안 된다', () => {
  for (const c of CHARS) {
    const body = fs.statSync(path.join(ROOT, `art/3d/${c}_body.glb`)).size / 1024;
    const anim = fs.statSync(path.join(ROOT, `art/3d/${c}_anim.glb`)).size / 1024;
    assert.ok(body < anim,
      `${c}: 맨몸 ${body.toFixed(0)} KB 가 옷 입은 본체 ${anim.toFixed(0)} KB 보다 무겁다`);
  }
});

test('텍스처는 JPEG 로 굽는다 — PNG 로 두면 아인만 7 MB 였다', () => {
  for (const c of CHARS) {
    const {g} = glb(`art/3d/${c}_body.glb`);
    const png = (g.images || []).filter(i => i.mimeType === 'image/png');
    const big = png.filter(i => g.bufferViews[i.bufferView].byteLength > 300 * 1024);
    assert.equal(big.length, 0,
      `${c}: 300 KB 넘는 PNG 텍스처 ${big.length}장 — JPEG 로 다시 구워야 한다`);
  }
});

test('가져온 에셋의 출처와 조건이 저장소에 남아 있다', () => {
  const dir = path.join(ROOT, 'art/3d/base');
  for (const f of ['vroid_female.vrm', 'vroid_male.vrm', 'mh_base.obj', 'README.md'])
    assert.ok(fs.existsSync(path.join(dir, f)), `${f} 가 없다 — 다시 구울 수 없다`);
  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  assert.match(readme, /CC0/, '라이선스 기록이 지워졌다');
  assert.match(readme, /VRoid/, 'VRoid 출처 기록이 지워졌다');
  const mh = fs.readFileSync(path.join(dir, 'mh_base.obj'), 'utf8').slice(0, 900);
  assert.match(mh, /CC0/, 'MakeHuman 라이선스 머리말이 지워졌다');
  for (const t of ['tools/3d/build_body.py', 'tools/3d/build_body_vroid.py',
                   'tools/3d/adopt_ain_body.py'])
    assert.ok(fs.existsSync(path.join(ROOT, t)), `${t} 가 없다`);
});

/* 가슴은 디렉터 지시로 도입 단계에서 키운다 (tools/3d/adopt_ain_body.py --bust).
   지피티 후보를 다시 받을 때 이 단계를 빠뜨리면 원래 몸으로 되돌아가므로 여기서 막는다.
   내보낸 글턴은 y 가 위, +z 가 «앞» 이다 (블렌더 −y → glTF +z). */
test('아인 몸체: 가슴이 도입 단계에서 키워져 있다', () => {
  const m = glb('art/3d/ain_body.glb');
  const pts = [];
  for (const me of m.g.meshes)
    for (const pr of me.primitives) pts.push(...positions(m, pr.attributes.POSITION));
  const at = (w) => pts.filter(p => Math.abs(p[1] - 1.245) < 0.008 && Math.abs(p[0]) < w);
  const apex = Math.max(...at(0.12).map(p => p[2]));
  const mid = Math.max(...at(0.012).map(p => p[2]));
  /* 원래 후보는 0.131 이었다. 22 mm 를 넣고 다듬으면 0.150 이 된다. */
  assert.ok(apex > 0.140 && apex < 0.200, `가슴 앞으로 ${apex.toFixed(3)} m — 키우는 단계가 빠졌나?`);
  /* 봉우리가 둘로 갈라져 있어야 한다. 한 덩어리면 가운데가 꼭대기와 같은 높이로 나온다.
     한때 18 mm 였는데, 그때는 한가운데가 «움푹 팬» 상태였다 — 무광 렌더로 보니 텍스처
     얼룩이 아니라 진짜 함몰이었다. 다듬기로 메워서 9~10 mm 가 정상이다 (docs/design/47 §7). */
  assert.ok(apex - mid > 0.006, `가운데가 ${((apex - mid) * 1000).toFixed(0)} mm 밖에 안 들어갔다`);
  assert.ok(apex - mid < 0.016, `가운데가 ${((apex - mid) * 1000).toFixed(0)} mm — 다시 움푹 팼나?`);
});
