# 104 — 시네마틱 HUD · 연출감독 동기화 v03 (2026-09-26)

## 목적

HUD와 Cinematic Director가 서로 전투 로직을 침범하지 않고 같은 설정과 같은 장면 단계로 움직이게 한다. v02의 `tw:cinematic` / `tw:cinematic:end` 계약은 유지한다.

## 소유권

- `js/cine-director.js` 또는 Director 구현: 카메라, 슬로, 화면 후처리, 연출 타이밍.
- `game3d.html`: 연출 단계에 따른 HUD 가시성.
- `js/game3d.js`: 설정을 Director와 HUD에 전달하는 연결부만 담당.
- `js/ui.js`: 사용자가 선택하는 시네마틱 강도 설정 UI.

## 설정 값

`tw:settings.cine`은 아래 네 값을 사용한다.

- `cinema`: Director의 가장 강한 연출 프로필.
- `normal`: 기본값.
- `minimal`: 카메라 연출을 줄이고 HUD 조작/생존 정보는 최대한 유지.
- `off`: Director 연출 비활성. HUD는 별도 전투 로직을 만들지 않는다.

`applySettings()`는 `CINE.mode`와 `TW_CINEMATIC_HUD.setMode()`를 같은 값에서 갱신한다.

## 이벤트 규칙

Director는 판정이 확정된 뒤에만 `tw:cinematic`을 보낸다. HUD는 이벤트를 받아 표시량만 바꾼다. 판정, 피해, 이동 거리, 회피 무적, 입력 버퍼는 이 패치에서 변경하지 않는다.

```js
window.dispatchEvent(new CustomEvent('tw:cinematic', {
  detail:{ id:'clash', tier:'L1', duration:350 }
}));

window.dispatchEvent(new CustomEvent('tw:cinematic:end'));
```

## v04 선행 조건

L2/L3 장면 프레젠테이션 v04는 이 v03가 적용된 상태를 기준으로 한다. 특히 `game3d.html`의 `104 — HUD ↔ Cinematic Director bridge`와 `function mode(m)`가 v04의 적용 문맥이다.
