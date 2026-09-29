# 황혼 온라인 v3 — 네이티브 클라이언트 / Dedicated Server

이번 패키지는 기존 `game3d.html` 중심 구조를 게임 본체에서 제거하기 위한 첫 전환본이다.

## 실행 흐름

```text
로딩
→ 캐릭터 선택
→ 매치메이커
→ 쉘터 Dedicated Server
→ NPC / 시설
→ 파티 구성
→ 던전
```

## 1. 설치

`HwanghonOnline_v3` 내용을 프로젝트 `Plugins/HwanghonShelter`로 교체/병합한다.

C++ 재빌드 후 플러그인을 활성화한다.

## 2. 프론트엔드 맵 생성

Unreal Editor:

`Tools > Execute Python Script`

실행:

```text
Plugins/HwanghonShelter/Content/Python/build_hwanghon_frontend_flow.py
```

생성:
- `/Game/Hwanghon/Frontend/L_Loading`
- `/Game/Hwanghon/Frontend/L_CharacterSelect`

## 3. 쉘터 맵

기존 v2의:

```text
Content/Python/build_hwanghon_shelter_blockout.py
```

로 B-1 맵을 만든 뒤,
World Settings의 GameMode를 `AHHShelterOnlineGameMode` 또는 그 Blueprint 자식으로 지정한다.

Blueprint 자식에서 `CharacterPawnClasses`:
- ain → 기존 Ain Pawn/BP
- kain → 기존 Kain Pawn/BP
- ryu → 기존 Ryu Pawn/BP
- sera → 기존 Sera Pawn/BP

를 연결한다.

## 4. Config

`Config/DefaultGame.ini.append`
`Config/DefaultEngine.ini.append`

내용을 실제 프로젝트 Config에 병합한다.

## 5. Matchmaker

Node 18+:

```bash
cd BackendPrototype
INSTANCE_SECRET=change-me node gateway.mjs
```

의존성 설치 없음.

## 6. Dedicated Server

Windows:
`ServerScripts/run_shelter_server_windows.bat`

Linux:
`ServerScripts/run_shelter_server_linux.sh`

## 7. 현재 CCU 목표

**한 쉘터 인스턴스 24명**부터 시작한다.

상한 시험:
**32명**

던전:
**1~4명**

전체 서비스 동접은 쉘터/던전 서버 인스턴스를 수평 확장해서 늘린다.
24명은 전체 게임 최대 동접이 아니다.

## 8. 기존 HTML

`game3d.html`은 삭제할 필요는 없지만 **배포 게임의 시작점에서는 제거**한다.

용도는:
- 개발 QA
- 캐릭터 모션 검수
- 디자인 비교
- 운영용 웹 도구

로 제한한다.
