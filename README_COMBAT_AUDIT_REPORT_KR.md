# 황혼 전투 감사 JSON 분석

P6 `?combatAudit=1`에서 저장한 JSON을 자동 판독한다.

```bash
node tools/combat-audit-report.mjs hwanghon-combat-audit-....json report.md
```

판독:
- P4 콤보 handoff 시간과 idle 경유
- action `hitAt` 대비 visual hit 이벤트 오차
- P5 최대 지지발 오차
- 중심 거리 + `player.r + boss.r` 기반 body penetration
- 의도된 boss lunge 관통과 일반 근접 overlap 분리
- P0 보스 reaction 관측 지연
- FPS / p95 / p99 / 50ms 초과

임시 검수 문턱:
- handoff ≤ 35ms, idle 경유 0
- hit 오차 ≤ ±25ms
- plant error ≤ 2cm
- 일반 body penetration ≤ 8cm PASS / 8~20cm CHECK / >20cm FAIL
- boss reaction ≤ 50ms
- p95 ≤ 20ms PASS, 20~25ms CHECK

보스 관통 돌진을 제외한 일반 body penetration이 8cm를 넘으면 P7 후보로 올리고,
20cm를 넘으면 우선 수정 대상으로 본다.
