# GPT 지시서 · 전국 길 문을 서버도 알게 (2026-10-09, Claude)

## 배경
디렉터: «전체 맵 매끄럽게 전부 연결». 2단계 13곳(대전·부산·제주 …)은 문이 하나도 없어 어디서도 못 갔다.
Claude 가 3D 필드(`world3d.html`)에 **길 문 28 개**를 넣었다 — 표는 `js/mmo/zone-links.js` 의 `LINKS` (14 줄).
```
① 계룡 → 대전 → 전주 → 목포 ⇢(여객선) 제주 → 서귀포
② 고흥 → 여수 → 부산 → 해운대 → 경주 → 경포 → 속초 → 춘천 → 수원 → 판교
```
문은 걷는 띠 끝(end: s0 · s1) 근처 큰길 위. 길 끝까지 걸어가면 단추 없이 다음 지역 `world3d.html?zone=<to>&gate=<지금 지역 id>` 로 넘어간다.

**map.json 은 바꾸지 않았다.** 처음엔 지역 표에 문을 넣고 `tools/2d/replan-map.mjs` 로 16 곳 계획을 다시 만들었는데,
막이·구역이 바뀌면서 서버 쪽 시험 32 개(생태 둥지·순찰 해시, 구운 높이, 사냥터 구역, 필드 상점 …)가 깨져 되돌렸다.

## 지금 온라인에서 생기는 일
`fieldJoin { gate: 'daejeon' }` 처럼 **map.json 에 없는 문 id** 가 온다 → `server/field.cjs` 의 `z.gates.find(...)` 가 못 찾아 **지역 출발점(spawn)** 에 세운다.
→ 3D 클라는 서버 자리를 따라가므로 길 끝이 아니라 출발점에 나타난다. 게임은 되지만 «길을 따라 왔다» 는 느낌이 깨진다.

## 해 줄 것 (작게)
`server/field.cjs` 도착 자리(문 id → 자리)에서, map.json 문에 없으면 **zone-links 로 계산**:
```js
// js/mmo/zone-links.js 의 linkGates(zone) 와 같은 표 · world3d.html 과 같은 공식
const a = map.road.ang, w = map.walk, g = /* LINKS 에서 (zone, gate=상대 지역 id) 인 끝 */;
const s = g.at.end === 's1' ? w.s1 - 3 : w.s0 + 3, t = g.at.t;
let x = s * Math.cos(a) - t * Math.sin(a), z = -s * Math.sin(a) - t * Math.cos(a);
// 막이에 걸리면 6 번 밀어낸다 (field-collide 의 collide(q, 2.4)) — world3d 와 같게
// 그리고 클라처럼 길 안쪽으로 5 m: 안쪽 = 띠 가운데(s) 쪽, 방향 (cos a, -sin a) × (s0 쪽이면 +1, s1 쪽이면 -1)
```
- zone-links.js 는 ESM 이다. 서버(CJS)에서 쓰려면 표를 복사하거나 동적 import — 편한 쪽으로. 복사하면 «두 표가 같다» 시험을 하나 붙여 달라.
- 시험 `tests/zone-links.test.mjs` 의 «길 문 자리: 막이에 안 밀림 · 보스 구역 밖» 이 이미 자리를 검사한다 (클라 공식 기준).

## 지켜 줄 것
- map.json(생태 해시·구운 높이·사냥터)은 이 일로 바꾸지 않는다.
- 2D(`mmo.html`)는 동결 — 길 문은 3D 만.
- 배포 뒤 Render 재배포, 디렉터에게 반영 시각을 알려 달라.

## 디렉터에게 남은 질문
- 여객선(목포 ⇢ 제주)을 «배 타는 연출»(대기·뱃고동)로 만들지, 지금처럼 길과 같은 이동으로 둘지.
- 나중에 map.json 을 다시 구울 때 길 문을 정식 문으로 넣을지(그러면 서버 생태 다시 굽기가 같이 필요).
