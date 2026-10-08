# Claude — N01 v06 PIE 실행 지시

v05 적용 이후 진행.

1. Live project의 기존 debug text/debug draw 체계를 먼저 확인.
2. 동일 기능이 있으면 `HwanghonWaveMonsterDebugComponent` 대신 기존 debug system에
   `ThreatGrade / Role / CurrentTarget`만 추가한다.
3. Pilot Level에 target classification 연결.
4. 6종 Enemy BP에 debug label을 활성화.
5. `AHwanghonN01PIETestController` 또는 기존 automated gameplay test에 동일 시나리오 병합.
6. 5개 Wave를 자동 실행.
7. Output Log의 PASS/FAIL 결과 캡처.
8. 아래 화면을 각각 캡처:
   - Breaker -> Generator
   - Stalker -> Engineer/Medic
   - Armored -> Gate
   - Resonator aura active
9. 기존 `AHwanghonBossBase` 기반 보스 테스트 1회 실행하여 regression 확인.
10. Android Mobile Preview에서 라벨 OFF 상태로 프레임 드랍 여부 확인.

절대로 승인된 컨셉 이미지를 다시 만들지 말 것.
모든 몬스터는 5급 유지.
