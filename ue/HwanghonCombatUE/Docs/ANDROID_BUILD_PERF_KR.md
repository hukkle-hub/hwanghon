# Android Build / Performance — Vertical Slice 1.1

## UE 5.5 Android 기준

엔진이 UE 5.8 → 5.5 로 바뀌었다(디렉터 결정 2026-09-27). 아래 5.5 값은 Epic 문서
«Android Development Requirements» 검색 결과로 옮긴 것이고, 원문 페이지는 이 컨테이너에서
열리지 않아(프록시 차단) **직접 대조하지 못했다.** 정답은 설치된 엔진이 들고 있는 값이다 —
아래 `-InstallSDK`(Turnkey `-BestAvailable`)는 그 엔진 버전에 맞는 SDK/NDK 를 고르므로
수동 설치보다 이것을 먼저 쓴다.

- Android Studio: Koala 2024.1.2
- Target SDK / Minimum compile SDK: 34
- Minimum install SDK: 26
- NDK: r25b
- Build-tools: 34.0.0
- Vulkan 1.1 compatible Android 10+ 권장 테스트군

(이전 5.8 기준 — 참고용: target 35 · NDK r27c · build-tools 35.0.1 · OpenJDK 21.0.3)

## SDK 설치

```powershell
.\Scripts\package_android.ps1 -InstallSDK
```

스크립트는 UE Turnkey:

`Turnkey -Command=InstallSDK -platform=Android -SdkType=Full -BestAvailable`

를 사용한다.

## Development 패키지

```powershell
.\Scripts\package_android.ps1
```

기본 출력:
`Saved/AndroidPackage/Development`

Shipping:

```powershell
.\Scripts\package_android.ps1 -Configuration Shipping
```

## 성능 캡처

Development build 또는 PIE에서:

**F10**

→ `csvprofile frames=1800`

을 실행한다.

60fps 기준 약 30초다.

CSV Profiler 출력:
`Saved/Profiling/CSV`

확인:
- FrameTime
- GameThread
- RenderThread
- GPU stats (플랫폼/빌드 설정에 따라)
- spike

추가 메모리 검수 시 launch arguments:
- `-LLM`
- `-LLMCSV`

LLM CSV:
`Saved/Profiling/LLM`

## 품질 기준 초안

60fps 목표:
- 16.67ms budget
- p95 ≤ 20ms 우선 목표
- p99 ≤ 25ms 검토
- >50ms spike는 원인 추적

단 최종 기준은 실제 목표폰 2~3종에서 thermal run 후 확정한다.

## 첫 실기기 시퀀스

같은 30초 입력:

1. 1→2→3 ×3
2. Smash ×2
3. Boss HookCombo
4. Charge dodge
5. Slam counter
6. GroundWave jump
7. 피격 1회
8. Counter 성공

High / Mid / Low 각각 한 번.

그래픽 tier 전환:
- F6 Low
- F7 Mid
- F8 High

## 결과 파일

반드시 보관:
- CombatAudit CSV
- CSV Profiler
- AssetAudit JSON
- 영상
- 기기명 / OS / GPU
- 품질 Tier
