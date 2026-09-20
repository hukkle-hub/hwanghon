# Render 재배포 대기 (파티 서버)

> GPT 확인 업데이트 (2026-09-20): 아래 5건은 이미 `d6cfe7d`에 포함되어 Render에서 live 확인됨.
> 배포 ID `dep-dannfqjtqb8s73cgo51g`, 완료 06:07:19 UTC, healthz 정상.
> 아래의 `5a80f53` 기준 대기/증상 목록은 **이전 상태 기록**이며 현재 미배포 목록이 아님.
> 이후 머리 자세 실험·검수 도구 수정은 별도 변경이며 Render 재배포하지 않음.
> 임시 저장소의 계정 초기화 위험을 해소하거나 사용자 확인을 받은 뒤 다시 배포할 것.

정적 사이트(GitHub Pages)는 `main` 푸시마다 자동으로 나간다. **파티 서버는
`render.yaml` 에 `autoDeployTrigger: "off"` 라서 손으로 눌러야 한다.**
그래서 지금 `main` 의 `server/` 와 실제로 돌고 있는 서버가 벌어져 있다.

- 대상: `hwanghon-party` (Render · Singapore · free)
- 확인: `curl -s https://hwanghon-party.onrender.com/healthz`
- 마지막으로 배포된 지점: **`5a80f53`** 이후 `server/` 변경이 전부 대기 중

## 대기 중인 커밋 (2026-09-20 기준, 5건)

| # | 커밋 | 무엇이 바뀌나 | 건드린 파일 |
|---|---|---|---|
| 1 | `312aa1c` | **길드 관리 알림** — 공지·임원 임명·길드장 위임·추방을 당사자와 실행자에게 `rpgNotice` 로 알린다 | `rpg-server.cjs` |
| 2 | `fe89ce8` | **길드 가입 신청·승인** — `guildBoard`/`guildApply`/`guildDecide`/`guildManage:open` 명령, 테이블 `guild_open`·`guild_applications` | `rpg-server.cjs` `rpg-store.cjs` |
| 3 | `891e660` | **파티원 Lv·전투력** — 대기 중인 방의 `state` 에 `level`·`power` 를 싣는다 | `index.cjs` |
| 4 | `8b9bfda` | (GPT) **아인 스킬 제스처·캐릭터별 모션 프로필** — 연출 전용, 피해·무적 없음 | `raid.cjs` |
| 5 | `834e84a` | **기술 등급 5종 · 모집 조건 · 목록 새로 고침** — 전투/제작/강화/수리/소모품에서 `p.skill` 누적, `techGrades`, `state` 에 `grades`, `board` 에 `chars`·`minPower`·`voice` + 가득 찬 방 포함, `join()` 의 최소 전투력 강제, `{type:'board'}` 명령 | `index.cjs` `rpg-store.cjs` `raid.cjs` |

| 6 | (이번) | **운영 도구** — `adminState` 에 이름·현재 제재·현재 공지, `adminFind` 신설, 제재 기간 상한 999분→1년, 신고 번호 999 제한 해제 | `rpg-server.cjs` `rpg-store.cjs` |

운영 도구(`admin.html`)를 쓰려면 환경변수도 하나 더 필요하다 —
`ADMIN_IDS = <플레이어 id>` (쉼표로 여러 명). 없으면 화면이 아무에게도
보이지 않는다. 자기 id 는 그 화면의 안내에 찍힌다 (`docs/design/32`).

## 재배포 전까지 온라인에서 안 되는 것

| 화면 | 증상 |
|---|---|
| 쉘터 | 공지 저장·임원·위임·추방을 눌러도 **당사자에게 알림이 안 간다** |
| 쉘터 | 「길드 찾기」가 비어 있고 가입 신청·승인이 **거부된다** |
| 파티 모집 | 4인 카드에 **Lv·전투력·5줄 등급표가 안 뜬다** |
| 파티 모집 | 모집 조건(최소 전투력·음성)이 **저장되지 않고 지켜지지도 않는다** |
| 파티 모집 | 「새로 고침」이 «파티에 먼저 참가해 주세요» 라는 **엉뚱한 오류**를 낸다 — 옛 서버에는 `board` 명령이 없어서 미지의 타입으로 떨어진다 |
| 파티 모집 | 필터의 「모집 중만 보기」가 거를 것이 없다 (옛 `board` 는 가득 찬 방을 애초에 안 보낸다) |

나머지(로그인·채팅·귓속말·차단·길드 생성/가입 코드·2~4인 레이드)는 **지금도
정상**이다.

## 재배포할 때

1. Render 대시보드 → `hwanghon-party` → **Manual Deploy** → *Deploy latest commit*
2. `curl -s https://hwanghon-party.onrender.com/healthz` 가 `{"ok":true,…}` 인지
3. 쉘터에서 길드 공지 저장 → 다른 계정에 알림이 뜨는지
4. 파티 모집에서 방을 만들고 → 카드에 Lv·전투력·등급표가 뜨는지

### 마이그레이션은 필요 없다

- 새 테이블 둘은 `initRpg()` 의 `CREATE TABLE IF NOT EXISTS` 로 부팅 때 생긴다
- 기술 등급 누적치 `p.skill` 은 프로필 JSON 에 새로 붙는 키다 (없으면 0 = 전부 C)

### 다만 계정은 날아간다

`render.yaml` 이 `DATA_DIR=/tmp/hwanghon` · `EPHEMERAL_STORAGE=1` 이라
**재배포·재시작하면 계정·캐릭터·길드가 초기화된다.** 무료 플랜을 그렇게 잡아
둔 것이고, 유지하려면 디스크를 붙이고 `EPHEMERAL_STORAGE` 를 지워야 한다
(`docs/DEPLOY.md` §2).
