# Animation Runtime Sync — Vertical Slice 0.8

## 왜 별도 Presentation Component가 필요한가

좋은 원본 모션을 넣어도 원본 접점 프레임과 황혼 combat hitAt이 다르면
“무기가 지나간 뒤 맞는” 문제가 다시 생긴다.

0.8부터 combat clock을 **유일한 시간 기준**으로 사용한다.

---

## 플레이어

`HWPlayerPresentationComponent`

Data Asset:
`HWAnimationSetAsset`

각 action binding:
- Sequence
- SourceContactNormalized
- BlendIn
- BlendOut
- SlotName

예:

Attack2 원본에서 날끝 접점이 클립 52%라면:

`SourceContactNormalized = 0.52`

황혼 combat:
`hitAt = 0.24 / duration 0.66`

런타임이:

- combat 0 → hitAt : source 0 → contact
- hitAt → end : source contact → end

로 piecewise 재생한다.

따라서:
- source clip을 바꿔도 hitAt 불변
- hitstop 동안 combat clock이 멈추면 animation도 멈춤
- 판정과 그림이 같은 순간을 유지

### Combo handoff

combat은 action end 후 같은 tick에 다음 action start를 보낸다.

Presentation은 stop을 한 frame 미룬다.

다음 attack이 같은 tick에 시작되면 pending stop을 취소하고
같은 FullBody slot에서 새 dynamic montage로 직접 cross-fade.

목표:
idle leak = 0 frame.

---

## 보스

`HWBossPresentationComponent`

패턴별:
- Tell sequence
- Strike sequence
- Recover sequence
- SourceBeatNormalized[]

예: HookCombo가 gameplay beat 3개면
원본 strike animation의 세 접점을:

`[0.20, 0.51, 0.84]`

처럼 기록한다.

런타임은 gameplay beat 시각과 source beat 위치 사이를
piecewise linear remap한다.

따라서 3연타의 각 contact가 combat rule과 맞는다.

### Reaction

Reaction은 `UpperBodyReaction` 등 별도 Slot을 사용한다.

목적:
보스 attack 전체를 끊지 않고 additive/light reaction을 얹기.

계층:
light < finisher < smash < counter < stagger < break.

---

## AnimBP 필수 Slot

Ain:
- `FullBody`

Boss:
- `FullBody`
- `UpperBodyReaction`

Boss reaction slot은 최종 AnimGraph에서 Layered Blend Per Bone 또는
적절한 additive layer로 조합한다.

---

## Audit

이제 CSV event에:

- `player_contact` = 실제 combat hitAt
- `visual_player_contact` = presentation source가 접점에 도달한 순간

둘 다 기록한다.

영상/CSV에서 같은 frame이어야 한다.

목표:
60fps 기준 ≤2 frame.
