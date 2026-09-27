# 119. UE5 전투 Vertical Slice — Phase A/B 실행 기록 (2026-09-27)

디렉터 지시: `CLAUDE_HWANGHON_UE5_VERTICAL_SLICE_PHASE_AB.md`(문서 118 의 실행판, 원문은 아래 부록 A). 「기존 Three.js 전투는 규칙·밸런스·데이터 참조용, 렌더/애니/VFX 구조 포팅 금지, 새 기능·콘텐츠 금지. UE5 모바일 프로젝트 → 서한역 Graybox → 아인 → 보스 → lock-on → 1→2→3 → smash → dodge/jump/counter → 보스 combo/lunge/slam/big → 피격 반응 → 20~30 초 영상 → Android 실기기 성능.」

## 0. 결론 먼저 — 이 컨테이너에서 된 것 / 안 된 것

| 완료물(지시 §15) | 상태 | 어디 |
|---|---|---|
| 1 UE 프로젝트 구조 | **골격 작성(컴파일 미검증)** | `ue/HwanghonCombatUE/` — .uproject(5.5) · Config(Android Vulkan, Mobile Deferred/Forward Device Profile 3 tier) · C++ 모듈 7 클래스 · README |
| 2 Seohan_Combat_VS01 | 그레이박스 «생성기» 작성 | `HwSeohanGraybox`(전투방·레일·벽·기둥·천장등·비상등·젖은 바닥) + `Scripts/build_seohan_vs01.py`(편집기에서 .umap 생성) |
| 3 아인 graybox playable | 코드 작성 | `HwCombatCharacter` — locomotion·락온 카메라·attack/smash/dodge/jump/counter·버퍼·연계·히트스톱·피격 |
| 4 보스 graybox playable | 코드 작성 | `HwBossGraybox` — d01 3 단계 패턴(JSON) tell→strike→contact→recover, 관통 돌진, jumpOnly, 카운터 3 단, additive 반동, 자세/다운 |
| 5 lock-on | 코드 작성 | 카메라 요우만 표적 추종(줌·흔들림·FOV 펌프 없음) |
| 6~8 1→2→3 · smash · dodge/jump/counter | 코드 작성 — **판정값은 three.js 와 같은 JSON** | `Content/Data/combat_rules.json` ← `tools/ue/export-combat-rules.mjs` (테스트 4 개 통과) |
| 9 보스 combo/lunge/slam/big | 데이터 포팅 + 상태기계 | awake 단계: 훅 연타 내려찍기(2 연계) · 회전 후려치기 · 도약 내려찍기(7.2 m) · 돌진(관통 9.2 m) · 앞차기 · 지면 충격파(jumpOnly) |
| 10 hit reaction | 코드 작성 | 위계 light<finisher<smash<counter<stagger<break, 순서 contact→hitstop→recoil→(FX·사운드·숫자는 뒤 단계) |
| 11 20~30 초 combat capture | **불가** | UE5 실행 환경 없음(§5) |
| 12 Android build | **불가** | UE5·Android SDK/NDK·실기기 없음 |
| 13 frame metrics | **불가** — 계측 코드만 | `HwCombatAudit`(P6 와 같은 JSON → `tools/combat-audit-report.mjs`) |
| 14 blocking issue list | §5 | |

**작성했지만 실행·컴파일하지 못한 코드**라는 점을 분명히 한다. 「항상 해보고 이미지로 보여줘」를 이번엔 지킬 수 없었다 — 이유는 §5. 가장 먼저 필요한 것은 **UE 5.5 가 설치된 작업용 PC(Windows 권장) + Android Studio/NDK + 실기기 1 대**이고, 그 위에서 이 골격을 열어 컴파일 오류를 잡는 것이 Phase B 의 첫 작업이다.

## 1. Phase A — 벤치마크 고정

- 레퍼런스: 문서 117(블소 레볼루션 모바일 모션, 디렉터 원문 + 부록 A 장면 분석), 문서 111(와일드리프트 기준 평가), 문서 85(마영전·몬헌 카메라·연출), 렐라나 tell/strike/recovery(문서 «렐라나» 학습 항목, 작업 #153).
- **20~30 초 스토리보드 (지시 §0 시퀀스)**

| # | 초 | 장면 | 카메라 | 통과 기준 |
|---|---|---|---|---|
| 1 | 0~2 | 접근: 아인이 레일 옆에서 보스(허수아비 계열)에게 4 m → 1.8 m 로 | 락온, 뒤·위 3.6 m | 첫 5 초가 프로토타입처럼 안 보임(그레이 재질에서도 실루엣 분리) |
| 2 | 2~4.2 | 1→2→3 | 요우만 추종, 줌 없음 | idle 0 프레임 · 접점 ±2 프레임(60 fps) · 3 타 실루엣 최대 · 지지발 ≤ 2 cm |
| 3 | 4.2~5.4 | smash (들기→머묾→내리침→박힘→회수) | 제한된 임펄스 1 회 | 접점 뒤 바로 가속하지 않음 |
| 4 | 5.4~8 | 보스 연계(훅 연타 내려찍기 2 연계): tell → 압축 → strike → contact → follow → recovery | 고정 | tell 실루엣만으로 구별 · recovery 가 punish window 를 보여줌 |
| 5 | 8~9 | 회피(iframes 0.30) → 바로 공격 | 고정 | 회피→공격 사이 idle 없음 |
| 6 | 9~11 | player hit(앞차기) → 경직·밀림 | 흔들림 최소 | 숫자보다 몸이 먼저 |
| 7 | 11~13 | counter(tele ≤ 0.14) → clash/repel → 후속 1→2 | 카운터 임펄스 1 회 | counter→후속 idle 없음 |
| 8 | 13~16 | stagger/break → 자세 100 → down 5 s → 큰 기술(smash tier 3) | 제한된 FOV 변화 | break 위계가 smash 보다 큼 |
| 9 | 16~20 | 보스 big(도약 내려찍기 7.2 m 또는 돌진 9.2 m 관통) → 점프/회피 | 관통 뒤 180° 급회전 금지 | 급회전 없음 |

- 샷 리스트(아인/카인/보스 Hero 단계용)는 문서 117 §(모션 기준) 과 118 §7 을 따르고, Hero 모델 단계(Phase D) 전에는 만들지 않는다(그레이박스 우선).

## 2. Phase B — 그레이박스 (작성 내용)

### 2.1 프로젝트
`ue/HwanghonCombatUE/README_KR.md`. 렌더 기본: Android Vulkan · `r.Mobile.ShadingPath=1`(High Device Profile) / 0(Mid·Low) · MSAA 4/2/1 · Nanite/Lumen 끔 · 정적 조명 허용. 화면 배율 1.0/0.85/0.7, `t.MaxFPS` 60/60/30. 값은 시안(근거 없음), 실기기 계측으로 정한다.

### 2.2 규칙 데이터 포팅 (코드가 아니라 데이터)
`node tools/ue/export-combat-rules.mjs` → `Content/Data/combat_rules.json`. 옮긴 것: 행동 시간표(attack1/2/3 0.66 s·hit 0.24·active 0.09·cancel 0.48; smash 1.15/0.48; counter 0.56/0.18; ult/exec/skill1~4), 입력 버퍼 0.16, defCancel 0.06, combo(gap 0.55·배율·smash tier), dodge(iframes 0.30·cd 0.45·perfect 0.14), jump(0.45·cd 0.8·st 15·height 1.1), counter(창 0.25·perfect 0.10·mid 0.17·배율), stamina(120·18/s·delay 0.6·dodge 25), hitstop 12 종, stagger light/heavy/guard(밀림 px→m), posture(100·down 5 s·downMult 1.5), d01 보스 3 단계(부위·패턴·counterable·jumpOnly·lunge·공격 이동 m). `tests/ue-combat-rules-export.test.mjs` 4 개가 원본과 대조한다. UE 쪽 `UHwCombatRulesAsset::LoadFromJson`(FJsonObjectConverter).

### 2.3 서한역 그레이박스
전투방 24×16×4.2 m, 레일 2 줄(1.435 m 궤간) + 침목, 강철 기둥 6, 천장등 8(RectLight warm 1.0/0.88/0.72, hero 그림자는 2 등만), 비상 적색 악센트 2(600 lm, 절제), 하늘광 cool(0.62/0.72/0.90 · 0.35), 안개 0.02. 파편·데칼·젖은 재질은 Phase E. 값 근거 없음 — 영상으로 조정.

### 2.4 아인 (그레이박스: 캡슐, 몽타주 비어 있으면 시간표만)
three.js `combat.js` 플레이어 상태기계의 **의미**만 옮겼다(action/elapsed/hitAt/cancelAt/defCancelAt/buffer/combo/comboT/dodgeT/lockT). 유일한 런타임 모션 보정 = «접점 리타임»: 몽타주의 접점 비율(ClipContactFrac) 이 정확히 hitAt 에 오도록 앞 구간 속도, 접점 뒤 남은 길이가 duration 에 끝나도록 뒤 구간 속도. 발 고정·체간 스윙·궤적·procedural cinema 는 옮기지 않는다(원본 애니메이션이 맡는다). 카메라: 락온 요우만, 거리 3.6 m, FOV 60, 어깨 오프셋 — 근거 없음.

### 2.5 보스 (그레이박스: 캡슐 + 큐브 + 핵 구)
모든 패턴 tell(tele s) → strike(window s, 공격 이동 at 지점에서 contact) → recover(0.7 s, 근거 없음) → 다음 tell (idle «자세» 없음 — recover 끝 자세에서 잇는 것은 몽타주가 담당). 관통 돌진: 경로 위 접촉 = 판정, 감속·회전은 몽타주. 피격: additive 스프링 반동(light .06 · finisher .11 · smash .16 · counter+ .22 m, 근거 없음) — 공격을 끊지 않음. 카운터: tele ≤ perfect → clash / ≤ mid → repel / 그 밖 deflect, 자세 가산 ×1.5/1.0/0.47, stagger 1.0/0.8/0.55 s. 자세 100 → down 5 s.

### 2.6 검수
`UHwCombatAudit` 가 50 ms 표본(gap·penetration·bossLunge·clip·elapsed)과 이벤트(actionstart/actionend/hit/whiff/bossreact/playerhit/counter/dodge/jump/telegraph/strike)를 P6 와 같은 키로 `Saved/HwAudit/*.json` 에 쓴다 → `tools/combat-audit-report.mjs` 그대로. 60 fps 목표: 접점·반응 ≤ 2 프레임.

## 3. 애니메이션 source / 라이선스 (현재 보유분 — UE 에 «그대로» 가져가지 않고 후보로만)

| 클립 | 원본 | 라이선스 | UE slice 판단 |
|---|---|---|---|
| attack1(2H_Melee_Attack_Slice), attack2(Chop), smash(Spin), 로코모션 | KayKit Character Pack Adventurers / Animations 1.1 | CC0 1.0 | 그레이박스 임시용 가능. 지시 §5 «attack2 는 새 source» — 후보 교체 |
| attack3(찌르기)·counter·skill1·skill2 | Meshy 리깅+애니 (문서 74) | Meshy 약관(플랜별 상업 이용) — **확인 필요** | 상용 전 확인 |
| 보스 hookR/L·kick·slam·charge·spin | Quaternius UAL2 · KayKit 1.1 (문서 88) | CC0 | 그레이박스 임시용 |
| 구르기·기상·피격·브레이크 | CMU Motion Capture DB (`art/3d/mocap/SOURCES.md`) | 연구·상업 사용 자유, 재판매 금지 | 가능 |
| 도약(jump) | 절차 생성(문서 158) | 자체 | UE 에서는 새로 |

Phase C 원칙(118 §8): 고품질 authored/mocap → retarget → contact retime → foot cleanup → weapon IK → additive → VFX. 블소 애니메이션 복제 금지(타이밍·포즈 문법만).

## 4. 아인 1/2/3 접점 프레임 · 포즈 시트
UE 캡처는 없다. 현재 three.js 계측(문서 116 §4b·§9)이 «같은 판정값» 이므로 UE 에서 맞춰야 할 목표치로 쓴다: 접점 0.213 s(speed 1.128) = 규칙 0.24 s; 3 타 실루엣 > 2 타 > 1 타; 지지발 ≤ 2 cm(현재 attack2 5.3 cm 미달); 1→2·2→3 idle 0 프레임(현재 30 fps 봇 1 프레임, 60 fps 이음매 §116 5.4).

## 5. Blocking issue (이 컨테이너)

1. **UE5 없음·설치 불가**: `unrealengine.com`·`github.com/EpicGames`(소스는 Epic 계정 연동 + EULA 동의 필요) 모두 프록시 403. 컨테이너 디스크 여유 14 GB(UE 5.5 Linux 편집기만 ≈ 25~40 GB), GPU 없음(swiftshader 는 UE 편집기·셰이더 컴파일에 부적합), CPU 4 코어(셰이더 컴파일 수 시간).
2. **Android 툴체인·실기기 없음**: SDK/NDK 미설치(`ANDROID_HOME` 비어 있음), 기기 없음 → APK 빌드·FPS/p95/p99/50 ms/CPU/GPU/draw call/메모리/셰이더 히치 계측 불가.
3. **이진 자산을 저장소에 못 만든다**: .umap/.uasset(몽타주·스켈레탈 메시·입력 자산) → 편집기 파이썬 스크립트·C++ 생성자로 대체. 첫 실행자가 `Scripts/build_seohan_vs01.py` 를 돌려야 맵이 생긴다.
4. **컴파일 미검증**: UE 5.5 API 로 썼지만 빌드 오류 가능(특히 EnhancedInput 자산의 코드 생성, RectLight 단위 함수). 첫 빌드에서 잡는다.
5. **아인/보스 원본 애니메이션**: 지시 §5 «attack2 는 현재 source 가 못 만들면 새 source» — 새 authored/mocap 원본 확보 경로(라이선스 포함)가 정해지지 않았다. 후보: CC0(KayKit/UAL2) 는 «되받아치기(reverse cut)» 가 없음 → 제작 또는 구매 필요.
6. **Meshy 클립 상업 라이선스 확인** 필요(attack3·counter·skill1/2).

## 6. 다음에 UE 가 있는 PC 에서 (순서)
1. 프로젝트 열기 → 컴파일 오류 수정 → `build_seohan_vs01.py` → Play(캡슐·큐브 그레이박스로 1→2→3·smash·dodge·counter 동작 확인, 감사 JSON → report).
2. 아인 스켈레탈 메시(임시: UE 마네킹) + 몽타주 5 개(attack1/2/3·smash·counter, 접점 노티파이) → 접점 리타임 확인(60 fps 2 프레임).
3. 보스 마네킹 + tell/strike/recover 몽타주 6 패턴.
4. 20 초 시퀀스 캡처(Trail OFF·HUD 없음·그레이 재질) → 통과 판정(§17 8 문항) → Android 빌드·계측 → Phase C/D.

## 부록 A. 디렉터 지시 원문 (`CLAUDE_HWANGHON_UE5_VERTICAL_SLICE_PHASE_AB.md`)

# Claude Code 실행 지시 — 황혼 UE5 전투·그래픽 리빌드 Phase A/B

목표는 기존 Three.js 전투를 계속 덧대는 것이 아니라,
Blade & Soul Revolution NEXT급 모바일 액션 RPG 품질을 목표로 UE5 기반 Vertical Slice를 새로 만드는 것이다.

전체 게임을 옮기지 않는다.

이번 작업 범위:
- UE5 신규 Vertical Slice
- 아인
- 보스 1종
- 서한역 계열 전투방 1개
- 20~30초 전투
- 기존 황혼 전투 규칙 재현

새 콘텐츠 개발 금지.

## 1. 기존 저장소 취급

기존 Three.js 구현은 설계/데이터 참조본으로 사용한다.

참조:
- js/combat.js
- js/dungeons.js
- boss patterns
- damage
- stamina
- dodge
- counter
- jumpOnly
- stagger/break
- combo timing

Three.js 렌더/animation/VFX 코드를 UE에 1:1 포팅하지 않는다.
procedural motion patch를 그대로 포팅하지 않는다.

목표:
좋은 animation source + 최소 runtime correction.

## 2. UE5 프로젝트

새 모바일 Vertical Slice 프로젝트를 만든다.

프로젝트명:
HwanghonCombatUE

초기 렌더:
- Android Vulkan
- High: Mobile Deferred 후보
- Mid/Low: Forward 후보

Nanite/Lumen을 필수 전제로 만들지 않는다.
Lumen은 high-end Android 실험 옵션으로만 다룬다.

## 3. 첫 맵

Seohan_Combat_VS01

graybox 구성:
- 전투방
- rail
- concrete wall
- steel pillar
- ceiling light
- emergency red accent
- wet floor area

아트보다 전투 camera/movement/contact가 먼저다.

## 4. 플레이어

첫 플레이어는 아인.

필수:
- locomotion
- lock-on
- attack
- smash
- dodge
- jump
- counter
- hit
- stagger

기존 황혼 combat timing을 참조한다.

기본 3타 비교 기준:
- total action 0.66s
- contact 0.24s

수치는 UE Data Asset로 분리한다.

## 5. 아인 3타

B&S Revolution의 연계 무공 원리를 참고한다.
animation 복제 금지.

힘 전달:
foot → pelvis → torso → shoulder → arms → scythe → contact → follow

attack1:
- 공격 선을 연다.
- 지지발 확실.
- 골반 선행.
- 끝 pose를 neutral로 돌리지 않는다.

attack2:
최우선.
attack1 follow → pelvis reverse → chest reverse → attack2
- neutral reset 금지
- 재감기 최소
- reverse cut
- 팔보다 몸이 먼저 움직임
- 현재 source가 못 만들면 새 animation source 사용

attack3:
- 가장 큰 finisher
- 1/2보다 큰 torso drive
- 강한 follow
- 명확한 recovery

## 6. 보스

플레이어와 동시에 만든다.

필수:
1. 기본 2~3타 combo
2. lunge
3. slam
4. big attack
5. counterable attack

모든 공격:
tell → compression → strike → contact → follow → recovery

공격 사이 idle reset 금지.
recovery pose가 punish window를 보여줘야 한다.

## 7. 피격 반응

보스:
- light
- finisher
- smash
- counter
- stagger
- break

attack animation을 매번 끊지 말고 additive reaction 우선.

접점:
1. contact
2. hitstop
3. recoil
4. FX
5. sound
6. damage number

## 8. animation 검수

VFX 없이 먼저 통과.

검수:
- gray material 가능
- trail OFF
- bloom OFF/minimum
- HUD minimum

확인:
- combo idle frame 0
- attack1→2 seamless
- attack2→3 seamless
- foot slide
- contact
- boss recoil
- recovery

contact/hit/reaction 오차 목표:
60fps 기준 2 frame 이내.

## 9. camera

기본 lock-on camera.

기본 공격:
- 과도한 zoom 금지
- 큰 shake 금지
- FOV pump 금지

전신과 weapon arc가 읽히는 거리 우선.
큰 기술에만 제한적 camera impulse.

## 10. Hero asset

Graybox combat 합격 후.

Ain:
- face
- body
- deformation
- hair
- outfit
- scythe

현재 모델을 무조건 포팅하지 말고 근접 카메라 품질 검사 후 교체 판단.

## 11. materials

첫 Hero material:
- skin
- hair
- fabric
- leather
- metal
- wet concrete
- painted steel

같은 조명에서 roughness/specular response가 구별돼야 한다.

## 12. lighting

서한역:
- cool ambient
- warm key
- restrained red accent
- character rim
- contact light

검정/빨강 덩어리 화면 금지.
어두워도 얼굴/몸/무기/보스 silhouette가 구별돼야 한다.

## 13. 모바일 최적화

처음부터 실제 Android build.

측정:
- FPS
- p95/p99
- 50ms spike
- CPU game thread
- GPU
- draw calls
- triangles
- texture memory
- peak memory
- shader hitch

성능을 마지막에 몰아서 해결하지 않는다.

## 14. 품질 tier

High:
Android Vulkan + Mobile Deferred 후보

Mid:
경량 Deferred/Forward

Low:
Forward + baked/static 중심

Device Profile로 분리 가능하게 만든다.

## 15. 이번 단계 완료물

1. UE 프로젝트 구조
2. Seohan_Combat_VS01
3. Ain graybox playable
4. Boss graybox playable
5. lock-on
6. 1→2→3
7. smash
8. dodge/jump/counter
9. boss combo/lunge/slam/big
10. hit reaction
11. 20~30초 combat capture
12. Android build
13. frame metrics
14. blocking issue list

## 16. 절대 하지 말 것

Vertical Slice 품질 통과 전:
- 새 던전
- 새 스토리
- 새 장비 시스템
- 새 UI 페이지
- PvP
- 신규 캐릭터 양산
- 신규 성장 시스템

추가하지 않는다.

## 17. 완료 판단

- Trail을 꺼도 공격이 멋있는가?
- 공격 사이 idle pose가 없는가?
- 보스 tell을 silhouette만으로 읽는가?
- recovery가 공격 기회를 설명하는가?
- damage number 없이도 타격이 느껴지는가?
- 캐릭터/보스가 배경에서 분리되는가?
- Android frame pacing이 안정적인가?
- 첫 5초가 prototype처럼 보이지 않는가?

NO가 크면 기능 추가 금지. 그 문제부터 고친다.

## 18. 완료 보고

- UE 프로젝트 구조
- 포팅한 combat rule
- 구현 action 목록
- animation source/라이선스
- attack contact frame
- player/boss pose sheet
- 20~30초 영상
- Android 성능 수치
- art/render screenshot
- blocking issue

이번 작업은 황혼의 새 3D 전투 기반을 만드는 작업이다.
기존 Three.js 화면을 예쁘게 꾸미는 작업이 아니다.
