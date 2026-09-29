# 황혼 Online Native v6 — 시작 마을 / 인력사무소 귀환

## 수정된 게임 루프

```text
Loading
→ Character Select
→ 강남 B-1 시작 마을
→ NPC / 생활 / 파티 준비
→ 인력사무소
→ 출격 셔터
→ Dungeon
→ Clear / Retreat
→ 인력사무소 귀환
→ 마태오 결과 정산
→ 다음 준비
```

## v6 변경

- 쉘터를 Starting Town으로 명확히 고정
- 최초 진입 Spawn: `HH_TownStart`
- 던전 귀환 Spawn: `HH_ManpowerOffice_Return`
- Return ticket이 귀환 지점을 결정
- Dungeon ticket에 원래 shelter instance 보존
- 가능한 경우 원래 shelter로 귀환
- 원래 shelter가 불가능하면 다른 instance로 fallback
- fallback이어도 항상 인력사무소에서 생성
- 귀환 HUD: `마태오에게 결과 보고 / 정산`
- 인력사무소 접근축에 귀환 arrival pad 프록시 추가
- shelter builder 기본 GameMode를 OnlineGameMode 우선으로 변경

실제 아트에서는 arrival pad를 B-1 디자인에 맞는 작은 검문/제독/승강기 구역으로 교체한다.
