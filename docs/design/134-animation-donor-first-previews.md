# 134 — Animation Donor v1: 첫 retarget preview (2026-09-28, 진행 중)

디렉터: `HWANGHON_ANIMATION_DONOR_PIPELINE_V1` 병합. 지정 10 개 모션을 retarget preview 까지 완성한다.

> 같은 날 제작 기준이 «소설 전체 = Source of Truth» 로 바뀌었다. 이 작업은 여기서 멈추고 기록만 남긴다. 이어서 할 때는 §4 부터 한다.

## 1. 병합

- 패키지 파일 29 개를 병합했다. 저장소 파일과 겹치는 것은 없었다.
- `docs/design/130-*`, `131-retarget-*` 는 번호만 기존 문서와 같고 이름이 다르다.
- 검사 결과:
  - `tests/animation-donor-v1.test.mjs` 8/8
  - `verify_donor_manifest.py` PASS
  - `verify_animation_donor.py` PASS

## 2. donor 확보

`docs/licenses/animation_donors.md` 의 «확보 상태» 에 적었다.

- 쓸 수 있는 것: Countess, UAL1·2 Standard(CC0)
- 나머지 Fab 팩: 라이브러리까지만 추가했다. 프로젝트 설치는 런처에서 디렉터가 해야 한다.

## 3. retarget (`Scripts/ue_donor_retarget_preview.py`)

- 대상: 게임의 네 캐릭터 몸과 훈련 보스(`art/3d/*_anim.glb`)
  - 모두 같은 24 관절 Mixamo 리그다.
  - `IK_HW_<캐릭터>` 는 체인을 직접 정의했다(Root = Hips).
- 원본: Countess·UAL 은 자동 IK 리그(root = pelvis)
- 출력: `/Game/Hwanghon/Animation/Retarget/<캐릭터>`
- `/Edited`·`/Final` 은 비어 있다. Control Rig 수정은 아직 **없음**.
- 고친 것: 황혼 몸은 Hips 가 곧 스켈레톤 루트다.
  - 5.8 리타기터의 Root Motion op 가 원본의 고정 root(0)를 Hips 에 복사해서 골반 이동이 사라졌다.
  - 그래서 구르기가 98 cm 에서 떠서 돌았다.
  - 황혼 몸 대상에서는 이 op 를 끈다. 수정 뒤 Hips 는 54 → 115 → 7 → 94 cm 로, 원본(51 → 107 → 7 → 88)을 따른다.

## 4. 10 개(+비교 2) — 수치 (61 샘플)

| 슬롯 | donor | 원본 → 옮긴 접점 | retarget 이 더한 발 미끄러짐 |
|---|---|---|---|
| Ain Attack1 | Countess Primary_Attack_A_Normal | 0.210 → 0.210 s | +6.8 cm |
| Ain Attack2 | Countess Primary_Attack_B_Normal | 0.165 → 0.165 s | +2.1 cm |
| Ain Attack3 | Countess Primary_Attack_Normal | 0.060 → 0.060 s | +2.6 cm |
| Ain Dodge | UAL1 Roll | 0.244 → 0.244 s | +9.2 cm |
| (비교) Ain Dodge | Countess Ability_E | 0.564 → 0.583 s | +4.1 cm |
| Kain Attack1 | UAL1 Sword_Attack (Greystone/Kwang 미설치) | 0.434 → 0.434 s | +10.1 cm |
| (비교) Kain Attack1 | UAL2 Sword_Regular_C | 0.500 → 0.533 s | +0.7 cm |
| Kain Smash | UAL2 Sword_Heavy_Combo | 2.600 → 2.600 s | 0 (딛는 프레임 없음) |
| Ryu Attack1 | Countess Primary_Attack_Fast_V1 | 0.130 → **0.060 s** | +8.4 cm |
| Sera Throw | UAL2 OverhandThrow (Morigesh 미설치) | 0.378 → 0.378 s | **+33.7 cm** |
| Boss Slam | Rampage/Sevarog 미설치 | — | — |
| Boss Charge | UAL2 Shield_Dash (Grux/Rampage 미설치) | 0.220 → 0.238 s | +10.4 cm |

- 접점: 손 전방 뻗음 최대. 원본과 결과 모두 `hand_l/r` 로 잰다(쌍검 뼈와 Mixamo 무기 슬롯은 서로 다른 뼈라 쓰지 않는다).
- 발 미끄러짐: **원본에서 발이 딛고 있는 프레임**만 본다(발끝 높이 최저 +2 cm, 프레임당 3 cm 미만). 그 프레임들에서 결과 발 이동에서 원본 발 이동(다리 길이 비율 보정)을 뺀 값이다.
  - 기준 2 cm 를 넘는 것이 대부분이다. Run IK Rig 발 고정(Speed Plant)이 다음 단계다.
- Ryu Attack1 의 접점이 70 ms 당겨진 것은 A-포즈 ↔ T-포즈 팔 정렬 차이로 보인다(팔 체인 정렬 확인 필요).

## 5. 남은 것

1. 디렉터: Epic 런처에서 Fab 팩을 프로젝트에 추가한다.
2. Speed Plant/발 IK 를 켜고 발 미끄러짐을 다시 잰다.
3. Boss Slam 은 Rampage/Sevarog 설치 후 만든다.
4. 렌더 비교: `-HWQA=clipreview`(`클립@메시@접점`, 시각 `c` = 접점)로 원본·결과 쌍을 찍는다. 루트 수정 뒤 다시 찍어야 한다.
