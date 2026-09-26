# 105 — L2/L3 시네마틱 HUD 프레젠테이션 v04 (2026-09-26)

## 목적

연출 감독의 다음 단계(L2 처형·궁극기·자세 붕괴, L3 보스 등장·페이즈·격파)가 들어왔을 때 HUD가 단순히 사라지기만 하지 않고 **한 장면의 영화 프레임처럼 정리**되도록 한다. 판정·피해·무적·이동 수치는 바꾸지 않는다.

## 규칙

- **L1**: 기존 v03 그대로. 입력 버튼은 유지하고 주변 정보만 낮춘다.
- **L2 execute / ult**: HUD 거의 전부 숨김. 보스바도 12%만 남겨 화면의 액션이 우선이다. 얇은 상·하 매트만 사용한다.
- **L2 poiseBreak**: 다음 공격 결정을 해야 하므로 보스바 68% 유지 + 중앙 상단에 `자세 붕괴 / BREAK`를 짧게 표시한다.
- **L3 bossIntro / phase**: 상·하 매트 5vh 이하, 중앙 상단 장면 제목. 보스 이름과 PHASE만 남기고 나머지 전투 HUD는 숨긴다.
- **L3 victory**: 보스바도 숨기고 `격파 / TARGET ELIMINATED`만 남긴다.
- `minimal` 모드에서는 매트와 장면 제목을 끄며 기존 조작 HUD를 유지한다.

## 이벤트 계약

`tw:cinematic` detail은 아래 필드를 선택적으로 받는다.

```js
{ id, tier, duration, title?, kicker?, subtitle?, phase? }
```

기본 문구는 HUD가 자체 제공한다. 연출 감독은 필요할 때만 `title/kicker/subtitle/phase`를 덮어쓴다.

권장 이벤트:

```js
{ id:'poiseBreak', tier:'L2', duration:1100 }
{ id:'execute', tier:'L2', duration:1800 }
{ id:'ult', tier:'L2', duration:1600 }
{ id:'bossIntro', tier:'L3', duration:2800, title:'눈뜬 허수아비', subtitle:'거리와 반격' }
{ id:'phase', tier:'L3', duration:1800, phase:2 }
{ id:'victory', tier:'L3', duration:2400 }
```

## 화면 안전 규칙

- PC 매트 최대 38px, 모바일 최대 18px. 실제 플레이 면적을 과도하게 줄이지 않는다.
- execute/ult 중에는 텍스트 캡션을 띄우지 않는다. 액션 그 자체가 제목이다.
- poiseBreak만 예외로 짧은 `BREAK`를 보여 공격 기회를 명확히 한다.
- L3 장면 제목은 2줄 이하, UI보다 캐릭터/보스 실루엣이 우선이다.
