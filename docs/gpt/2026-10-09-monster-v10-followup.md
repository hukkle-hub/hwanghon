# GPT 지시서 · 몬스터 v10 다음 (2026-10-09)

이 파일 하나만 보면 된다. 앞 지시서: `docs/gpt/2026-10-09-monster-tasks.md`. 배경: `docs/design/207-monster-plan-review.md` §6.

## 0. v10 받았다 — 저장소에 들어간 것

| 넣음 | 메모 |
|---|---|
| `docs/design/ref/monster-catalog-v10/*` (캐논 68 · 배치 근거 · 제작 순서 · 검증) | `MonsterDelivery_v10.json` 만 다시 만들었다 — 원본 해시가 윈도 CRLF 로 잰 값이었다(740c…). 저장소 원본은 **LF**, 해시 90bc…. 앞으로 해시는 LF 원본으로 잰다(`git config core.autocrlf false` 작업본 권장) |
| `server/field-ecology.cjs` · `server/field-ecology-route.cjs` | 그대로. 아직 `field.cjs` 에 연결 안 됨 → Render 재배포 영향 없음 |
| `tools/monsters/canon-v10.mjs` · `build-canon-v10.mjs` · 시험 둘 | 그대로 (전부 통과) |

**«순찰 여섯 변 막힘» 은 풀었다(Claude).** 생태 자리(`map.json areas[].eco`)를 런타임 `legal`·`canTraverse`·`planRoute` 와 같은 규칙으로 다시 깔았다 — 실제 지도 180 변 전부 길 있음, `anchorAdjustments` 0.
지킴이 시험: `tests/field-ecology-anchors.test.mjs`. 생태 런타임 규칙(여백 0.6 m, 막는 구역 종류, 경로 예산)을 바꾸면 **이 시험이 맵을 다시 깔라고** 알려 준다 — 바꿀 때 Claude 에게 알려 주면 `node tools/2d/patch-areas.mjs <지역…>` 로 맞춘다.

## 1. 서버 연결 — `server/field.cjs` (먼저)

- `Field` 가 지역마다 `Ecology` 하나: `zone = map.json`, `collide = createCollide(map).collide`(js/mmo/field-collide.js — 클라와 같은 것), `rng = this.rng`, 시계 = 서버 시계, `owner` = 거점 주인(문서 198 — 보스가 차지한 거점 마을은 안전 지대 아님).
- 틱: 기존 20 Hz `tickBosses` 옆에서 `eco.tick(now, { night, invasion, owner })`.
- 몬스터 체력·피해는 `field.cjs` 가 쥔다(ecology 는 자리·생사만). 쓰러뜨리면 `eco.defeat(id, now)` 한 번.
- 몬스터 공격 = `bossStrike(o, p, hit, now)` 식 그대로 → 회피 무적·방어·버프·**hurt `h[6]`(맞은 서버 시각)** 이 몬스터에도 먹는다(웹 필드의 «완벽 회피» 연출이 그 값을 쓴다).
- 메시지: 기존 `field` 패킷에 `mobs:[[id, catalogId, x, z, hp%, anim, generation]]` (관심 반경 28 m, 20개 — `snapshot()` 이 이미 그렇게 자른다). 타격 `fieldHit { mob }` (보스와 같은 `HIT_GAP`·스킬 배율·`critNext`).
- 보상: 재료·골드·회복약은 `store.addItems`, 경험치 `profile.xp` (필드 첫 경험치). `bossLoot` 은 보스 장비만.
- **순수 모듈 유지:** 몬스터 AI(추적·공격 결정)를 새로 만들면 `field-ecology.cjs` 처럼 node 내장 없이 — 웹 필드 혼자 연습이 브라우저에서 그대로 돌린다(`js/mmo/cjs-browser.js`).
- `server/` 바꾸면 Render 재배포(GPT) — 디렉터에게 언제 반영되는지 알린다.

## 2. 첫 몸 — G5_HOOKHAND (갈고리손)

- 흔한 종 칸 1위(131칸 중 18). 동작 idle·walk·attack·hit·die. GLB → `art/3d/monsters/g5_hookhand.glb` 제안.
- 승인 레퍼런스가 없는 종은 **먼저 디렉터 승인 시트**부터(재해석 금지 원칙). N01 레퍼런스가 있는 6종(보행·질주·파쇄·추적·철갑·공진)은 그 시트로 바로.
- 키 `visualH`, 발이 바닥에 — `tools/3d/pose-sheet.html` 로 찍어 확인(CLAUDE.md §1). 휴대폰용 가벼운 모델 `tools/2d/make-lod.mjs` (정점 속성이 끼워져 나온다 — `.array` 직접 읽기 금지).
- Hi3D 자격증명은 환경변수로만, 커밋 금지.

## 3. Claude 가 받을 것 (겹치지 않게)

- 서버가 `mobs` 를 보내기 시작하면: 2D·3D 필드 그리기(로더·발 높이·이름표·피격·쓰러짐), 혼자 연습에서 `Ecology` 를 브라우저로 돌리기, 휴대폰 무게 재기 — Claude.
- 몸(GLB)이 오면 확대 컷·포즈 시트로 확인하고 붙인다 — Claude.

## 4. 디렉터에게 남은 질문 (정하지 말 것)

- 2급 지배형: 강함의 결(HP 300만·한 대 32~52% ↔ «HP 스펀지 금지»), 등장(10분마다 늘 / 드문 강자), 이름.
- 몬스터 드롭 표·경험치 곡선.
