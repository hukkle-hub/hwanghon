# HwanghonCombatUE — Vertical Slice 0.1

이 폴더는 황혼의 기존 Three.js 전투를 꾸미는 패치가 아니라,
**새 UE5 모바일 전투 Vertical Slice의 첫 C++ 기반**이다.

## 현재 들어간 것

### 플레이어
- WASD 이동
- T 락온
- Space/J 기본 공격
- U Smash
- K Dodge
- I Jump
- L Counter
- Attack1 → Attack2 → Attack3 direct queue/handoff
- 0.66s / hit 0.24s 기본 3타
- dodge iframe / jumpOnly 판정 기반
- hitstop
- stamina

### 보스
- LockOnTarget
- HookCombo
- Charge
- Slam
- Spin
- GroundWave(jumpOnly)
- tell → strike → recovery state
- lunge 이동
- counterable beat
- additive reaction용 Blueprint event

### Graybox
- 바닥/벽
- warm key + red accent
- empty level에서 GameMode가 arena와 boss를 자동 spawn
- player를 시작 위치로 재배치

### 모바일
- Android Vulkan
- Mobile Deferred `r.Mobile.ShadingPath=1`
- High-tier baseline

UE 5.8에서는 Mobile Deferred가 모바일 품질/동적 조명에 유리한 경로이므로
Vertical Slice의 High tier 기준으로 사용한다.

## 아직 없는 것

- 실제 아인/카인/보스 hero mesh
- Animation Blueprint
- Montage/animation source
- weapon socket
- trail/VFX
- HUD
- Android 실기기 빌드 측정
- Mobile Forward fallback profile

이것들은 다음 단계에서 얹는다.

## 실행 순서

1. UE 5.5에서 `HwanghonCombatUE.uproject` 열기 (uproject EngineAssociation 5.5 — 디렉터 결정 2026-09-27)
2. C++ compile
3. Empty Level 생성
4. World Settings GameMode = `HWCombatGameMode`
5. PIE
6. T로 보스 lock-on
7. 1→2→3 / smash / dodge / jump / counter 확인

GameMode가 player 위치, graybox arena, boss를 자동으로 준비한다.

## 코드 검증

UE 없이도:

```bash
python Scripts/verify_scaffold.py
```

UE가 있는 환경에서는 Automation:
- `Hwanghon.Combat.PlayerTimingDefaults`
- `Hwanghon.Combat.BossVerticalSlicePatterns`

를 실행한다.

## 다음 우선순위

1. Animation Blueprint + Montage section
2. Ain 1/2/3 실제 animation source
3. boss tell/strike/recover 실제 animation
4. contact notify
5. foot plant
6. gray material 상태 20초 영상
7. 그 뒤 hero model/material/lighting
