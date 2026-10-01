# 172 — Kimodo: 글로 만드는 스킬 동작 (2026-10-01)

디렉터가 «무료 블렌더 애니메이션 애드온» 영상을 보냈고(InspirationTuts), 그중 쓸 수 있는 것은 **Kimodo Blender Bridge** 하나였다. 디렉터의 설치 승인 지시: «여러가지 항상 조사해보고 적합한거를 넣어보자».

## 1. 무엇인가

- **Kimodo**는 NVIDIA의 텍스트 → 동작 확산 모델이다(github.com/nv-tlabs/kimodo).
  - 모션캡처 700시간으로 학습했고, 비디오게임 전투 동작도 학습 범위에 들어 있다.
  - 동작은 프롬프트 외에 루트 경로, 손·발 위치, 전신 키포즈로도 제약할 수 있다.
  - 출력은 30 fps, 한 프롬프트당 최대 10초다.
  - 라이선스: 코드는 Apache-2.0, 체크포인트는 NVIDIA Open Model License.
  - 텍스트 인코더는 LLM2Vec(Llama 3 계열 NF4, Aero-Ex 재배포본)이다. **출시 전에 라이선스를 다시 확인한다.**
- 블렌더 브리지(무료, GPL)는 설치 단계를 참고만 했다. 블렌더 GUI 없이 같은 단계를 스크립트로 돌린다.

## 2. 설치 (이 PC)

- 장비: RTX 3090 24 GB, Python 3.10, CUDA 12.1 PyTorch
- `C:/w/tools/install_kimodo.sh`
  1. 가상환경 `C:/w/tools/kimodo-venv`를 만든다.
  2. PyTorch를 설치한다.
  3. motion_correction 휠을 설치한다(Aero-Ex 빌드).
  4. Kimodo(Aero-Ex 오프라인 포크)와 kimodo-viser를 설치한다.
  5. LLM2Vec과 Kimodo-SOMA 가중치를 받는다.
- 설치 뒤 한 번, `llm2vec_wrapper.py`의 자리표시자 경로를 `kimodo-venv/llm2vec-model`로 바꿔야 한다.
- 생성은 기본 모델 v1.1이 자동으로 받아져 쓰인다. 텍스트 인코더 서버가 없으면 로컬로 자동 전환한다.

## 3. 파이프라인

```
art/anim/kimodo/prompts.json
  → tools/3d/kimodo_batch.py (venv python)    : kimodo.scripts.generate --bvh --bvh_standard_tpose, 3 seeds
  → tools/3d/kimodo_to_xbot.py (blender -b)  : SOMA77 → Mixamo X Bot FBX
  → (UE) Scripts/ue_mixamo_heroes.py 와 같은 길: X Bot 뼈대 → RTG_XBot_To_Countess
비교: tools/3d/xbot_clip_render.py — 같은 X Bot 몸에 Mixamo / Kimodo 를 한 줄씩
```

변환에서 밟은 함정:

1. **뼈 이름.** SOMA와 Mixamo가 한 칸씩 어긋난다(Spine1→Spine, Chest→Spine2, LeftLeg→LeftUpLeg, LeftShin→LeftLeg).
2. **회전 옮기기.** 두 뼈대의 롤이 달라서 «T자 대비 월드 회전»으로 옮긴다.
   - target = source × source_rest⁻¹ × target_rest
   - 기본 T자 BVH로 검사하면 그대로 T자가 나온다.
3. **방향.** 손 방향으로 맞추면 5° 틀어졌다(SOMA T자의 팔이 수평이 아니다) → 골반 좌우로 맞추고 90°로 스냅한다.
4. **길이.** 장면 길이 기본값 250프레임이 그대로 남아 모든 클립이 8.4초가 되었다 → 액션 범위로 정한다.
5. **메시 없이 내보내면 바인드 포즈가 없다.** 다시 읽으면 내보낸 프레임의 자세가 휴식 자세가 되어 팔이 꺾여 보였다 → 메시를 함께 내보낸다.

## 4. 1차 결과 (스킬 5개 × 3 시드)

비교 시트: `C:/w/tools/kimodo_out/kimodo_vs_mixamo.png`

| 스킬 | Mixamo | Kimodo | 판정 |
|---|---|---|---|
| 카인 «모루» | 콤보 4.2초 | 두 손을 머리 위로 들었다가 몸을 굽혀 내려찍는다(2.5초) | **채택 후보** |
| 아인 «베기» | 3.5초 | 넓게 디디며 휘두른다(1.8초) | 후보 |
| 류 «난무» | 4.7초 | 런지 베기(2.0초). «연속 베기»로는 약하다 | 후보 |
| 아인 «결의» | 거의 정지 | 한 팔만 든다(두 손 막기가 아님) | 보류, 프롬프트 재작성 |
| 세라 «시약» | 투척이 분명함 | 서서 손을 흔드는 정도 | 탈락, Mixamo 유지 |

- 고른 테이크: `art/anim/kimodo/hw_kmd_<id>.fbx`
- 한계: 맨손 동작이다. 무기 무게감과 손 모양은 프롬프트로 일부만 나온다.
- 무거운 전신 동작(내려찍기, 런지)에 강하고, 작은 손동작(투척)에 약하다.

## 5. 다음

- 디렉터가 고르면 UE에 넣는다.
  - `ue_mixamo_heroes.py`에 Kimodo 클립 목록을 더해 같은 리타깃을 거친다.
  - 그다음 skillfx QA로 확인한다.
- «결의»는 전신 포즈 제약(키프레임 두 개: 막기 → 밀치기)으로 다시 만든다.
- 보스(허수아비 외) 모션 단계에서는 Mixamo에 없는 동작의 1순위 공급원으로 쓴다.
