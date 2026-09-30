# Boss Blueprint / Encounter 연결 v10

## 1. Boss BP

각 실제 보스 Blueprint에서:

```text
Class Settings
→ Implemented Interfaces
→ HHBossPresentationInterface
```

이벤트:

```text
HH_BossIntroBegin(BossId)
HH_BossIntroBeat(BossId, Beat)
HH_BossIntroEnd(BossId)
```

### Begin

서버 권한에서:
- AI 공격 시작 금지
- Encounter phase = Intro
- 피해/부위 파괴 판정 잠금
- Root Motion/이동은 컷신용 상태만 허용

로컬/시각:
- Intro idle / pre-pose
- 필요한 환경 FX 준비

### Beat

```text
PlayerEntry
Silhouette
ScaleReveal
SignatureMotion
Handback
```

각 Beat에서 해당 보스의 실제 Montage / Actor state / Sound를 실행한다.

중요:
- SignatureMotion은 실제 전투 Actor/기믹 상태를 사용.
- 컷신 전용 가짜 약점/파괴/노드를 만들지 않는다.

### End

서버 권한:
- 피해 판정 활성
- AI 활성
- Encounter phase = Combat
- 첫 패턴 시작

클라이언트:
- 전투 HUD 표시
- 카메라 플레이어 복귀

---

## 2. Level 구성

필수 Actor:

```text
HHBossIntroDirector
HHBossIntroTrigger

HHBossIntroAnchor_PlayerEntry
HHBossIntroAnchor_Silhouette
HHBossIntroAnchor_ScaleReveal
HHBossIntroAnchor_SignatureMotion
HHBossIntroAnchor_Handback
```

각 Anchor:
- BossId 동일
- Beat 지정
- Camera FOV 조정
- 필요하면 HoldOverride / BlendOverride

## 3. 자동 블록아웃

```text
Content/Python/build_boss_intro_template.py
```

사용:
1. 실제 보스룸 오픈
2. 실제 Boss Actor 선택
3. script의 `BOSS_ID` 지정
4. 실행
5. 생성된 다섯 카메라는 반드시 직접 재배치

자동 생성 카메라 위치는 최종 카메라가 아니다.

---

## 4. Encounter Trigger

`AHHBossIntroTrigger`

첫 플레이어가 진입하면 서버에서:

```text
Director.StartBossIntro(false)
```

재도전:

```text
Director.StartBossIntro(true)
```

파티 전체를 특정 위치까지 기다려야 하는 보스는
이 단순 Trigger를 그대로 쓰지 말고 Encounter Manager에서
PartyReady 조건 뒤 Director를 호출한다.

---

## 5. HUD

등장 중:

```text
HUD hidden
```

등장 종료:
```text
HUD restored
Boss HUD appears
```

큰 Boss Title card는 만들지 않는다.

보스 이름은 전투가 시작된 후
Boss HUD에서 자연스럽게 처음 읽힌다.

---

## 6. 네트워크

Director:
- Replicated Actor
- Server start
- Reliable NetMulticast
- 로컬 카메라만 전환

Boss gameplay state:
- 반드시 Server Authority

Blueprint Event에서 상태를 바꿀 때:
```text
Has Authority
```
분기 필수.

---

## 7. 현재 생산 ID

```text
TUTORIAL_SCARECROW
CLAVE_GANGNAM
CELESTIAL_NAMSAN
AEGIS07_SDC
LEVIATHAN_HANRIVER
EXPERIMENT09_PANGYO
SHADOWFANG_GWANAK
ARSENAL_GYERYONG
PARK_GYERYONG
IRONWARDEN_YEOUIDO
LEE_FINAL_LINE
MINISTERJEONG_GOHEUNG
NANONOVA_GOHEUNG
```

오르도는 현재 생산 ID에 넣지 않는다.
