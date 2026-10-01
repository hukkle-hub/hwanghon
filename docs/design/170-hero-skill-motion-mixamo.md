# 170 — 4인 스킬 동작: Mixamo → Countess (2026-10-01)

디렉터: «일단 4명의 캐릭터 먼저 진행해». 문서 169의 결정 세 가지는 보류하고, 결정과 무관한 영웅별 스킬 동작부터 넣었다.

## 1. 클립 (`art/anim/mixamo_heroes/clips.json`)

| 영웅 | 1 | 2 | 3 | 4 | 궁극 |
|---|---|---|---|---|---|
| 아인(낫) | Great Sword Slash | Standing Dodge Backward | Great Sword High Spin Attack | Great Sword Blocking | Great Sword Jump Attack |
| 카인(대검) | Great Sword Attack | Standing Block | Standing Melee Attack 360 High | Standing Melee Attack Downward | Standing Melee Combo Attack Ver. 2 |
| 류(쌍단검) | Standing Melee Combo Attack Ver. 1 | Aerial Evade | Standing Melee Attack 360 Low | Standing 1H Magic Attack 01 | Stabbing |
| 세라(투척) | Throw | Standing Dodge Right | Toss Grenade | Magic Heal | Standing 2H Magic Area Attack 01 |

- 세라 1·3번은 뼈대 시트를 보고 바꿨다.
  - 처음 고른 Throw Object는 바닥에서 물건을 주웠다.
  - Throw Grenade는 엎드려서 던졌다.
  - 후보 4개(Throw / Throwing / Toss Grenade / Grenade Throw)를 같은 파이프라인으로 리타깃해서 비교했다.
- 받는 법
  - 크롬 탭 하나는 스크립트 다운로드를 한 번만 허용한다. 그래서 페이지에 버튼을 띄운다.
  - 클릭(사용자 제스처)할 때마다 빈 창을 열고, 내보내기가 끝나면 그 창을 S3 주소로 보낸다(한 번 클릭에 한 파일).
  - 내보낼 때 `product_name`이 파일 이름이 되므로 `hw_<영웅>_<칸>`으로 받았다.

## 2. 리타깃 (`Scripts/ue_mixamo_heroes.py`)

X Bot(문서 168 파이프라인) → Countess 뼈대(`IK_Countess_Auto`) → `/Game/Animation/Heroes/Mixamo/MX_<영웅>_<칸>`

이번에 새로 밟은 함정:

1. **root가 떴다.**
   - X Bot에는 root 뼈가 없다(Hips가 맨 위다). 그래서 «Root Motion» 연산이 골반 높이를 Countess의 root에 복사했다(root 98 cm).
   - 게임에서 몸이 공중에 떴다 → 이 연산을 끈다.
   - Paragon 원본 클립은 root 0, 골반 115 cm다. 지금 리타깃 결과는 root 0, 골반 109 cm다.
2. **골반이 몸을 끌고 나갔다.**
   - 골반 수평 이동이 1–2 m라 아인 뒤 회피와 도약 공격이 화면 밖으로 나갔다가 끝나면 제자리로 튀었다.
   - 골반 연산의 `scale_horizontal = 0`으로 제자리 동작으로 만든다.
   - 실제 이동은 회피 시스템이 캡슐로 한다. 공격은 움직이지 않는다.
3. 타격 접점은 클립마다 잰다(손이 골반 앞으로 가장 멀리 나간 순간). 회피·버프는 0.42 그대로다.
   - 세라 3번은 시작 자세에서 손이 앞에 있어서 0.1로 잘못 잡혔다 → 0.5로 고정했다(`CONTACT_OVERRIDE`).
   - 이 접점으로 재생 속도를 맞춘다: 접점 프레임이 첫 타격 시각에 오도록(문서 169 §2.5).

## 3. 세트와 연결

- `DA_Hero_<id>`는 `DA_Ain_Graybox`를 복제하고 Skill1–4·Ultimate만 바꾼다. 슬롯 이름(UpperBody)은 그대로 둔다.
- `DefaultGame.ini`에서 ain/kain/ryu/sera가 각자의 세트를 입는다.
- `/Game/Animation/Heroes`를 쿡 대상에 넣었다.

## 4. 확인

- `-HWQA=select -HWQASelect=<id>` 다음에 `-HWQA=showcase -HWQAExpect=<id>`를 돌렸다. 네 명 모두 `kit_matches PASS`, `ok=1`이다.
- 20개 스킬이 제자리에서 각자의 동작으로 나온다.
- **한계**: Countess 애니 블루프린트가 스킬을 상체(UpperBody) 슬롯으로만 재생해서, 다리는 전투 대기 자세 그대로다. 회전·도약의 하체 동작이 빠진다.
  - 다음 작업: 전신 슬롯을 받는 레이어를 연결한다. 전에 FullBody 슬롯을 시도했을 때는 몸에 보이지 않았다(메모리·문서 127).

## 4.5 전신 슬롯 (같은 날)

- 원인을 찾았다.
  - Countess 애니 블루프린트는 몽타주를 상체(UpperBody, 척추부터)에만 섞는다. 원본 클립에서 다리가 움직여 보인 건 골반 이동 때문이었다.
  - `mask_geo` 커브를 넣어도 다리는 그대로였다. 그 커브는 스위치가 아니다.
- 해결:
  - `ABP_Hero_Countess` = 원본의 복사본에 **출력 직전 DefaultSlot 노드**를 끼웠다.
  - 그래프 편집은 Python으로 안 된다 → 에디터 전용 C++ `UHWEditorAnimTools::InsertOutputSlot`(Build.cs에서 에디터 빌드에만 UnrealEd·AnimGraph 의존)
  - 스크립트: `Scripts/ue_hero_fullbody_abp.py`
- 영웅 스킬 5개는 DefaultSlot(전신)으로 재생하고, 평타는 UpperBody로 남겼다(이동 중 공격).
- 네 영웅이 이 애니 블루프린트를 쓴다(`DefaultGame.ini` AnimClass).
- 확인
  - showcase 4명 `ok=1`, 스킬마다 하체가 다르다(베기 넓은 자세, 걸음 발끝 후퇴, 류 폭풍 뻗은 다리, 세라 투척 스텝).
  - `system-core-qa local` 전 게이트 통과(스킬 5/4/4/4회)
- 주의: `ue_mixamo_heroes.py`를 다시 돌리면 세트의 슬롯이 UpperBody로 돌아간다 → 이어서 `ue_hero_fullbody_abp.py`를 돌린다.

## 5. 다음

- 스킬 이펙트(콘티의 층): 예고 섬광, 무기 끝 궤적, 타격 섬광, 광역 고리, 세라 발사체, 버프 오버레이
- 문서 169의 결정 세 가지는 디렉터 결정 뒤 반영한다.
