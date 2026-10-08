# 서버 권위 상태 계약 v0.3

Unreal GameInstanceSubsystem은 클라이언트/세션 캐시로 사용할 수 있지만 MMORPG 영속 상태의 최종 권위자는 백엔드여야 한다.

## Backend authoritative
- Guild membership / role
- Alliance membership
- Management cycle contribution snapshot
- Node manager
- Node operational state
- Node threat
- Region pressure
- Strategic order list
- National campaign result

## Unreal session authoritative during an encounter
- 현재 인스턴스의 NPC/Facility HP
- Wave progress
- Boss combat state
- Player combat result

Encounter 종료 시 서버에 outcome event를 전송하고 백엔드가 Node/Region 상태를 갱신한다.

## 권장 이벤트
- `node.defense.completed`
- `node.defense.failed`
- `node.repair.completed`
- `node.recapture.completed`
- `guild.contribution.delta`
- `guild.order.issued`
- `guild.order.cancelled`
- `region.network.step`
- `campaign.objective.resolved`

클라이언트가 ManagingGuildId, Contribution 총점, RegionPressure를 직접 확정하지 않는다.
