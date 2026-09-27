# Hero Asset QA — Vertical Slice 1.0

## 목적

기존 GLB를 “있으니까 사용”하지 않는다.

UE import 직후 자동 보고서로:
- 지금 placeholder로 쓸 수 있는가
- Hero asset으로는 무엇이 부족한가
- 새로 만들어야 하는가

를 결정한다.

## 실행

UE Editor command:

`Scripts/ue_asset_audit.py`

출력:
- `Saved/AssetAudit/asset_audit.csv`
- `Saved/AssetAudit/asset_audit.json`

요약:

```bash
python Scripts/summarize_asset_audit.py Saved/AssetAudit/asset_audit.json
```

## 자동 검사

### Skeletal Mesh
- LOD 수
- material slot 수
- skeleton 존재 여부

### Texture
- 해상도

### Animation
- duration

UE에서 추가 API가 확보되는 즉시:
- triangle count
- bone count
- skin influences
- morph targets
- texture memory
- animation compression

을 확장한다.

## provisional Hero gates

이 수치는 Vertical Slice 초기 예산이며 Android 실기기 프로파일링 후 확정한다.

### Player Hero
- LOD ≥ 3
- material slots ≤ 8, 권장 ≤ 6
- 기본 texture ≤ 2K
- 4K는 High tier에서만 예외 승인
- LOD0 triangles 70k~120k 초기 목표
- bones ≤120 권장

### Boss Hero
- LOD ≥3
- material slots ≤10
- 기본 texture ≤2K
- LOD0 100k~180k 초기 목표

### Weapon
- LOD ≥3
- material slots ≤4
- 기본 texture ≤2K

## 중요한 판정

이 검사에서 PASS라고 “블소급”이 되는 것은 아니다.

자동 검사는 최소 기술 조건만 본다.

최종 Hero Gate에는 반드시:
- 얼굴 품질
- deformation
- silhouette
- roughness separation
- hair
- hands
- cloth/armor construction
- animation close-up

육안 검수가 추가된다.
