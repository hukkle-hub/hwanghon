# 116. 전투 질감 회복 패스 v12 — GPT P0~P5 적용 + d01 아인 20 초 검수 (2026-09-27)

디렉터 지시(같은 날 순서대로): ① 03:56 `CLAUDE_COMBAT_POLISH_V12_v2.md` — 새 기능 중단, 낫 궤적 → 아인 1·2·3 타 모션 → 보스 공격 중 피격 반응 → 전체 붉은 플래시 → 근접 카메라 → d01 조명 → VFX/SFX 순. ② 05:14 `CLAUDE_AFTER_P0_P1_V12.md` — 공격별 프레임 표·통과 기준. ③ 06:41 `CLAUDE_APPLY_AND_REVIEW_V12_FIXED.md` + ④ 06:5x 번들 v4/v5 + `CLAUDE_APPLY_AND_REVIEW_V12_P0_P5.md` — **GPT 패치 6+1 개를 순서대로 적용·개별 테스트·커밋**한 뒤 20 초 영상, 프레임 감사, 원본 클립 교체 여부는 그 뒤에만.

`combat.js`(피해·판정 시각·회피/점프 무적·기력·보스 피해)는 **diff 0 줄**. UI/HUD/모바일 버튼은 GPT 패치 1 번(조작/HUD)으로만 바뀌었다.

- 참고 영상 `Screen_Recording_20260927_114302.mp4` 는 업로드 폴더에 없다(07:51 녹화본만). «수정 전» 은 main `eae2d8f` 를 같은 봇·같은 조건으로 구운 20 초 영상으로 대신했다.
- 패치가 오기 전(03:56~06:40)에 내가 같은 항목을 직접 구현해 두었었다(궤적·보스 반동·플래시·근접 카메라·조명·footlock 재굽기). 패치 지시가 오자 **패치를 기준으로 삼고** 내 구현은 겹치는 부분을 버렸다. 남긴 것은 §2.

## 1. 적용 커밋 (base `eae2d8f`, 순서 v5)

| # | 커밋 | 패치 | 내용 | 적용 상태 |
|---|---|---|---|---|
| 1 | `1bb9d3d` | `hwanghon_gpt_v12_controls_readability_v2_fixed.patch` | 점프 전용 버튼·큐, 점프 중 공격/카운터 잠금, 사정거리 링 0.08→0.10/0.035→0.06, 모바일 카운터 배너 회피, `tw:input` | 깨끗. 기존 테스트 2 개 기대 문자열 갱신(링 투명도, `jumpIn('keyboard')`) |
| 2 | `1f51f4d` | `hwanghon_combat_polish_p0_v12_fixed.patch` | 낫 궤적 시간 리본 0.11/0.17 s·날 바깥 0.76~1.03(안)/0.70~1.08(밖)·0.22 m 재표본·TRN 64, 보스 additive 반동 항상(hit .42/.20, 좌우 방향), 일반 hit 전체 빨강 제거(무거운 타격만 0.055 s, FLASHC 0x2a180f), d01 노출 .82→.92·hemi .42→.50·안개 ↓·붉은 역광 2.6→1.8·인물 필 1.1→1.6 | game3d/boss-motion hunk 4 개가 들여쓰기·줄 번호로 거부 → 같은 줄에 손으로(내용 동일). 옛 궤적 내부(TRN 28·0.30 s)를 못박던 테스트 2 개 갱신 |
| 3 | `fdbcd87` | `hwanghon_combat_polish_p1_v12_fixed.patch` | character-cinema 전신 레이어를 실제 hitAt 에 동기화(1 타 예비·2 타 되받아치기·3 타 큰 마무리), 카메라 near 1.2→1.6, 2.1 m 안 nearK(피치 +.055·거리 +.58·어깨 +.30·주시점 −.08) | 카메라 hunk 3 개 손으로(내용 동일) |
| 4 | `37d7a02` | `hwanghon_combat_polish_p2_v12_fixed.patch` | 접점 위계 light<crit<finish<smash<counter: 섬광 .30/.43/.53/.68/.82~1.00 · 85/105/120/145/160 ms · 파편 5/8/10/14/16~20, 재질 2 차(짚 먼지·금속 스파크)는 finish 이상만, 타격음 음량 .40~.62·피치 1.04~.88 | 깨끗. audio 테스트 기대 재생 속도 갱신 |
| 5 | `1dbaa5c` | `hwanghon_combat_polish_p3_mobile_v12_fixed.patch` | 모바일 auto/medium 소품 castShadow 끔(아인·보스 유지), 모바일 일회성 PointLight 생략 | loadProps hunk 손으로 |
| 6 | `8164964` | `hwanghon_combat_polish_p4_combo_handoff_v12_fixed.patch` | actionend 뒤 20 ms 안에 다음 actionstart 가 오면 idle/run 을 거치지 않고 끝 자세→다음 공격 cross-fade | 깨끗 |
| 7 | `f3c5742` | `hwanghon_combat_polish_p5_contact_foot_v12_FIXED.patch` | 아인 attack1/2/3/smash 접점 ±85/75 ms(스매시 140/45) 동안 덜 움직인 발을 다리 IK 로 세계 고정, plantSide/plantError 진단 | 깨끗 |
| 8 | `3e8beb2` | (Claude 보정) | §2 | — |

각 단계 개별 테스트 + `npm test` 통과(마지막 497/497). 패치 안 README 5 개(`README_*_KR.md`)도 그대로 들어왔다.

## 2. Claude 보정 (8/8) — 20 초 녹화 분석에서 나온 것만

| 무엇 | 어디 | 근거 |
|---|---|---|
| 접점 끌림 따라잡기 완만 | `game3d.js tickDrag` `dragLag - dt*2.2` → `dt*max(0.7, lag/남은 행동 시간)` | 접점 저항(문서 65)은 그림 시계만 늦춘 뒤 **3.2 배**로 따라잡았다. 그 한 프레임에 들린 발이 44 cm(attack2)·29 cm(attack3)·25 cm(attack1·smash) 순간 이동 — «지지발 미끄러짐» 으로 읽혔고 spec «접점 직후 바로 가속» 실패 항목. 판정 시계는 그대로, 그림만 최대 1.7 배 |
| 보스 핵 빛 | `coreLight` 거리 9→5.5 m, 큰 기술 정점 `charge*7`→`*3.5` | 스매시 접점 직후 아인이 통째로 붉게 되는 것은 피격 플래시가 아니라 보스 «양손 내려찍기» 달아오름 핵 빛(정점 11)이었다(전·후 영상 둘 다). 핵 스프라이트가 읽기를 맡는다 |
| 관통 돌진 뒤 급회전 억제 | `startLunge` → `camCalmT=0.9`, 그동안 요우 상한 ×0.4 | spec §5 «관통 lunge 뒤 180° 급회전 금지». P1 에는 없음 |
| 3 타·스매시 화각 +3° | `fv+=3` | spec «낫 핵심 호가 화면 밖으로 잘리지 않게». 흔들림 계수는 손대지 않음 |
| 플레이어 피격 플래시 | 0.18 s 0x802020 → 0.10 s 0x4a1a12 | 수정 전 영상: 맞는 순간 아인이 단색 빨강. 옷 재질이 남게 |
| GLB extras → 클립 userData | 로드 직후 `animations[i].extras` 복사 + `ain-bind-repair` footlock 예외 | 우리 GLTFLoader(vendor) 는 클립 extras 를 안 옮긴다 → 발 고정 재굽기 클립을 넣어도 골반 XZ 가 rest 로 덮여 무효였다(계측: 골반 세계 XZ 가 공격 내내 mm 단위로 고정). 이번엔 **GLB 를 안 바꿨다**(디렉터: P0~P5 뒤 실패한 클립만). 도구 `tools/3d/clip-footlock.mjs` 만 커밋 |
| 바람 스프라이트 | 0.9×0.35·0.045 s → 0.55×0.20·0.07 s | 스매시 때 노란 구름 |
| `TW_DUNGEON.renderInfo` | draw call·삼각형 진단 | 성능 보고용 |

값 근거: 0.7·5.5·3.5·0.9·+3°·0.10 s 는 시안(근거 없음), 영상으로 검수.

## 3. 20 초 영상 (d01 · 아인 · 락온, 같은 봇·같은 시드, 1280×720 30 fps)

(§3~§6 은 녹화 뒤 채운다)
