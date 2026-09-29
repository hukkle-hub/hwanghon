# v6 검증

## 최초 접속
- Character Select
- Shelter ticket consume
- `HH_TownStart` 생성
- 마을 탐색 가능

## 던전 출정
- Party
- 전원 셔터 대기구역
- Dungeon ticket
- Dungeon DS 입장

## 귀환
- Dungeon complete
- 원래 shelter instance 우선 요청
- Return ticket `spawnPoint=ManpowerOfficeReturn`
- `HH_ManpowerOffice_Return` 생성
- 마태오가 바로 보이는 위치인지 확인
- PartyId / Leader 복원
- HUD가 `귀환 · 인력사무소`로 바뀌는지 확인

## fallback
- 원래 쉘터 종료 또는 슬롯 부족
- 다른 쉘터 instance
- 여전히 인력사무소 귀환
