# 황혼 SYSTEM CORE v2.4 DELTA

기준 main: `c6f3f2d9445292723222ab2ba68efe62b635acd5`

이 패키지는 SYSTEM CORE v2.3 전체를 다시 설치하지 않는다.
이미 UE 5.8.1에서 1P/2P/4P 검증을 통과한 최신 main 위에 **캐릭터 성능 정체성 + 스킬 판정 + 보스 snapshot 정밀화**만 추가한다.

## 1. 캐릭터 실제 전투 수치

디자인 시트 원본값을 UE 로컬 전투와 서버 권한 전투 양쪽에 반영한다.

| 캐릭터 | HP | ATK | DEF | 치명 | 치피 | ASPD | MSPD |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ain | 24,450 | 2,980 | 1,780 | 18.2% | 142.6% | 112.5 | 105 |
| Kain | 38,200 | 3,410 | 2,960 | 9.4% | 118% | 96 | 98 |
| Ryu | 21,800 | 2,640 | 1,520 | 22.6% | 151% | 124 | 112 |
| Sera | 19,600 | 1,480 | 1,610 | 6% | 110% | 100 | 104 |

### UE local
- MaxHealth 적용
- 기본공격/Smash를 Base ATK 비율로 적용
- DEF는 서버 Raid와 같은 `min(25%, DEF/(DEF+5000))`
- ASPD는 실제 combat clock에 적용
- MSPD는 CharacterMovement MaxWalkSpeed에 적용
- 치명/치명피해 실제 판정
- 회피형 Skill2 이후 다음 공격 강제 치명
- 캐릭터별 Runtime Tuning duplicate → 서로의 DataAsset 수치를 오염시키지 않음

## 2. 스킬 판정 정합성

기존 로컬 fallback은 Skill1/3/Ult가 버튼 순간 한 번 피해를 주었다.
v2.4에서는 서버의 스킬 사건표 방향과 맞춰:

- Ain 회전: 다단 2회
- Kain 회전: 다단 2회
- Ryu 난무: 3회
- Ryu 폭풍: 3회
- Sera 투척: 비행 지연 후 폭발
- Sera 연쇄폭발: 지연 2회
- Kain part-break 배율
- Kain stomp posture 추가
- 캐릭터별 Ultimate contact 수

를 로컬 Graybox에서도 실제 시간 이벤트로 처리한다.

## 3. 역할 차이

### Kain
- 로컬 threat ×1.25 유지
- 서버도 `threatMult=1.25`

### Sera
- 로컬/서버 Skill4가 자기 자신만이 아니라 근거리 생존 파티원에게
  - HP 15% 회복
  - 3초간 피해 50% 감소

## 4. 서버 authoritative stats 보완

기존 `server/store.cjs::stats()`가 누락하던 값을 전달한다.

- base DEF
- critChance
- critDamage
- mspd
- moveMult
- Kain threatMult

온라인 damage/part/phase/reward authority 자체는 계속 `server/raid.cjs`다.

## 5. 온라인 보스 snapshot 정밀화

기존 UE 온라인 보스는 HP와 state 위주라서:
- boss max HP
- posture
- current pattern id
- counterable
- telegraph/recover 진행도

가 presentation에 충분히 전달되지 않았다.

v2.4에서 snapshot → UE BossActor에 위 값을 연결하고,
HUD boss bar도 매 프레임 authoritative MaxHP를 사용한다.

## 6. 절대 유지되는 계약

- 한 플레이어 = 캐릭터 1명
- 전투 중 캐릭터 교대 없음
- 3캐릭터 편성 없음
- 기존 v2.3 `CommitDeath / OnDied / OnBossDied / QuestRun` 유지
- 기존 문서 129 캐릭터 몸/애니메이션 설정 유지
- 온라인 결과 authority는 서버

## 7. 적용

```powershell
powershell -ExecutionPolicy Bypass -File tools\ue\integrate-system-core-v2-4.ps1
```

순서:
1. v2.4 preflight
2. delta 적용
3. delta/server regression
4. npm test
5. UE 5.8.1 compile
6. `Hwanghon.System.CharacterIdentity` + `Hwanghon.*`
7. 기존 `tools/ue/system-core-qa.cjs all` 1P/2P/4P 실검수

## 8. 이 패키지에서 직접 검증한 것

- apply/preflight Python syntax PASS
- delta static tests: 9 PASS / 0 FAIL
- server 실파일이 필요한 2 tests는 패키지 단독 환경에서 SKIP

최종 PASS 판정은 Claude PC의 최신 저장소에서 UE compile + 기존 SYSTEM CORE QA를 통과한 뒤 내린다.
