# OpenStreetMap — 실제 공간 맵 출처 · 사용 조건 기록

2D 맵 MMORPG 의 실제 공간 맵(docs/design/185 §6.5)은 OpenStreetMap 데이터로 만든다.

- 출처: https://www.openstreetmap.org — Overpass API (`maps.mail.ru/osm/tools/overpass`, 미러)로 받음
- 라이선스: **Open Database License (ODbL) 1.0** — https://www.openstreetmap.org/copyright
- 표기: **«© OpenStreetMap contributors»** — 맵을 보여 주는 화면(`mmo.html` 왼쪽 아래)에 늘 띄운다.

## 무엇을 받았고 어디에 있나

| 파일 | 내용 | ODbL 상 성격 |
|---|---|---|
| `maps/2d/<zone>/osm.json` | 건물 윤곽·층수·높이, 도로 중심선·차로 수, 지하철 출구 위치·번호, 횡단보도·신호등 위치, 상가 업종 | **파생 데이터베이스** — ODbL 그대로 공개한다(이 저장소에 원본 그대로 둔다) |
| `maps/2d/<zone>/t_*.webp`, `d_*.png` | 위 데이터로 세운 장면을 구운 그림 | **제작물(Produced Work)** — 출처 표기만 하면 된다 |
| `maps/2d/<zone>/map.json` | 걷는 띠·충돌 윤곽(건물 다각형)·출구 좌표 | 파생 데이터베이스 — ODbL |

- `tools/2d/osm-extract.mjs` 가 원본 Overpass JSON → `osm.json` 로 바꾼다. 다시 받으면 같은 명령으로 갱신한다.

## 쓰지 않는 것

- **상호(가게 이름)·건물 이름은 버린다.** 실제 상표를 게임에 그리지 않는다 — 간판은 업종(편의점·약국·치과 …)으로만.
- 지도 타일 이미지(openstreetmap.org 의 그림)는 쓰지 않는다. 데이터만 받아 우리가 그린다.
