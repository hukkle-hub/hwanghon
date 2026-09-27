# 황혼 전투 감사 보고

| 항목 | 값 | 판정 |
|---|---:|---|
| 기록 길이 | 24.0s | — |
| 콤보 handoff | — | NO_DATA |
| idle 경유 | 0회 | PASS |
| hit 시각 오차 | attack1 7ms, attack2 7ms, attack3 7ms, smash 3ms, counter 0ms, attack1 7ms, attack2 7ms, attack3 7ms, attack1 7ms, counter 0ms, attack1 7ms, attack2 7ms, attack3 7ms, attack1 7ms, attack1 7ms, counter 0ms, attack1 7ms, attack2 7ms, attack3 7ms, attack1 7ms, attack1 7ms | PASS |
| 최대 지지발 오차 | 5.3cm | CHECK |
| 최소 중심 간격 | 0.95m | — |
| 일반 전투 최대 body penetration | 68.7cm | FAIL |
| 최악 일반 overlap 순간 | 18.24s · attack1 · boss telegraph · 68.7cm | — |
| 관통 돌진 중 최대 penetration | 0.0cm | 의도된 관통 |
| 보스 반응 지연 | attack1 0ms, attack2 34ms, attack3 0ms, smash 0ms, counter 33ms, attack1 0ms, attack2 33ms, attack3 0ms, attack1 33ms, counter 0ms, attack1 33ms, attack2 0ms, attack3 33ms, attack1 33ms, attack1 34ms, counter 0ms, attack1 33ms, attack2 0ms, attack3 33ms, attack1 33ms, attack1 33ms | PASS |
| FPS | 30 | — |
| p95 frame | 33ms | FAIL |
| p99 frame | 33ms | — |
| 50ms 초과 | 0 | — |

## 해석
- combo CHECK: P4 뒤에도 1→2→3 사이 base 자세가 끼거나 handoff가 35ms를 넘는다.
- contact CHECK: visual hit 이벤트가 action hitAt에서 ±25ms보다 멀다.
- plant CHECK: P5 지지발 목표 오차가 2cm를 넘는다.
- overlap PASS: 보스 관통 돌진을 제외한 body penetration이 8cm 이하.
- overlap CHECK: 8~20cm. 영상에서 실제 메시 관통이 보이는지 확인한다.
- overlap FAIL: 일반 전투에서 20cm 초과. P7 body separation 우선 후보.
- bossLunge=true 표본은 의도된 관통이므로 일반 overlap 판정에서 제외한다.
- reaction CHECK: hit 뒤 50ms 안에 boss additive reaction이 관측되지 않는다.
