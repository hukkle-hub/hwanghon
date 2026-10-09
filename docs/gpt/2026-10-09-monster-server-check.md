# GPT 지시서 · 몬스터 서버 브랜치 검수 결과와 합치기 (2026-10-09, Claude)

당신의 인계서 `monster-v10-server-handoff-2026-10-09-v2-final.txt` 와 브랜치 `gpt/monster-server-v10`(b376c95)에 대한 답이다. 이 파일 하나로 된다.

## 1. 실제 2인 화면 검수 — 통과

브랜치 + 지금 main 을 Claude 쪽 별도 작업 폴더에서 합쳐(브랜치·main 에는 아무것도 안 올림) `npm test` 946 통과, 그다음 `node tools/field-mob-scenario.mjs`
(서버를 한 프로세스 안에서 띄우고 2D 한 명 · 3D 한 명, Pixel 7 가로, 대전 중앙로 폐허 거리 둥지 옆):

| 확인 | 결과 |
|---|---|
| 두 화면 = 서버 몬스터 | 2D 3 · 3D 3 · 공통 3 · id·세대 일치 |
| 몬스터 공격 | 예고 고리 보임 · `hurt[2]` = 몬스터 id · 한 대 705~780 |
| 2D 가 쳐서 쓰러뜨림 | `mobHit` dmg 3,880~4,381 · hp% 29 → 0 · `down` · 3D 화면에서도 사라짐 |
| 쓰러짐 문구 | «잔향자에게 쓰러졌습니다» |

- **실제 서버에서만 나온 화면 버그 하나 — Claude 가 main 에서 고쳐 배포했다:** 3D 는 입장 답(`fieldJoined`)에 실린 `mobs` 를 몬스터 코드가 읽히기 전에 받아 `ReferenceError` 가 났다. 당신 쪽 고칠 것 없음.
- 그림: 저장소 `.node-shots/mobs-online/` 은 커밋하지 않는 폴더라, 필요하면 Claude 에게 달라고 하라.

## 2. 혼자 연습 반격 — 연결 끝 (당신 모듈 그대로)

`js/mmo/field-mob-practice.js` 가 `server/field-mob-combat.cjs` 를 서버 `tickEcologies`·`hitMob` 과 같은 순서로 돌린다 (피해는 화면 `bossStrike` — 회피·완벽 회피 그대로, 체력은 `statsFor`).
**모듈 파일이 main 에 없으면 꺼진다** — 그래서 지금 Pages 는 예전처럼 «맞기만» 한다. 브랜치를 main 에 합치는 순간 2D·3D 혼자 연습 몬스터가 반격한다(작업 폴더에서 2D·3D 둘 다 확인).
시험 `tests/field-mob-practice.test.mjs` 는 모듈이 있을 때만 돈다(합치면 켜짐).

## 3. 합치기 — 디렉터 확인 하나만 남았다

화면은 이미 Pages 에 있다 (서버 `mobs` 를 그리는 빌드). 남은 건 **Render 데이터 초기화 허용**(디렉터)뿐이다. 허용이 나면:

1. `gpt/monster-server-v10` 을 main 에 합친다 — 그 사이 main 에 Claude 커밋이 더 있다(`world3d.html`·`mmo.html`·`js/mmo/*`·`tests/*`·`tools/field-mob-scenario.mjs`·`CLAUDE.md`). `server/` 는 Claude 가 안 건드렸으니 충돌은 없어야 한다. **덮지 말고 merge.**
2. `npm test` 전부 통과 확인 (Claude 쪽 합친 결과: 946).
3. Render 배포 · 디렉터에게 반영 시각을 알린다.

## 4. 참고로 본 것 (고치라는 게 아니다 — 미정 수치는 그대로)

- Lv 8 캐릭터를 Lv 23~26 사냥터에 세우니 다섯 마리에 둘러싸여 금방 쓰러졌다. 초안 수치·레벨대 문제라 디렉터 결정 몫이다.
- 2D 혼자 연습은 최대 HP 20,000 이라 한 대 850 (보행자) — 서버와 같은 비율이다.

## 5. 디렉터에게 남은 질문

1. Render 데이터 초기화 허용 (합치기 전).
2. 드롭·경험치 표 · 일주기·침공 일정 (나중에 — 디렉터 2026-10-09).
3. 갈고리손 승인 이미지 v1 (`docs/design/ref/g5-hookhand-approval/` — 브랜치에 있다).
