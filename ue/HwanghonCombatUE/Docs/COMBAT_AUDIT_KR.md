# Combat Audit — UE Vertical Slice

자동 생성 파일:
`Saved/CombatAudit/HwanghonAudit_YYYYMMDD_HHMMSS.csv`

자동 저장:
- 10초마다
- PIE 종료 시
- F9 수동 저장

20Hz sample:
- frame ms
- player action
- player action phase
- HP / stamina
- boss state
- boss pattern
- boss state phase
- player↔boss gap
- capsule penetration
- last boss reaction tier
- reaction age

event:
- player_contact
- player_damaged

## 첫 품질 판정

### Motion
- 1→2 / 2→3에 idle action 없음
- contact 시각은 Anim Notify와 CSV event를 영상 frame에 맞춘다.
- boss reaction age는 contact 직후 50ms 이하 목표.

### Collision
capsule penetration:
- 0~8cm: PASS
- 8~20cm: CHECK
- >20cm: FAIL 후보

lunge는 의도된 관통이므로 영상/패턴 상태와 함께 해석한다.

### Frame
CSV frame_ms:
- 16.7ms = 60fps
- p95/p99 계산은 후처리 스크립트 단계에서 추가.
