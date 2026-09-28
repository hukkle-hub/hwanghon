# 130. 황혼 무료 donor 애니메이션/리깅 파이프라인 v1

## 목표

아인/카인/류/세라/보스를 처음부터 전부 수제 애니메이션으로 만들지 않는다.

```
무료·합법 donor
→ UE5 IK Retargeter
→ 타이밍 고정
→ Control Rig 자세 수정
→ Motion Warping
→ 황혼 무기/실루엣에 맞춘 QA
```

로 빠르게 production 후보를 만든다.

중요:
- **donor 애니메이션을 그대로 최종본으로 쓰지 않는다.**
- 황혼의 전투 타이밍과 무기 실루엣이 우선이다.
- Paragon/Epic donor는 Unreal Engine 안에서만 retarget/edit한다.
- Fab에서 AI 사용 불가로 표시된 Epic/Paragon 원본을 Rokoko/기타 AI 서비스 입력으로 보내지 않는다.
- Rokoko AI mocap에는 직접 촬영한 영상이나 사용권을 명확히 가진 영상만 넣는다.

---

# 1. 1차 다운로드 우선순위

## P0 — 먼저 받기

1. Game Animation Sample
2. Paragon Countess
3. Paragon Kwang
4. Paragon Greystone
5. Paragon Sevarog
6. Paragon Grux
7. Paragon Rampage

이 7개만 있어도:
- 공통 이동
- 아인
- 카인
- 보스

의 Graybox 모션 품질을 먼저 올릴 수 있다.

## P1 — 다음

8. Paragon Serath
9. Paragon Gadget
10. Quaternius Universal Animation Library 1
11. Quaternius Universal Animation Library 2

류/세라/잡몹/피격/사망/부족한 콤보를 채운다.

## P2 — 서명 동작

12. Mixamo
13. Rokoko Create / Vision
14. AccuRIG

사용:
- Mixamo: 빠른 utility/throw/cast/hit/death.
- Rokoko: 황혼만의 낫·대검·쌍검 서명 동작.
- AccuRIG: 황혼 캐릭터 원본 메시의 리그가 약할 때.

---

# 2. 라이선스 안전선

| Source | 프로젝트 사용 | 외부 AI 입력 |
|---|---|---|
| Game Animation Sample | Unreal Engine 프로젝트 | 금지 쪽으로 운용 |
| Paragon | Unreal Engine 프로젝트 | **금지** |
| Quaternius UAL 1/2 | CC0 / 상업 가능 | 가능 |
| Mixamo | 상업 게임 로열티 프리 | 별도 AI 입력은 권리 확인 |
| Rokoko 생성 모션 | 상업 사용 가능 | 직접 촬영/권리 보유 영상만 |
| AccuRIG | 무료 자동 리깅 툴 | 해당 없음 |

Paragon:
- 게임명/광고에 `PARAGON` 상표 사용 금지.
- donor 모델을 황혼 캐릭터의 최종 외형으로 그대로 사용하지 않는다.
- 모션 donor/리타게팅 source로 우선 사용.

---

# 3. 공통 UE5 리타게팅

## Source

Donor skeleton:
- UE5 Manny / Game Animation Sample
- Paragon skeleton
- Quaternius humanoid
- Mixamo humanoid
- Rokoko Manny/Mixamo preset

## Target

황혼:
- Ain
- Kain
- Ryu
- Sera
- humanoid boss target skeleton

## IK chains

필수:
- Root
- Pelvis
- Spine
- Neck
- Head
- Arm_L / Arm_R
- Leg_L / Leg_R

권장:
- Clavicle_L/R
- Hand_L/R
- Finger chains
- Weapon helper chains가 있으면 별도.

Retarget Root:
- pelvis/hips.

## Retarget Pose

Donor와 황혼 target의:
- shoulder elevation
- elbow bend
- wrist pronation
- pelvis height
- foot angle

을 먼저 맞춘다.

리타게팅 뒤 Control Rig에서 억지로 다 고치는 방식 금지.

---

# 4. 황혼 timing lock

애니메이션이 어떤 source에서 왔든 게임 판정이 먼저다.

## Basic 1 / 2 / 3

- duration: `0.66s`
- contact: `0.24s`
- cancel: `0.48s`

## Smash

- duration: `1.15s`
- contact: `0.48s`
- cancel: `0.91s`

## Counter

- duration: `0.56s`
- contact: `0.18s`
- cancel: `0.40s`

애니메이션 donor contact가 다르면:
1. clip trim
2. play-rate
3. pose timing edit
4. Control Rig
순서로 contact를 target에 맞춘다.

판정 시간을 donor에 맞춰 바꾸지 않는다.

---

# 5. Ain donor recipe

## Base

- Locomotion: Game Animation Sample
- Fast movement/dodge: Countess
- torso/weapon mechanics: Kwang
- missing armed combo: UAL2
- signature scythe: self-recorded Rokoko

## Attack1

Donor search:
- Countess: attack / slash / light
- Kwang: attack / slash

Modify:
- pelvis starts first.
- chest follows.
- arms/scythe last.
- both hands remain on 황혼 낫 grip.
- contact exactly .24.
- blade trail is QA OFF while editing.

## Attack2

Highest-priority chain quality.

Modify:
- Attack1 end pose == Attack2 start pose.
- no neutral recoil.
- pelvis reverses direction before chest.
- reverse cut.
- support foot slide <=2cm.

## Attack3

- body drive > Attack2.
- largest silhouette of basic chain.
- not a giant VFX finisher.
- recovery prepares dodge/skill.

## Smash

- Kwang/UAL2 overhead donor.
- lift → hold → drop.
- contact .48.
- scythe head follows a long arc but body stays planted/readable.

## Signature

Do not force a sword donor into every scythe skill.

Record original:
- 3-hit scythe flow
- large horizontal reap
- low-to-high hook
- finisher
- spin

with Rokoko from original/self-recorded footage.

---

# 6. Kain donor recipe

## Base

- Locomotion: Game Animation Sample
- Primary combat: Greystone
- torso/guard: Kwang
- missing heavy combo: UAL2
- signature greatsword: original Rokoko

## Motion rule

Kain is not just Ain slowed down.

Sequence:
`feet → pelvis → back → shoulder → hands → greatsword`

Heavy attacks need:
- visible anticipation
- hold
- abrupt acceleration
- long follow-through
- recovery weight

## Smash

target:
- lift 0-.25
- hold .25-.34
- acceleration .34-.48
- contact .48
- follow .48-.92
- settle .92-1.15

Greystone donor is source motion only.
Greatsword size/grip/COM is 황혼-specific.

---

# 7. Ryu donor recipe

- Locomotion: Game Animation Sample
- fast melee: Countess + Serath
- multi-hit: UAL2
- signature dual blade: Rokoko

Rules:
- do not simply increase play-rate.
- delete/shorten recovery poses.
- smaller torso amplitude than Kain.
- faster pelvis direction changes.
- twin hands must not mirror mechanically.

---

# 8. Sera donor recipe

- Locomotion: Game Animation Sample
- caster body language: Gadget
- throw/cast fallback: Mixamo
- hit/death: UAL1
- vial/ward signature: Rokoko

Rules:
- Sera is not a full-body melee character.
- keep center of mass stable during cast.
- hands + shoulders carry readability.
- vial throw release uses exact socket/event.
- projectile contact timing remains gameplay-authoritative.

---

# 9. Boss donor recipe

## Sevarog

Use for:
- held tell
- slow heavy swing
- ground-wave-like body mechanics
- intimidating idle/recovery

## Grux

Use for:
- charge
- multi-hit
- heavy hooks
- strong recoil

## Rampage

Use for:
- leap
- landing
- slam
- roar
- body-weight reactions

## Pattern construction

Do not look for one animation that perfectly equals a 황혼 boss pattern.

Example:

`GroundWave`
- Sevarog tell/hold
- Control Rig pelvis compression
- Rampage-like impact/landing body response
- 황혼 contact event
- procedural/FX ground wave

`Charge`
- Grux low anticipation
- Motion Warping forward pass
- root motion passes player
- deceleration
- turn after pass

`HookCombo`
- Grux/Kwang-like first swing
- no idle
- short walking/neutral beat
- final slam
- explicit recovery pose

---

# 10. Motion Warping

Use on:
- player attack approach
- Kain heavy step-in
- boss charge
- boss lunge
- boss slam alignment

Do NOT use Motion Warping to hide bad animation.

Warp target:
- root travel distance
- facing

Keep:
- foot plants
- body mechanics
- contact pose

---

# 11. Control Rig edit priority

Only edit what changes quality fastest:

1. pelvis
2. planted foot
3. chest
4. weapon hand
5. support hand
6. head look
7. fingers last

Ain/Kain two-hand weapons:
weapon grip consistency is a hard gate.

---

# 12. Automated donor audit

Run inside UE Editor:

`Scripts/audit_animation_donors.py`

Output:

`Saved/HwanghonAnimationDonorAudit/donor_candidates.json`
`Saved/HwanghonAnimationDonorAudit/donor_candidates.csv`

The audit:
- scans AnimSequence/Montage
- detects installed donor packages
- scores asset names/path using source + action keywords
- emits top candidates per 황혼 animation slot
- creates `/Game/Hwanghon/Animation/...` workspace folders

This does not automatically declare a winning animation.
A candidate still needs visual review.

---

# 13. Candidate acceptance

A donor candidate passes only if:

- silhouette readable with trail OFF
- contact within ±2 frames at 60fps
- support-foot slide <=2cm target
- weapon grip stable
- attack1→2→3 has no idle pose
- boss tell/strike/recovery readable
- source license recorded
- source asset was not sent to prohibited AI processing

---

# 14. Fast execution order

## Pass A — same day target

Install:
- Game Animation Sample
- Countess
- Kwang
- Greystone
- Sevarog
- Grux
- Rampage

Audit.

Produce:
- Ain locomotion + dodge + attack1/2/3
- Kain locomotion + attack1/2/3 + smash
- boss idle + charge + slam + hit reaction

No VFX polish.

## Pass B

Add:
- Serath
- Gadget
- UAL1
- UAL2

Produce:
- Ryu full Graybox set
- Sera utility set
- generic hit/death
- boss missing patterns

## Pass C

Record only signature gaps:
- Ain scythe
- Kain greatsword
- Ryu dual blade
- Sera vial/ward
- boss unique mechanic

with original Rokoko captures.

---

# 15. Stop condition

Do not spend days searching donor assets.

For each slot:
- audit top 5
- visually review top 3
- choose 1
- retarget/edit
- QA
- move on

If none passes in 20 minutes:
use UAL2/Mixamo fallback or record a custom Rokoko motion.
