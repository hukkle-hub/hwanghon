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

function contacts() {
  const src = fs.readFileSync(path.join(ROOT, 'js/dungeons.js'), 'utf8');
  const m = src.match(/clipContacts:\s*\{([^}]*)\}/);
  assert.ok(m, 'js/dungeons.js 에서 clipContacts 를 못 찾았다');
  const out = {};
  for (const [, k, v] of m[1].matchAll(/(\w+)\s*:\s*([0-9.]+)/g)) out[k] = parseFloat(v);
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
    pts.push(TRACK.filter(n => bone[n]).map(n => bone[n].getWorldPosition(new T.Vector3()).sub(hip)));
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
    const C = contacts();
    const g = await load(`art/3d/${ch}_anim.glb`);
    const root = g.scene; root.updateMatrixWorld(true);
    const bone = {};
    root.traverse(o => { if (o.isBone) bone[o.name.replace(/^mixamorig:?/, '')] = o; });
    const mixer = new T.AnimationMixer(root);
    for (const name of PUNCHED) {
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
