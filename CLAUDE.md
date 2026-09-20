# 황혼 — 작업 규약

## 1. 눈으로 확인하고, 이미지로 보여 준다

**디렉터 상시 지시: 「항상 해보고 이미지로 보여줘, 확인하게」**

화면에 보이는 것을 바꿨으면 **반드시 렌더해서 이미지를 첨부**한다.
수치만 대고 「고쳤습니다」라고 하지 않는다. 실제로 이 규약이 없어서

- 보스 다섯이 전부 바닥에 파묻혀 있는 걸 몇 달 못 봤고,
- 「최고속 = 접점」이라는 틀린 지표로 멀쩡한 클립 20개를 고칠 뻔했고,
- 헤드리스가 느린 걸 모르고 「카메라가 50° 어긋난다」는 오판을 네 번 했다.

### 무엇으로 찍는가

| 대상 | 도구 |
|---|---|
| 보스 자세 (쓰러짐·사망·공격) | `tools/3d/pose-sheet.html` |
| 실제 전투 화면 | `game3d.html?d=dNN` + Playwright |
| 온라인 | `party.html` (2인 필요) + `window.TW_RAID` |
| 쉘터 | `node server/index.cjs` + `shelter.html` + `window.TW_SHELTER` |
| 설계 시트 ↔ 구현 | `compare.html` · `tools/screen-fit.mjs` |
| 파티 모집 (2인) | `node tools/recruit-scenario.mjs` — 서버까지 한 프로세스에서 띄운다 |
| 휴대폰 (Pixel 7) | 같은 명령에 `MOBILE=port` / `MOBILE=land` |

```
# 포즈 시트 — 게임을 안 띄우므로 빠르다. 바닥판이 있어 파고듦이 보인다.
tools/3d/pose-sheet.html?clip=down&times=0,0.5,1      # 전 보스 × 한 클립
tools/3d/pose-sheet.html?rig=ward&clip=all            # 한 보스 × 전 클립
tools/3d/pose-sheet.html?clip=hit,stagger&times=peak  # 클립마다 «가장 멀어지는 순간»
```

### UI 화면은 1672x952 한 장이다

설계 시트가 그 크기다. 스테이지가 그보다 길어지면 `fitStage` 가 **화면 전체를**
축소한다 — 인력사무실이 0.81배로 줄어 글씨가 시트보다 19% 작게 나오고 있었다
(docs/design/26). UI 를 건드렸으면 반드시 재라.

```
node tools/serve.cjs &
node tools/screen-fit.mjs          # 20화면 전부 952px 인지 + 잘림 검사
```

넘치면 «스테이지를 늘리는» 게 아니라 **패널 안에서 스크롤하게** 만든다.
패널 «안» 이 넘치는 것도 눈으로 보지 말고 재라 — 시트가 한 화면에 보여 주는 것을
스크롤 뒤에 숨기면 시트를 따른 게 아니다. `el.scrollHeight - el.clientHeight`
를 **모든 경우에** 찍어 본다 (의뢰 7개를 다 눌러 봐야 가장 긴 것이 나온다).

**디렉터는 안드로이드로 논다.** 화면을 새로 만들면 데스크톱만 보고 끝내지 말고
휴대폰 가로·세로를 같이 재라 (docs/design/31). 가로 넘침 0 은 «멀쩡하다» 가
아니다 — 폭 0 으로 눌린 `<select>` 는 넘치지 않으면서 못 쓴다. 64px 미만인
조작 요소도 같이 센다.

`!important` 로 `display` 를 정할 때는 **항상 `:not([hidden])`** 을 붙인다.
`html.mobile #x{display:flex!important}` 는 `[hidden]{display:none!important}`
를 이겨서 숨겨야 할 것을 보이게 만든다 (같은 실수를 두 번 했다).

새 클래스 이름은 `css/ui.css` · `css/mobile.css` 에 **먼저 grep** 한다. `.mtabs`
는 모바일 페인 탭 바가 이미 쓰고 있어서 (`display:none` 이 기본) 새로 만든 종류
탭이 데스크톱에서 통째로 안 보였다 (docs/design/30 §7.1).

**짧은 클립은 반드시 `times=peak`** 로 찍는다. 0/0.5/1 은 하필 «되돌아오는 지점» 에
걸려 멀쩡한 클립도 죽은 것처럼 보인다 (hit 이 정확히 그랬다 — docs/design/25 §3).

### 헤드리스의 함정 (네 번 밟았다)

헤드리스 브라우저는 **초당 1~2프레임**으로 돈다. 3D 게임 화면을 찍을 때
`waitForTimeout(5000)` 은 게임 안에서 0.5초도 안 된다. 카메라가 수렴하기 전에 찍힌다.
**벽시계로 기다리지 말고 렌더된 프레임을 세거나, 카메라가 멈출 때까지 기다린다.**

## 2. 고치기 전에 잰다

숫자로 재고, 고치고, 다시 재서 보여 준다. 눈대중으로 값을 만지지 않는다.
그리고 **지표 자체가 맞는지 먼저 의심한다.** 이 프로젝트에서 잘못된 지표로 결론을
낼 뻔한 게 세 번이다:

- 「최고속 = 접점」 — 선형 키프레임 리그에서는 틀리다 (docs/design/24 §1)
- 헤드리스 벽시계 — 초당 1~2프레임이라 게임 시간이 아니다 (§1 위)
- **bpy 선형색 vs JS sRGB 색** — 그냥 견주면 8배 차이로 보인다 (docs/design/25 §4)

**단위와 공간부터 맞추고 재라.**

## 3. 배포

```
cd /home/user/hwanghon
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit ...
git push -q hwanghon hwanghon-split:main
curl -s https://hukkle-hub.github.io/hwanghon/version.json   # 빌드 해시 확인까지가 배포다
```

- GPT 가 main 에 올리므로 **push 전에 fetch/merge** 한다.
- `server/` 변경은 Render 재배포가 필요하고 그건 GPT 몫이다. 온라인에 언제 반영되는지
  디렉터에게 반드시 알린다.
- PR 은 **명시적으로 요청받을 때만** 만든다.

## 3.5 «없다» 고 말하기 전에 소스를 읽는다

이 세션에서 「서버에 그 명령이 없다」고 두 번 틀리게 말했다. 둘 다 있었고
테스트까지 있었다. grep 한 번으로 단정하지 말고 **호출 경로를 끝까지 따라가거나
실제로 돌려 본다.** 삼항 연산자 안의 문자열, 동적으로 만든 경로는 grep 에 안 걸린다.

## 4. 테스트

`npm test` 는 항상 통과시킨다. 새 규칙을 테스트로 박을 때는
**일부러 어긋나게 해 보고 실패하는지 확인**한다 — 통과만 보고 믿지 않는다.

## 5. 손대면 안 되는 것

- Hi3D 자격증명은 환경변수(`HI3D_CLIENT_ID` / `HI3D_CLIENT_SECRET`)로만. 커밋 금지.
- Hi3D 웹 세션 흔적(`hi3d-cookie.*`, `hi3d-state.json`, `hi3d-code.txt`)은 컨테이너 밖으로 내보내지 않는다.
- `android/keystore/hwanghon.jks` 는 사이드로딩용으로 **일부러** 커밋되어 있다.
- TLS 검증을 끄거나 `HTTPS_PROXY` 를 해제하지 않는다.

## 6. 참고 문서

`docs/design/` — 번호순. 최근 것들:

- `18` 보스전 설계 (연계·지연타·예고)
- `22` 마영전·몬헌 카메라/연출 벤치마크
- `23` 던전 07 폐병원
- `24` 접점·접지 감사 (전 보스 세밀 조정)
- `25` 전 보스 렌더 감사 + 디자인 시트 빌드 포함
- `26` 시트대로 화면 맞추기 (레이아웃 예산 952px)
- `27` 쉘터 화면 (길드·채팅, 서버 무변경)
- `28` 귓속말·차단 · 봉인 · 서비스워커 프리캐시 (0개였다)
- `29` 길드 가입 신청·승인 (공개 모집)
- `30` 파티 모집 화면 (설계 시트 03)
