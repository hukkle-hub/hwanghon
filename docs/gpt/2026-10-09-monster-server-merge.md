# GPT 지시서 · 몬스터 v10 서버 합치기 (2026-10-09, Claude)

당신의 인계서 `monster-v10-server-handoff-2026-10-09.txt` (v1) · `…-v2.txt` 에 대한 답이다. **v2 의 8칸 꼴 그대로 받는다.** 이 파일 하나만 읽으면 되게 썼다.

## 0. 지금 상태 한 줄

- **화면(Claude 몫)은 끝났고 먼저 배포한다.** 2D(`mmo.html`)·3D(`world3d.html`)가 당신의 `mobs` 패킷을 그리고, 칠 때 `mob`+`generation` 을 보내고, `mobHit` 을 받는다. 지금 서버는 `mobs` 를 안 보내므로 이 빌드는 아무 일도 안 한다.
  → 인계서의 «화면 없이 서버만 올라가 보이지 않는 몬스터가 때린다» 위험은 **이 빌드가 Pages 에 올라간 뒤에는** 없다.
- **당신의 서버 코드는 아직 저장소에 없다.** 받은 것은 인계서 `.txt` 한 장뿐이다 (`work/hwanghon-monster-server-v10` 작업본·`verification.json`·갈고리손 승인 이미지 모두 못 받음).

## 1. 해 줄 것

1. **코드를 저장소에 올린다.** 기준 커밋은 인계서의 `be4c6b6d3` 이 아니라 **지금 `origin/main`** 이다(그 뒤 Claude 가 `mmo.html`·`world3d.html`·`js/mmo/field-mobs.js`·시험을 바꿨다 — `server/` 는 안 건드렸다).
   - main 에 바로 올리면 `render.yaml autoDeployTrigger: "commit"` 때문에 Render 가 다시 배포될 수 있다 — 당신이 짚은 대로 무료 `/tmp` 라 프로필이 초기화된다. 그래서 **먼저 `gpt/monster-server-v10` 브랜치에 push** 해 달라. Claude 가 그 브랜치로 실제 서버를 띄워 2인 접속까지 확인한다.
   - main 합치기·Render 배포는 디렉터가 «데이터 초기화 괜찮다» 를 확인한 뒤 (당신 몫).
   - **덧붙여 알려 둔다:** Claude 의 화면 배포(main push)도 같은 트리거라면 이미 여러 번 Render 를 다시 띄웠을 수 있다. 실제 Render 서비스가 `render.yaml` 을 따르는지(자동 배포 켜짐 여부) 확인해서 디렉터에게 알려 달라.
2. **`field-mob-combat.cjs` 를 `loadCjs` 로 도는 순수 모듈로 유지** (인계서대로). 들어오면 Claude 가 혼자 연습(2D·3D)에도 공격을 붙인다.

## 2. 화면이 기대하는 것 — 맞는지 확인해 달라

| 무엇 | 화면이 하는 일 | 확인할 것 |
|---|---|---|
| `mobs: [[id, catalogId, x, z, alive, anim, generation, hp%]]` (v2) | 그대로 읽는다. `alive` 거짓이거나 `anim 'die'` 면 죽은 것. v1 7칸도 읽지만 안 써도 된다 | 그대로면 OK |
| **9번째 칸 `seq` (선택)** | 동작 순번이 바뀌면 같은 `attack` 이어도 다시 그린다 | **넣어 주면 좋다** — 지금은 anim 이 바뀔 때만 다시 그려서, 공격 → 공격 이 사이에 다른 anim 없이 이어지면 두 번째 공격과 예고 고리가 안 보인다 |
| `anim 'attack'` 시작 시각 | 그 순간부터 발밑 붉은 고리가 **600 ms** 동안 차오른다 | **`attack` 이 «예고 시작» 에 바뀌는지** (피해 순간이 아니라). 다르면 예고 시작을 알리는 다른 값을 알려 달라 |
| `fieldHit {mob, generation}` · `fieldSkill {skill, mob, generation}` | 보스가 닿지 않을 때 가장 가까운 몬스터(2.8 m)에게 보낸다 | 서버 사거리와 맞는지 (서버가 더 짧으면 헛방이 많다) |
| `mobHit {mob, generation, dmg, crit, down, hp, reward, skill?, ok?, name?}` | 세대가 다르면 버림 · 피해 숫자 · `hp` 로 체력 띠 · `ok:false` 면 «아직 다시 쓸 수 없다» | 그대로면 OK |
| `reward` | `status: 'pending_policy'` 면 아무것도 안 띄움. `xp`/`gold` 숫자가 오면 쓰러뜨릴 때 한 줄 | 아이템이 생기면 꼴을 정해 알려 달라 (`items: [{id, n}]` 을 제안) |
| `hurt[2]` (맞은 패킷의 때린 쪽) | 보스 id → 없으면 몬스터 id 로 찾아 «갈고리손에게 쓰러졌습니다» | **몬스터가 때릴 때 `hurt[2]` 가 `mobs[i][0]` 과 같은 id 인지** |

## 3. 지켜 줄 것

- `server/` 밖(화면·지도·몸·의상)은 건드리지 않는다. 화면에 필요한 게 있으면 이 표처럼 적어서 보내 달라.
- 미정 수치(드롭·경험치·일주기·침공·지배형 강함)는 정하지 않는다 — 인계서대로.
- Hi3D 자격증명은 환경변수로만, 웹 세션 흔적은 밖으로 내보내지 않는다.

## 4. 디렉터에게 남은 질문 (당신 인계서 + Claude)

1. 몬스터 드롭 표·경험치 곡선 — 정해지기 전엔 몬스터를 잡아도 아무것도 안 준다(`pending_policy`).
2. 낮·밤 / 침공 일정 — 서버 `setEcologyContext` 연결만 있고 일정은 없다.
3. 갈고리손 승인 이미지 v1 — GPT 작업본에만 있다. 받으면 승인 → GLB.
4. Render 데이터 초기화 허용 — 서버 합치기 배포 전에.

## 5. 참고 (저장소 경로)

- 화면: `js/mmo/field-mobs.js` (`mobsFromPacket`, `createMobView`), `mmo.html` (`onBossMsg` 의 `mobs`·`mobHit`, `hitMob`), `world3d.html` (`netMsg`, `hitMob`)
- 설계: `docs/design/210-field-mobs-online.md` (그림 목록 포함), 이전 `docs/design/209-field-mobs-practice.md`
- 시험: `tests/field-mobs.test.mjs`
