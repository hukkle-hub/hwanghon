# Material Preview Library — Vertical Slice 1.2

## 목적

텍스처가 완성되기 전에라도
**천 / 가죽 / 금속 / 콘크리트가 같은 조명에서 서로 다르게 읽히는지** 먼저 검수한다.

UE5.8 MaterialEditingLibrary로 자동 생성한다.

## 실행

UE Editor Python:

```python
exec(open(r"...\HwanghonCombatUE\Scripts\ue_create_material_library.py", encoding="utf-8").read())
```

생성:

`/Game/Materials/Hwanghon/`

- `M_HW_SurfacePreview`
- `MI_HW_Fabric_Dark`
- `MI_HW_Leather_Dark`
- `MI_HW_WeaponMetal`
- `MI_HW_PaintedMetal`
- `MI_HW_DryConcrete`
- `MI_HW_WetConcrete`
- `MI_HW_SkinPreview`

## Master parameters

- BaseColor
- Roughness
- Metallic
- Specular
- AO

## 초기 재질 차이

### Fabric
Roughness 0.78 / Metallic 0

### Leather
Roughness 0.50 / Metallic 0

### Weapon Metal
Roughness 0.28 / Metallic 0.96

### Painted Metal
Roughness 0.43 / Metallic 0.05

### Dry Concrete
Roughness 0.86

### Wet Concrete
Roughness 0.22

### Skin Preview
Roughness 0.56 / Metallic 0

**Skin Preview는 최종 피부 셰이더가 아니다.**
최종 Hero 단계에서는 모바일 SSS 근사/skin normal/roughness map을 별도 설계한다.

## 화면 검수

서한역 Lighting Rig 아래에서:

- 검은 천이 금속처럼 번들거리면 실패
- 가죽과 천의 highlight 폭이 같으면 실패
- 대검/낫 edge highlight가 안 읽히면 실패
- 젖은 바닥이 전체 거울처럼 되면 실패
- dry/wet concrete 차이가 roughness로 읽혀야 함

## 다음 확장

실제 텍스처가 들어오면 Master에:

- BaseColor texture
- Normal texture
- ORM/packed texture
- Detail normal
- Wetness mask
- Edge/wear mask

를 추가한다.

그 전에는 복잡한 shader graph를 만들지 않는다.
