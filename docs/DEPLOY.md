# 황혼 배포 안내

이 저장소는 **정적 사이트**(GitHub Pages)와 **파티 서버**(Node) 두 갈래로 배포한다.

| 대상 | 주소 | 배포 방법 | 되는 것 / 안 되는 것 |
|---|---|---|---|
| 정적 사이트 | https://hukkle-hub.github.io/hwanghon/ | `main` 푸시 → `.github/workflows/pages.yml` 자동 | 혼자 하는 던전·인벤토리·제작 등 전부 동작. 계정·길드·채팅·파티는 **파티 서버 주소**를 넣어야 동작 |
| 파티 서버 | 직접 호스팅 | 아래 세 가지 중 하나 | 계정·길드·월드/길드/파티 채팅·모집·2~4인 코옵 레이드(동시 100명) |

파티 서버는 정적 파일도 함께 서빙한다. 서버 주소로 접속하면 추가 설정 없이 전부 동작한다.

## 1. 같은 Wi-Fi (지금 바로)

```sh
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
npm run server       # 또는 START_PARTY_WINDOWS.bat / sh START_PARTY_MAC_LINUX.sh
```

실행 창에 뜨는 `같은 Wi-Fi` 주소(예: `http://192.168.0.10:8787/party.html`)를 PC·휴대폰에서 연다. 자세한 절차는 `PARTY_QUICKSTART.md`.

## 2. Render 무료 플랜 (상시 공개)

1. https://dashboard.render.com → **New** → **Blueprint**
2. 저장소 `hukkle-hub/hwanghon` 연결, 브랜치 `main` 선택 (`render.yaml` 을 읽는다)
3. **Apply** → 몇 분 뒤 `https://hwanghon-party.onrender.com` 형태의 주소가 생긴다
4. 그 주소의 `/party.html` 로 접속하면 끝. 정적 사이트 쪽에서 붙이려면 아래 3번 참고

> **재배포 대기 목록은 `docs/DEPLOY-PENDING.md`.** `render.yaml` 이
> `autoDeployTrigger: "off"` 라 `server/` 변경은 손으로 눌러야 나간다.

무료 플랜 주의: 15분 유휴면 잠들어 첫 접속이 30초쯤 걸리고, 재시작하면 `EPHEMERAL_STORAGE=1` 이라 계정·캐릭터가 초기화된다. 상시 유지가 필요하면 유료 플랜이나 디스크를 붙이고 `EPHEMERAL_STORAGE` 를 지운다.

## 3. GitHub Pages 사본에서 파티 서버에 붙이기

정적 사이트에는 WebSocket 서버가 없다. `party.html` 의 **파티 서버 주소** 칸에 호스팅한 서버 주소(예: `hwanghon-party.onrender.com`)를 넣으면 그 서버로 접속한다. 주소는 브라우저에 기억되고 `?server=` 로도 넘길 수 있다.

서버 쪽에서는 그 출처를 허용해야 한다. `render.yaml` 에 `ALLOWED_ORIGINS=https://hukkle-hub.github.io` 가 들어 있고, 직접 실행할 때는 같은 환경변수를 주면 된다.

```sh
ALLOWED_ORIGINS=https://hukkle-hub.github.io npm run server
```

## 4. Docker

```sh
docker compose up --build       # compose.yaml, 8787 포트
```

## 브랜치

| 브랜치 | 내용 |
|---|---|
| `main` | 쉘터·온라인 파티 빌드 (현재 배포본) |
| `shelter` | 업로드 스냅샷 원본 (cbbc64f) |
| `solo-line` | 단독 플레이 갈래 — 카인·류·세라 3인, 스킬 성장·연출, 장비 v0.4. 온라인 빌드와 던전 코드가 갈라져 있어 병합은 별도 작업 |
