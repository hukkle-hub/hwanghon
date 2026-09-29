# 황혼 v4 — Party → Dungeon 실제 흐름

```text
Loading
  ↓
Character Select
  ↓
Shelter Matchmaker
  ↓
B-1 Dedicated Server (24 players target)
  ↓
마태오 / 인력사무소
  ↓
Create Party
  ↓
Look at player + Invite
  ↓
Accept / Ready
  ↓
Party Leader selects mission
  ↓
POST /v1/match/dungeon
  ↓
pre-warmed Dungeon Server reserved
  ↓
individual one-time join tickets issued
  ↓
party ClientTravel
  ↓
Dungeon Server validates ticket
  ↓
1~4 player dungeon
```

## Dev key bindings

- `P`: 파티 생성
- `I`: 바라보는 플레이어 초대
- `Y`: 초대 수락
- `N`: 초대 거절
- `R`: 준비/해제
- `L`: 파티 나가기
- `G`: 파티장 출정

모바일/최종 제품에서는 Common UI 버튼이 동일한 Server RPC를 호출하면 된다.

## Server authority

Shelter server owns:
- party membership
- leader
- ready states
- dungeon request

Matchmaker owns:
- free shelter/dungeon instance registry
- dungeon reservation
- one-time join ticket

Dungeon server owns:
- ticket validation
- combat
- boss
- drops
- result

## Important

This v4 uses a pre-warmed dungeon pool.
A production orchestrator (Kubernetes/ECS/Agones/GameLift-style) can later replace the allocation step without changing the client party RPC contract.
