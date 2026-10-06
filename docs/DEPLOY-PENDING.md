# Render 재배포 대기 (파티 서버)

> **2026-10-07 — 클레이브 명예 장비·공개 칭호, 타격 접점·보행·서버 시각 안무, 강화 광휘 가시성·수명 배포 완료** (§2). Render 자동 배포도 실제 main 푸시로 확인했다.
> 남은 것: 환경변수 `ADMIN_IDS` (§3) · **지속 디스크 (§5, 디렉터 승인 필요)**.

정적 사이트(GitHub Pages)와 파티 서버는 `main` 푸시마다 자동으로 나간다.
파티 서버의 `render.yaml` 은 `autoDeployTrigger: "commit"` 으로 맞춰져 있다.
`server/` 를 고칠 때마다 이 파일에 한 줄을 남기고, 배포되면 §2 로 옮긴다.

- 대상: `hwanghon-party` (Render · Singapore · free)
- 확인: `curl -s https://hwanghon-party.onrender.com/healthz`

## 1. 대기 중

| 커밋 | 무엇이 바뀌었나 |
|---|---|
| 작업 중 | 클레이브 명예 표식 — 이미 공개되는 장착 장비·강화값만으로 이름 옆에 작은 `클레이브 +7/+8/+9/+10` 표식을 붙여 원격에서도 출처와 강화 성취를 읽게 한다. 새 조명·바닥 이펙트·서버 필드·보스 체력은 추가하지 않는다. |

## 2. 배포 완료 (최신: 2026-10-07)

최신 강화 광휘 검증: `e8a46e8310fe202e01988f4da61bd8b6e63f54e5`, 배포 `dep-db2l3qjl550s73bgtr8g`, 2026-10-06T19:57:13.481Z (2026-10-07 04:57:13.481 KST) live. `npm test` 718/718 성공했고 GitHub Actions APK run `37522381643`, Pages run `37522381785` attempt 2의 test·deploy도 성공했다(첫 attempt는 checkout 정지 뒤 취소·재시도). Pages 빌드 `e8a46e8`은 2026-10-07 05:17:09 KST 배포 완료했다. `/healthz`는 연속 3회 HTTP 200(246/204/379 ms), WebSocket은 402 ms 만에 열려 5.514초 유지 후 코드 1000으로 정상 종료했고, 실제 Pages `mmo.html?server=…`도 `온라인 · 근처 0명`으로 접속했다. Render와 Pages의 `mmo.html`·`js/looks.js`는 커밋과 SHA-256이 각각 `d47fe417a293cceb5413a30d547e6cf5578a589bc9e7eb5d2e2e6d4511587b8c`·`33ed6f9fdb8c210c46da54531fc79509360cdfe88a163c4dfc9777495ee96733`로 정확히 같다. 배포 이후 오류·경고·5xx 로그는 0건, 메모리는 약 67.7 MB/512 MB였다. +0/+7/+9/+10 데스크톱·휴대폰 가로 및 동작 줄이기 실화면을 확인했고 서버 판정·드롭률·보스 체력 비공개 계약은 그대로다.

최신 Render 검증: `976542d1fda3f554fd5aead11275ff0c5f715e3c`, 배포 `dep-db2k64s9v7es738luh0g`, 2026-10-06T18:53:48.368Z (2026-10-07 03:53:48.368 KST) live. `npm test` 715/715 성공했고 GitHub Actions run `37514452916`의 test·APK, Pages run `37514452900`도 모두 성공했다. `/healthz`는 연속 3회 HTTP 200(241/105/95 ms), WebSocket은 374 ms 만에 열려 5.119초 유지 후 코드 1000으로 정상 종료했다. Render와 Pages의 `boss-motion.js`는 로컬과 SHA-256 `d31c67936b66174d96b7fe47dc61f33a6dfc3717e1af2fd11e35738edf4c1251`로 정확히 같고 새 안무·재출현·세로 프레이밍·서버 시계 표식이 모두 보인다. 배포 이후 오류 및 5xx 로그는 0건, 메모리는 약 52.5 MB/512 MB였다. 서버는 보스 체력을 계속 보내지 않는다.

이전 타격 접점 검증: `8e07dabb8ca01704ef7a9b38a4a45c4ef0d14a95`, 배포 `dep-db2hsejl550s73chr0sg`, 2026-10-06T16:16:25.941Z (2026-10-07 01:16:25.941 KST) live. `npm test` 707/707 성공했고 GitHub Actions의 같은 커밋 시험도 성공했다(run `37494033124`). `/healthz`는 연속 3회 HTTP 200(525/206/175 ms), WebSocket은 354 ms 만에 열려 5초 유지 후 코드 1000으로 정상 종료했다. 서버는 보스 체력을 계속 보내지 않는다.

이전 명예 장비 검증: `faccc4508c63b419c9a0c8d90f171e197234efbc`, 배포 `dep-db2h8b67bikc73e2h6eg`, 2026-10-06T15:33:40.561Z (2026-10-07 00:33:40.561 KST) live. `npm test` 702/702 성공, `/healthz` HTTP 200. GitHub Pages run `37488152495`는 2026-10-07 00:37:16 KST 성공했고 배포 버전은 `faccc45`였다. 검사한 실서비스 파일은 이 커밋과 정확히 일치했다. WebSocket은 451 ms 만에 열려 5초 유지 후 정상 종료했다. 브라우저에 남은 접속 키는 임시 저장소 재기동 뒤 무효가 되어 새 계정 생성 없이 실제 캐릭터 입장까지는 반복하지 않았다(§4·§5).

이전 클레이브 세부 전투 검증: `6af28c15f98df8ca6692ecbc873baffb09838a14`, 배포 `dep-db2gfe7lk1mc738ujl2g`, 2026-10-06 14:40:45 UTC (23:40:45 KST) live. `npm test` 693개 성공. `/healthz` 200/ok (`protocol: 2`), 새 인스턴스 기동과 배포 직후 오류 로그 없음.

이전 필드 보스 검증: `4b0c41e37cf0ff61b7e7442f50053dd13c902428`, 배포 `dep-db2ftr7avr4c73alqp30`, 2026-10-06 14:03:44 UTC (23:03:44 KST) live. GitHub Actions `npm test` 688개 성공, 필드 보스 Pages 빌드 `4b0c41e`. `/healthz` 200/ok (`protocol: 2`), GitHub Pages `mmo.html?online=1&server=…` 에서 `온라인 · 근처 0명`, 배포 직후 오류 로그 없음.

이전 Render 검증: `38bf537ed67468dae5001fec487b7a579b5a9623`, 배포 `dep-danpfkoae00c739k3b80`, 2026-09-20 08:23:24 UTC live. 통합 테스트 182개 통과. `/healthz` 200/ok, 전투·리깅·재질·온라인 핵심 파일 7개가 배포 소스와 일치, 배포 직후 오류 로그 없음. `91e5db6` 전투 개선과 `f20f4df` 클로드 팔/재질/환경광 개선을 함께 포함한다. S25 Ultra 실기기 체감 검수는 별도다.

| 커밋 | 무엇이 바뀌었나 |
|---|---|
| `e8a46e83` | 클레이브 강화 광휘 가시성·수명 — +0/+7/+9/+10 불티를 직교 카메라의 실제 화면 픽셀로 구분하고 동작 줄이기에서는 고정했다. 바닥 전리품 반복 스냅숏의 색·DOM 재할당과 제거 뒤 GPU 잔존도 없앴다. 서버 판정·드롭률·보스 체력 계약은 바꾸지 않는다. |
| `976542d1` | 클레이브 서버 시각 안무 — 셔터 돌진 위치·뒤쪽 0.5 m 판정·예고를 같은 계약으로 묶고, 세 기술의 실측 접점 자세·정지→순간타격→무거운 회수·4.8초 보초 idle을 프레임 독립으로 재생한다. counter 외곽선·접촉 코어·암전 상한·reduced motion·세로 구역 가장자리 프레이밍·동일 seq 재출현을 검증했다. 보스 체력·피해·드롭은 바꾸거나 보내지 않는다. |
| `8e07dabb` | 클레이브 타격 접점·보행 무게감 — 같은 전투를 보는 사람에게 접촉점·치명 여부만 짧게 전파하고, 공격을 끊지 않는 미세 반응·실제 좌우 발 접지 먼지·금속 임팩트음을 더했다. 첫 입력 공격음 보존, `prefers-reduced-motion` 전역 흔들림 차단, 사망 꼬리 뒤 애니메이션 믹서 정지까지 검증했다. 타인의 피해량과 보스 체력은 보내지 않는다. |
| `faccc450` | 클레이브 명예 장비·공개 칭호 — 필드 공개 장비 전체 슬롯·강화 광휘 단계·1위 처치 칭호를 서버 정보에 싣고, 본인/주변 캐릭터 외형에 반영한다. 보스 체력은 계속 보내지 않는다. |
| `6af28c15` | 클레이브 상세 전투 — 서버 권위 추적·선회, 셔터 돌진·셔터 폭풍 3연계·용광로 내려찍기, 마지막 타 반격창, 플레이어 체력·방어·회피 무적·넉백·사망·5초 복귀. 원본 GLB 보행·전용 기술 클립과 셔터 팔 보강, 발 접점·범위 예고·검 궤적·충돌 연출을 데스크톱과 휴대폰 가로로 확인했다. 보스 체력은 계속 서버 밖으로 보내지 않는다. |
| `4b0c41e` | 필드 보스 — 리니지식 주기 창 출현, 서버 판정 `fieldHit`, 바닥 드롭 `fieldLoot`(1위 10초 우선), 출현·처치·전설 획득 전체 공지, DB 표 `field_bosses` · `boss_kills`, 보스 고유 장비 28종. 출현·피해 숫자·처치·빛기둥·줍기 화면을 데스크톱과 휴대폰 가로로 확인했고, 디렉터 결정대로 보스 체력은 서버가 보내지 않으며 체력바도 없다. **§5 의 지속 디스크가 없으면 재시작 때 보스 시각·처치 기록·얻은 장비가 지워진다.** |
| `27b5595` | 2D 맵 MMORPG 필드 — `fieldJoin`/`fieldMove`/`fieldLook`/`fieldLeave`, 초당 10번 `field` (관심 반경 28 m, 속도 7.5 m/s 제한), 지역별 `maps/2d/<zone>/map.json` |
| `27b5595` | 지역 이동 문 — `fieldJoin.gate`, 새 지역 17개 `map.json` 및 짝 문 도착 위치 반영 |
| `312aa1c` | 길드 관리 알림 (공지·임원·위임·추방을 당사자에게) |
| `fe89ce8` | 길드 가입 신청·승인 — `guildBoard`/`guildApply`/`guildDecide`/`open` |
| `891e660` | 파티원 Lv·전투력 (대기 중인 방의 `state`) |
| `8b9bfda` | (GPT) 아인 스킬 제스처 · 캐릭터별 모션 프로필 |
| `834e84a` | 기술 등급 5종 누적·`techGrades` · 모집 조건(최소 전투력·음성) · `board` 명령 |
| `1d29ded` | 운영 도구 — `adminState` 이름/제재/공지, `adminFind`, 제재 기간 1년, 신고 번호 제한 해제 |

## 3. 아직 남은 것 — `ADMIN_IDS`

운영 도구(`admin.html`)는 **코드가 아니라 환경변수**로 열린다. Render 의
`hwanghon-party` → Environment 에 넣는다.

```
ADMIN_IDS = <플레이어 id>          # 쉼표로 여러 명
```

자기 id 는 운영자로 쓸 계정으로 접속해 `admin.html` 을 열면 안내에 찍힌다.
넣기 전까지는 그 화면이 **아무에게도 보이지 않는다** (`docs/design/32`).

## 4. 배포하면 계정이 초기화된다

`render.yaml` 이 `DATA_DIR=/tmp/hwanghon` · `EPHEMERAL_STORAGE=1` 이라
**재배포·재시작하면 계정·캐릭터·길드가 초기화된다.** 무료 플랜을 그렇게 잡아
둔 것이고, 유지하려면 디스크를 붙이고 `EPHEMERAL_STORAGE` 를 지워야 한다
(`docs/DEPLOY.md` §2).

## 5. 지속 저장 — 보스·장비가 남으려면 (디렉터 승인 후, 2026-10-06)

저장은 이미 DB(SQLite, `world.sqlite`)다. 지워지는 이유는 DB 가 아니라 **디스크**다(`/tmp`).
Supabase 등으로 옮길 필요 없이, 지워지지 않는 디스크에 같은 파일을 두면 된다(코드 변경 없음).

Render `hwanghon-party` 에서:

1. 요금제 **Starter** 이상 (무료는 디스크를 못 붙이고, 15분 유휴면 잠들어 보스 주기가 멈춘다)
2. **Disks** → Add disk: 이름 `world`, Mount path `/var/data`, 1 GB
3. Environment: `DATA_DIR=/var/data`, `EPHEMERAL_STORAGE` **지우기**
4. (Auto-Deploy 는 2026-10-06 GPT 가 이미 켰다 — `autoDeployTrigger: "commit"`)
5. 확인: 재배포 후 `/healthz` 200, 그리고 한 번 더 재시작해도 계정이 남는지

`render.yaml` 로 맞출 때의 모양 (요금이 붙으므로 승인 전에는 고치지 않는다):

```yaml
    plan: starter
    disk:
      name: world
      mountPath: /var/data
      sizeGB: 1
    envVars:
      - key: DATA_DIR
        value: /var/data
      # EPHEMERAL_STORAGE 줄은 지운다
```

백업은 서버가 한 시간마다 `DATA_DIR/backups` 에 남긴다(`BACKUP_INTERVAL_MS`). 같은 디스크라서, 디스크째 잃는 경우를 막으려면 가끔 `npm run backup` 결과를 밖으로 옮긴다.
