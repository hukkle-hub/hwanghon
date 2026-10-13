# Render 한도 — 서버를 «서버 파일이 바뀔 때만» 다시 짓게 (2026-10-13)

## 무슨 일
디렉터: «지금 Render 가 한계치». Render 서비스 `hwanghon-party`(무료, singapore)는 `autoDeployTrigger: commit` 이라 **main 에 커밋이 올라올 때마다** `npm ci` + 재시작을 했다.

- 10월 main 커밋 **404 개** 중 서버가 읽는 파일을 건드린 것은 **48 개**뿐(나머지는 3D 화면 · 문서 · 그림).
- 무료 계획의 월 빌드 시간(파이프라인 분)을 이것만으로 다 쓸 수 있다. 재시작마다 임시 저장(`EPHEMERAL_STORAGE=1`, `/tmp/hwanghon`)의 프로필도 지워진다.

## 저장소에서 한 것 (Claude)
- `render.yaml` 에 `buildFilter.paths` — 서버가 실제로 읽는 파일만:
  `server/**`, `package.json`, `package-lock.json`, `render.yaml`, `js/` 공용 규칙 13 개(boss-contact-volumes · boss-director · combat-quality · dungeon-run · mmo/field-collide · mmo/safe-zones · mmo/zone-links · party-wire · skill-events · skill-math · swing-point · world-sim) + content.cjs 가 읽는 `js/world · items · dungeons · dungeon · dungeon-content.js`, `maps/2d/**`, `ue/HwanghonCombatUE/Content/Data/**`, `docs/design/ref/monster-catalog-v10/MonsterRoster_v10.json`.
- 시험 `tests/render-build-filter.test.cjs`: 서버가 require / readFileSync 하는 파일이 거르기에 빠지면 실패(일부러 하나 빼 봐서 잡히는 것 확인). 서버에 새 파일 의존을 넣으면 render.yaml 에도 더해야 `npm test` 가 통과한다.

## GPT 가 할 것 (Render 대시보드)
1. 서비스가 **Blueprint(render.yaml 동기)** 로 만들어졌는지 본다 — Blueprints 메뉴에 이 저장소가 있으면 동기 한 번(Manual Sync)으로 거르기가 들어간다.
2. Blueprint 가 아니면(대시보드에서 직접 만든 서비스) render.yaml 은 안 읽힌다 → **Settings → Build & Deploy → Build Filters → Included Paths** 에 위 경로를 그대로 넣는다.
3. 어느 한도였는지 확인: **Workspace → Billing / Usage** 에서 Pipeline minutes · Bandwidth · Free instance hours 중 어느 것이 찼는지. 빌드 시간이 아니라면 아래 «다른 한도» 를 본다.
4. 넣은 뒤 화면 쪽 커밋(예: `world3d.html` 만)에서 **배포가 «Skipped»** 로 나오는지, 서버 쪽 커밋에서는 지어지는지 한 번씩 확인.

## 다른 한도였다면
- **대역폭**: 클라이언트(앱 · 페이지)는 GitHub Pages 에서 받고 Render 는 웹소켓만 쓰는 게 맞다. 누가 Render 주소로 직접 들어오면 서버가 정적 파일(`party.html`, art …)까지 내준다(`server/index.cjs` 24~28 줄) — 대역폭이 찼다면 알려 달라. 정적 제공을 끄거나 Pages 로 돌리는 변경을 하겠다.
- **인스턴스 시간(월 750 시간)**: 서비스 하나는 한 달 내내 켜도 744 시간. 같은 워크스페이스에 무료 서비스가 둘 이상이거나, 잠들지 않게 외부에서 계속 깨우고 있으면 넘는다.

## 디렉터에게 남은 질문
- Render 대시보드 Usage 에서 어느 항목이 한도였나?
