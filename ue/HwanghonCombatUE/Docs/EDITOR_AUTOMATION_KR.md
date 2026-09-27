# UE Editor 자동 세팅

## 목적

C++ compile 뒤 반복 수작업을 줄인다.

`Scripts/ue_setup.py`는:

1. Content 폴더 생성
2. 기존 황혼 placeholder GLB import
3. `/Game/Maps/Seohan_Combat_VS01` 생성
4. `HWGrayboxArena` 배치
5. `HWBossCharacter` 배치
6. `PlayerStart` 배치
7. level 저장

## 실행

원본 황혼 저장소 위치를 환경변수로:

Windows PowerShell:

```powershell
$env:HWANGHON_REPO="D:\work\hwanghon"
```

UE Editor Python console:

```python
exec(open(r"D:\work\HwanghonCombatUE\Scripts\ue_setup.py", encoding="utf-8").read())
```

또는 Output Log의 `py` 명령으로 실행한다.

## import 대상

- `art/3d/ain_anim.glb`
- `art/3d/kain_anim.glb`
- `art/3d/ain_scythe_tex.glb`
- `art/3d/boss_anim.glb`

이 에셋은 **Vertical Slice placeholder**다.
최종 블소급 Hero asset으로 자동 채택하지 않는다.

## 다음 에디터 작업

- Ain SkeletalMesh를 Ain Character에 할당
- Ain AnimBP parent = `HWAinAnimInstance`
- Boss SkeletalMesh를 Boss Character에 할당
- Boss AnimBP parent = `HWBossAnimInstance`

그 뒤 Gray material 상태로 전투모션부터 검수한다.
