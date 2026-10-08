# Claude 적용 지시 v0.3

## 우선 확인
1. v0.2 또는 대응 GuildWorld 코드가 실제 프로젝트에 존재하는지 확인.
2. 동일 역할의 기존 Outpost/Region/WorldState 시스템이 있으면 중복 추가 금지.
3. 실제 모듈명/API export macro/Include 경로 확인.
4. 기존 `AHwanghonBossBase`, `AHwanghonBossAIController`는 손대지 않는다.

## 적용 순서
1. `HwanghonGuildWorldTypes.h`에 NodeOperationalState/서비스 필드 병합.
2. `HwanghonGuildWorldConfig.h`에 NodeLinks 및 서비스 설정 병합.
3. GuildWorldSubsystem에 Network Step API 병합.
4. 서울 8거점을 DataAsset 또는 서버 seed 데이터로 생성.
5. N01 남산 결과를 `SetNodeOperationalState` / `AddNodeThreat`에 연결.
6. GuildCommandBoard는 기존 길드 직책/권한 시스템과 연결.
7. PIE에서 남산 함락 → N02/N06/N07 Threat 증가 확인.
8. 남산 탈환 → Recovering → Online 복구 확인.
9. 회귀 테스트: 기존 보스/전투/길드 공헌도 정상.

## Prototype 합격
- N01 함락이 Intel 서비스를 떨어뜨린다.
- N01 하나가 함락됐다고 서울 전체가 즉시 붕괴하지 않는다.
- 연결 Threat 전파가 step당 cap을 지킨다.
- 복구로 서비스가 회복된다.
- N04 함락은 Logistics에 직접 영향 준다.
- 길드 직책별 전략 명령 권한이 분리된다.

## 중요한 구현 원칙
Network Step은 Tick에서 매 프레임 돌리지 않는다.
백엔드/지역 서버 타이머(예: 30분 논리 스텝) 또는 이벤트 기반으로 호출한다.
