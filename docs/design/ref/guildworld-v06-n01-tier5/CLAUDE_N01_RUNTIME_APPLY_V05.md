# Claude 적용 지시 — N01 Tier5 Runtime v05

## 목적
승인된 5급 6종을 남산 Prototype에 실제 행동으로 붙인다.
아트 재생성 금지.

## 순서
1. 현재 Enemy Character / AIController / BT / Target system을 READ-ONLY 감사.
2. 동일 기능이 있으면 v05 C++를 그대로 추가하지 말고 기존 클래스에 최소 병합.
3. Player, Gate, Generator, Comms, NPC에 target classification을 연결.
4. 6종 Enemy BP에 각 DataAsset과 WaveMonsterComponent 연결.
5. 역할별 BT/StateTree:
   - Walker: Player → Gate
   - Runner: Player/후방 flank
   - Breaker: Generator → Comms → Gate
   - Stalker: Engineer/Medic/Civilian
   - Armored: Gate → Player
   - Resonator: ally centroid 뒤쪽 유지
6. Resonator Aura를 서버 권위로 연결. 중첩 1.
7. Armored 공격 3종을 기존 카운터 인터페이스에 연결.
8. N01 v04 Wave를 v05 역할 데이터로 스폰.
9. PIE에서 debug label로 모든 적 `T5 / Role / CurrentTarget` 표시.
10. 아래 증거 캡처:
    - Breaker가 근처 플레이어를 지나 Generator 공격
    - Stalker가 기술자를 추적
    - Armored가 Gate 압박
    - Resonator 생존 전/후 주변 적 speed/attack 값 변화
11. Compile + PIE + 기존 Boss regression 확인.

## 하지 말 것
- 보스 시스템 재작성
- 새 캐릭터 베이스 프레임워크
- 5급을 3/4급으로 변경
- 승인 이미지를 다른 디자인으로 대체
- 최종 3D 모델이 없다는 이유로 작업 중단
