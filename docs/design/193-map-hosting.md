# 193 · 맵 그림을 둘 곳 — 결정 보고서 (2026-10-07)

디렉터: «글쎄 어느게 좋을까? 지피티랑 상의해보게 보고서좀» — 문서 192 §5 의 «정할 것».
이 문서는 GPT 와 디렉터가 같이 읽고 정하라고 쓴다. 숫자는 2026-10-07 새벽에 잰 값, 한도는 각 서비스 공식 문서를 같은 날 읽었다(§6).

## 1. 한 줄 결론

**지금은 «맵 전용 GitHub 저장소를 지역 묶음별로 나눠 각자 Pages» (A).** 새 계정·키·도메인이 필요 없고 지금 굽기·캐시가 그대로 돈다.
총량이 5 GB 를 넘거나, 월 전송량이 100 GB 에 가까워지거나, **수익화를 시작하면 Cloudflare R2 + 우리 도메인 (B)** 으로 옮긴다 — 게임은 주소 한 줄만 바뀐다.
Hugging Face (C) 는 권하지 않는다 — 기술은 되지만 «다른 사람이 다시 쓸 데이터» 를 위한 곳이라 취지가 안 맞다.

## 2. 지금 상황 (잰 값)

| | 값 |
|---|---|
| `maps/` 전체 | **445 MB · 파일 26,699개** (10 MB 넘는 파일 없음) |
| 필드 지역 하나 | 20~74 MB · 파일 1,600~2,800 (남산 74 MB 가 가장 크다, 던전은 1~14 MB) |
| 찍어 낸 지역 하나 (대전·해운대·경포) | **약 30 MB · 파일 1,889** (943 타일 × 색·깊이 + map.json + 미니맵) |
| 저장소 `.git` | **1.4 GB** — GitHub 권장 1 GB 넘음(강력 권장 상한 5 GB). 다시 구울 때마다 옛 타일이 이력에 남는다. 오늘 깊이 버그(문서 192 §9)로 11곳을 다시 구워 수백 MB 늘었다 |
| GitHub Pages 한도 | 게시 사이트 **1 GB**, 전송 월 100 GB(소프트), 배포 10분 제한 |
| 계획 (문서 192) | 전국 지역 30곳이면 +0.9 GB, 목록 46곳 전부면 약 1.8 GB. 해상도·넓이를 늘리면 더 |

**플레이어가 실제로 받는 양**: 게임은 화면 둘레 타일만 받는다(`js/mmo/map2d.js` — 보이는 범위 + 한 칸). 타일 한 쌍(색+깊이)은 평균 약 32 KB.
한 지역을 끝까지 다 돌면 약 30 MB, 보통 한 번 들어가면 5~10 MB. 타일 주소에 내용 해시(`?v=`)가 붙어 서비스워커가 오래 캐시하므로 **다시 오면 0**.
→ 월 100 GB 는 «한 지역 다 돌기» 약 3,300번, 보통 접속으로는 1~2만 번.

## 3. 후보

| | **A. GitHub Pages — 맵 저장소 나누기** | **B. Cloudflare R2 + 우리 도메인** | C. Hugging Face 데이터셋 | (제외) D. Cloudflare Pages |
|---|---|---|---|---|
| 용량 | 저장소(사이트)마다 1 GB → 묶음 2~3개면 지금 계획 다 들어감 | **10 GB 무료**, 넘으면 GB당 월 $0.015 | 공개는 무료 «best-effort» — «처음 몇 GB 넘으면 다른 사람에게 가치 있는 것만» | 무료 사이트당 파일 **2만 개** — 지금 이미 26,699개라 안 들어감 |
| 전송·요청 | 사이트마다 월 100 GB(소프트) | **내보내기 무료**, 읽기 월 1천만 회 무료(우리 도메인 + 캐시면 대부분 캐시에서 나감) | CloudFront CDN | — |
| 필요한 것 | 같은 계정에 새 저장소 몇 개. 끝 | Cloudflare 계정 + **도메인**(연 1~2만 원) + API 키(환경변수로만 — 커밋 금지 규칙 그대로). `r2.dev` 주소는 «속도 제한 · 개발용» 이라 운영에 못 쓴다 | 계정 + 데이터셋 카드 | — |
| 이력 부풀기 | 맵 저장소는 굽을 때마다 **한 커밋으로 덮어쓰기**(force push) → 안 쌓인다 | 없음 (버전 없이 덮어쓰기, 옛 해시 파일은 지우면 됨) | git 기반이라 쌓인다 → 주기적 `super_squash` | — |
| 다른 출처에서 읽기(CORS) | **`Access-Control-Allow-Origin: *` 실측 확인** (우리 Pages) | 버킷에 CORS 규칙 한 번 | 됨 | — |
| 약관·정책 | Pages 는 «온라인 사업·전자상거래, 상업 거래나 상업 SaaS 를 주 목적으로 하는 사이트» 의 무료 호스팅을 막는다(후원 버튼·크라우드펀딩 링크는 허용) → **수익화하면 걸린다 — 맵뿐 아니라 게임 사이트 자체도** | 상업 사용 문제없음 | «공동체가 다시 쓰라고 공유하는 데이터» 가 전제. 다시 안 쓸 데이터면 «다른 플랫폼이 낫다» 고 적혀 있다 | — |
| 비용 | 0 | 도메인만 (10 GB 까지) | 0 (PRO 월 $9) | — |
| 옮기는 일 | 반나절 (§5) | A + 업로드 도구(S3 호환) + 도메인·캐시 규칙 설정 | A 와 비슷 | — |

## 4. 추천과 이유

1. **지금 A.** 지역을 «원작 동선(서울~고흥) / 중부 / 남부 / 동해안·제주» 처럼 묶어 `hwanghon-maps-<묶음>` 저장소 몇 개로. 각자 Pages.
   - 새로 만들 계정·키·도메인이 없다 — 디렉터 손이 안 간다.
   - 지금 굽기 → 해시 → 서비스워커 흐름을 그대로 쓴다. CORS 실측 OK.
   - 맵 저장소는 이력을 덮어써 1 GB 안에 머문다. 본 저장소는 코드·문서·`map.json` 만 남아 가벼워진다(옛 이력 정리는 §7 에서 따로 정함).
2. **옮길 때 B.** 기준 셋 중 하나가 오면: 총 5 GB 넘음 · 사이트 하나 월 전송 100 GB 근처 · 수익화(결제·광고) 시작.
   맵 주소가 `map.json` 한 칸이라 A → B 는 업로드 대상만 바꾸면 된다.
3. **C 는 안 한다.** 무료 한도가 «노력하겠다» 수준이고, 게임 타일은 그곳의 취지(재사용 데이터)와 다르다 — 어느 날 정리 대상이 될 수 있다.

## 5. A 로 할 때 바꾸는 것 (내 몫, 반나절)

- 타일(`t_*.webp`, `d_*.png`, `overview.webp`)만 맵 저장소로. **`map.json` 은 본 저장소에 남긴다** — Render 서버가 걷는 띠·출발점·문을 `maps/2d/<zone>/map.json` 에서 읽기 때문(`server/field.cjs`).
- `map.json` 에 `tileBase`(예: `https://hukkle-hub.github.io/hwanghon-maps-south/2d/daejeon/`). `js/mmo/map2d.js` 는 `tileBase` 가 있으면 거기서, 없으면 지금처럼.
- `tools/2d/publish-maps.mjs` — 굽기 뒤 묶음 저장소에 복사 → 한 커밋으로 덮어써 push → Pages 빌드 확인.
- `sw.js` — 다른 출처 타일도 해시 주소로 캐시.
- 시험 — `map.json` 의 타일 목록과 맵 저장소 목록(로컬 사본)이 맞는지, `tileBase` 가 허용 목록 안인지.

## 6. 근거 (공식 문서, 2026-10-07 읽음)

- GitHub Pages limits — 게시 1 GB, 소스 저장소 권장 1 GB, 월 100 GB 소프트, 배포 10분: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub 저장소 크기 — 이상적 1 GB 미만, 강력 권장 5 GB 미만, 파일 100 MiB 차단: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- Cloudflare R2 요금 — 10 GB-월 무료, Class A 100만 · Class B 1천만 무료, 내보내기 무료: https://developers.cloudflare.com/r2/pricing/
- R2 공개 버킷 — `r2.dev` 는 속도 제한·개발용, 운영은 같은 계정의 도메인 + Cache Everything: https://developers.cloudflare.com/r2/buckets/public-buckets/
- Cloudflare Pages 한도 — 무료 사이트당 파일 2만 개, 파일 25 MiB: https://developers.cloudflare.com/pages/platform/limits/
- Hugging Face 저장 한도 — 공개 무료 best-effort, 폴더당 1만 파일, 재사용 데이터 전제: https://huggingface.co/docs/hub/storage-limits
- GitHub Pages 약관 — «not intended for or allowed to be used as a free web hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions or providing commercial software as a service (SaaS)», «Some monetization efforts are permitted on Pages, such as donation buttons and crowdfunding links»: https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
- 실측: `curl -I https://hukkle-hub.github.io/hwanghon/maps/world/korea.json` → `access-control-allow-origin: *`, `cache-control: max-age=600`

## 7. GPT 와 정할 것

1. **수익화 계획이 있나?** (결제·광고·유료 아이템) — 있으면 Pages 약관 때문에 맵은 처음부터 B 가 맞고, **게임 사이트 자체(지금 Pages)도 옮길 곳이 필요하다**. 후원 버튼 정도면 Pages 에 남아도 된다.
2. **도메인을 살 건가?** — B 의 전제. 산다면 게임 주소도 그 도메인으로 옮길 수 있다.
3. **예상 이용자 수** — 월 100 GB = 한 지역 다 돌기 약 3,300번. 몇 명이 매일 몇 지역을 도나.
4. **본 저장소 이력(1.4 GB) 정리** — 맵을 빼도 옛 이력은 남는다. 이력을 다시 쓰면(`git filter-repo`) **GPT 의 작업 사본과 Render 배포가 모두 다시 받아야** 한다 → 둘이 같이 날을 정해야 한다. 안 쓰면 본 저장소는 1.4 GB 에서 멈추고 더는 안 늘어난다.
5. **Render 서버가 `map.json` 을 어디서 읽나** — §5 처럼 본 저장소에 남기는 안(추천) / 서버가 맵 주소에서 받아 오는 안.
