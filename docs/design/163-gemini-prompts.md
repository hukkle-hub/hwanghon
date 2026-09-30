# 163 부록 — Gemini 프롬프트 (EP01 허수아비 변신, 5클립)

쓰는 법
1. **이미지(Nano Banana)**: 매번 참조 이미지 4장을 같이 올린다.
   - ① `ain_design_sheet_9132.png` ② `kain_design_sheet_9049.png` ③ `training_heosuabi.jpg` ④ `scene_reference_9075.png`
   - 경로: `docs/story/source/design/…`, 허수아비는 `…/bosses/turnaround/`
   - 아래 프롬프트를 그대로 붙인다. 마음에 드는 1장씩 고른다.
2. **영상(Veo, 8초)**: «프레임으로 영상 만들기»에 1번에서 고른 이미지를 시작 프레임으로 넣고, 아래 영상 프롬프트를 붙인다.
3. 고른 이미지·영상은 `art/video/ep01_awakening/` 에 `A.png`, `A.mp4` … 로 넣어 주면 이어 붙이기·자막·효과음은 내가 한다.

공통 스타일 문장은 모든 프롬프트 끝에 이미 들어 있다.

---

## A — 카인의 일격 (0–8초)

**이미지**
```
Use the attached images as strict references: image 1 is AIN (the young woman), image 2 is KAIN (the big man), image 3 is the scarecrow monster AFTER transformation (do NOT show it yet), image 4 is the painting style and color mood.
Scene: an underground training room in a ruined Seoul, very LOW concrete ceiling (a greatsword held upright would touch it), worn gym mats on the floor, broken fluorescent tubes, one flickering. In the center stands an ordinary old straw training dummy, human height, wooden frame tilted to one side, straw sticking out, bound with iron chains. It looks harmless.
KAIN in the foreground-left, three-quarter back view, gripping his titanium greatsword with both hands, blade held HORIZONTAL because of the low ceiling, faint orange light leaking from the joints of his suit. AIN stands a few steps behind him with her scythe, watching.
Wide shot, eye level, 16:9.
Style: dark fantasy painterly illustration like image 4, desaturated browns and blacks, warm dusty light, cinematic, detailed. The ONLY supernatural glow allowed is ember orange. No cyan, no purple, no game UI, no text, no letters, no watermark.
```
**영상**
```
8-second anime-style painterly cinematic shot, 16:9, starting from the given frame. Keep the characters exactly as in the frame.
0-2s: the flickering fluorescent light buzzes; Kain tightens both hands on his horizontal greatsword, orange light seeping from his suit joints.
2-5s: Kain bursts forward, the big man crossing the mats in two heavy steps, swinging the greatsword down onto the straw dummy.
5-8s: impact — the straw bundle explodes outward, straw flying everywhere in slow motion, dust in the light, camera shakes slightly then holds.
Key-pose animation: fast motion, a held impact frame, then small aftershake. Low ceiling stays visible. No text, no subtitles, no dialogue; sound: fluorescent buzz, sword whoosh, heavy thud.
```

## B — 아인의 세 궤적 (8–16초)

**이미지**
```
Use the attached images as strict references: image 1 AIN, image 2 KAIN, image 4 style. (Image 3 is not in this shot.)
Same low-ceilinged underground training room, straw still floating in the air after an explosion of straw. AIN slides in low through the flying straw, her rusted reaper's scythe spinning in her hand, mid-motion, black short bob hair whipping, red eyes calm, right arm is the armored combat prosthesis (keep it on her RIGHT arm). Behind her, KAIN recovers from his swing. The broken straw dummy's wooden core and chains are visible between them.
Medium shot, low angle following Ain, 16:9, motion blur on the straw.
Style: dark fantasy painterly illustration like image 4, desaturated, warm dusty light. The only glow is ember orange. No cyan, no purple, no text, no watermark.
```
**영상**
```
8-second painterly anime cinematic, 16:9, from the given frame, keep Ain's design exactly (scythe, right-arm prosthesis, short black hair, red eyes).
0-2s: Ain slides in through the floating straw, the scythe spins in her hand.
2-6s: three slashes at the broken dummy: first from upper-left to lower-right, second returning in reverse, the third leaves a long glowing ember-orange afterimage trail at the tip of the blade hanging in the air.
6-8s: Ain stops, lowers the scythe and flicks straw off the blade, her breathing steady; Kain watches from behind, rolling his shoulder.
Key-pose animation with held frames on each slash. No text, no dialogue; sound: blade whooshes, a sharp crack, fading hum.
```

## C — 짚단 안쪽의 붉은 빛 (16–24초)

**이미지**
```
Use the attached images as strict references: image 1 AIN, image 2 KAIN, image 4 style.
Close-up of the split-open straw training dummy in the dark training room: from deep inside the torn straw a RED-ORANGE glow leaks out; glowing lines of an old carved sigil spread along the cracks, down into a circular engraving half-buried in the floor at its feet. Straw bits on the floor. In the soft background, out of focus, AIN's face turning toward it, eyes narrowing.
Insert/close shot, 16:9, shallow depth of field.
Style: dark fantasy painterly like image 4, darkness with one ember-orange light source. No cyan, no purple, no text, no watermark.
```
**영상**
```
8-second painterly anime cinematic, 16:9, from the given frame.
0-3s: slow push-in on the split straw dummy; red-orange light seeps from inside, sigil lines crawl along the cracks and spread across the circular engraving on the floor with a faint electric crackle.
3-5s: cut to a close-up of Ain: her red eyes narrow, then widen; she shouts (mouth moves, no audible words).
5-8s: cut to Kain, still standing near the dummy, turning his head toward her a half beat too late, puzzled.
No text, no subtitles, no spoken words; sound: electric crackle, a rising low hum.
```

## D — 폭발 (24–32초)

**이미지**
```
Use the attached images as strict references: image 1 AIN, image 2 KAIN, image 4 style.
The moment of explosion in the low-ceilinged underground training room: a blinding white-orange flash bursting from the straw dummy, black smoke and ember-orange particles pouring out like a waterfall, iron chains snapping and flying, AIN and KAIN thrown backward off their feet onto the mats, silhouetted against the light.
Wide shot, 16:9, dramatic backlight.
Style: dark fantasy painterly like image 4. Glow is ember orange and white only. No cyan, no purple, no text, no watermark.
```
**영상**
```
8-second painterly anime cinematic, 16:9, from the given frame.
0-2s: a high-pitched whine; the red light inside the straw bundle tightens into one point.
2-4s: blinding flash fills the screen, then a huge explosion of black smoke and ember-orange sparks.
4-8s: iron chains snap and whip away; the shockwave throws Ain and Kain rolling across the mats; smoke fills the room.
Key poses with a held white frame at the blast. No text, no dialogue; sound: rising whine, massive boom, chains snapping, bodies hitting mats.
```

## E — 3 m 강선 괴물 (32–40초)

**이미지**
```
Use the attached images as strict references: image 3 is THE MONSTER (the transformed training scarecrow — match its design exactly: log-like block head with two red glowing eyes, ember rune glowing in the chest, body wrapped in iron bands, chains and tangled steel wires, long arms), image 1 AIN, image 4 style.
In the smoke-filled low-ceilinged training room, seen from a LOW ANGLE at floor level: the 3-meter monster stands where the straw dummy was, its head almost touching the low ceiling, straw hanging off, nano steel wires bursting out of the straw and tangled like muscles, abnormally long arms. The light now comes from the monster itself: ember glow from below, lighting the smoke upward. AIN small in the foreground, on one knee on the mat, scythe in hand, looking up.
16:9, epic low-angle reveal.
Style: dark fantasy painterly like image 4. Only ember orange and the two red eye points glow. Not a fantasy wooden golem. No cyan, no purple, no text, no watermark.
```
**영상**
```
8-second painterly anime cinematic, 16:9, ending on the given frame composition.
0-2s: only smoke on screen; inside it two small red eye-lights switch on.
2-5s: the smoke thins; steel wires writhe out of the straw and tighten like muscles; a joint grinds and rotates.
5-8s: slow low-angle tilt up the full 3-meter body to its head under the low ceiling, ember light rising from below; hold.
Keep the monster design exactly like the reference. No text, no dialogue; sound: grinding metal "creak… creak", low rumble.
```
