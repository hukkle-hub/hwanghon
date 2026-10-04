# 179 — 머리 마무리 조사 + 장비(의상) 방식 조사 (2026-10-03)

디렉터: «조사한번 더 해보고 장비로 넘어가자»

## 1. 머리 — 지금 방식이 업계 방식과 같은가

- **같은 길이다.** 블렌더 곡선(Curves·지오메트리 노드)으로 가닥을 만들고, 알렘빅으로 내보내고, 언리얼 그룸으로 쓴다. 메타휴먼 그룸 표준 작업 흐름이다.
  - Fab의 «Blender MetaHuman Groom Starter + Hair Cards», 메타휴먼 그룸 가이드(UE 5.6–5.7).
  - 필요한 플러그인은 Alembic Hair Importer와 Hair Card Generator다. Alembic Hair Importer는 이번에 켰다(문서 177 §23).
- **휴대폰은 «헤어 카드 생성기»가 답이다.**
  - UE 5.6부터 실험 기능으로 들어 있다. 5.8 엔진에도 `Plugins/Experimental/HairCardGenerator`가 있다.
  - 그룸(가닥)을 버튼 한 번에 카드 메시와 텍스처로 구워 준다. 가까이는 가닥, 멀리와 휴대폰은 카드(LOD)로 쓴다.
  - 우리가 직접 만든 카드(§22, 깨짐)는 버리고, 이 생성기로 지금 그룸에서 굽는다. → 휴대폰 단계에서 한다.
- **아인 결(굵고 윤기 나는 다발)**
  - 그룸 재질의 `HairRoughness`, `Spec0/1`, `Scraggle` 값과 다발 굵기(`GROOM_CLUMP`, 가이드 수)로 조절한다.
  - 장비를 입힌 뒤 전체 모습에서 한 번에 맞춘다. 갑옷 칼라가 머리 아래쪽을 가리기 때문이다.

## 2. 장비 — 메타휴먼에 옷을 입히는 길

| 길 | 내용 | 우리에게 |
|---|---|---|
| A. 스켈레탈 메시 의상 | 옷 메시를 메타휴먼 몸에 맞추고, 몸의 뼈 가중치를 옮겨 같은 뼈대로 움직인다 | **채택.** 영웅 몸이 고정 크기라 크기 조절이 필요 없다. 휴대폰에서 가장 싸다 |
| B. Chaos Outfit(파라메트릭) | 몸 치수에 따라 크기를 고르는 메타휴먼 공식 의상. 천 시뮬레이션 포함 | 크기 조절은 편집기에서만 된다. 시뮬레이션은 휴대폰에 무겁다 → 망토·코트 자락만 나중에 검토 |
| C. Marvelous Designer / CLO → USD → 메타휴먼 | 2025.2부터 메타휴먼 몸을 바로 불러 옷본을 짠다 | 유료 프로그램과 사람 손이 필요하다. 지금은 보류 |

## 3. A의 시험 순서 — 새로 생성하기 전에 있는 것부터

메모리 «생성 반복 금지, 시험 먼저»에 따라 순서를 정했다.

1. **이미 있는 Hi3D 결과물로 시험**: `art/3d/heroes/sera.glb`(코트 입은 전신), `art/3d/gear/a_ward_coat_sera.glb`(코트).
2. 블렌더에서 다음 순서로 처리한다.
   1. 옷 부분만 떼어낸다.
   2. 메타휴먼 세라 몸(`state_Sera_body.fbx`)에 맞춰 크기와 자세를 맞춘다.
   3. 몸을 뚫고 들어간 곳을 밀어낸다.
   4. 몸의 뼈 가중치를 가장 가까운 점에서 옮긴다.
3. 언리얼에서 같은 뼈대의 스켈레탈 메시로 붙인다. 정면·옆·뒤 사진을 찍고, 팔을 들어 접힘도 확인한다.
4. 맞으면 같은 방법으로 아인 디자인 시트 갑옷, 그다음 의상 시안 11장 순서로 간다.

## 출처

- [Blender MetaHuman Groom Starter + Hair Cards (Fab)](https://www.fab.com/listings/6a061f58-8dfc-4bce-b298-4cf5f943d8a4)
- [MetaHuman Groom Guide UE 5.6–5.7](https://viirtuals.com/guide/metahumanGroomGuide-Viirtuals.pdf)
- [Hair Card Generator for Grooms (Epic 문서)](https://dev.epicgames.com/documentation/unreal-engine/hair-card-generator-for-grooms-in-unreal-engine?lang=en-US)
- [Hair Card Generator in Dataflow (Epic 문서)](https://dev.epicgames.com/documentation/metahuman/hair-card-generator-in-dataflow-in-unreal-engine?lang=en-US)
- [Tailoring Your Own Wardrobe Items (Epic 문서)](https://dev.epicgames.com/documentation/metahuman/tailoring-your-own-wardrobe-items?lang=en-US)
- [Chaos Cloth Outfit Asset Resizing Addendum (Epic 포럼)](https://forums.unrealengine.com/t/tutorial-chaos-cloth-outfit-asset-resizing-addendum/2647376)
- [Marvelous Designer → MetaHuman USD 의상 연동](https://support.marvelousdesigner.com/hc/en-us/articles/52699135975705-Marvelous-Designer-to-MetaHuman-USD-Garment-Integration-Workflow)
- [MetaHuman 5.6/5.7 Pipeline Reference](https://medium.com/@Jamesroha/metahuman-5-6-5-7-pipeline-reference-170d302b078e)
