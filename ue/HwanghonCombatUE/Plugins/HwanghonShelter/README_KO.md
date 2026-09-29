# 황혼 강남 벙커 B-1 — Unreal Engine 5.8 구현 패키지 v2

## 이번 버전의 기준

이 패키지는 새로 만든 대형 오픈 로비가 아니라, 프로젝트에 이미 존재하는 **`EP01 벙커 기지 디자인 시트`**를 건축 기준으로 사용한다.

핵심 형태:

- 중앙 코어
- 좁은 분기 통로
- 마태오의 직무실
- 인력사무소
- 지하 훈련장
- 외부와 통하는 통로
- 벙커끼리 연결하는 통로
- 낮은 천장 / 노출 배관 / 낡은 금속 / 작업등 / 방폭 셔터
- '사람이 사는 던전형 거점'

여기에 게임 기능용 7개 거점을 추가했다.

| 번호 | 구역 | 기능 | NPC |
|---|---|---|---|
| 01 | 인력사무소 | 파티 구성 / 출정 | 마태오 |
| 02 | 등급측정소 | 등급 / 스킬 재배치 | 유진 |
| 03 | 장인 공방 | 수리 / 제작 / 강화 | 한 장인 |
| 04 | 훈련소 | 허수아비 / 카운터 / 스킬 시험 | 오정길 |
| 05 | 의뢰소 | 임무 / 지역 정보 | 두호 |
| 06 | 치료실 | 치료 / 회복약 / 억제제 | 닥터 진 |
| 07 | 배급소 | 음식 제작 / 버프 음식 | 수희 |

## 조작

- `F` 또는 `Enter`: NPC 대화 시작 / 다음 대사
- `E`: 해당 NPC가 담당하는 시설 메뉴 열기
- `ESC`: 대화 / 시설 메뉴 닫기

## 설치

1. `HwanghonShelter_v2` 폴더를 프로젝트의 `Plugins/HwanghonShelter`로 복사한다.
2. Unreal Editor를 닫은 상태에서 C++ 프로젝트 파일을 재생성/빌드한다.
3. 플러그인을 활성화한다.
4. 새 빈 레벨을 만들고 `L_GangnamBunker_B1` 같은 이름으로 저장한다.
5. `Tools > Execute Python Script`
6. 아래 파일 실행:

```text
Plugins/HwanghonShelter/Content/Python/build_hwanghon_shelter_blockout.py
```

## NPC 디자인시트/3D 캐릭터 연결

스크립트는 `/Game` 전체에서 아래 이름 별칭을 검색한다.

```text
Matteo / 마태오
Yujin / 유진
HanJangin / 한장인
OJeonggil / 오정길
Duho / 두호
DrJin / 닥터진
Suhui / Suhee / 수희
```

### 이미 NPC Blueprint가 있을 때

예:

```text
/Game/Twilight/Characters/NPC/BP_Matteo
/Game/Twilight/Characters/NPC/BP_Yujin
...
```

이름이 맞으면 자동으로 `VisualActorClass`에 연결된다.

### 디자인시트 이미지만 있을 때

이미지를 Texture로 Import하고 파일/에셋 이름에 NPC 이름을 넣는다.

예:

```text
T_Matteo_DesignSheet
T_Yujin_DesignSheet
T_HanJangin_DesignSheet
```

자동 검색되면 대화 UI의 `PortraitTexture`로 연결된다.

3D BP가 아직 없으면 월드에서는 단순 프록시가 서 있고, 디자인 BP가 준비되는 순간 NPC 액터의 `VisualActorClass`만 연결하면 대화/시설 로직은 그대로 유지된다.

## 클래스

```text
AHHShelterStation
  └─ 시설 기능과 메뉴

AHHShelterNPC
  ├─ NPC 프로필
  ├─ 대화
  ├─ 이전 디자인 BP 자동 연결
  ├─ 디자인시트 Portrait 연결
  └─ 담당 Station 연결

UHHHubSubsystem
  ├─ Station 등록/포커스
  ├─ NPC 등록/포커스
  ├─ 대화 상태
  └─ 시설 상태

AHHShelterHubManager
  ├─ F/Enter 대화
  ├─ E 시설 이용
  └─ ESC 닫기

AHHShelterHUD
  ├─ RPG HUD
  ├─ NPC 이름/역할/대사
  ├─ Portrait
  └─ 시설 메뉴
```

## 캐논 NPC 기준

거점 NPC 기본 대사는 프로젝트 설정에 맞춰 넣었다.

- 마태오: 인력사무소 소장, 장부/출정
- 유진: 각인 평가원, 사무적인 계측
- 한 장인: 말수 적은 제작자
- 오정길: 경비·길잡이 성격을 훈련 보조에 사용
- 두호: 현장 정보/심부름을 의뢰소 기능에 연결
- 닥터 진: 치료·억제제
- 수희: 배급 총괄

대사는 `AHHShelterNPC::ApplyProfileDefaults()`에서 수정하거나, 에디터에서 `DialogueLines`를 덮어쓸 수 있다.

## 다음 실제 아트 교체 순서

블록아웃은 구조 검증용이다. 승인 순서는 다음을 권장한다.

1. 중앙 코어 + 통로 폭/시야
2. 인력사무소 + 마태오 직무실
3. 등급측정소
4. 훈련장 + 허수아비
5. 공방 / 치료실 / 배급소
6. 외부 통로 + 가로 슬랫형 방폭 셔터
7. 벙커 연결 통로
8. NPC 실제 BP/애니메이션
9. 최종 조명/안개/데칼/생활 NPC

`EP01 벙커 기지 디자인 시트`와 다르게 대형 몰/광장처럼 만들지 않는 것이 핵심이다.
