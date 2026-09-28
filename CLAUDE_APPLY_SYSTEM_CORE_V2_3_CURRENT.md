# Claude Code — SYSTEM CORE v2.3 적용

최신 main에 `HWANGHON_SYSTEM_CORE_V2_3_CURRENT_MAIN_FINAL.zip`을 저장소 루트 기준으로 병합.

실행:

```powershell
powershell -ExecutionPolicy Bypass -File tools\ue\integrate-system-core-v2-current.ps1
```

## 이번 v2.3에서 반드시 확인

1. `PendingCharacterName / PendingCharacterId`는 `UHWRaidNetworkSubsystem` private 멤버여야 한다.
   - `FHWRaidNetEvent` 안에 있으면 안 됨.
2. UE compile/UHT에서 Network struct 오류 0.
3. 온라인 프로필 캐릭터가 이미 만들어진 상태에서 다른 로컬 캐릭터 선택으로 상태가 갈라지지 않아야 함.
4. `ain/kain/ryu/sera` 중 한 캐릭터만 출격.
5. 캐릭터 교대 시스템 추가 금지.

## 보존

현재 main의:
- `CommitDeath`
- `OnDied`
- `OnBossDied`
- `UHWQuestRunSubsystem`
- 출격 기록/실패/Leave lifecycle

절대 퇴행시키지 말 것.

## 실검수

- UE 5.8.1 compile
- Hwanghon.* Automation
- npm test
- 1P dungeon
- 2P: 서로 다른 독립 캐릭터, down/revive
- 4P: boss scaling/threat/parts/phase
- expedition/interact/gate/hazard
- wipe/retry
- reconnect

온라인 damage/phase/part/reward는 `server/raid.cjs` authority.
UE는 intent/prediction/presentation/reconciliation만 담당.

완료 후 main에 커밋/푸시하고 commit SHA + 남은 blocker만 보고.
