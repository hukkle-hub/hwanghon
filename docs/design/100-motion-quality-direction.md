# 100 — 모션 품질: 블소 모바일 급으로 가려면 (조사 · 방향 정하기, 2026-09-26)

디렉터: 「이게 품질이 너무 떨어지는데 차라리 블레이드앤소울 모바일버전으로도 힘들까?」 → 「조사좀 해보고 다시 방향을 정하자」

## 1. 블소2 는 어떻게 만드나

- 블소2 는 NC 가 **3 년** 들여 **언리얼 엔진 4** 로 만든 모바일 MMORPG ([MMORPG.com](https://www.mmorpg.com/blade-and-soul-2)).
- NC 는 **카메라 100 대 · 150㎡ 자체 모캡 스튜디오**(Vicon)를 쓰고, «움직이는 애니메이션 데이터 대부분은 모캡으로 만든다» — 광학·관성·얼굴·손가락 모캡,
  언리얼 버추얼 프로덕션까지 ([NC 모캡 스튜디오 소개](https://about.ncsoft.com/play/viewer/mcs), [NCONTENT vol.17](https://www.kocca.kr/n_content/vol17_pop/s13.html)).
  매일 쏟아지는 모캡의 후처리를 자동화하는 연구까지 한다 ([NC Research](https://ncsoft.github.io/ncresearch/319fb78179318b68c095e724c5d3e2b41efcaa8a)).
- 즉 품질의 원천은 **① 사람이 실제로 휘두른 모캡 + 애니메이터 손질 ② 그걸 받는 뼈대·몸(비틀림 뼈·손가락·옷 뼈) ③ 엔진의 애니메이션 시스템(레이어·블렌드·관성 전환)**.
  세 개 다 우리와 규모가 다르다. 얼굴·전체 그래픽까지 같은 급은 전문 인력 영역이다(81 번과 같은 결론).

## 2. 우리 카인의 현재 (저장소에서 확인)

| | 지금 | 블소 급 |
|---|---|---|
| 뼈 | **24 개**(손가락·비틀림 뼈 없음) | 60~100+ (손가락·비틀림·옷·머리칼 뼈) |
| 몸 | AI 이미지→3D 한 덩어리(몸·망토·옷 붙음) | 부위별·관절용 토폴로지 |
| 공격 클립 | 1·2타·스매시·처형·궁극기 = **손 경로만 주고 팔을 IK 로 굽힘**(rig_core) → 97~99 의 꺾임·팔 돌기의 뿌리 | 모캡 + 손질 |
| 시스템 | 동작 하나씩 교차 페이드(3 곳), 상·하체 분리 없음, 관성 전환 없음, 옷 흔들림은 절차적 일부 | 상·하체 레이어, 블렌드 스페이스, 관성 전환, 옷·머리 물리 |

잘 된 쪽: 이미 모캡/전문 클립으로 바꾼 3타·반격·스킬1·스킬3 은 측정에서 전문가 기준(칼끝 가속 ≤ 35, 팔 돌기 ≤ 16°/프레임) 안.
→ **«클립을 진짜로 바꾸면 좋아진다» 는 우리 게임에서 이미 확인됨.**

## 3. 쓸 수 있는 것 (라이선스 확인)

### 3-1. 대검(두 손) 모션 소스

| 소스 | 값 | 라이선스 | 비고 |
|---|---|---|---|
| **Mixamo «Great Sword Pack»** | 무료(Adobe 계정) | 게임 안에서 상업 사용 무료, 원본 파일 재판매·재배포만 금지 ([LicenseOrg 정리](https://www.licenseorg.com/guide/3d-assets/mixamo), [Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)) | 대검 베기·회전 공격 등이 든 묶음으로 알려져 있다 — **정확한 구성은 받아서 확인**. 로그인이 필요해 디렉터가 받아 줘야 한다(나는 계정 로그인 불가) |
| Fab 대검 팩 (예: Greatsword Combo Animation Pack, Two-Handed Sword 391 개, Double Handed Sword 70 개 모캡) | $30~140 대 | Fab Standard License = **어느 엔진에서나 상업 사용** ([Fab EULA](https://www.fab.com/eula?lang=en), [three.js 리소스](https://threejsresources.com/tool/fab)) | 3~5 연타 콤보·대시·회전. UE 마네킹 뼈대 → 리타깃 필요. 구매는 디렉터 |
| itch «Two Handed Sword Animations V2» | $12.99~ | 페이지에 라이선스 명시 없음 → 사기 전 확인 | UE/FBX/Mixamo 호환 ([itch](https://gamedev-hero.itch.io/two-handed-sword-animations-v2/purchase)) |
| MoCap Online 무료 T.C. Sword | 무료 | 100만 사용자·$1M 매출까지 상업 가능, AI 사용 시 별도 허가 ([MoCap Online](https://mocaponline.com/products/tc-sword)) | 한손검 위주 |
| Quaternius UAL 1·2 (받아 둠) | 무료 CC0 | 제한 없음 | 검 콤보는 **한손검**(UAL2 Sword_Regular A·B·C) — 대검엔 부적합. 류(쌍단검)·이동·피격엔 쓸 만함 |
| KayKit 2H (받아 둠) | 무료 CC0 | 제한 없음 | 지금 굽기의 원재료. 동작이 짧고 단순 |

### 3-2. 직접 찍기 (카인만의 모션)

폰으로 찍은 영상 → AI 모캡: **Rokoko Vision 무료**, DeepMotion 월 $9~, Move.ai 월 $99~ ([Uthana 비교](https://uthana.com/resources/best-ai-motion-capture-tools), [Rokoko](https://www.rokoko.com/insights/the-future-of-motion-capture)).
정확도는 관성 슈트보다 낮다(~92% vs 98%+, 같은 글). 무기 궤적은 손질 필요. 86 번(MediaPipe) 보다 낫다.

### 3-3. AI 생성·보조

- **Tencent HY-Motion 1.0**(글 → 모션, 오픈소스): 라이선스가 **EU·영국·한국을 제외** → **못 쓴다** ([License.txt](https://github.com/Tencent-Hunyuan/HY-Motion-1.0/blob/master/License.txt)).
- Cascadeur(물리 보정·AI 중간 프레임, 인디 연 $96·매출 $10 만 이하): 데스크톱 GUI 라 디렉터가 직접 써야 한다 ([CG Channel](https://www.cgchannel.com/2025/04/nekki-releases-cascadeur-2025-1-with-ai-based-inbetweening/), [라이선스 FAQ](https://cascadeur.com/blog/general/cascadeurs-new-licensing-structure-comprehensive-faq)).
- 반다이남코 모션 데이터셋은 비상업(85 번) — 못 쓴다.

### 3-4. 시스템(코드로 내가 할 수 있는 것)

- **관성 전환(inertialization) / dead blending** — 기어스 오브 워 이후 업계 표준. 두 동작을 섞지 않고 «지금 자세·속도» 에서 새 동작으로 오프셋을 줄여 간다.
  교차 페이드의 «손 흔들며 넘어가기»·관절 휘돌기(=99 번 증상)를 구조적으로 없앤다 ([GDC 2018 Bollo](https://media.gdcvault.com/gdc2018/presentations/bollo_david_inertialization_high_performance.pdf), [Dead Blending](https://theorangeduck.com/page/dead-blending)). three.js 에 내장은 없어 직접 짜야 한다(비용 작음).
- **상·하체 레이어** — 달리며 베기(블소식 이동 공격). three.js 믹서는 트랙을 골라 레이어를 만들 수 있다.
- **망토·머리칼 흔들림 뼈** — `@pixiv/three-vrm-springbone`(MIT) 또는 자체 스프링. 단 **망토가 몸과 붙은 한 덩어리라 먼저 떼야** 한다([npm](https://www.npmjs.com/package/@pixiv/three-vrm-springbone)).
- 엔진을 언리얼/유니티로 옮기는 것은 게임 전체 재작성 — 지금 단계에선 권하지 않는다.

## 4. 선택지

| | 할 일 | 기대 효과 | 드는 것 | 기간(「근거 없음」 추정) |
|---|---|---|---|---|
| **A. 클립 교체 + 전환 시스템** | 1·2타·스매시·처형·궁극기를 대검 모캡(Mixamo 대검 팩 또는 Fab 팩)으로, 관성 전환 도입, 97~99 의 땜질 걷어내기 | 공격 모션 부드러움 가장 크게 개선. 팔 꺾임·돌기의 뿌리 제거 | 디렉터: Mixamo 로그인 후 대검 팩 받아 올리기(또는 Fab 구매) | 며칠 |
| **B. A + 몸 다시 만들기** | MPFB2 몸(뼈 52, 손가락) + 비틀림 뼈 + 망토 분리·흔들림 | 어깨·망토 찢어짐, «쥔 손», 옷 흔들림 해결 | 얼굴이 시트와 멀어짐(81 번) — 얼굴 작업 따로 | 몇 주 |
| **C. 직접 찍기** | 디렉터가 폰으로 대검 동작 촬영 → Rokoko Vision → 리타깃·손질 | 카인만의 동작(스킬·궁극기) | 촬영(나무 막대 등), 무료 도구 | 동작당 반나절~ |
| D. 엔진 교체 | 언리얼/유니티 | 장기적 상한↑ | 전체 재작성 | 수개월 |

**권하는 순서: A → (결과 보고) B → 필요한 스킬만 C.** D 는 보류.
A 는 이미 확인된 사실(전문 클립은 우리 게임에서도 전문가 수치가 나온다)에 기대고, 돈이 안 들고(Mixamo), 97~99 의 문제를 뿌리에서 없앤다.

## 5. A 를 고르면 바로 할 것

1. (디렉터) [mixamo.com](https://www.mixamo.com) 로그인 → «Great Sword» 검색 → 팩 전체를 FBX(Without Skin 가능)로 받아 공유.
   — 받는 동안 나는 **관성 전환**(교차 페이드 대체)을 먼저 만든다. 클립과 무관하게 모든 동작 전환이 좋아진다.
2. 받은 클립을 카인에 리타깃 → 1·2타·스매시·처형·궁극기 후보를 옆에 놓고 비교 그림 + 수치(칼끝 가속·팔 돌기) → 디렉터가 고른다.
3. 고른 클립으로 교체하고 97~99 의 클립 수리·팔 묶기가 필요 없어지면 걷어 낸다.
