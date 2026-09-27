# HwanghonCombatUE — 황혼 UE5 모바일 전투 Vertical Slice (Phase A/B 골격)

디렉터 문서: `docs/design/118`(마스터플랜) · `docs/design/119`(Phase A/B 실행 기록·차단 항목).

## 이 폴더가 «무엇인가»
- **텍스트로 저장소에 넣을 수 있는 것 전부**: `.uproject`, `Config/*.ini`(Android Vulkan · Mobile Deferred(High)/Forward(Mid·Low) Device Profile), C++ 모듈 `Source/HwanghonCombat`, 규칙 데이터 `Content/Data/combat_rules.json`, 맵 생성 스크립트 `Scripts/build_seohan_vs01.py`.
- **이진 자산(.uasset/.umap)은 없다** — 편집기에서 스크립트로 만든다. 몽타주·스켈레탈 메시는 Phase C 에서 넣는다(지금은 그레이박스: 캡슐 + 큐브, 몽타주 없이 시간표만 돈다).
- 이 골격은 **UE5 가 없는 컨테이너에서 작성했고 컴파일하지 못했다**(`docs/design/119 §5`). 처음 여는 사람이 컴파일 오류를 잡아야 한다 — API 는 UE 5.5 기준.

## 열기 (UE 5.5, Windows/macOS/Linux)
1. `HwanghonCombatUE.uproject` 우클릭 → Generate project files → IDE 에서 `HwanghonCombatUEEditor` 빌드.
2. 편집기 → Output Log 에서 `py "Scripts/build_seohan_vs01.py"` → `/Game/Maps/Seohan_Combat_VS01` 생성.
3. Play: 아인(캡슐) 이 −4 m, 보스 그레이박스가 +4 m. 키보드 검수: WASD 이동 · J/좌클릭 공격 · K/우클릭 스매시 · Shift 회피 · Space 점프 · L 카운터 · Tab 락온.
4. 감사 JSON: 플레이 종료 시 `Saved/HwAudit/audit_*.json` → `node tools/combat-audit-report.mjs Saved/HwAudit/audit_*.json report.md` (three.js P6 와 같은 판독).

## 규칙 데이터 (판정은 three.js 와 «같은 값»)
`Content/Data/combat_rules.json` 은 `node tools/ue/export-combat-rules.mjs` 가 `js/dungeons.js` 에서 뽑는다. `tests/ue-combat-rules-export.test.mjs` 가 원본과 대조한다(평타 0.66 s / 접점 0.24 s / cancel 0.48, 스매시 1.15/0.48, 연계 gap 0.55, 회피 무적 0.30, 카운터 창 0.25(단계별 0.14), 기력 120/18, 히트스톱 위계, 자세 100/다운 5 s, d01 보스 3 단계 패턴·공격 이동).
규칙을 바꾸려면 `js/dungeons.js` 를 고치고 다시 내보낸다 — UE 쪽에서 숫자를 손대면 «근거 없음» 이 된다.

## 코드 구조
| 파일 | 역할 | three.js 대응 |
|---|---|---|
| `HwCombatRules.*` | 규칙 DataAsset, JSON 로더 | `js/dungeons.js RULES` |
| `HwCombatCharacter.*` | 아인: locomotion·락온 카메라·attack/smash/dodge/jump/counter·입력 버퍼(0.16)·연계(comboT)·히트스톱·피격 | `js/combat.js` 플레이어 쪽 (규칙만, 렌더/VFX 없음) |
| `HwBossGraybox.*` | d01 보스: tell → strike → contact → recovery, 관통 돌진, jumpOnly, 카운터 3 단, additive 반동, 자세/다운 | `js/combat.js` 보스 쪽 + `boss-motion.js` 의 «반응은 additive» 원칙만 |
| `HwSeohanGraybox.*` | 전투방 그레이박스 + 천장등(warm key)·비상 적색·하늘광(cool)·안개 | `game3d.js` d01 환경의 «의도» 만 |
| `HwCombatAudit.*` | P6 와 같은 감사 JSON (events/samples/frameMetrics) | `?combatAudit=1` |
| `HwCombatGameMode.*` | 기본 폰 = 아인 | — |

런타임 모션 보정은 **접점 리타임 하나**(몽타주 접점 비율 → hitAt 에 정렬, 앞/뒤 두 구간 속도). 발 고정·체간 스윙·궤적 등 three.js 의 절차 보정은 옮기지 않는다 — 좋은 원본 애니메이션이 대신한다(Phase C).

## 아직 없는 것 (Phase C~G)
아인/보스 스켈레탈 메시·몽타주, 애니메이션 원본(authored/mocap), Hero 재질, VFX, 사운드, UMG 패드, Android 빌드·실기기 계측. 목록과 차단 사유는 `docs/design/119 §5`.
