# Claude — N01 5급 몬스터 적용 지시

이 패키지의 `References/황혼_남산_거점_5급_감염체_시안.png`가 사용자가 승인한 원본이다.
새 이미지를 만들거나 디자인을 재해석하지 말 것.

1. 현재 프로젝트의 Enemy base/Pawn/AI/Combat interface를 READ-ONLY 감사.
2. 6종 모두 `ThreatGrade=5`로 구현.
3. 가능한 경우 기존 Enemy BP에 `UHwanghonWaveMonsterComponent`를 붙이고 DataAsset으로 역할만 분리.
4. 새 전투 프레임워크/새 보스 프레임워크 생성 금지.
5. N01 WaveDirector가 `N01_Tier5_Waves_v04.json`의 6종 archetype을 매핑하도록 수정.
6. 우선 Graybox/더미 메시로 PIE 실행.
7. AI 타겟 우선순위 실제 검증:
   - Breaker -> Generator
   - Stalker -> NPC
   - Armored -> Gate
   - Resonator -> 군집 후방
8. 공진형 Aura는 서버 권위로 적용하며 중첩 상한 1회.
9. 기존 카운터 시스템이 있다면 Armored에 연결하되 기존 수치/코드를 덮어쓰지 말 것.
10. 변경 파일, 컴파일 결과, PIE 결과를 보고.

아트 제작 단계에서는 승인 레퍼런스 6열을 각각의 3D 제작 기준으로 사용한다.
