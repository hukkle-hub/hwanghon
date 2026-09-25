/* 스킬 모션 타이밍 패스 (tools/3d/punch.py) 의 결과를 고정한다.
   클립의 «최고속이 나는 시각» 이 엔진의 판정 시각(js/dungeons.js motion.clipContacts)과
   맞아야 한다. 안 맞으면 휘두르는 그림과 판정이 따로 논다 — 고치기 전 skill3 은 −0.32,
   ult 는 −0.35 어긋나 있었다 (docs/design/49). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* exec·smash·attack3 은 아직 손대지 않는다 — tools/3d/punch.py 의 주석 참고 */
const PUNCHED = ['skill1', 'skill2', 'skill3', 'skill4', 'counter'];
const TRACK = ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'];
const FPS = 60;

/* ch 를 주면 clipContactsByChar[ch] 가 공통 값을 덮는다 (아인의 Meshy 클립, docs/design/74) */
function contacts(ch) {
  const src = fs.readFileSync(path.join(ROOT, 'js/dungeons.js'), 'utf8');
  const m = src.match(/clipContacts:\s*\{([^}]*)\}/);
  assert.ok(m, 'js/dungeons.js 에서 clipContacts 를 못 찾았다');
  const out = {};
  for (const [, k, v] of m[1].matchAll(/(\w+)\s*:\s*([0-9.]+)/g)) out[k] = parseFloat(v);
  const by = ch && src.match(/clipContactsByChar:\s*\{(.*)\}\s*$/m);
  const own = by && by[1].match(new RegExp('\\b' + ch + ':\\s*\\{([^}]*)\\}'));
  if (own) for (const [, k, v] of own[1].matchAll(/(\w+)\s*:\s*([0-9.]+)/g)) out[k] = parseFloat(v);
  return out;
}

function contactsByChar() {
  const src = fs.readFileSync(path.join(ROOT, 'js/dungeons.js'), 'utf8');
  const by = src.match(/clipContactsByChar:\s*\{(.*)\}\s*$/m), out = {};
  if (by) for (const [, ch, body] of by[1].matchAll(/(\w+):\s*\{([^}]*)\}/g)) out[ch] = Object.fromEntries([...body.matchAll(/(\w+)\s*:\s*([0-9.]+)/g)].map(([, k, v]) => [k, parseFloat(v)]));
  return out;
}

async function load(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  const l = new GLTFLoader();
  l.register(() => ({name: 'nr', loadTexture: () => Promise.resolve(new T.Texture())}));
  return l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}

function peakTime(root, mixer, bone, clip) {
  const act = mixer.clipAction(clip);
  mixer.stopAllAction();
  act.reset(); act.setLoop(T.LoopOnce, 1); act.clampWhenFinished = true; act.play();
  const N = Math.max(8, Math.round(clip.duration * FPS)), pts = [];
  for (let i = 0; i <= N; i++) {
    /* 끝에서 되감기며 한 프레임짜리 가짜 스파이크가 난다 — 0.998 로 잘라 피한다 */
    mixer.setTime(Math.min(clip.duration * 0.998, i / FPS));
    root.updateMatrixWorld(true);
    const hip = bone.Hips.getWorldPosition(new T.Vector3());
    /* 다시 리깅한 캐릭터(docs/design/77)는 손 관절이 손목으로 옮겨졌다(예전엔 손끝 근처). 같은 «메시 위
       점» 을 재야 하므로 glb 가 남긴 옛 관절 자리(rerigAnchor)를 잰다 — 손목을 재면 반지름이 짧아
       손이 20% 느리게 나와 발이 «최고속» 을 가져간다(지표 오류). */
    const at = n => { const a = bone[n].userData && bone[n].userData.rerigAnchor;
      return a ? bone[n].localToWorld(new T.Vector3(a[0], a[1], a[2])) : bone[n].getWorldPosition(new T.Vector3()); };
    pts.push(TRACK.filter(n => bone[n]).map(n => at(n).sub(hip)));
  }
  let best = 0, bi = 0;
  for (let i = 1; i < pts.length; i++) {
    const s = Math.max(...pts[i].map((p, k) => p.distanceTo(pts[i - 1][k])));
    if (s > best) { best = s; bi = i; }
  }
  act.stop();
  return {t: (bi - 0.5) / (pts.length - 1), speed: best * FPS};
}

for (const ch of ['ain', 'kain', 'ryu', 'sera']) {
  test(`${ch}: 스킬 클립의 최고속이 판정 시점과 맞는다`, async () => {
    const C = contacts(ch);
    const g = await load(`art/3d/${ch}_anim.glb`);
    const root = g.scene; root.updateMatrixWorld(true);
    const bone = {};
    root.traverse(o => { if (o.isBone) bone[o.name.replace(/^mixamorig:?/, '')] = o; });
    const mixer = new T.AnimationMixer(root);
    /* 아인의 Meshy 클립(docs/design/74)은 양손 리그가 팔을 통째로 다시 풀어서 «원본 손»
       이 화면에 안 나온다 — 화면의 날끝은 tools/3d/swing-measure.html 로 잰다
       (접점 감속·거칠기, 74번 표). 여기서는 원본 손을 쓰는 클립만 본다. */
    const OWN = ch === 'ain' ? new Set(Object.keys(contactsByChar().ain || {})) : new Set();
    for (const name of PUNCHED) {
      if (OWN.has(name)) continue;
      const clip = g.animations.find(a => a.name === name);
      if (!clip || C[name] == null) continue;
      const {t} = peakTime(root, mixer, bone, clip);
      assert.ok(Math.abs(t - C[name]) < 0.12,
        `${ch}/${name}: 최고속 ${t.toFixed(3)} vs 판정 ${C[name]} — ${(t - C[name]).toFixed(3)} 어긋남`);
    }
  });
}

test('punch.py 의 접점 표가 js/dungeons.js 와 같다', () => {
  const C = contacts();
  const py = fs.readFileSync(path.join(ROOT, 'tools/3d/punch.py'), 'utf8');
  const m = py.match(/CONTACT = \{([\s\S]*?)\}/);
  assert.ok(m, 'punch.py 에서 CONTACT 를 못 찾았다');
  const out = {};
  for (const [, k, v] of m[1].matchAll(/'(\w+)':\s*([0-9.]+)/g)) out[k] = parseFloat(v);
  for (const k of Object.keys(C))
    assert.equal(out[k], C[k], `${k} 가 어긋난다 — punch.py ${out[k]} vs dungeons.js ${C[k]}`);
});
