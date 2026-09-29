# 기존 HTML/WebGL 런타임 제거 계획

## 지금 렉이 나는 구조에서 버릴 것

- `game3d.html`을 앱 본체로 실행
- 브라우저 WebGL에 전체 게임 월드/캐릭터/전투를 적재
- JS에서 매 프레임 UI와 전투를 동시에 갱신
- 대형 GLB를 브라우저 메모리에 상주
- 브라우저 탭/모바일 WebView를 게임 클라이언트처럼 사용

## 교체

```text
이전:
HTML + JS + Three.js + browser/WebView

신규:
Unreal Android/PC packaged client
        ↓
HTTP auth/matchmaker
        ↓
Unreal Dedicated Server (UDP gameplay)
```

HTML은 `/tools` 또는 별도 개발 호스트에 남겨
모션 검수/3D 비교/운영 패널 용도로만 사용한다.

## 얻는 것

- 네이티브 GPU/메모리 제어
- Texture Streaming / LOD / Anim Budget
- Unreal replication
- Dedicated server 권한 판정
- 서버 인스턴싱
- 캐릭터 선택 → 쉘터 → 던전이라는 실제 게임 흐름
