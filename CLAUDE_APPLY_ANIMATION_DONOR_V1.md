# Claude Code 전달용 — 황혼 Animation Donor Pipeline v1

SYSTEM CORE/UI를 건드리지 말고 애니메이션 가속 파이프라인만 적용한다.

## 1. 패키지 병합

저장소 루트 기준으로 병합.

추가되는 핵심:
- `Content/Data/animation_donor_manifest.json`
- `Scripts/setup_animation_donor_workspace.py`
- `Scripts/animation_donor_audit.py`
- `docs/design/130-animation-donor-map-v1.md`
- `docs/design/131-retarget-pipeline-v1.md`

## 2. 먼저 확보할 donor

Fab:
- Game Animation Sample
- Paragon Countess
- Paragon Kwang
- Paragon Greystone
- Paragon Feng Mao
- Paragon Serath
- Paragon Morigesh
- Paragon Phase
- Paragon Dekker
- Paragon Sevarog
- Paragon Grux
- Paragon Rampage
- Paragon Minions

외부:
- Quaternius Universal Animation Library 1/2

Mixamo/Rokoko는 필요한 clip이 없을 때만 사용.

## 3. 다운로드 자동화 금지

Fab/Adobe/Reallusion/Rokoko 계정 약관을 우회하는 downloader를 만들지 말 것.
사용자가 정상적인 라이브러리/다운로드 경로로 확보한 asset만 프로젝트에 사용.

## 4. Donor audit

UE 5.8.1 환경에서:

```powershell
powershell -ExecutionPolicy Bypass -File tools\ue\run-animation-donor-audit.ps1
```

결과:
`Saved/AnimationDonorAudit/donor_candidates.csv`

slot별로 상위 후보를 검수.

자동 점수만 보고 Final로 승격하지 말 것.

## 5. 리타기팅

필수 IK Rig:
- donor source rigs
- Ain
- Kain
- Ryu
- Sera
- Boss

필수 chains:
Root/Pelvis/Spine/Neck/Head/LeftArm/RightArm/LeftLeg/RightLeg.

weapon 캐릭터는 hands 확인.

UE IK Retargeter:
- target retarget pose 먼저 맞춤.
- 발 slide는 Run IK Rig/Speed Plant/Stride Warping 사용.
- 비율 차이는 Pelvis Motion부터 교정.

## 6. 편집

Retarget 결과는 `/Retarget`.
수정 결과는 `/Edited`.
실게임 합격만 `/Final`.

Control Rig 수정 순서:
1. pelvis/root
2. planted foot
3. chest
4. shoulders
5. hands
6. head/fingers

## 7. 황혼 고유화

Ain:
- Countess/Kwang donor를 낫 양손/긴 shaft 기준으로 재작성.
- Attack1→2→3 neutral pose 금지.

Kain:
- Greystone/Kwang.
- 발→골반→등→어깨→대검.
- anticipation과 follow-through 강화.

Ryu:
- Serath/Countess.
- playback speed만 올리지 말고 recovery를 제거/연결.

Sera:
- Morigesh/Phase/Dekker.
- projectile release frame과 gameplay spawn 정확히 일치.

Boss:
- Sevarog/Grux/Rampage를 tell/strike/recovery 조각으로 사용.
- whole clip 그대로 사용 금지.

## 8. Motion Warping

작은 range 보정에만 사용.
큰 거리 차이는 애니 자체 수정.

Combat system의 HitAt/CancelAt/Duration을 animation 때문에 임의 변경하지 말 것.

## 9. 라이선스

Paragon:
- UE 프로젝트에서만 사용.
- PARAGON/원작 캐릭터 이름/정체성을 홍보에 사용 금지.
- donor asset을 AI 서비스에 업로드하지 말 것.

Quaternius:
- CC0 확인.

Mixamo:
- Adobe FAQ 조건 하에 사용.

Rokoko:
- 황혼 팀이 직접 촬영/생성한 데이터만 사용.

라이선스/URL을 `docs/licenses/animation_donors.md`에 기록.

## 10. 첫 목표

그래픽을 새로 만드는 것이 아니다.

먼저 아래 10개만 실제 retarget preview까지 완성:
- Ain Attack1/2/3 + Dodge
- Kain Attack1 + Smash
- Ryu Attack1
- Sera Throw
- Boss Slam
- Boss Charge

각 clip에 대해:
- donor source
- retarget output
- 변경한 Control Rig 항목
- contact frame
- foot-slide 평가

를 보고.

그 뒤에 전체 슬롯으로 확장.
