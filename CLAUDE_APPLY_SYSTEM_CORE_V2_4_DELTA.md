# Claude Code 전달용 — SYSTEM CORE v2.4 DELTA

최신 main에는 이미 SYSTEM CORE v2.3 및 문서 129가 적용되어 있다.
**v1/v2.3 전체 패키지를 다시 적용하지 말고** 이 v2.4 delta만 병합한다.

기준 확인 SHA: `c6f3f2d9445292723222ab2ba68efe62b635acd5`
그 이후 main이 움직였어도 preflight가 PASS하면 적용 가능하다.

## 실행

```powershell
powershell -ExecutionPolicy Bypass -File tools\ue\integrate-system-core-v2-4.ps1
```

preflight가 FAIL하면 억지로 적용하지 말고 현재 문맥에 맞춰 delta를 최소 수정한다.

## 이번 변경 범위

### 캐릭터
- Ain: 24450 / 2980 / 1780 / Crit 18.2 / CritDmg 142.6 / ASPD 112.5 / MSPD 105
- Kain: 38200 / 3410 / 2960 / 9.4 / 118 / 96 / 98
- Ryu: 21800 / 2640 / 1520 / 22.6 / 151 / 124 / 112
- Sera: 19600 / 1480 / 1610 / 6 / 110 / 100 / 104

실제 HP/피해/방어/공속/이속/치명 판정에 적용.
캐릭터 교대는 추가하지 않는다.

### 스킬
서버 skill event 방향과 로컬 fallback contact timing을 맞춘다.
다단히트/투사체 지연/강제 치명/Kain 부위배율·posture를 실제 판정으로 확인.

### 역할
- Kain threat server/local ×1.25
- Sera 회복결계는 근거리 파티원도 회복+피해감소

### 보스 온라인
- authoritative maxHP
- posture
- pattern id
- counterable
- state progress
- HUD maxHP

을 snapshot에서 UE presentation으로 연결.

## 반드시 보존

현재 main의 아래 코드는 퇴행시키지 마:
- CommitDeath / OnDied
- OnBossDied
- UHWQuestRunSubsystem
- HWSystemQASubsystem
- tools/ue/system-core-qa.cjs
- 문서 129 캐릭터 visual settings / server clip presentation

## 실검수

통합 스크립트가 자동으로:
- npm test
- UE compile
- Hwanghon.* Automation
- 1P / 2P / 4P 기존 SYSTEM CORE QA

까지 돌린다.

추가 확인:
1. Ryu 기본공격 clock이 가장 빠르고 Kain이 가장 느린지
2. Kain 실제 HP/DEF가 가장 높은지
3. Sera ATK는 낮지만 파티 회복이 실제 동료에게 들어가는지
4. Kain 동일 피해에서 threat가 더 높은지
5. 온라인 Boss HUD maxHP가 phase/party scale과 맞는지
6. 온라인 telegraph에서 pattern id가 NAME_None으로 사라지지 않는지
7. 부위파괴/브레이크/재접속/위험지대가 v2.3 대비 회귀하지 않는지

완료 후 main에 커밋/푸시하고:
- commit SHA
- UE compile
- Automation pass count
- npm test count
- 1P/2P/4P QA gate
- 실패 gate만 보고.
