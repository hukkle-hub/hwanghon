# 바탕 메시 — 어디서 왔고 무슨 조건인가

이 폴더의 파일은 **우리가 만든 것이 아니다.** 출처와 조건을 여기 적어 둔다.

## mh_base.obj — MakeHuman hm08 기본 메시

- **CC0** (2020년 9월 공개). 저작권자: Data Collection AB · Joel Palmius · Jonas Hauquier
- 출처: `makehumancommunity/makehuman` → `makehuman/data/3dobjs/base.obj`
- 파일 머리말에 원문 그대로 남아 있다. **지우지 말 것** — 검사가 확인한다.
- 사람 해부에 맞는 사실적 비율. 얼굴·머리카락은 없다.

## vroid_female.vrm · vroid_male.vrm — VRoid Studio 기본 모델

- **CC0** — 파일 안 VRM 메타데이터가 스스로 그렇게 밝힌다:
  `licenseName: CC0`, `author: VRoidプロジェクト`,
  상업 이용 허용 · 크레딧 불필요 · 개작 허용
  (`hub.vroid.com/license?...corporate_commercial_use=allow&credit=unnecessary`)
- 받은 곳: opengameart.org/content/vroid-studio-cc0-models
- `.vrm` 은 glTF 확장이라 **그대로 glb 로 읽힌다.**
- 재질 이름 끝에 쓰임이 붙어 있어 옷만 골라 낼 수 있다:
  `_SKIN` `_FACE` `_EYE` `_HAIR` `_CLOTH`
- 뼈 이름이 믹사모와 1:1 로 맞는다 (`J_Bip_C_Hips` → `Hips` …)

두 바탕 모두 `tools/3d/build_body.py` 가 캐릭터 골격의 비율로 옮긴다.
