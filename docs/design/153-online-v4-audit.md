# 153 — 온라인 v4 인계 감사 (Phase 0, 읽기 전용) (2026-09-29)

디렉터가 올린 `Hwanghon_Claude_Handoff_UE5.8_v4` 의 지시(«코드를 바로 덮어쓰지 말고 실제 프로젝트를 읽기 전용으로 감사,
대상 목록이 확정될 때까지 멈춤»)에 따른 감사다. **이 문서까지 코드·설정·에셋은 바꾸지 않았다.**
(인계 패키지가 요구한 `Docs/HwanghonOnline/01_AUDIT.md` 는 프로젝트 문서 규칙에 따라 이 문서로 대신한다.)

## 1. 프로젝트

| 항목 | 실제 | 인계 문서의 가정 |
|---|---|---|
| 경로 | `C:\w\hwanghon\ue\HwanghonCombatUE` (git: hukkle-hub/hwanghon) | `…/UEIntroProject 5.8` — **다르다** |
| 모듈 | `HwanghonCombatUE` (런타임), 플러그인 `HwanghonShelter`(v2 + 우리 수정, 문서 152) | 플러그인 `HwanghonShelter` v4 |
| 엔진 | UE 5.8.1 **런처 설치판**(`Engine/Build/InstalledBuild.txt`) | — |
| 타깃 | `HwanghonCombatUE.Target.cs`(Game), `…Editor.Target.cs` — **Server 타깃 없음** | `UEIntroProjectServer.exe` |
| 시작 맵 | `GameDefaultMap=/Game/Hwanghon/Story/EP01/EP01_TrainingRoom_World`(스토리 EP01) | `L_Loading` |

**차단 요소 1 — 전용 서버 빌드.** 런처판 엔진은 Server 타깃(패키징된 전용 서버)을 빌드할 수 없다. 소스 빌드 엔진이 필요하다.
개발 검증은 가능하다: `UnrealEditor.exe <uproject> <map> -server -log -port=7777`(에디터를 서버로) + 클라이언트 `-game 127.0.0.1:7777`.
리눅스 서버·Android 서비스 배포에는 소스 엔진이 필수다.

## 2. 현재 맵과 게임모드

| 맵 | 게임모드 | 무엇 |
|---|---|---|
| `/Game/Maps/HW_Frontend` | `HWFrontendGameMode` | Clean UI v1 타이틀·로비(웹 설계 시트 기준 UMG, 문서 123·126) |
| `/Game/Hwanghon/Story/EP01…EP28` | `HWStoryGameMode` | 제1부 스토리 모드 34전투(문서 150) |
| `/Game/Hwanghon/Maps/Hub/L_GangnamBunker_B1` | `HWShelterGameMode` | 쉘터 v2 + 원문 NPC 대사 + 터치(문서 152) |
| `/Game/Maps/Seohan_Combat_VS01`, `Hwanghon_OnlineRaid` 등 | 전투 VS / 온라인 레이드 | 이전 작업 |

## 3. 캐릭터

- C++ `AHWAinCharacter` 와 카인·류·세라 파생 클래스(`HWPlayableCharacterVariants`). 몸은 `DefaultGame.ini` 의 `HWCharacterVisualSettings` 가
  **파라곤 Countess 스킨(기증 에셋, 대역)** 을 입힌다. 전용 영웅 팩은 아직 없다(문서 129).
- 웹판 몸: `art/3d/ain_anim.glb`·`kain_anim.glb`·`ryu_anim.glb`·`sera_anim.glb`(웹 게임 전용 리그).
- 인계 체크리스트의 «approved existing project assets» 에 해당하는 **승인된 네 캐릭터 UE 몸은 아직 없다** — 지금은 대역이다.

## 4. NPC

- 디자인 시트: 마태오·닥터 진·유진·수희·한(장인) 5장(`docs/story/source/design/npc/`). **두호·오정길 시트 없음.**
- UE: 시트에서 자른 초상화 5장(`T_<Id>_Portrait`), 월드 몸은 플러그인 원기둥 프록시. NPC BP·3D 메시 없음.
- 대사: 원문 17줄(`shelter_npcs.json`, 문서 152 §2). v4 의 NPC 기본 대사는 v2 와 같고 21줄 중 19줄이 창작이다.

## 5. 기존 온라인 코드 — **v4 와 방식이 다르다**

| 층 | 지금 | v4 |
|---|---|---|
| 서버 | Node `server/`(index.cjs, raid.cjs, rpg-server.cjs …) WebSocket 릴레이, Render 배포(GPT 담당) | UE Dedicated Server + Node 매치메이커 `gateway.mjs` |
| UE 쪽 | `HWRaidNetworkSubsystem`·`HWNetworkCombatBridgeComponent`·`HWCoopCombatSubsystem` — 전투는 각 클라가 돌리고 WebSocket 으로 맞춤 | UE 액터 복제(Pawn replication), 서버 권한 RPC |
| 검증 | `tools/ue/system-core-qa.cjs local/1p/2p/4p` 통과(문서 128·129) | 없음 |

**차단 요소 2 — 던전 전투의 서버 권한.** 우리 전투(`UHWCombatComponent`, 보스 AI, 스토리 규칙)는 UE 복제용으로 짜여 있지 않다.
v4 의 «Dedicated Server authoritative 전투·보상» 은 전투 컴포넌트·보스·판정의 복제 재설계가 필요한 가장 큰 일이다.
쉘터(이동·NPC·파티)는 v4 방식(UE 복제)으로 가도 전투와 분리되어 부담이 작다.

## 6. HTML / WebGL 진입점

- 웹: `index.html` → `game3d.html` 등(GitHub Pages 배포, `version.json`).
- **Android 앱 = Capacitor 래퍼(`android/`)가 웹을 싣는다.** 지금 폰에서 도는 황혼은 HTML 게임이다.
- 인계 방향(«HTML 게임 본체 폐기»)대로 가면 Android 배포가 **UE Android 패키지로 바뀐다** — 이 PC 에서 UE Android 패키징은 아직 검증하지 않았다.

## 7. v4 코드 검토 결과

| 구분 | 내용 |
|---|---|
| 컴파일 | `HHShelterNPC.h` 의 `Engine/SoftObjectPtr.h`(5.8 에 없음) — v2 에서 고친 것이 v4 에 되돌아왔다 |
| 빌더 | `unreal.Rotator(0, yaw, 0)` 3곳 그대로 — 복도가 세로 판으로, NPC 가 거꾸로 선다(문서 152 §3). 레이아웃 연결 문제(코어 닫힘 등)도 그대로 |
| 보안 1 | 매치메이커가 쉘터 `joinToken` 을 발급하지만 **쉘터 서버가 검사하지 않는다** — 7777 에 누구나 직접 접속, 캐릭터도 URL 로 고른다 |
| 보안 2 | 던전 입장권을 **PostLogin 뒤 비동기로** 검사한다 — 검사가 끝나기 전에 폰이 스폰된다. `PreLogin` 단계에서 보류해야 한다 |
| 보안 3 | 던전 서버가 **클라가 보낸** `PartyId`·`Character`·`Mission` 을 믿는다 — 입장권의 기록(서버 발급)으로 덮어써야 한다 |
| 보안 4 | `/v1/match/dungeon` 이 공개 — 누구나 던전을 잡고 입장권을 찍어낼 수 있다(쉘터 서버만 부르도록 비밀키 필요) |
| 보안 5 | 기본 비밀 `change-me` 가 코드·스크립트에 박혀 있다. `/v1/status` 가 인스턴스 주소를 공개한다 |
| 흐름 | `DefaultEngine.ini.append` 가 `GameDefaultMap` 을 `L_Loading` 으로 바꾼다 — 지금의 스토리 EP01·Clean UI 프론트엔드와 충돌 |
| 게임모드 | `AHHShelterOnlineGameMode` 는 우리 `HWShelterGameMode`(아인 폰·원문 대사·터치)를 모른다 → 파생 클래스로 합쳐야 한다 |
| 수치 | 24/32 명, 20–30 Hz 는 목표값으로만 쓰였다(실측 없음) — 인계 지시와 같이 **실측 전 보장하지 않는다** |

좋은 점: 파티 RPC 가 서버 권한(생성·초대·수락·준비·나가기·4인 제한), 입장권이 1회용·만료·인스턴스 한정, 매치메이커 입력 검증, 하트비트.

## 8. 제안 — 통합 대상 목록 (승인 필요)

**배치 A (되돌리기 쉬움, 이 PC 에서 끝까지 검증 가능)**
1. v4 소스를 `Plugins/HwanghonShelter` 에 병합 — 우리 두 수정(include, Rotator) 유지.
2. `AHWShelterOnlineGameMode : AHHShelterOnlineGameMode` — `CharacterPawnClasses` 를 우리 C++ 네 캐릭터로, 원문 NPC 대사·터치·동선 보정 유지.
3. `L_Loading`·`L_CharacterSelect` 생성. **`GameDefaultMap` 은 바꾸지 않는다**(디렉터 결정 전까지).
4. `gateway.mjs` → `tools/online/gateway.mjs`.
5. 검증(에디터를 서버로): 매치메이커 + 쉘터 서버(7777) + 던전 서버(7780) + 클라 2개 → 서로 보임·이동 복제 → NPC → 파티 초대·수락·준비 →
   둘이 같은 던전 서버로 → 입장권 재사용·다른 인스턴스 입장권 거부. 로그·샷을 남긴다.

**배치 B (보안)** — §7 보안 1–5.

**배치 C (부하)** — `-nullrhi` 봇 클라 N 개로 8/16/24/32 명, 서버 프레임·대역폭 **실측**.

**디렉터 결정이 필요한 것**
1. 던전 전투의 네트워크 방식 — (a) 지금의 Node WebSocket(4인 검증됨) 유지, (b) UE 전용 서버 복제로 전투 재설계.
2. 시작 흐름 — Clean UI `HW_Frontend`(설계 시트 기준 UMG) vs v4 캔버스 `L_Loading`/`L_CharacterSelect`, 그리고 스토리 모드의 자리.
3. 소스 빌드 엔진 도입(패키징 전용 서버·리눅스).
4. Android 배포 — Capacitor 웹 앱을 언제 UE Android 로 바꿀지.

## 9. 롤백

- 배치마다 커밋 하나. 되돌리기 = 그 커밋 `git revert`.
- 플러그인은 폴더 통째(`Plugins/HwanghonShelter`) — 이전 커밋의 폴더로 복원.
- Config 는 의도한 줄만 스테이징(에디터가 쓰는 `DefaultEngine.ini`/`DefaultInput.ini` 잡음 제외, 기존 규칙).
- 생성 맵·에셋은 커밋하지 않고 스크립트로 다시 만든다.
