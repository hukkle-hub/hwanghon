# 208 · GPT 에게 — 몬스터 작업 지시서 (2026-10-09)

디렉터: «그대로 진행하고 따로 지피티 시킬 거는 문서로 만들어줘».
문서 207(몬스터 기획 훑어보기)의 결론대로 **Claude 는 표·맵 쪽을 끝냈다.** 이 문서는 GPT 가 이어서 할 일과, 이미 깔린 «연결점» 이다.
웹 필드 = GitHub Pages `mmo.html`(2D) · `world3d.html`(3D), 서버 = `server/`(Render). UE = `ue/HwanghonCombatUE`.

## 0. 이미 된 것 (Claude, 2026-10-09)

| | 어디 | 내용 |
|---|---|---|
| 캐논 한 표 | `js/mmo/monster-catalog.js` | GPT v09 63종 그대로 + 디렉터 «2급 지배형» 다섯(`G2_DOM_*`, `src:'director-sheet'`) = 68종. 원본은 `docs/design/ref/monster-catalog-v09/` |
| 2급 결정 | 문서 207 §2 → **(가)** | 디렉터가 2급으로 분류한 시트 다섯을 캐논에 «2급 지배형 계열» 로 **덧붙였다**(GPT 2급 지휘형 10종은 그대로) |
| 사냥터 배정 | `js/mmo/hunt-pools.js` → 각 `maps/2d/<지역>/map.json` `areas[].pool` | «(가안)» 이었던 사냥터 45곳에 종을 앉혔다. 흔한 종 = 5급·OpenWorld 2~3종(레벨 15 이하는 보행자 포함), 드문 종 = 레벨 20↑ 4급 1 · 45↑ 3급 1 (OpenWorldRare). 지역 성향(지역 기본 + 사냥터 이름) 이 맞는 것만. 2급 이상은 무작위 풀에 없다 |
| 생태 자리 | 같은 `areas[].eco` | 사냥터 53곳마다 **둥지 3곳 + 순찰 고리 4점** — 게임 충돌에 안 밀리는 곳 · 걷는 띠 안 · 쉼터·문·보스 둘레 밖 (시험이 지도와 대조) |
| 이름표 | 게임 화면 사냥터 띠 | «Lv 81~83 · 2급 지배형 · 갈고리손 · 호각자 · 포획자 · 드물게 재봉자·단죄자» (휴대폰 세로 412px 에 들어감 — 쟀다) |

`map.json` 의 사냥터 한 칸:

```json
{ "kind":"hunt", "id":"left", "name":"중정로 폐허 거리", "lv":[78,81], "danger":2,
  "mobs":"2급 지배형 · 포획자 · 갈고리손 · 절단자 · 드물게 기수·무영",
  "pool": { "common":["G5_CAPTOR","G5_HOOKHAND","G5_SLASHER"], "rare":["G4_STANDARD_BEARER","G3_SHADOWLESS"], "regions":["Port","Urban"] },
  "eco":  { "nests":[[x,z],[x,z],[x,z]], "patrol":[[x,z],[x,z],[x,z],[x,z]] },
  "poly": [[x,z],…] }
```

좌표는 월드 미터(x, z). 서버 `field.cjs` 가 같은 `map.json` 을 읽는다.

## 1. 캐논 v10 (GPT — 먼저)

- `MonsterRoster_v09.json` 에 `G2_DOM_THORNCROWN`(가시관) · `G2_DOM_BLACKCOAT`(흑의) · `G2_DOM_SILENCE`(침묵) · `G2_DOM_CRIMSON`(붉은 검) · `G2_DOM_BLOODFLOWER`(혈화) 다섯을 같은 스키마로 넣어 `v10` 을 낸다.
  - 승인 시트: `docs/design/ref/field-monsters-grade12/` — **재해석 금지**. 이름은 아직 가안(디렉터 확정 전).
  - 지금 넣어 둔 값(우리가 임시로 채운 것 — 고쳐도 된다): 역할 Duelist · 계열 Dominator · 기술 «베기·이어 베기·지배 파동» · SpawnContext OpenWorld/OpenWorldRare · 지역 Urban/Port · Raid.
- 각 종에 **권장 레벨대** 를 하나 넣어 주면 좋다(캐논엔 등급만 있다). 지금은 우리 규칙(위 표)이 대신한다.
- 내 놓으면 Claude 가 `js/mmo/monster-catalog.js` 를 다시 만들고 `node tools/2d/patch-areas.mjs <지역…>` 로 사냥터를 다시 배정한다. **표 파일을 손으로 고치지 말 것** — 시험(`tests/monster-catalog.test.mjs`)이 원본 JSON 과 한 종씩 대조한다.

## 2. 필드 몸 — 우선순위 (GPT)

사냥터 45곳의 «흔한 종» 칸 131개를 세면, 위에서 6종이 54%, 11종이 80% 를 덮는다:

| 순 | 종 | 칸 | 누적 |
|---|---|---|---|
| 1 | 갈고리손 G5_HOOKHAND | 18 | 14% |
| 2 | 포획자 G5_CAPTOR | 16 | 26% |
| 3 | 등반자 G5_CLIMBER | 10 | 34% |
| 4 | 감시자 G5_WATCHER | 9 | 40% |
| 5 | 절단자 G5_SLASHER | 9 | 47% |
| 6 | 운반자 G5_CARRIER | 9 | 54% |
| 7~11 | 밀침꾼 · 보행자 · 호각자 · 철갑병 · 추적자 | 8·7·7·6·6 | 80% |

- 보행자·질주자·파쇄자·추적자·철갑병·공진자는 남산 N01 승인 레퍼런스(`docs/design/ref/guildworld-v06-n01-tier5/n01-tier5-reference.png`)가 이미 있다 — 같은 몸을 필드에서도 쓴다(캐논 원칙: MonsterId 재사용).
- 2급 지배형 다섯의 진짜 몸(지금은 세라·카인·류를 물들인 임시 몸). Hi3D 자격증명은 **환경변수로만**(`HI3D_CLIENT_ID`/`SECRET`), 커밋 금지.
- 동작 다섯: idle · walk · attack · hit · die. GLB 는 `art/3d/...`, 키는 `visualH` 로 맞추고 **발이 바닥에** — `tools/3d/pose-sheet.html` 로 찍어 확인(보스 다섯이 바닥에 파묻혀 몇 달 못 본 일이 있다, CLAUDE.md §1).
- 휴대폰용 가벼운 모델은 `tools/2d/make-lod.mjs`. 이 도구가 쓰는 GLB 는 정점 속성이 **한 버퍼에 끼워져(interleaved)** 나온다 — 속성을 `.array` 로 직접 읽지 말 것(`js/hand-grip.js separateAttributes` 참고, 문서 206 §3.1).

## 3. 서버 몬스터 — 웹 필드 (GPT)

문서 199 §3 의 연결점이 그대로 유효하다. 추가로 이번에 깔린 것:

- **어디에 몇 마리:** `areas[].eco.nests` 마다 `pool.common` 에서 2~4마리 군락, `eco.patrol` 을 도는 무리 하나. `pool.rare` 는 드물게(예: 사냥터당 10~20분에 한 번) 둥지 하나를 대신한다.
- **안전 지대 금지:** 쉼터(`rest`) 안으로 들어오지 않게 — `js/mmo/safe-zones.js` 그대로. 거점 마을은 보스가 차지한 동안 안전 지대가 아니다(문서 198).
- **권위:** 수·리스폰·피해는 서버. 화면은 보이기만(보스·지배형과 같은 구조).
- **모듈은 순수하게.** 몬스터 AI 를 `server/field-dominator.cjs` · `server/field-boss-combat.cjs` 처럼 **node 내장(fs·path 등) 없이** 짜 줄 것 — 웹 필드는 서버가 없을 때(혼자 연습) 이 모듈을 **브라우저에서 그대로** 돌린다(`js/mmo/cjs-browser.js loadCjs`, 문서 206 §11·12). 상대 경로 `require('./x.cjs')` 만 따라간다.
- 공격 판정은 `Field.bossStrike` 의 식(회피 무적·방어력·버프)을 같이 쓴다 — 회피·완벽 회피 연출(문서 205 §4)이 몬스터에도 그대로 먹는다. 맞은 서버 시각을 hurt 묶음 `h[6]` 에 넣어 주면 완벽 회피 판정이 된다.
- 메시지 제안: 기존 `field` 에 `mobs:[[id, catalogId, x, z, hp%, anim]]` (관심 반경 28 m). 타격은 `fieldHit {mob}` 또는 `fieldHitMob`.
- 드롭·경험치: 문서 199 §3 표 그대로(`bossLoot` 은 보스 장비만 — 몬스터 드롭은 `store.addItems`).
- **휴대폰:** 몬스터 20 + 사람 10 에서 초당 30프레임 — Pixel 7 기준 3D 필드 그리기는 지금 바깥 지역 360~650(문서 206 §13). 몬스터는 인스턴싱이나 가벼운 모델로.
- `server/` 를 바꾸면 Render 재배포가 필요하다(GPT 몫) — 디렉터에게 언제 반영되는지 알린다.

## 4. 생태 런타임 (GPT — v09 다음 목표 그대로)

`NEXT_OPEN_WORLD_ECOLOGY_V09.md` 의 1~8 중 웹 필드에 먼저 올릴 것:
1. 둥지/순찰 스폰 원천 — 자리는 `eco` 에 있다.
2. 낮·밤 풀 교체 — 밤엔 추적자·4급 침묵자 비중 ↑ (캐논 `NightEvent` 맥락).
3. 드문 조우(Rare) — `pool.rare` 와 3급 `OpenWorldRare`.
4. 거점 사건 → 평소 필드 풀 일부가 «침공(NodeInvasion)» 으로 바뀜 — 남산 N01 과 같은 MonsterId.

## 5. UE (GPT)

- N01 4급 웨이브(`N01_Tier4_Monsters_v08.json`, `test_mixed_grade_v08.py`)가 패키지에만 있고 UE·시뮬엔 아직 없다.
- UE 쪽 MonsterCatalogAsset 을 만들면 **같은 MonsterId** 를 쓴다(웹 표와 한 쌍) — 웨이브가 몬스터의 부모가 되지 않게(CLAUDE_MMORPG_DIRECTION_RESET_V09 §0).

## 6. 디렉터에게 남은 질문 (GPT 가 정하지 말 것)

- 2급 지배형의 강함 결: 지금 체력 300만 · 한 대 32~52% — 캐논의 «HP 스펀지 금지» 와 어떻게 맞출지.
- 2급 지배형 등장: 10분마다 늘 / 드문 강자.
- 다섯의 이름(가안).

## 7. Claude 가 이어서 받칠 것

- v10 이 오면 표·사냥터 다시 만들기 (시험 포함).
- 몬스터 GLB 가 오면 2D·3D 필드 로더·발 높이·휴대폰 무게 재기 (그림으로 보고).
- 지역을 새로 굽거나 사냥터를 바꾸면 `patch-areas` 로 배정·생태 자리 다시 깔기.
