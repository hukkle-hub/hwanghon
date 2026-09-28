# Claude Code — SYSTEM CORE v2.4 적용

최신 main에 `HWANGHON_SYSTEM_CORE_V2_4_CURRENT_MAIN_FINAL.zip`을 저장소 루트 기준으로 병합.

실행:

```powershell
powershell -ExecutionPolicy Bypass -File tools\ue\integrate-system-core-v2-current.ps1
```

## 이번 패스 핵심

1. 캐릭터 원본 수치를 실제 combat runtime에 적용:
   - Ain 24450 / 2980 / 1780 / ASPD 112.5 / MSPD 105
   - Kain 38200 / 3410 / 2960 / 96 / 98
   - Ryu 21800 / 2640 / 1520 / 124 / 112
   - Sera 19600 / 1480 / 1610 / 100 / 104

2. 서버 `store.stats()`:
   - base DEF 누락 수정
   - critChance / critDamage 추가
   - MSPD / moveMult 추가

3. Server Raid 시작:
   - 2명 이상 제한 제거
   - 의뢰 계약대로 1~4명 authoritative Raid 허용

4. Kain:
   - server/local threat ×1.25 일치

5. Sera:
   - Skill4 회복 결계가 가까운 파티원에게도 HP 15% 회복
   - 3초간 피해 50% 감소
   - online 효과는 server authority

## 절대 보존

- 한 플레이어 = 캐릭터 한 명
- 캐릭터 실시간 교대 없음
- CommitDeath / OnDied / OnBossDied / UHWQuestRunSubsystem 퇴행 금지
- client가 damage/part/reward를 authoritative하게 계산하지 않음

## 검수

### Compile
- UE 5.8.1 C++ / UHT 0 error
- Hwanghon.* automation
- npm test

### Character
각 캐릭터 실제 확인:
- MaxHP
- basic damage
- attack timing
- movement speed
- incoming damage after DEF

ASPD 예상 예:
- Ain 기본 0.66s clock -> 약 0.587s
- Kain -> 약 0.688s
- Ryu -> 약 0.532s
- Sera -> 0.660s

### Authority
- 1P room ready/start 가능
- 2P / 4P 유지
- Kain이 같은 damage 기준으로 더 높은 threat 생성
- Sera Skill4가 근거리 동료도 회복/보호

### Existing system
- down/revive
- boss phase/break/parts
- expedition/interact/gate/hazard
- wipe/retry
- reconnect

완료 후 commit/push하고 SHA + 실패한 gate만 보고.
