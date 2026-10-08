# 203 — 남산 N01 5급 감염체 6종 (GPT 패키지 GuildWorld v04 · v05 · v06 적용)

GPT 가 연달아 보낸 세 패키지를 한 번에 적용했다. 세 판은 겹친다 — v05 는 v04 웨이브·몬스터를 그대로 두고 «행동»을,
v06 는 그 위에 «PIE 눈 확인(라벨·자동 판정)» 을 얹는다. 그래서 감사도 한 번에 했다.

- v04 `N01_Tier5`: 승인 외형 6종 잠금, 전부 ThreatGrade 5, 역할별 목표 우선, 5웨이브, 공진형 오라
- v05 `N01_Tier5_Runtime`: 역할별 목표 재평가 주기, 파괴형 발전기→통신→정문, 추적형 NPC 중요도(기술자 1.5·의무관 1.35), 철갑형 세 공격, 공진형은 무리 중심 뒤
- v06 `N01_PIE`: 머리 위 `T5 / ROLE / TARGET`, 5웨이브 자동 판 + PASS/FAIL 로그, 라벨 끄고 폰 프레임 확인

원본 설정·지시서·**승인 레퍼런스 이미지**는 `docs/design/ref/guildworld-v06-n01-tier5/` 에 그대로 두었다
(`n01-tier5-reference.png` — 6열 각각이 3D 제작 기준. 새로 그리거나 재해석하지 않는다).

## 1. 감사 — 이미 있는 것 / 넣은 것 / 넣지 않은 것

패키지는 «새 전투·보스 프레임워크를 만들지 말고, 같은 기능이 있으면 기존 클래스에 최소 병합» 하라고 한다.
우리 남산 판(문서 200·201)은 이미 역할 다섯을 갖고 있었다:

| 패키지 | 우리 쪽 (전부 `HWNodeRules.h` ↔ `node-combat-rules.cjs`, 벡터로 대조) | 처리 |
|---|---|---|
| T5_WALKER 보행형 | `Normal` — 플레이어 9 m 안이면 플레이어, 아니면 정문 | 그대로 (이름표만 WALKER) |
| T5_RUNNER 질주형 | `Runner` — 측면 길로 돌아 후방 NPC·발전기 | 그대로 |
| T5_BREAKER 파괴형 | `Breaker` — 시설 먼저 | **순서만** v05 대로 발전기 → 통신 → 정문 (정문 북쪽 목표는 여전히 서 있는 정문을 먼저 만난다 — `BlockedByGate`) |
| T5_STALKER 추적형 | `Stalker` — NPC 먼저 (가장 가까운) | **NPC 고르기** 를 v05 점수로: 중요도 − 10 m 당 0.08 (§3) |
| T5_ARMORED 철갑형 | `ArmoredElite` — 정문 압박, 카운터 전까지 피해 ¼ (`FEliteArmor`) | 기존 수치 **안 건드림** (v04 지시 9). 세 공격 순환만 얹음 (§4) |
| T5_RESONATOR 공진형 | 없음 | **새 역할** (§2) |
| ThreatGrade=5 | 없음 | `NodeThreatGrade = 5`, `ArchetypeId()` — HUD·로그·판 기록 |
| `UHwanghonWaveMonsterComponent` · `BrainComponent` · `WaveTargetComponent` · `ResonanceEmitterComponent` · `DebugComponent` · `AHwanghonN01PIETestController` | `AHWNodeEnemy`(목표 선택 `ChooseTarget`) · `AHWNodeDirector`(시설·NPC 위치, 웨이브, 판 기록 hwnode-run/1) · 적 머리 위 `TextRender` | **넣지 않음.** 같은 기능이 이미 있다. 특히 Brain 의 «매 AI 가 `TActorIterator` 로 전 액터 스캔» 은 패키지 스스로 시제품용이라고 적었다. 우리 감독은 시설·NPC 목록을 들고 있어 스캔이 없다 |
| 가중치 점수 목표 선택 (Player 1.0 · Gate 0.55 …) | 규칙 기반 `ChooseTarget` | 규칙 그대로. v05 시나리오 셋(파괴형→발전기 · 추적형→기술자 · 철갑형→정문)을 **우리 규칙이 같은 답으로** 낸다 (벡터 `tier5.npc_pick`, 시뮬 판정) |
| 수치 hp 1000 · move 0.9 … (비율) | 우리 조정 수치 (보행 5500 hp · 285 cm/s …) | 우리 것 유지. 공진형만 패키지 비율 × 우리 보행형 (§2). 대조표 §5 |
| 철갑 전면 피해 0.45 · 퍼펙트 카운터 자세 피해 ×2.25 | 피해 ¼ (방향 없음) · 퍼펙트 균열 9초 | 0.25 유지(지시 9). ×2.25 는 «경직 ×2.25» 로 연결 — 노드 적엔 자세 게이지가 없다 (§4) |

## 2. 공진형 (`EEnemyRole::Resonator`)

- **수치**: 체력 5400 · 플레이어 피해 640 · 시설 피해 220 · 290 cm/s · 1.5초 · 갑옷 없음.
  패키지 비율(보행형 대비 hp 0.98 · move 0.92/0.9 · attack 0.75)을 우리 보행형 수치에 곱했다. 처치 공헌 2 (파괴형과 같음 — «최우선 제거 대상»).
- **자리**: 3000 cm 안 무리(공진형 제외)의 **중심에서 자기 쪽으로 350 cm 뒤** (`ResonatorHoldPoint`). 무리가 그 반경에 없으면 가장 가까운 하나.
  목표 종류 `ETargetKind::Ally` — 도착하면 머문다, 치지 않는다. 플레이어가 6 m 안에 오면 플레이어. 무리가 다 죽으면 보행형처럼.
- **오라** (서버 권위): 감독(`AHWNodeDirector::RefreshResonance`)이 **0.4초마다** 살아 있는 공진형 1800 cm 안의 다른 감염체에
  이동 ×1.1 · 공격 ×1.12 (플레이어·NPC·시설 피해 모두). **중첩 상한 1**, 공진형 자신과 다른 공진형은 안 받는다.
  공진형이 죽으면 그 자리에서 다시 잰다(0.4초를 기다리지 않는다). 적은 자기 버프를 정하지 않는다 — `SetResonance` 만 받는다.
- 시뮬도 같은 0.4초로 잰다. 리플레이에 오라 원(분홍 점선)·공진 받은 적(분홍 테)이 그려진다.

## 3. 추적형 NPC 중요도 (v05)

`NpcPickScore(사냥꾼, NPC, 거리) = 중요도 − 거리/1000 × 0.08` — 추적형만. 기술자 1.5 · 의무관 1.35 · 나머지 1.0.
다른 역할은 그대로 «가장 가까운 NPC». v05 시나리오: 기술자 26 m (1.292) > 민간인 12 m (0.904) — 같은 값이 벡터에 있다.
감독은 `PreferredNpc(위치, 역할)` 하나로 목표·길·타격이 같은 NPC 를 보게 했다.

## 4. 철갑형 세 공격 (v05) — 카운터 판정은 그대로

| 순서 (4타 순환) | 공격 | 예비 동작 | 카운터 |
|---|---|---|---|
| 1·3 | 방패 밀치기 | 0.8초 (기존) | 어떤 카운터든 «보통 균열» 6초 |
| 2 | 돌진 | 1.0초 | 퍼펙트면 «퍼펙트 균열» 9초 + **경직 1.4 × 2.25 = 3.15초** (자세 피해 ×2.25 의 연결) |
| 4 | 내려찍기 | 1.2초 (읽고 피할 시간) | **카운터 불가** — 카운터를 들고 있어도 맞는다. 피하기(무적)만 |

카운터 판정(`UHWCombatComponent::IsCounterActive / IsPerfectCounterActive`)은 고치지 않았다. 이 공격에 카운터가 «무엇을 하는가» 만 규칙에 있다.
시뮬은 내려찍기를 같은 손 실력(카운터 확률)으로 «피했다/맞았다» 친다.

## 5. 웨이브 v04 와 균형 — 숫자로

`N01_Tier5_Waves_v04.json` 그대로, 시각만 −20초 (우리 시계는 침공 시작 = 0):

| | W1 접촉 0s | W2 측면 45s | W3 시설 95s | W4 압박 150s | W5 돌파 200s | 합 |
|---|---|---|---|---|---|---|
| 전 (Prototype A) | 보4 질2 | 보5 질3 (55s) | 보6 파1 (115s) | 보4 철1 (175s) | — | 26 |
| v04 | 보4 질2 | 보4 질3 추1 | 보4 파2 | 보5 철1 공1 | 보4 질2 파1 추1 철1 | **36** |

시뮬 (시드 7·11·23, `tools/ue/node-sim.cjs`):

| 판 | 전 웨이브 | v04 웨이브 | 정문 무너짐 |
|---|---|---|---|
| 솔로 DPS 1000 | 막음 | **3판 다 함락** | 111.6초 |
| 솔로 DPS 1600 · 2400 | 막음 | 2/3 막음 | 111.6초 |
| 2인 파티 DPS 1000 | — | 3/3 막음 | 111.6초 |
| 3·4인 파티 | — | 3/3 막음 (228~246초) | 111.6초 |
| 기술자 → 정문 + 2인 | — | 3/3 막음 | **167초** |

- **정문이 W3 파괴형 둘에 111.6초에 무너진다** — 인원과 상관없이. 그래서 철갑형(W4 150초)이 «정문을 압박» 할 정문이 없다.
  기술자를 정문에 보내야 167초까지 버티고, 그 판에서만 PIE 일곱 항목이 다 PASS 다 (§6).
- 시험(`tests/ue-node-sim.test.cjs`)의 «플레이어가 있으면 버틴다» 는 솔로 → **2인 파티** 로 바꿨다.
  «정문 강화가 정문을 늦춘다» 는 20초 → 10초 (W3 가 두 배 빨리 쳐서 ×1.5 체력이 14.7초를 산다). 탈환전·포탑 수리 시험은 전제(마지막 웨이브까지 감 · 포탑이 반 깎일 때 보급이 남음)를 맞추려고 2인 · 포탑 노림 1500 으로.

**디렉터 결정이 필요한 것** (패키지 수치를 그대로 넣고 대조만 했다):
1. 솔로가 v04 남산을 지켜야 하나? (지금: 2인부터)
2. 정문이 W3 에 무너지는 것 — W3 파괴형 2 → 1, 정문 체력 36000 → ?, 또는 «기술자 정문 수리» 가 정답인 판으로 둔다
3. 공진형 처치 공헌 2 · 자리 350 cm 뒤 · 자기방어 6 m
4. 철갑 «전면 0.45» 를 넣을지 (지금 사방 0.25)

## 6. PIE 판정 (v06) — 같은 일곱 항목을 UE 와 시뮬이

`HWNodeRules::FTier5Evidence` 가 판 동안 증거를 모으고, 판 끝(막음·함락)에 Output Log 로:

```
[HWNode][N01_TIER5_PIE_V06] PASS  all six roles spawn
[HWNode][N01_TIER5_PIE_V06] PASS  all spawned monsters report ThreatGrade 5
[HWNode][N01_TIER5_PIE_V06] PASS  Breaker selects Generator at least once
[HWNode][N01_TIER5_PIE_V06] PASS  Stalker selects NPC at least once
[HWNode][N01_TIER5_PIE_V06] PASS  Armored selects Gate at least once
[HWNode][N01_TIER5_PIE_V06] PASS  Resonator aura changes a nearby T5 monster multiplier
[HWNode][N01_TIER5_PIE_V06] PASS  the multiplier returns once the Resonator is gone
[HWNode][N01_TIER5_PIE_V06] PASS - run held (scenario finished without a crash)
```

판 기록(`Saved/HWNode/last_run.json`)에도 `threatGrade` · `tier5{pass,checks}` · 적마다 공진 단계(7번째 칸)가 들어간다 — 시뮬과 같은 모양이라
`node tools/ue/node-compare.mjs` 가 그대로 받는다. 시뮬은 기술자→정문 판 세 시드에서 일곱 다 PASS, 기본 판에선 «철갑→정문» 을 **FAIL 로 짚는다** (거짓 PASS 없음, 시험으로 박음).

- 머리 위 라벨: `T5 / BREAKER` · `TARGET: GENERATOR` (공진 받으면 `~RES~`). Shipping 빌드엔 안 나온다. `?HWLabels=0` 으로 끄고 폰 프레임을 본다.
- HUD: `ThreatGrade 5 - all six roles   RESONANCE: 6 strengthened (move x1.10, attack x1.12) - kill the resonator`
- 웨이브마다 로그: `[HWNode] wave 4: T5_WALKER x5 T5_ARMORED x1 T5_RESONATOR x1 ThreatGrade=5`
- 판 기록 목표 글자: 발전기를 `e` 로 (정문 `g` 와 갈라 «파괴형→발전기» 가 리플레이에서 읽힌다).

## 7. 같이 고친 것 — 측면 길 입구에서 영영 못 나오던 질주형

W5 의 32번 질주형이 스폰 자리에서 한 발도 못 갔다. 측면 경사로 입구에서 160 cm 흩뿌리면 길섶(스폰 발판)에 떨어지는데,
경사로 옆면이 발판보다 **64 cm** 높아(턱 45 초과) 옆으로 올라탈 수 없다. UE 캡슐도 같은 면에 막힌다 (같은 상자 기하).
이제 질주형은 길 입구 **뒤 150 cm 에서 60 cm 만** 흩어진다 (UE `SpawnEnemy` · 시뮬 `spawn` 같이). 막힘 0.

## 7.5 코드 리뷰(읽기 전용 에이전트)에서 고친 것

- «공진 풀림» 판정은 **살아 있는 공진형이 줄어든 갱신**에서만 센다 — 공진 받던 적이 반경 밖으로 걸어 나간 것(공진형 290 < 공진 받은 무리 313 cm/s)은 아니다.
- 공진형의 «무리» 에서 **서 있는 정문 건너편** 적은 뺀다 — 측면을 돈 질주형이 무리 중심을 정문 북쪽으로 끌어, 공진형이 정문을 치러 가던 것.
- 판정은 «정문 차단 뒤의 실제 목표» 로 센다(그대로 둠): v06 이 원하는 건 «파괴형이 플레이어를 지나 **발전기를 친다**» 는 행동 증거라서. 그래서 정문이 W3 에 무너지면 «철갑→정문» 이 FAIL 이다 (§5).
- 쓰이지 않게 된 `NearestTargetableNpc` 제거, Shipping 의 미사용 인자, 경직 주석.

## 8. 시험

- `tests/vectors/node-rules.json` `combat.tier5` — 등급·원형 id·공진(단계·반경·자리)·역할별 재평가·철갑 순환/균열/예비·NPC 점수·PIE 증거.
  JS 는 바로, C++ 은 벡터에서 굽는다. **일부러 11곳을 어긋나게** (중첩 상한 2, 공진형 자기 강화, 파괴형 순서, 내려찍기 자리, 기술자 중요도, W4 공진형 빼기, 풀림 판정, Ally 빼기 — C++·JS 양쪽) 해서 전부 실패하는 걸 봤다.
- `Scripts/tests/node_rules_test.cpp` · `Private/Tests/HWNodeRulesTest.cpp` — 36체·200초·여섯 역할 다 나옴·공진·철갑·추적.
- `tests/ue-node-sim.test.cjs` — PIE 일곱 항목(세 시드) · 공진형이 죽은 뒤 첫 프레임에 공진 0 (공진을 안 푸는 돌연변이로 실패 확인).
- `tests/ue-node-compare.test.cjs` — UE 판 기록 형식 14개, `tier5` · 공진 칸이 시뮬과 같다.

UE 컴파일·PIE 는 여기서 못 돌린다 — 디렉터 PC 에서 `?HWNode` 판을 돌리고 Output Log 의 `N01_TIER5_PIE_V06` 줄을 보면 된다.
