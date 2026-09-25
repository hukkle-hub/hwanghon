# 황혼 — 아인·카인·세라·류 40세트 bone-bound v02

정적 v01 40개를 **24개 Mixamo형 관절 계층에 파트별 rigid parenting**으로 직접 바인딩한 2차 후보입니다.

## 이번에 한 것
- 캐릭터별 기준 키 유지: 아인 1.68m / 카인 1.86m / 세라 1.72m / 류 1.78m
- Y-up / meter 유지
- 의상 파츠를 이름/위치 역할에 따라 Hips, Spine2, Arm, ForeArm, Leg, Foot 등에 연결
- 무기 노드는 손 본에 연결 (쌍단검/정제환은 좌우 손 분리)
- bind / attack / guard / run / dodge 5자세로 30세트 전부 변환 검사
- GLB 재로드 검사 및 자세별 bounds/바닥 관통 수치 기록

## 중요한 제한
이 버전은 **smooth skin weighting이 아닌 rigid bone parenting**입니다. 금속 갑주·벨트·가방·무기 검수에는 유효하지만, 소매·코트·천 패널의 최종 스키닝/천 물리를 대체하지 않습니다. 기존 게임 `*_body.glb` 또는 `*_anim.glb`를 덮어쓰지 마세요.

## 다음 승격 조건
실제 프로젝트 24본과 이름/바인드 매트릭스를 대조한 뒤, 천/소매 파츠를 smooth weight로 전환하고 실제 attack/run/roll/skill 클립에서 관통을 검사해야 합니다.

자동 검사: 40 GLB 재로드, 150 pose 상태. 중대한 수치 이슈 0건.
