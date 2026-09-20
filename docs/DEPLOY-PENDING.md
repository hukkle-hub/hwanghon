# Render 재배포 대기 (파티 서버)

> **2026-09-20 — 대기 없음.** 아래 목록은 모두 배포됐다 (GPT 가 눌렀다).
> 남은 것은 **환경변수 하나** 뿐이다 (§3).

정적 사이트(GitHub Pages)는 `main` 푸시마다 자동으로 나간다. **파티 서버는
`render.yaml` 에 `autoDeployTrigger: "off"` 라서 손으로 눌러야 한다.**
`server/` 를 고칠 때마다 이 파일에 한 줄을 남기고, 배포되면 §2 로 옮긴다.

- 대상: `hwanghon-party` (Render · Singapore · free)
- 확인: `curl -s https://hwanghon-party.onrender.com/healthz`

## 1. 대기 중

없음.

## 2. 배포 완료 (2026-09-20)

| 커밋 | 무엇이 바뀌었나 |
|---|---|
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
