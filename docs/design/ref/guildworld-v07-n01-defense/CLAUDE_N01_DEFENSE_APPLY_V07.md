# Claude 적용 지시 — N01 v07

1. Live 프로젝트에서 기존 Encounter/Wave/Enemy Registry/Facility death 이벤트를 먼저 감사.
2. 기존 기능이 있으면 `AHwanghonN01EncounterDirector`를 그대로 중복 추가하지 말고 규칙만 병합.
3. Wave Spawn 직후 `RegisterEnemy`.
4. 실제 Enemy Death event에서 `UnregisterEnemy`. Actor Destroy는 fallback만 사용.
5. 각 Wave Spawn 완료 시 `NotifyWaveSpawned(1..5)`.
6. Gate HP 0 -> `NotifyGateDestroyed`; 절대 즉시 패배시키지 않는다.
7. Generator HP 0 -> `NotifyGeneratorDestroyed`; 전투 계속.
8. Comms HP 0 -> `NotifyCommsDestroyed`; Occupied.
9. `OnRequestDefenseLineReroute`에서 기존 BT/StateTree/Nav Anchor를 새 전선으로 갱신.
10. PIE 증거:
   - Gate 붕괴 전 MainGate 전투
   - Gate 붕괴 후 CentralPlaza 후퇴
   - 마지막 Wave가 스폰되어도 적이 남아 있으면 Invasion 유지
   - 마지막 적 사망 순간 Recovery
   - Comms 파괴 시 Occupied
11. 기존 보스 시스템 regression 확인.

승인된 5급 6종의 외형과 등급은 수정하지 않는다.
