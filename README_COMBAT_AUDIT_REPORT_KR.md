# 황혼 전투 감사 JSON 분석

P6 `?combatAudit=1`에서 저장한 JSON을 자동 판독한다.

```bash
node tools/combat-audit-report.mjs hwanghon-combat-audit-....json report.md
```

판독:
- P4 콤보 handoff 시간과 idle 경유
- action `hitAt` 대비 visual hit 이벤트 오차
- P5 최대 지지발 오차
- 실제 플레이어↔보스 최소 거리
- P0 보스 reaction 관측 지연
- FPS / p95 / p99 / 50ms 초과

임시 검수 문턱:
- handoff ≤ 35ms, idle 경유 0
- hit 오차 ≤ ±25ms
- plant error ≤ 2cm
- 실제 최소 간격 ≥ 0.80m
- boss reaction ≤ 50ms
- p95 ≤ 20ms PASS, 20~25ms CHECK

최소 간격이 0.80m 아래로 실제 측정됐을 때만 P7 body separation을 넣는다.
