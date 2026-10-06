# Render 재배포 대기 (파티 서버)

> **2026-10-06 — 필드 보스(§1) 가 main 푸시로 자동 배포된다** (자동 배포는 GPT 가 켰다). 배포 확인 후 §2 로 옮긴다.
> 남은 것: 환경변수 `ADMIN_IDS` (§3) · **지속 디스크 (§5, 디렉터 승인 필요)**.

정적 사이트(GitHub Pages)와 파티 서버는 `main` 푸시마다 자동으로 나간다.
파티 서버의 `render.yaml` 은 `autoDeployTrigger: "commit"` 으로 맞춰져 있다.
`server/` 를 고칠 때마다 이 파일에 한 줄을 남기고, 배포되면 §2 로 옮긴다.

- 대상: `hwanghon-party` (Render · Singapore · free)
- 확인: `curl -s https://hwanghon-party.onrender.com/healthz`

## 1. 대기 중

| 커밋 | 무엇이 바뀌었나 |
|---|---|
| (2026-10-06, 필드 보스) | `server/boss-cycle.cjs` · `boss-table.cjs` · `boss-store.cjs` 새 파일, `server/field.cjs` · `index.cjs` · `store.cjs` · `rpg-store.cjs`. 리니지식 주기 창 출현, `fieldHit`(피해는 서버가 굴림) · `fieldLoot`(바닥 드롭, 1위 10초 먼저), 서버 전체 `announce`(출현·처치·전설 획득), DB 표 `field_bosses` · `boss_kills`. 보스 장비는 상점에서 뺐다. 시험 `tests/field-boss.test.cjs`. **§5 의 지속 디스크가 없으면 재시작 때 보스 시각·처치 기록·얻은 장비가 지워진다** |

## 2. 배포 완료 (최신: 2026-10-06)

최신 Render 검증: `27b5595fc55ebf07b4d8d0ec2994fb2372bf9ce7`, 배포 `dep-db2fcp8ae00c73a5e750`, 2026-10-06 13:26:35 UTC (22:26:35 KST) live. 같은 커밋의 GitHub Actions `npm test` 성공. `/healthz` 200/ok (`protocol: 2`), GitHub Pages `mmo.html?online=1&server=…` 에서 `온라인 · 근처 0명`, 배포 직후 오류 로그 없음.

이전 Render 검증: `38bf537ed67468dae5001fec487b7a579b5a9623`, 배포 `dep-danpfkoae00c739k3b80`, 2026-09-20 08:23:24 UTC live. 통합 테스트 182개 통과. `/healthz` 200/ok, 전투·리깅·재질·온라인 핵심 파일 7개가 배포 소스와 일치, 배포 직후 오류 로그 없음. `91e5db6` 전투 개선과 `f20f4df` 클로드 팔/재질/환경광 개선을 함께 포함한다. S25 Ultra 실기기 체감 검수는 별도다.

| 커밋 | 무엇이 바뀌었나 |
|---|---|
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
