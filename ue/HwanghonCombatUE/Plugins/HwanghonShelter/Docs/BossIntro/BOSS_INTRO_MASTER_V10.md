# 황혼의 서울 — 보스 등장 시네마틱 v10

## 기준

이 문서는 현재 프로젝트의 최신 잠금 보스 목록을 기준으로 한다.

제작 대상:

| ID | 보스 | 장소 |
|---|---|---|
| `TUTORIAL_SCARECROW` | 튜토리얼 허수아비 | 강남 지하 훈련 구역 |
| `CLAVE_GANGNAM` | 클레이브 | 강남역 지하상가 → 침수된 2호선 선로 |
| `CELESTIAL_NAMSAN` | 셀레스티얼 | 남산 케이블카 권역 |
| `AEGIS07_SDC` | 에이지스-07 | 수도방위사령부 지하 |
| `LEVIATHAN_HANRIVER` | 리바이어던 나노 | 한강 침수 터널 |
| `EXPERIMENT09_PANGYO` | 실험체 09 | 판교 연구 복합체 |
| `SHADOWFANG_GWANAK` | 섀도우 팽 | 관악산 폐터널, 단독전 |
| `ARSENAL_GYERYONG` | 아스널 오버로드 | 계룡 군사 지하 시설 |
| `PARK_GYERYONG` | 감염된 박 준장 | 군 지휘 벙커 |
| `IRONWARDEN_YEOUIDO` | 아이언 워든 | 여의도 |
| `LEE_FINAL_LINE` | 감염된 이 중장 | 최종 방어선 |
| `MINISTERJEONG_GOHEUNG` | 정 장관 | 고흥 발사 시설·갱도 진입부 |
| `NANONOVA_GOHEUNG` | 나노-노바 코어 | 고흥 갱도·증폭 탑 |

**오르도/심맥 굴착자는 현재 제작 대상이 아니다.**

---

# 공통 등장 구조

모든 보스는 같은 5단계 카메라 문법을 사용하되,
카메라 내용과 보스 동작은 전부 다르게 만든다.

```text
1. PlayerEntry
2. Silhouette
3. ScaleReveal
4. SignatureMotion
5. Handback
```

## 1. PlayerEntry

플레이어가 보스룸으로 들어가는 순간.

목표:
- 아직 보스의 전신을 보여주지 않는다.
- 장소의 규칙을 먼저 보여준다.
- 플레이어 카메라와 전투 공간의 방향을 연결한다.

## 2. Silhouette

보스의 실루엣/무기/기계 구조 중 하나를 먼저 보여준다.

목표:
- 보스 정체를 설명문이 아니라 형태로 읽게 한다.
- 약점 전체를 미리 친절하게 보여주지 않는다.

## 3. ScaleReveal

보스와 공간의 크기 관계를 보여준다.

목표:
- 인간형은 발-무기-몸 순서.
- 거대 보스는 **전신을 한 프레임에 억지로 넣지 않는다.**
- 환경 기믹도 한 가지 같이 보여준다.

## 4. SignatureMotion

이 보스가 어떤 전투인지 1개의 행동으로 예고한다.

예:
- 클레이브: 셔터/무기팔
- 에이지스: 4노드 공명
- 리바이어던: 좌우 아가미
- 이 중장: 중력장
- 정 장관: 명령 거울

이 동작은 실제 전투 시스템과 같은 Actor/상태를 사용한다.
컷신 전용 가짜 기믹을 만들지 않는다.

## 5. Handback

플레이어 뒤 전투 카메라로 자연스럽게 복귀.

이때:
- HUD 복구
- 입력 복구
- Boss AI 활성
- Boss HUD 표시
- 첫 패턴 시작

---

# UI 원칙

보스 등장 중:

**금지**
- 화면 중앙 거대한 보스명
- 긴 별명/설정 문장
- HP바를 미리 띄우기
- 경고 문구 남발
- 블랙바를 무조건 사용
- 모바일 화면을 가리는 자막

**허용**
- UI 전체 숨김
- 월드 자체의 조명/소리/구조
- Handback이 끝난 뒤 Boss HUD에서 보스명 표시

즉:

```text
컷신 = 공간과 보스가 설명
전투 시작 = UI가 정보 제공
```

---

# 네트워크

`AHHBossIntroDirector`

- 서버가 시작
- NetMulticast로 같은 BossId/시점 전달
- 각 클라이언트는 자기 로컬 카메라만 전환
- Dedicated Server는 카메라를 실행하지 않고 Boss Presentation Event는 실행 가능
- `OnIntroFinished` 이후 Encounter Manager가 전투를 시작

파티에서 한 명이 먼저 트리거를 밟으면 전 파티에 같은 인트로가 시작된다.

---

# 반복 공략

첫 조우:
```text
StartBossIntro(false)
```

재도전/파밍:
```text
StartBossIntro(true)
```

Short version은 같은 카메라 문법을 유지하되 Hold 시간을 줄인다.

완전히 다른 짧은 컷신을 새로 만들지 않는다.
