# GPT 지시서 · 정 장관 실전 AI + 전용 동작 — Render 재배포 (2026-10-10, Claude)

## 배경
디렉터: «전용먼저 진행해». 섀도우 팽·실험체 09호에 이어 **세 번째 기술표형 보스**로 고흥의 **정 장관**을 넣었다.
몸(`art/3d/part1/minister_jeong_candidate.glb`)에 전용 동작 6개를 구웠고(정적 파일 — GitHub Pages 로 이미 배포),
서버 기술표(`server/field-boss-kit.cjs`)에 `KITS.jeong` 을 더했다. 앞 두 지시서(섀도우 팽 · 09호)의 재배포를 아직 안 했다면 **한 번에** 하면 된다.

## 바뀐 것 (server)
- `server/field-boss-kit.cjs` — `KITS.jeong` 추가 + 기술표 기능 넷: `counterEvery`(N 번째마다 반격창) · 판정 `turn`(등 뒤)·`yawOff`(벌린 줄) ·
  `weights(d, phase, rel)`(rel = 대상이 정면에서 몇 rad) · 등 뒤 기술은 시작할 때 돌아서지 않는다(`behind`).
  - 완성된 원: 반격창은 네 번째 원에만 · 결계 가르기: 3합, 0.85 m 전진 · 다 아는 검: 등 뒤 3.4 m 안 · 지휘 — 각도: 12 m 직선 셋(−18°·0°·+18°).
- `server/field.cjs` · `server/index.cjs` — 바뀐 것 없음.
- `tests/field-boss-kit.test.cjs` — 정 장관 3개 추가(총 13).

## 해 줄 것
1. main 최신 → `npm test` (전부 통과).
2. Render 재배포 → 디렉터에게 반영 시각을 알린다.
3. 확인: 두 사람이 `world3d.html?zone=goheung&online=1` 에서 정 장관(14 m 안) — 가까우면 원·3합, 4 m 밖이면 세 줄, 등 뒤에 서면 등 뒤 베기. 원을 네 번 보면 네 번째에 하늘색 반격창.

## 지켜 줄 것
- 보스 체력·단계는 패킷에 넣지 않는다.
- `art/3d/part1/minister_jeong_candidate.glb` 는 `node tools/3d/jeong-clips.mjs` 로만 다시 굽는다(손으로 클립을 더하면 GLB 가 커지고 얼굴 감사가 깨질 수 있다 — `tests/jeong-clips.test.mjs`).

## 디렉터에게 남은 질문
- 의장대(원작의 클레이브 계열 다수)는 아직 없다 — «지휘» 는 그림자 세 줄로 대신했다. 실제 졸개를 불러낼지.
- 다음 보스: 나노-노바 코어(공용 클립뿐 — 전용 동작부터?).
