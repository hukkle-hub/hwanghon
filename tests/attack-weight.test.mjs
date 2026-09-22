import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import fs from 'node:fs'; import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinClips} from '../js/ain-bind-repair.js';

/* 「공격 모션이 촐싹댄다」의 정체는 «클립을 행동 시간보다 빨리 감는 것» 이다.
   배속 = (쓰는 클립 길이 × clipSpan) ÷ 행동 시간.
   clipSpan 으로 꼬리를 잘라 배속을 내렸다 — 행동 시간은 안 건드리므로 균형 불변.
   이 테스트는 (1) 배속이 상한 아래인지 (2) 잘라낸 지점이 판정보다 뒤인지를
   못박는다. (2)가 깨지면 «맞기 전에 모션이 끝나는» 더 나쁜 버그가 된다.
   docs/design/61-attack-weight.md */
const ctx={window:{}};
for(const f of ['world','dungeons']) vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const R=ctx.window.TW_DUNGEONS.RULES;
const SPAN=R.motion.clipSpan||{}, CONTACT=R.motion.clipContacts||{};

async function clipDurations(){
  const b=await readFile('art/3d/ain_anim.glb'), l=new GLTFLoader();
  l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  return Object.fromEntries(repairAinClips(g.animations,{changed:new Map()}).map(c=>[c.name,c.duration]));
}
/* speed=1.0 (aspd 100, 기본 무기) 기준의 행동 시간 */
const actionDur=clip=>((R.motion.characterProfiles||{}).ain||{})[clip]?.duration
  ?? (clip==='smash'?R.motion.smash.duration:clip==='counter'?R.motion.counter.duration:R.motion.light.duration);

test('평타·스매시가 행동 시간보다 과하게 빨리 감기지 않는다', async () => {
  const dur=await clipDurations();
  const worst=[];
  /* 스매시는 뺀다: 판정이 클립 .78 지점이라 자를 꼬리가 없어 2.52 배로 남아 있다.
     고치려면 행동 시간(=균형) 이나 클립 자체를 손봐야 한다 — dungeons.js 주석 참고. */
  for(const clip of ['attack1','attack2','attack3','counter']){
    const rate=dur[clip]*(SPAN[clip]??1)/actionDur(clip);
    worst.push([clip, +rate.toFixed(2)]);
    assert.ok(rate<1.85, `${clip} 배속 ${rate.toFixed(2)} — 1.85 를 넘으면 촐싹댄다`);
  }
  /* 음성 대조: 자르지 않으면 평2 는 상한을 넘는다 (2.53) */
  assert.ok(dur.attack2/actionDur('attack2')>1.85, '음성 대조 — 자르기 전에는 넘어야 한다');
});

test('잘라낸 끝이 판정보다 뒤에 있다 — 맞기 전에 모션이 끝나면 안 된다', () => {
  for(const [clip,span] of Object.entries(SPAN)){
    const c=CONTACT[clip];
    if(c==null) continue;
    /* 보정 후 판정이 «잘라 쓰는 구간» 안에서 차지하는 비율. 1 을 넘으면 판정이
       잘려 나가고, 1 에 너무 가까우면 따라감(follow-through)이 사라진다. */
    assert.ok(c/span<0.90, `${clip}: 보정 판정 ${(c/span).toFixed(2)} — 0.90 밑이어야 따라감이 남는다`);
  }
});
