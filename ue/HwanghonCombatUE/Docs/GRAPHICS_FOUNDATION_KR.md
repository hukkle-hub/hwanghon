# Graphics Foundation — Vertical Slice 0.9

## 목표

블소급 그래픽의 핵심은 “효과를 크게”가 아니라:

1. silhouette
2. material separation
3. lighting hierarchy
4. contact readability
5. stable mobile frame pacing

이다.

0.9는 이를 런타임 구조로 고정한다.

---

# 1. 품질 티어

`HWGraphicsQualitySubsystem`

PIE:
- F6 Low
- F7 Mid
- F8 High

## High
- Resolution 100%
- Shadow 3
- Post 3
- Texture 3
- VFX 3
- Shading 3
- Reflection 2
- AA 3
- AO on
- contact hero light 100%

## Mid
- Resolution 90%
- Shadow 2
- Post 2
- Texture 2
- VFX 2
- Shading 2
- Reflection 1
- AA 2
- AO off
- contact hero light 55%

## Low
- Resolution 75%
- Shadow 1
- Post 0
- Texture 1
- VFX 1
- Shading 1
- Reflection 0
- AA 1
- Bloom off
- contact hero light off

`r.Mobile.ShadingPath`는 런타임 전환하지 않는다.
Device Profile / startup에서 선택.

---

# 2. 서한역 Lighting Rig

`HWSeohanLightingRig`

## Fill
cool neutral skylight.

역할:
- black crush 방지
- 피부/천/금속의 base readability 유지

## Warm Key
얼굴/몸통/젖은 바닥을 읽히게 하는 주광.

## Cool Rim
어두운 벽에서 player/boss silhouette 분리.

## Red Accent
분위기용 보조색.
씬 전체 ambient를 빨갛게 만들지 않는다.

## Contact Light
딱 한 개의 짧은 hero light.

계층:
light < finisher < smash < counter

Low에서는 완전히 꺼진다.

---

# 3. 머티리얼 언어

동일한 조명에서 다음이 확실히 달라야 한다.

## Skin
- metallic 0
- medium-high roughness
- micro normal
- face roughness variation

## Fabric
- metallic 0
- high roughness
- weave normal
- edge/crease response

## Leather
- metallic 0
- medium roughness
- broad specular

## Painted Metal
- metallic under chipped regions
- paint layer lower metallic
- controlled roughness variation

## Weapon Metal
- clear edge highlight
- body보다 낮은 roughness
- damage/wear를 normal/roughness로

## Wet Concrete
- base concrete high roughness
- wet mask lowers roughness
- puddle는 reflection이 읽히되 mirror처럼 만들지 않음

---

# 4. 화면 금지

- black + red 두 색으로 화면을 덮기
- 모든 표면 같은 roughness
- 모든 공격 contact point light
- full-screen bloom
- 보스 전체 red flash
- shadow 때문에 얼굴이 완전히 사라짐

---

# 5. 그래픽 검수

VFX OFF:
- 아인 얼굴/몸/낫 분리
- 보스 실루엣 분리
- wet floor / concrete / metal 구분
- 흑색 의상 내부 디테일 유지

High/Mid/Low 모두 같은 gameplay readability를 유지해야 한다.
차이는 장식 품질이어야지 공격 판독성이면 안 된다.
