# 131. UE5.8 Retarget / Edit Pipeline

## 파이프라인

`Donor → IK Rig → IK Retargeter → Retargeted Sequence → Control Rig edit → Montage → Motion Warping → Combat QA → Final`

---

## 1. Source IK Rig

donor pack마다 Source IK Rig를 하나 만든다.

권장:
- IK_UE5_Mannequin_Source
- IK_Countess_Source
- IK_Kwang_Source
- IK_Greystone_Source
- IK_Serath_Source
- IK_Morigesh_Source
- IK_Sevarog_Source
- IK_Grux_Source
- IK_Rampage_Source
- IK_Quaternius_Source

필수 chains:
- Root
- Pelvis
- Spine
- Neck
- Head
- LeftArm
- RightArm
- LeftLeg
- RightLeg

weapon donor라면:
- LeftHand
- RightHand

을 명확하게 확인.

---

## 2. Target IK Rig

황혼 target:

- IK_HWAin
- IK_HWKain
- IK_HWRyu
- IK_HWSera
- IK_HWBoss

Target pose는 캐릭터 디자인시트 기준.

A/T pose 차이는 반드시 Retarget Pose에서 먼저 해결하고
애니마다 Control Rig로 땜질하지 않는다.

---

## 3. IK Retargeter

이름:

- RTG_Countess_To_Ain
- RTG_Kwang_To_Ain
- RTG_Greystone_To_Kain
- RTG_Kwang_To_Kain
- RTG_Serath_To_Ryu
- RTG_Countess_To_Ryu
- RTG_Morigesh_To_Sera
- RTG_Sevarog_To_Boss
- RTG_Grux_To_Boss
- RTG_Rampage_To_Boss
- RTG_UE5_To_<Character>

발 slide가 보이면:
- Run IK Rig
- Speed Planting
- Stride Warping

순으로 확인.

비율 차이가 크면:
- Pelvis Motion
- target retarget pose
부터 고친다.

---

## 4. Retargeted Output

donor 원본과 섞지 않는다.

`/Game/Hwanghon/Animation/Retarget/<Character>`

예:
`RT_Ain_Countess_Attack_candidate_01`

아직 Final 이름을 쓰지 않는다.

---

## 5. Control Rig Edit

`/Game/Hwanghon/Animation/Edited/<Character>`

수정 우선순위:

1. root/pelvis
2. support foot
3. chest
4. weapon shoulder
5. hands
6. head
7. fingers

UE Sequencer에서 원 animation sequence를 Control Rig layer와 함께 사용.

완성 후 Animation Sequence로 bake.

---

## 6. Motion Warping

Motion Warping을 “모션을 살리는 도구”로 사용하지 않는다.

용도:
- target까지 30~80cm 정도 부족/과한 root distance 조정
- smash/charge가 정해진 contact range에 도달
- boss lunge target alignment

금지:
- 2m donor를 5m charge로 억지 확장
- 발이 1m씩 미끄러질 정도의 scale warp

큰 차이는 애니 자체를 수정.

---

## 7. Montage / Notify

모든 combat montage는 최소:

- Anticipation
- Contact
- Follow
- Recovery

논리 구간을 갖는다.

Notify는 gameplay authority가 아니다.
기존 Hwanghon Combat timing이 authority.

Notify는:
- weapon trail
- footstep
- camera cue
- audio cue
- debris

같은 presentation에 사용.

---

## 8. Donor 자동 스캔

실행:

`tools/ue/run-animation-donor-audit.ps1`

결과:

`Saved/AnimationDonorAudit/donor_candidates.csv`

이 보고서에서 slot별 상위 후보를 빠르게 검수.

자동 점수는 최종 선택이 아니다.

사람이 반드시:
- silhouette
- weapon body mechanics
- root motion
- foot plant
를 보고 확정.

---

## 9. Custom model auto-rig

황혼 Hero mesh가 아직 정식 Skeleton이 없을 때:

- AccuRIG로 A/T-pose auto-rig
- FBX export
- UE import
- IK Rig
- Retarget

최종 Hero skeleton이 확정되면
임시 auto-rig Skeleton을 production target으로 계속 끌고 가지 않는다.

---

## 10. 직접 모캡

Rokoko:
- 직접 촬영
- 단색/몸 전체가 보이는 영상
- weapon 대신 가벼운 막대 사용
- 실제 대검 무게를 들고 찍지 않는다
- capture 후 UE에서 exaggeration

촬영 시:
- 카메라 정면 하나만 고집하지 말고
- 팔/다리가 겹치지 않도록 동작 방향을 설계
- 시작/끝 neutral 0.5~1초 확보

---

# 최종 구조

## 무료 donor가 해결
- locomotion
- generic dodge
- generic hit/death
- 60~80% basic body mechanics
- boss generic weight

## 우리가 직접 수정
- weapon spacing
- silhouette
- combo continuity
- contact
- foot plant
- timing
- signature attacks

## 직접 capture
- 황혼을 대표하는 4~6개의 핵심 모션만

이 구조가 가장 빠르면서도
“무료 에셋 게임처럼 보이는 문제”를 피할 수 있다.
