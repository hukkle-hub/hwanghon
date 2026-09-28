# 황혼 Animation Acceleration v1

목표:
무료/합법 donor animation을 이용해 황혼 캐릭터와 보스 모션 제작 시간을 크게 줄인다.

## 핵심

- 공통 이동: Epic Game Animation Sample
- Ain: Countess + Kwang
- Kain: Greystone + Kwang + Feng Mao
- Ryu: Serath + Countess
- Sera: Morigesh + Phase + Dekker
- Boss: Sevarog + Grux + Rampage
- 범용 fallback: Quaternius UAL/UAL2
- 부족한 일반 동작: Mixamo
- 황혼 대표 모션: 직접 촬영 → Rokoko
- 정식 rig 전 임시 custom mesh: AccuRIG

## 원칙

donor를 그대로 쓰지 않는다.

`Retarget → pelvis/feet/chest/hands 수정 → weapon arc → Motion Warping → combat timing QA`

순서로 황혼 캐릭터에 맞춘다.

## 빠른 사용

1. Fab에서 donor pack을 라이브러리에 추가하고 UE 프로젝트에 설치.
2. Quaternius/Mixamo/Rokoko 결과는 별도 Donors 폴더로 import.
3. 실행:
   `tools/ue/run-animation-donor-audit.ps1`
4. 확인:
   `Saved/AnimationDonorAudit/donor_candidates.csv`
5. 슬롯별 후보 상위 3~5개를 실제로 preview.
6. IK Retargeter로 황혼 target에 retarget.
7. Control Rig edit.
8. combat contact timing QA.
9. 합격본만 `/Final/<Character>`에 저장.

## 라이선스 주의

Paragon:
- Unreal Engine 프로젝트 전용.
- PARAGON 상표/캐릭터 정체성을 게임 이름·홍보에 쓰지 않는다.
- Fab에서 AI 사용 허용이 아니므로 donor 자산 자체를 AI 생성/학습 서비스에 업로드하지 않는다.

Quaternius UAL/UAL2:
- CC0.

Mixamo:
- Adobe FAQ 기준 게임 포함 상업 프로젝트 royalty-free 사용 가능.

Rokoko:
- 직접 생성한 Video/Text-to-Motion 데이터는 상업 사용 가능.

이 패키지는 donor 에셋 자체를 포함하거나 재배포하지 않는다.
