# 황혼 (TWILIGHT) — GAME UI

제공된 UI 컨셉 시트 / 설계 보드 9장을 실제로 동작하는 화면으로 구현한 정적 프론트엔드입니다.
빌드 도구·프레임워크·번들러 없이 **브라우저에서 파일을 바로 열면** 동작합니다.

```
game-ui/
├── index.html        타이틀 (게임 진입점: 시작 → 메인 로비)
├── lobby.html        메인 로비 (컨셉 시트 1: 메뉴 · 자원 · 이벤트 · 출정 → 인력사무실)
├── board.html        컨셉 시트 + 화면 보드(개발용, 각 화면 실시간 미리보기)
├── office.html       1. 인력사무실 (로비)
├── quest.html        2. 의뢰 상세 / 보스 도감
├── party.html        3. 파티 모집 / 인력사무실
├── battle.html       4. 전투 화면 (HUD)
├── inventory.html    5. 장비 / 인벤토리
├── shop.html         보급소 (소모품·재료 구매/판매, 단가는 items.js SHOP)
├── forge.html        6. 장비 관리 / 강화 (재료·확률·비용은 items.js)
├── craft.html        6-1. 장비 관리 / 제작 (레시피 · 재료 보유/필요 · 제작)
├── profile.html      7. 플레이어 프로필 / 기술 등급
├── result.html       8. 전투 결과 / 보상 정산
├── benchmark.html    9. UI 벤치마크 / 제안 압축 시트
├── characters.html   캐릭터 설정 시트 (턴어라운드 뷰어)
├── compare.html      디자인 시트 ↔ 구현 대조 뷰어
├── design-sheets/    원본 설계 시트 9장 + characters/ 캐릭터 시트 4장
├── manifest.json     PWA 매니페스트 (전체화면 · 가로 고정)
├── sw.js             서비스워커 (같은 출처 자산 캐시 우선, 오프라인 동작)
├── art/              시트에서 추출한 일러스트 에셋
├── css/tokens.css    디자인 토큰 (팔레트·타이포·등급 컬러·간격)
├── css/ui.css        공용 컴포넌트 (패널·배지·슬롯·게이지·버튼·탭 …)
└── js/icons.js       SVG 아이콘 스프라이트 (60여 종, currentColor 상속)
    js/ui.js          런타임 (탭·선택·게이지·슬롯·카운트다운·화면 전환·스테이지 피팅·상단 바 우편/기록/설정 시트)
    js/items.js       장비 · 재료 · 소모품 · 레시피 · 강화 단계표 · 제작 재료 효과표 (단일 원본)
    art/items/*.svg   아이템 고유 이미지 31종 (tools/items/gen-item-art.mjs 로 생성 · items.js artHTML 이 슬롯·상세·드랍에 사용, 제작품은 재료 색조·광채 덧씌움)
    js/gear.js        장비 저장(장착·보유·강화·내구도·제작품) · 스탯 계산 · 강화/대수선/분해/제작 규칙
    js/world.js       캐릭터 · 의뢰 · 보스 · 파티 · 전투 결과 · 프로필 · 전투 HUD (단일 원본)
    js/inventory.js   인벤토리 화면 렌더러 (장착/해제 · 비교 · 필터)
```

## Android APK (사이드로드)

PWA 대신 앱으로 설치할 수 있습니다. 앱은 GitHub Pages 의 최신 배포(https://hukkle-hub.github.io/hwanghon/)를 그대로 띄우는 셸이라, `main` 에 푸시하면 앱을 다시 설치하지 않아도 다음 실행에서 자동 갱신됩니다(한 번 불러온 뒤에는 서비스워커 캐시로 오프라인 실행). `main` 푸시마다 GitHub Actions 가 서명된 APK 도 새로 빌드해 릴리스에 올립니다.

- 앱 설치 파일(사이트에서 직접): https://hukkle-hub.github.io/hwanghon/app/hwanghon.apk
- GitHub 릴리스(빌드마다 갱신): https://github.com/hukkle-hub/hwanghon/releases/download/apk-latest/hwanghon.apk
- 릴리스 페이지(빌드 sha 별 파일 포함): https://github.com/hukkle-hub/hwanghon/releases/tag/apk-latest
- 설치: 폰에서 링크를 열어 다운로드 → "출처를 알 수 없는 앱 허용" → 설치. 같은 키로 서명되므로 새 APK 를 덮어 설치하면 업데이트됩니다.
- 로컬 빌드: `npm ci && bash tools/build-www.sh && npx cap sync android && cd android && ./gradlew assembleRelease`
  (Capacitor 6 · `android/keystore/hwanghon.jks` 는 사이드로드 배포 전용 키입니다. 스토어 배포 시 새 키로 교체하세요.)

## 실행

```bash
# 아무 정적 서버나 사용 (또는 index.html을 브라우저로 바로 열기)
npx http-server game-ui -p 8080
```

`index.html`(타이틀)이 시작점입니다. 시작 → `office.html`(인력사무실, 허브) → 각 화면. 개발용 화면 보드는 `board.html`. 데스크톱에서는 모든 화면 하단에 **화면 전환 독**이 떠 있고 `H` 키로 숨길 수 있으며, 휴대폰에서는 타이틀의 "개발 메뉴"(또는 `?dev=1`)로 켠 경우에만 표시됩니다.

## 아이템 데이터 (`js/items.js`)

장비·재료·소모품·제작 레시피·강화 단계표가 이 파일 하나에 들어 있고,
인벤토리 · 강화 · 제작 화면이 여기서 읽어 렌더링합니다.

| 구분 | 내용 | 출처 |
|---|---|---|
| `EQUIP` | 무기 7 · 방어구 5 · 악세서리 3 (전투력·기본/추가 공격·치명·효과·내구·판매가·귀속) | 시트 항목 + `src:'fill'` 가안 |
| `MATERIAL` | 강화 합금 124 · 응축된 파편 78 · 정제된 에너지 코어 24 · 고급 강화 보조제 9 + 채집 재료 6종 | 06-forge / 05-inventory |
| `CONSUMABLE` | 회복약 · 투척 폭약 · 채집 도구 · 지혈제 · 임무 아이템 2종 | 시트 + 가안 |
| `RECIPE` | 9종 — 메마른 갈대밭 검창 레시피는 강화 재료 필요량(36/18/6)과 동일 수치 | 시트 + 가안 |
| `ENHANCE` | +1 ~ +10 성공률·비용·재료. +5 = 65% / 18,000 G, +7 옵션 잠금 해제 | 06-forge |
| `PLAYER` | 골드 75,300 · 제작 숙련 20 · 장착 슬롯 · 가방 | 시트 |

각 항목의 `src` 가 `'sheet'` 면 디자인 시트에서 확인되는 수치, `'fill'` 이면
시트에 이름이 없어 세계관에 맞춰 채운 가안입니다. **실제 기획 자료가 오면 이 파일만 교체**하면
세 화면이 그대로 따라옵니다. 새 항목에 필요한 키: `id · name · type · slot · rarity · icon · cp · stats`.

## 월드 데이터 (`js/world.js`)

`items.js` 가 아이템이라면 `world.js` 는 나머지 전부입니다. 화면의 목록·카드·수치는 여기서 읽습니다.

| 키 | 쓰는 화면 | 내용 |
|---|---|---|
| `CHARS` | 캐릭터 · 인력사무실 · 전투 HUD · 결과 | 아인·카인·류·세라 — 역할·등급·능력치·외형·특성·대사 |
| `QUESTS` / `MISSIONS` | 인력사무실 · 의뢰 상세 · 파티 모집 | 의뢰 5건 (보수·권장·목표·보상·전리품·드롭·정찰 노트·체크리스트) |
| `BOSSES` / `CODEX` | 의뢰 상세 | 약점 부위·공격 패턴·추천 특성·마스터리, 도감 수집 현황 |
| `PARTY` | 파티 모집 · 인력사무실 | 파티 코드·멤버·등급·준비 상태·채팅·모집 설정·사무소 등급 |
| `RESULT` | 전투 결과 | 작전 요약·보상·보너스·기여도·파티 성과 |
| `PROFILE` | 플레이어 프로필 | 신원·숙련도·보스 기록·클리어 이력·역할·장비 요약·시즌 |
| `BATTLE` | 전투 HUD | 보스 체력·파티·카운터·상태·자원·스킬 |

의뢰 목록을 누르면 상세가 바뀌고, 보스가 없는 의뢰는 부위 정보 대신 안내가 뜹니다.
아이템 참조(`loot` `drops` `rewards` `equip`)는 전부 `items.js` 의 id 를 씁니다.

## 안드로이드 / 모바일

설계 기준(1672×952)을 유지한 채 다음으로 안정화했습니다.

- **피팅**: 터치 기기는 폭·높이를 모두 맞춰(contain) 한 화면에 들어오고 가로 중앙 정렬. 데스크톱은 폭 기준.
- **세로 화면**: "가로로 돌려 주세요" 안내, "이대로 보기"로 넘길 수 있음. `manifest.json` 은 `orientation: landscape`.
- **터치**: `touch-action: manipulation`(더블탭 확대 지연 제거), 탭 하이라이트 제거, 텍스트 선택 방지, `:active` 눌림 피드백, 화면 전환 독 확대·안전영역 반영.
- **성능**: 터치 기기에서 전체 화면 그레인(feTurbulence)·backdrop-filter 를 끔, 스테이지 `will-change`.
- **인덱스 미리보기**: 터치 기기는 iframe 10개 대신 `art/thumbs/` 정적 썸네일(총 63KB).
- **PWA**: 홈 화면 추가 시 전체화면·가로 고정으로 실행, 서비스워커가 같은 출처 자산을 캐시해 오프라인에서도 열림. 폰트 CDN 은 네트워크 우선.
- **뷰포트**: `viewport-fit=cover`, 핀치 확대 비활성(게임 UI 관례).

### 휴대폰 전용 레이아웃 (`css/mobile.css`, `html.mobile`)

터치 기기이면서 짧은 변이 640 CSS px 이하(휴대폰)면 스테이지를 축소하지 않고
**100vw × 100dvh 에 네이티브로 재배치**합니다. 태블릿은 축소 스테이지를 유지합니다.

근거 — Android Material 48dp · Apple HIG 44pt · WCAG 2.5.5 44px 터치 목표, 주 행동은 하단 모서리(엄지 영역),
HUD 는 고정 픽셀이 아닌 안전영역 인셋 기준. (조사 출처는 커밋 메시지 참고)

| 규칙 | 구현 |
|---|---|
| 진행 공개 | 데스크톱의 3~5열을 **패널 탭**으로. `main` 직계 자식이 패널, `data-mpane="라벨"` 로 이름, 같은 라벨은 하나로 합침 |
| 첫 패널 | `main[data-mdefault]`. 방문한 패널은 세션 동안 기억 |
| 주 행동 | `[data-primary]` 를 하단 바로 이동(48px, 엄지 영역). 좌측은 뒤로 |
| 목록 → 상세 | `[data-mgoto="라벨"]` 안을 누르면 그 패널로 이동 (의뢰·임무·레시피·가방·장착 슬롯) |
| 터치 크기 | 버튼 44px, 탭 40px, 행 12px 패딩, 슬롯 최소 58px, 본문 13.5px |
| 세로 화면 | 패널 탭이 둘째 줄로. HUD(`body[data-landscape]`)만 가로 회전 안내 |
| 안전영역 | 스테이지·하단 바·HUD 앵커에 `env(safe-area-inset-*)` |
| 예외 | `compare.html` 은 `data-nomobile` (좌표 대조 화면이라 축소 유지) |

화면별 재배치는 `mobile.css` 하단 "화면별 컨테이너" 절에 있습니다 — 페이퍼돌 3열 유지, 파티 카드 2열,
강화 작업 레일 2×2, 프로필 아이콘 레일 가로, 전투 결과 시트 헤더 한 줄 등.

## 디자인 토큰

컨셉 시트의 MAIN COLOR PALETTE를 그대로 `css/tokens.css`에 옮겼습니다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--c-void` | `#0B0C0F` | 최심부 배경 |
| `--c-panel` | `#1A1B1F` | 패널 기본면 |
| `--c-steel` | `#2B3C31` | 스틸/보조면 |
| `--c-gray` | `#8A8A8A` | 보조 텍스트 |
| `--c-red` | `#A51C1C` | 주요 액션 |

타이포는 **Noto Serif KR**(제목) / **Noto Sans KR**(본문)이며 Google Fonts에서 로드합니다.
오프라인 환경에서는 `--f-serif` / `--f-sans` 폴백 스택이 적용됩니다.

등급 컬러(S/A/B/C)와 아이템 레어도(일반·희귀·영웅·전설·신화)는 벤치마크 시트의
"컬러 시스템(권장)" 원칙에 맞춰 토큰화되어 있습니다.

## 디자인 시트 (작업 기준 원본)

`design-sheets/` 에 원본 설계 시트 9장이 들어 있습니다. 모든 화면은 이 시트를 기준으로
작업하며, 시트와 구현은 **같은 1672px 좌표계**를 씁니다.

| 파일 | 대응 화면 |
|---|---|
| `00-concept.webp` | 컨셉 시트 (팔레트·타이포·레퍼런스) |
| `01-office.webp` | 인력사무실 |
| `02-quest.webp` | 의뢰 상세 / 보스 도감 |
| `03-party.webp` | 파티 모집 |
| `05-inventory.webp` | 장비 / 인벤토리 |
| `06-forge.webp` | 장비 관리 / 강화 |
| `07-profile.webp` | 플레이어 프로필 |
| `08-result.webp` | 전투 결과 / 보상 정산 |
| `09-benchmark.webp` | UI 벤치마크 압축 시트 |
| `characters/ain·kain·ryu·sera.webp` | 캐릭터 턴어라운드 (정면/측면/후면) |

`compare.html` 에서 시트와 구현을 겹쳐 놓고 분할 슬라이더로 대조할 수 있습니다.
화면을 수정한 뒤에는 이 뷰어로 시트와 어긋난 곳을 확인하고 작업하십시오.

> 시트 원본은 941px, 구현 스테이지는 952px이라 하단에서 약 11px 차이가 납니다.
> 대조 시 이 오차를 감안하십시오.

## 아트 에셋

일러스트는 원본 시트에서 잘라내 `art/` 에 WebP로 관리합니다 (총 약 0.4MB).
모든 아트 자리는 `.art` 컨테이너로 분리되어 있어 교체는 이미지 한 장이면 됩니다.

```html
<div class="art art--beast">
  <img src="art/boss-marsh.webp" alt="">
</div>
```

| 에셋 | 쓰이는 곳 |
|---|---|
| `office-brief` | 인력사무실 중앙 브리핑 |
| `boss-marsh` / `boss-anatomy` | 보스 아트 · 부위 파괴 다이어그램 |
| `portrait-ain/kain/ryu/sera` | 파티 모집 카드 (상황 일러스트) |
| `face-ain/kain/ryu/sera` | 모든 소형 아바타 슬롯 (캐릭터 시트 얼굴, 알파) |
| `full-* / side-* / back-*` | 캐릭터 설정 시트 턴어라운드 · 인벤토리 페이퍼돌 (알파) |
| `char-inventory` / `char-profile` / `char-result` | 전신 캐릭터 아트 |
| `forge-kain` | 대장간 |
| `lobby-city` / `story-city` | 폐허 도시 · 전장 배경 |

캐릭터 시트는 회색 배경을 알파로 제거해 추출했습니다 — 배경은 이미지 가장자리와 이어진
무채색 영역으로 잡고(가장자리 플러드필 + 채도 판정), 피부처럼 배경 밝기에 가까운 색은
윤곽 안쪽이면 전경으로 유지합니다. 새 캐릭터 시트가 오면 같은 절차로 뽑으면 됩니다.

보정 클래스: `.art--top`(상단 기준, 얼굴 노출) `.art--mid`(상단 32%) `.art--avatar`(알파 얼굴) `.art--doll`(전신 contain)
분위기 폴백: `.art--beast` `.art--portrait` `.art--city` `.art--forge` `.art--office`
— 이미지를 비우면 절차적 플레이스홀더로 되돌아갑니다.

새 크롭이 필요하면 원본 시트에서 좌표를 지정해 추출하십시오.

## 해상도

설계 기준 해상도는 **1672 × 952 (16:9)** 입니다.
`js/ui.js`가 뷰포트가 좁을 때 스테이지 전체를 비율 유지하며 축소하므로
노트북/태블릿에서도 레이아웃이 깨지지 않습니다.

## 상호작용

마크업만으로 동작하는 데이터 속성을 씁니다. 별도 초기화 코드가 필요 없습니다.

| 속성 | 동작 |
|---|---|
| `data-tabs` / `data-tab` | 탭 전환 (`data-pane`과 연결 가능) |
| `data-pick` | 컨테이너 내 단일 선택 (리스트·카드·슬롯) |
| `data-fill="62"` | 진행 바 채움 (%) |
| `data-seg="72"` | 12칸 분절 게이지 (구조 안정성 등) |
| `data-gauge="87"` | 원형 숙련도 게이지 |
| `data-slots="15"` | 아이템 슬롯 그리드 자동 생성 |
| `data-countdown="55"` | 초 단위 카운트다운 |

## 호스팅

- 이 저장소는 완전한 정적 사이트다. GitHub Pages(Settings → Pages → Deploy from a branch → `main` / root) 로 그대로 서빙된다. `.nojekyll` 이 있어 언더스코어 경로도 빌드 없이 노출된다.
- 서버 호출이 없으며 장비·제작·파티 상태는 브라우저 메모리에만 있다(새로고침 시 초기화). 나중에 저장이 필요하면 `js/items.js` 의 `PLAYER` 와 `js/world.js` 의 `PARTY` 를 API 응답으로 치환하면 되도록 데이터 모듈을 분리해 두었다.
- 서비스워커(`sw.js`)는 이 저장소 경로 범위만 담당하며 `tw-` 접두 캐시만 관리한다. HTML/CSS/JS 는 네트워크 우선이고 아트만 캐시 우선이다.
- 업데이트: 배포 워크플로가 `sw.js`·`js/ui.js` 의 `__BUILD__` 를 커밋 해시로 치환하므로 `main` 에 푸시하면 설치형 PWA 도 접속(또는 앱 복귀)하는 즉시 새 서비스워커를 받고, 워커가 열린 화면을 직접 다시 불러온다. 보조로 화면은 켜질 때 `version.json` 을 읽어 빌드가 다르면 스스로 갱신한다. 현재 빌드는 화면 전환 독 안에 표시된다.
- 이력: `hukkle-hub/sns-agent-app` 의 `game-ui/` 폴더에서 `git subtree split` 으로 분리했다(커밋 이력 보존).

## 던전 01 · 뒷마당 훈련장 (`game.html` — Phaser 4)

기획: `docs/design/01-training-arena.md`. 완전 수동 조작, 아인 고정, 허수아비 3단계(짚 → 철갑 → 태엽).

| 파일 | 역할 |
|---|---|
| `js/dungeons.js` | `TW_DUNGEONS` — 전투 공통 규칙 `RULES`, 아인 기술 `SKILLS`, 아레나 `ARENAS.tutorial`(허수아비는 `BOSSES` 형식 + 엔진 필드) |
| `js/combat.js` | `TW_COMBAT` — DOM 없는 전투 엔진. 60틱 고정 스텝, 입력(공격·회피·방어·기술·궁극기·조준), 카운터/부위 파괴/출혈/자세/격추, 지표·등급·정산. Node 에서도 돌아가 봇 검증에 쓴다 |
| `css/battle.css` | 전투 HUD 공통 스타일 (`battle.html` 과 공유) |
| `game.html` + `js/game-dungeon.js` | **던전 화면(Phaser 4.2 WebGL).** 노멀맵 조명(횃불·플레이어·핵 광원, 환경광), 생성 아트(바닥·돌담·울타리·문·소품·보스 원), 아인 3면 컷아웃 걷기 리그, 허수아비 리그(Phaser 컨테이너), 히트 파티클·카메라 흔들림/줌·비네트, 바닥 범위(존), 가상 스틱, 미니맵, 보스 방 입장 시 문 잠김 → 3 페이즈 → 정산. HUD 는 DOM 오버레이 |
| `vendor/phaser.min.js` | Phaser 4.2.1 (jsDelivr 에서 고정) |
| `js/sfx.js` | 절차 생성 효과음(공격·타격·카운터·파괴·격추·궁극기·피격·구르기·문·사슬·페이즈·클리어)과 바람+불꽃 환경음. 파일 없음, 첫 터치에서 잠금 해제 |
| `js/rig-phaser.js` | `dummy-rig.js` 리그 데이터를 Phaser 컨테이너 계층으로 올리는 렌더러/애니메이터 |
| `js/ain-rig.js` + `art/ain/*.webp` | 아인 정면·후면·측면 컷아웃(몸통·팔·다리) 걷기 리그 |
| `art/env/*.webp` | 생성 환경 아트: `ground`(+`_n` 노멀맵), `wall`(+`_n`), `fence`/`fpost`, `gate`, `ring`, `barrel` `crate` `post` `sign` `torch` `straw` |
| `maps/d01.json` + `maps/yard-tiles.png` | 레벨을 Tiled 형식으로 내보낸 것(바닥/구조/소품 레이어). Tiled 에서 열어 편집 가능 |
| `dungeon.html` | 같은 던전의 캔버스 2D 판(엔진 이전 전 버전) |
| `js/dungeon.js` | 레벨 데이터: 격자 맵(ASCII), 소품, 보스 방, 페이즈별 AI(속도·거리·패턴 선택), 패턴별 바닥 존(원·직선), 안내 비트 |
| `js/dungeon.js` d02 · `js/dungeons.js` ARENAS.marsh | **던전 02 갈대습지** (`game3d.html?d=d02`) — 야외 습지(갈대 벽·얕은 물·망루·등불·안개·반딧불), 잡몹 2종(갈대 잠복자·늪 껍질), 대형 사족 보스 「모르버스」(부위 5 · 패턴 4 + 광란 페이즈). 아레나 설정이 3D 모델·부위→뼈·파괴 조각·클립을 지정하므로 엔진 수정 없이 던전을 늘린다. 보스 모델은 `tools/3d/build_marsh_boss.py`(bpy 절차 생성 + 사족 뼈대 + 클립 12) → `art/3d/boss_marsh.glb`. 검수: `docs/design/08-phase3-dungeon02-review.md` |
| `js/story.js` · `story.html` | **4단계 이야기·의뢰 진행.** 장(프롤로그·1장 훈련장·2장 갈대습지·3장 예고)과 대사(초상화 오버레이), 의뢰 상태(수행 가능/완료·보수 미수령/보수 수령), 보수 수령, 출격 전 마태오 브리핑, 클리어 후 후일담(정찰대의 기록 유무 분기), 던전 입장 컷신(플라이오버)·격파 컷신. 상태는 `save.js` flags. 잡몹은 제거 — 보스 전용 던전 |
| `js/grade.js` | **등급 시스템(레벨 대체).** 요원 등급 A→A+→S→S+→SS(누적 경험치), 기술 등급 5종 카운터·부위 파괴·정제·드랍·제작 C→SS(전투·대장간 기록 `save.stats`). 파티(플레이어+동행 NPC)의 기술 최고 등급이 카운터 판정·부위 피해·재료·행운·강화 성공률·수리비에 반영. 검수: `docs/design/10-grade-system-review.md` |
| `js/looks.js` · `art/3d/gear/` | **장비 외형 반영.** 주무기 5종 모델 교체(`tools/3d/build_weapons.py` 절차 생성), 단도는 허리·갈고리 낫은 등, 방어구·장신구는 뼈에 붙는 조각. **v0.3: 컨셉 이미지→Hi3D 이미지-3D 로 뽑은 실제 모델(`art/3d/gear/`, `tools/3d/gear_post.py` 후처리)** — 무기 6종·방어구 5종 전부 적용(장신구는 프리미티브). 던전 입장 시 저장 장비로 구성, `viewer.html?equip=1&fit=1` 장착 모드, 인벤토리 「3D 외형」 미리보기(교체 즉시 갱신). 검수: `docs/design/11-equipment-looks-review.md` |
| `tools/3d/rig_char.py` · `art/3d/{kain,ryu,sera}_anim.glb` | **플레이어블 4인.** 설정 시트 3면 → Hi3D 멀티뷰 → 6만 면 저폴리 → 메시 랜드마크 자동 리깅 + KayKit 리타게팅(무기 프로필: 낫·대검 캐리, 쌍단검, 시약). 캐릭터 설정 시트 「출격 캐릭터로」(`TW_SAVE.char`) → 로비·인벤토리·뷰어·던전이 따라간다. 캐릭터별 기술 4+궁극기(`dungeons.js SKILLS`), 고유 무기(`looks.js CHARW`: 대검·쌍단검·시약). 검수: `docs/design/12-characters-review.md` |
| `js/world-sim.js` | 월드 시뮬레이션: 맵 파싱, 원-격자 충돌(슬라이딩), 이동·구르기, 존 판정(깊이 0.55 비등방 거리), 보스 추적 AI, 카메라 |
| `arena.html` | 정면 대치 연습 모드(던전 이전 버전). 같은 엔진·리그를 쓴다 |
| `design-sheets/10-dummy.webp` | 허수아비 설정화(정면·측면·후면). `art/dummy-front/side/back.webp` 로 배경을 딴 뷰, `art/dummy/*.webp` 는 정면 뷰를 관절 단위로 자른 15개 파츠 |
| `js/dummy-rig.js` | 리그 정의: 파츠(위치·피벗·부모·z), 히트 영역(핵·가슴 사슬·몸통·견갑·머리), 발광, 애니메이션 클립(대기·예고 3종·타격 3종·경직·비틀거림·격추·기립·붕괴) |
| `js/rig.js` | SVG 컷아웃 스켈레탈 렌더러/애니메이터. 클립 레이어 블렌딩, 파츠 분리(부위 파괴), 발광, 피격 플래시 |

연출: 문을 지나면 카메라가 허수아비로 이동해 이름을 띄우고 돌아온다(시네마틱, 입력 잠김). 카운터·궁극기는 슬로모션. 일시정지 메뉴에서 밝기·동적 조명·진동·소리를 바꿀 수 있고(`localStorage['tw:settings']`), 프레임이 26 이하로 떨어지면 조명을 자동으로 끈다.
조작(던전): 왼쪽 가상 스틱 이동, 오른쪽 큰 버튼 공격(길게 방어), 회피 버튼(스틱 방향으로 구르기), 기술 1~4, 궁극기 R, 허수아비 부위 탭 = 조준. 키보드: WASD 이동, J/Space 공격, K 회피, L 방어, 1~4, R, Q 조준 전환.
위치 판정: 공격은 사거리 150 안에서만 닿고, 카운터는 230 안에서만 성립한다. 보스 예고는 바닥에 붉은 범위로 표시되며 범위 밖에 있으면 맞지 않는다(구르기로 탈출). 보스는 페이즈 2 부터 플레이어를 추적한다.
예고 중 창이 열리기 전에 공격하면 적의 타격이 끝날 때까지 경직된다(성급한 연타 방지).

흐름: 사무실 준비물 카드 → 3단계 → `result.html`(실제 결과가 `sessionStorage['tw:result']` 로 전달) → 최고 기록은 `localStorage['tw:arena:tutorial']`, 사무실 카드에 표시.

### 완성도 단계 (docs/design/03-action-rpg-benchmark.md 기준)

- **콤보**: 탭 4연타 + 길게 누르면 스매시(타수별 배율 1.6/2.0/2.6/3.4, 자세 12/18/28/45). 방어 전용 버튼(L), 방어 성공 직후 스매시 = 반격(1.5배, 자세 +25). 키보드 U = 스매시
- **잡몹**: 마당의 짚 인형 3체(`js/skirmish.js`). 접근·예고 휘두르기(바닥 범위), 피격 반응 경직/넉백/다운(타수별). 전부 처치해야 문이 열린다
- **진행**: `js/save.js` — 골드·경험치·레벨·가방을 `localStorage['tw:save']` 에 저장. 드랍은 바닥에 떨어져 가까이 가면 자동 습득(토스트). 사무실 골드와 인벤토리 수량에 합산
- **퀘스트**: 입장 시 마태오 대화(탭으로 진행) → 좌측 추적 HUD(짚 인형 정리 → 훈련장 입장 → 허수아비 격파)
- **사망**: 체력 0 이면 진짜 사망 → “쓰러졌다” → 문 앞에서 재도전(`sessionStorage['tw:retry']`), 얻은 것은 유지
- **HUD**: 보스 격추 게이지 바, N HIT 콤보 카운터, XP 바·골드, 전투 중 카메라는 플레이어·보스 중간점

## 3D 에셋 검증기 (`viewer.html`)

GLB 를 넣으면 높이·뼈·손 뼈·클립을 판정하고, 낫(`art/3d/ain_scythe_v02.glb`)을 손 뼈에 붙여 그립·회전을 맞춘 뒤 소켓 JSON 으로 저장한다. Three.js r170 은 `vendor/three/` 에 고정. 파이프라인 규약은 `docs/design/04-3d-pipeline.md`.

## 기획 문서

- `docs/design/04-3d-pipeline.md` — 3D 전환 파이프라인: 진단, 최소 경로(Hi3D → 뷰어 → Mixamo → GLB), 규약, 던전 계획.
- `docs/design/03-action-rpg-benchmark.md` — 검은사막·붉은사막·마영전·아이온 1 에서 뽑은 완성도 기준표와 적용 순서.
- `docs/design/02-engine-research.md` — 엔진·플러그인 조사와 추천안(Phaser 4 + Tiled + Spine/DragonBones), 마이그레이션 계획.
- `docs/design/01-training-arena.md` — 던전 01 훈련장(튜토리얼 허수아비 아레나) 기획 v0.1. 전투 공통 규칙(카운터·부위 파괴·출혈·자세·궁극기)과 수치 표의 원본.
