# 123. 황혼 Clean Mobile UI v1 — 10465.mp4 레퍼런스 분석

## 0. 결론

영상 UI의 강점은 **화면을 패널로 채우지 않는 것**이다.

황혼 UE UI도 다음 원칙으로 통일한다.

> **배경/캐릭터 1순위 → UI는 화면 가장자리 → 선택된 것만 금색 → 큰 팝업은 한 장 → 정보량보다 여백**

원본 게임 UI를 복제하지 않는다.  
레이아웃 문법과 밀도만 참고하고 황혼 고유의 청흑/금속/적색 언어로 재설계한다.

---

# 1. 영상에서 확인한 공통 패턴

영상: 2340×1080 / 약 109초.

## 메인 로비

- 캐릭터와 배경이 화면 대부분을 차지한다.
- 좌측에 이벤트/콘텐츠 카드가 세로로 짧게 배치된다.
- 상단은 프로필 + 재화만 작은 크기로 존재.
- 우측은 소셜/퀵 메뉴 아이콘만 좁은 레일에 둔다.
- 하단은 긴 한 줄 내비게이션.
- 가장 강한 CTA만 우하단에 크게 배치.

황혼 적용:
- 메인에 아인/카인 등 Hero 캐릭터 전신.
- Office/Quest/Inventory 같은 정보는 중앙을 막지 않는다.
- `출격`만 우하단 Primary CTA.

## 상점/인벤토리형 화면

- 전체 배경은 그대로 남고 어둡게 눌린다.
- 좌측 좁은 카테고리 레일.
- 왼쪽/중앙에 상품 grid.
- 오른쪽에 선택 아이템 세부/보상.
- 하단 카테고리 탭.
- 카드 자체는 장식이 적고 선택 카드에만 금색 border.

황혼 적용:
- Inventory/Forge/Shop 모두 같은 Screen Skeleton 사용.
- 아이템 카드 배경은 PanelSoft.
- 선택만 Gold 1px/3px bar.
- rarity 색으로 카드 전체를 칠하지 않는다. 작은 tag/icon만 사용.

## 친구/파티

- 화면 전체 전환이 아니라 오른쪽 Drawer.
- 원래 로비 캐릭터가 뒤에서 계속 보인다.
- Drawer는 진한 청흑색.
- 친구 한 줄의 높이는 충분하지만 장식은 적다.

황혼 적용:
- Recruit/Party/Friends는 오른쪽 Drawer 35%.
- Lobby를 유지한 채 열림.
- 모바일 Back으로 즉시 닫힘.

## 큰 기록/게시물 Popup

- 뒤 화면 60% 정도 dim.
- 중앙 70% 폭의 큰 한 장짜리 패널.
- 좌측 탭, 우측 본문.
- 불필요한 작은 카드 중첩 없음.
- 구분은 얇은 선과 배경 명도 차이로만.

황혼 적용:
- Result 상세, Story archive, Codex, Settings는 이 Modal Skeleton.

---

# 2. 황혼 컬러 시스템

### BackgroundDeep
`#070D14`

### Panel
`#0D1724` / alpha 약 87%

### PanelStrong
`#0A121D` / alpha 약 95%

### PanelSoft
`#182333` / alpha 약 72%

### OverlayDim
`#02060A` / alpha 약 60%

### TextPrimary
`#F2EFE7`

### TextSecondary
`#A8B0BC`

### TextMuted
`#727D8C`

### Divider
`#7C8796` / alpha 약 30%

### Gold — 선택/주요 동작
`#D0AE5A`

### Cyan — 정보/스킬
`#62B7CF`

### Danger — 위험/피격/경고만
`#B74643`

**빨강을 일반 메뉴 선택색으로 사용하지 않는다.**
황혼 특유의 붉은색은 전투 위험/상태/결정적 순간에만 남겨 더 강하게 만든다.

---

# 3. 2340×1080 기준 레이아웃 토큰

- Safe horizontal: 92
- Safe top: 24
- Safe bottom: 22
- Top bar: 72
- Bottom nav: 88
- Left content rail: 340
- Slim icon rail: 76
- Right drawer: 820
- Large modal: 1680 × 720
- Primary CTA: 150
- Panel padding: 24
- Card gap: 12
- Section gap: 22
- Border: 1
- Active selection bar: 3

DPI에 맞춰 비례 축소한다.

---

# 4. Typography

1080p 기준:

- Hero number/title: 34
- Page title: 28
- Section title: 19
- Body: 15
- Caption: 12
- Micro: 10
- Large number: 24

원칙:
- 굵은 폰트는 PageTitle/중요 숫자만.
- 메뉴 항목 전체 Bold 금지.
- 영문/숫자는 가능한 한 짧게.
- 설명문은 최대 2~3줄.

---

# 5. 컴포넌트

## Edge Top Bar
좌:
- Back
- 화면명 / 프로필

우:
- 골드
- 특수재화
- 알림/연결상태

높이 72.

## Bottom Navigation
- 6~8개까지만.
- 아이콘 30.
- 비선택: TextMuted.
- 선택: Gold.
- 선택된 탭 아래 3px Gold line.
- 배경은 투명에 가깝게.

## Left Feature Cards
Lobby에서만.
폭 약 300~340.
2~4장.
카드 사이 여백을 충분히.

## Right Slim Rail
소셜/메일/설정.
폭 76.
원형 아이콘 남발 금지.
중립색 + notification dot만 색.

## Drawer
폭 820.
오른쪽에서 등장.
PanelStrong.
내부 row는 90~120 높이.
닫기 X는 우상단.

## Modal
1680×720.
화면 dim 60%.
PanelStrong 한 장.
좌측 서브탭 260~300.
콘텐츠는 스크롤.

## Primary CTA
Lobby의 출격 등 한 화면 하나만.
150.
원형/둥근 사각형 어느 쪽도 가능하지만 황혼은:
- 어두운 내부
- 얇은 Gold/RedTension ring
- 과한 glow 금지.

---

# 6. 화면별 적용

## Lobby
- Hero character center/right.
- left feature cards.
- bottom nav.
- right slim rail.
- `출격` CTA bottom-right.
- 중앙 카드 UI 금지.

## Quest / Office
- left 32~35% quest list.
- selected quest info right.
- 배경의 지역 art 유지.
- 위험도/추천CP는 작고 선명.

## Character
- 전신 캐릭터 화면 55~65%.
- 장비/스탯은 좌우 edge.
- 캐릭터 전환은 bottom carousel.

## Inventory
- left category slim rail.
- item grid 2~4 columns depending viewport.
- selected detail right 30%.
- compare는 필요할 때만 overlay.

## Skills
- 스킬 트리/목록 55%.
- 캐릭터 Hero는 배경/우측.
- 포인트는 top-right.
- 선택된 스킬만 Gold.

## Forge
- 장비 리스트 left.
- 중앙 장비 3D/큰 icon.
- 오른쪽 재료/확률.
- 강화 버튼 하나만 강한 CTA.

## Shop
영상 상점과 같은 구조를 가장 직접적으로 참고.
- left category rail.
- grid.
- right purchase summary.
- bottom subcategory nav.

## Recruit / Party
Right Drawer 우선.
상세 파티 구성은 필요 시 Modal.

## Result
큰 centered Modal.
- Rank 큰 숫자/문자 한 번.
- rewards list.
- 반복 버튼 / 로비 버튼 2개 이하.

## Story
영상 친구 게시물 Modal처럼:
- background dim
- left chapter list
- right dialogue/record

## Combat HUD
- Top center: Boss HP + pattern/tell.
- Left edge: party only.
- bottom-left: joystick.
- bottom-right: skills/actions.
- 중앙은 비워둔다.
- damage numbers 크기 축소.
- COUNTER 성공 순간만 중앙 피드백 허용.

---

# 7. 애니메이션

UI transition:
- tab: 80~120ms
- drawer: 180~220ms
- modal: 140~180ms
- button press: 60~90ms

과한 overshoot/bounce 금지.

모바일에서는 Blur보다:
- alpha
- small translate
- opacity
를 우선한다.

---

# 8. 금지

- 모든 패널에 금색 border.
- rarity 색으로 카드 전체 칠하기.
- 12px 이상 큰 corner radius 남발.
- 중앙에 작은 카드 6~10개 쌓기.
- 한 화면에 CTA 3개 이상.
- 모든 버튼 glow.
- 빨간색을 메뉴 accent로 남발.
- BackgroundBlur 중첩.
- 4종 이상의 accent color를 한 화면에서 동시에 사용.

---

# 9. 구현 계약

C++/UMG에서 직접 색값/여백 숫자를 복사하지 않는다.

사용:
`UHWUIThemeLibrary`

JSON:
`Content/Data/ui_theme.json`

최종 UMG가 들어와도 Native fallback UI와 같은 token을 쓴다.
