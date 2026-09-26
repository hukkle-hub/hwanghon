# 103 — 시네마틱 전투 HUD v02 · 연출 감독 연결 계약

기준 main: `c8834638f2ed6ad3aa60081d9fd9985f7642f16c`.
Claude의 101(전투 카메라/서한역 조명), 102(시네마틱 전투 액션)의 위에 HUD를 얹는다.

## 역할 분리

- **Claude 소유:** `js/game3d.js` 카메라·조명·Cinematic Director·전투 연출 이벤트.
- **GPT 소유:** `game3d.html` HUD 정보 위계·반응형·연출 중 가시성.
- **공유 계약:** 브라우저 이벤트 `tw:cinematic` / `tw:cinematic:end`.
- 판정·피해·이동거리·무적시간은 어느 쪽도 HUD 때문에 바꾸지 않는다.

## Cinematic Director → HUD 이벤트

시작:

```js
window.dispatchEvent(new CustomEvent('tw:cinematic', {
  detail: {
    id: 'clash',      // 식별자: clash/perfectDodge/execute/phase/ult/bossIntro/victory ...
    tier: 'L1',       // L1 | L2 | L3
    duration: 350     // ms, 생략 가능. 생략 시 명시적 end 이벤트 필요
  }
}));
```

종료:

```js
window.dispatchEvent(new CustomEvent('tw:cinematic:end'));
```

HUD 쪽에는 `window.TW_CINEMATIC_HUD.set(detail)`, `.clear()`, `.setMode('default'|'minimal')`도 있다.

## 단계별 HUD 규칙

| 단계 | 전투 의미 | HUD |
|---|---|---|
| L0 | 상시 전투 | 전체 HUD. 단 중앙 시야는 비운다. |
| L1 | 튕김·맞대기·완벽 회피·연계 마무리 | 조작 버튼 유지. 의뢰/토스트/조준 알약 숨김. 플레이어 카드 72%로 한 박자 후퇴. |
| L2 | 처형·궁극기·큰 흐름 컷 | 조작 UI/콤보/가이드 숨김. 플레이어 정보 18%, 보스바 52%만 남김. |
| L3 | 보스 등장·페이즈·격파 | 보스 이름과 PHASE만 제목처럼 남기고 나머지는 숨김. |

`minimal` 모드는 접근성/실기 설정용: L2/L3에서도 조작 버튼과 플레이어 생존 정보는 유지한다.

## 화면 위계

1. 좌상단 — 캐릭터 초상/이름/HP·기력·ULT.
2. 상단 중앙 — 보스명/HP/격추/PHASE.
3. 우상단 — 전투 시간/일시정지.
4. 우하단 — 공격을 가장 큰 버튼으로, 스킬·회피·가드·궁극기를 그 주변에 배치.
5. 좌하단 — 플로팅 이동 스틱.
6. 우측 중앙 — 콤보 숫자만.
7. 하단 중앙 — 전투 힌트 한 줄.

## Claude에게 요구하는 최소 구현

Cinematic Director를 만들 때 아래 이벤트만 연결하면 HUD 쪽 추가 수정 없이 동작한다.

- `deflect / repel / clash / perfectDodge / comboFinish` → L1.
- `execute / ult / poiseBreakCinematic / bossBigTellCinematic` → L2.
- `bossIntro / phase / victory` → L3.
- 연출 취소·스킵·전투 종료 시 반드시 `tw:cinematic:end`.
- L1은 판정 확정 **후**에 이벤트를 내고 입력 버퍼는 유지한다.

## 완료 조건

- PC 1280×720, 모바일 가로 915×412, 저세로 690×272에서 버튼 겹침 없음.
- L1 중 공격/회피/가드 버튼 클릭 가능.
- L2/L3 종료 후 HUD 1프레임 내 복구.
- 전투 판정·피해·이동·무적 수치 diff 없음.
