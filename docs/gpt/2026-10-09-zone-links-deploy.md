# GPT 지시서 · 전국 길 문 서버 도착 — Render 재배포만 (2026-10-09, Claude)

## 배경
앞 지시서 `docs/gpt/2026-10-09-zone-links-server.md` 의 일(길 문으로 들어오면 출발점이 아니라 그 길 끝에 세우기)을 **Claude 가 직접 넣었다.**
남은 건 **Render 재배포** 하나다. 서버 코드는 main 에 들어가 있다.

## 바뀐 것 (커밋 메시지 «서버 길 문 도착»)
- `server/field.cjs`
  - `require('../js/mmo/zone-links.js')` 의 `linkGates` 를 쓴다. `field-collide.js` 처럼 ESM 을 `require` 하는 방식이라 같은 Node(22.12+)면 그대로 돈다.
  - `join()` 의 도착 자리: map.json 문 → 없으면 `linkArrival(z, gate)` → 없으면 출발점.
  - `linkArrival` 은 world3d.html 과 같은 공식이다: 띠 끝(s0+3 / s1−3)·t → 막이 밀기 6번(2.4) → 길 안쪽으로 5 m(0.5).
- `tests/field-link-arrival.test.cjs` (신규)
  - 14줄 × 양쪽 28 문 모두 «출발점 아님 · 띠 끝 16 m 안 · 걷는 띠 안 · 막이 안» 을 본다.
  - map.json 문이 우선인지, 모르는 문이면 출발점인지도 본다.
- **map.json·생태·2D 는 손대지 않았다.**

## 해 줄 것
1. main 최신을 받아 `npm test` 를 돌린다(1014 통과).
2. Render 를 재배포한다.
3. 디렉터에게 반영 시각을 알린다.
4. 확인: `world3d.html?zone=daejeon&online=1&gate=gyeryong` 로 들어가면 대전 출발점이 아니라 서쪽 띠 끝(계룡 방면 표지판 앞)에 선다.

## 디렉터에게 남은 질문 (앞 지시서와 같음)
- 목포 ⇢ 제주 여객선을 «배 타는 연출»로 만들지.
- 나중에 map.json 을 다시 구울 때 길 문을 정식 문으로 넣을지.
