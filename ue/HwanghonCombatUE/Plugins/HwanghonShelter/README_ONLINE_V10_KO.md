# 황혼의 서울 Online Native v10 — Boss Intro Cinematics

v10은 v9까지의 시작화면/캐릭터선택/Minimal UI/온라인 구조에
**현재 보스 12종 + 튜토리얼 허수아비의 실제 등장 시네마틱 시스템**을 추가한다.

## 새 시스템

### `AHHBossIntroDirector`
서버가 시작하고 모든 클라이언트에 같은 Intro sequence를 전달.

### `AHHBossIntroAnchor`
보스룸에 직접 배치하는 5개 카메라 Beat.

```text
PlayerEntry
Silhouette
ScaleReveal
SignatureMotion
Handback
```

### `AHHBossIntroTrigger`
보스룸 진입 감지.

### `UHHBossPresentationInterface`
각 실제 Boss BP가 Intro/Beat/End에서
기존 Montage, AI 상태, 기믹 Actor를 연결하기 위한 Interface.

## UI

등장씬에서는 HUD를 숨긴다.

보스 이름을 중앙에 크게 띄우는 방식은 사용하지 않는다.
Handback 뒤 Boss HUD와 함께 이름이 등장한다.

## 보스 목록

현재 프로젝트 잠금 목록:
- 튜토리얼 허수아비
- 클레이브
- 셀레스티얼
- 에이지스-07
- 리바이어던 나노
- 실험체 09
- 섀도우 팽
- 아스널 오버로드
- 감염된 박 준장
- 아이언 워든
- 감염된 이 중장
- 정 장관
- 나노-노바 코어

오르도는 현재 제작 대상이 아니다.

## 보스별 연출

`Docs/BossIntro/BOSS_INTRO_SHOTS_00-12_V10.md`

각 보스의 실제 공략 기믹을 등장씬에서 하나씩만 먼저 보여준다.

## 반복 공략

첫 조우:
```text
StartBossIntro(false)
```

재도전:
```text
StartBossIntro(true)
```

Short version은 같은 장면의 Hold만 줄인다.

## Editor 블록아웃

```text
Content/Python/build_boss_intro_template.py
```

실제 Boss Actor를 선택하고 BOSS_ID를 지정한 후 실행.

자동 배치된 카메라는 검수용 시작점이며
최종 보스룸에서 수동 카메라 튜닝이 필요하다.
