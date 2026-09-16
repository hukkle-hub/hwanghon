# 3D 캐릭터 파이프라인 (아인)

로컬에서 `pip install bpy==4.2.0 numpy trimesh pillow` 후 실행. Mixamo·Higgsfield 없이 전부 스크립트로 재현된다.

| 스크립트 | 입력 | 출력 |
|---|---|---|
| `glbxform.cjs` | Hi3D 원본 GLB | `art/3d/ain_hi3d_v1.glb` (Y-up, 1.68 m, 발 원점, 노멀맵 보존) |
| `bake_vcol.py` | Hi3D 원본 + 4방향 원화 PNG | `art/3d/ain_hi3d_vcol_v1.glb` (임시 정점색) |
| `retarget_ain.py` | 정점색 GLB + KayKit `Rogue.glb`(CC0) | `art/3d/ain_anim.glb` — Mixamo 이름 뼈 23개 + 클립 21개 |

```
KAYKIT_DIR=/path/to/kaykit python3 tools/3d/retarget_ain.py art/3d/ain_anim.glb
```

## retarget_ain.py 가 하는 일
1. 메시 랜드마크에 맞춘 `mixamorig:*` 뼈대 생성, 캡슐 거리 기반 스킨 가중치
2. KayKit 클립을 월드 회전 기준으로 리타게팅 (T 포즈 참조, 골반 이동은 다리 길이 비율로 스케일)
3. **무기 주도 자세**: idle/walk/run/guard 는 오른손 위치·자루 방향·날 방향을 캐릭터 기준으로 지정하고 두 팔을 해석적 2-본 IK 로 푼다. 공격 클립은 왼손을 자루 위 지점에 IK 로 붙이고, 시작·끝 22 % 구간을 idle 자세와 섞는다.
4. `mixamorig:RightHandSlot` 뼈(손바닥, +Y = 자루 방향) 를 내보낸다. 낫 GLB 는 런타임에 이 뼈 아래 `position.y = -그립(0.95 m)` 로 붙인다 (`viewer.html` 의 attach 와 동일 규약).

## 클립 이름 (게임 규약)
idle, idle2, walk, run, roll, dodgeB/L/R, attack1(베기), attack2(내려찍기), attack3(찌르기), smash(회전), ult(연속 회전), hit, hit2, death, guard, guardHit, guardUp, cheer, pickup

## 출처
- 메시: Hi3D 생성 (디렉터 계정). 컬러 텍스처는 아직 없음 → Hi3D PBR 텍스처 생성 후 교체 예정.
- 애니메이션: KayKit Character Pack Adventurers (CC0 1.0). 
