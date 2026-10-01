# 175 — 영웅마다 자기 무기 + 의상 시안 접수 (2026-10-01)

디렉터: «일단 각 캐릭터에 맞는 무기 먼저 들게 하고 … 장비 전번에 올려 놓은거 확인해서 올리고».

## 1. 무기 — 전에 올려 둔 장비(art/3d)에서, 문서 160의 배정대로

| 영웅 | 무기 | 파일 | 길이 | 손잡이(Grip) |
|---|---|---|---|---|
| 아인 | 사신의 낫 | art/3d/ain_scythe_tex.glb | 180 cm | 62 cm |
| 카인 | 모루의 대검 | art/3d/gear/w_kain_greatsword.glb | 160 cm(메시 55–215) | 70 cm |
| 류 | 쌍아 쌍단검(양손) | art/3d/gear/w_ryu_twinfang.glb | 42 cm | 8 cm |
| 세라 | 약병(던진다) | art/3d/gear/w_sera_vial.glb | 22 cm | 9 cm |

- 다른 후보(w_hook_scythe, w_kain_crusher, w_ryu_shiv, w_sera_flask/reagent)도 `tools/3d/gear_sheet.py`로 보고 크기를 쟀다.
- 세라 무기(지팡이+봉인 그물 안)는 디렉터 결정 대기라 약병으로 둔다.

### 연결

`DefaultGame.ini`의 `+Characters=(… WeaponR=, WeaponL=, GripR=, GripL=)`를 읽어 `UHWCharacterVisualSettings::ApplyWeapons`가 붙인다. 원격 아바타도 같은 경로다.

1. Countess 몸에 붙은 쌍검을 숨긴다(`HideBoneByName(weapon_r/l)`).
2. 숨긴 뼈는 크기가 0이고 그 자식도 0이 된다. 그래서 무기는 **손(hand_r/l)**에 붙이고, 기준 자세에서 weapon_r이 손에 대해 놓인 변환을 그대로 쓴다.
   - 부모 뼈를 쓰면 안 된다. 카인 스킨은 weapon_r이 IK 뼈에 매달려 있어서 대검이 1 m 넘게 떠 있었다.
3. 메시의 +Z(칼끝)를 칼날 축(weapon_r의 −Y, weapon_l의 +Y)으로 돌리고, Grip만큼 내려서 손잡이를 손에 둔다.
   - 회전은 `FindBetweenNormals`로 구한다. roll +90으로 가정했더니 방향이 반대라 손이 칼끝 너머에 왔다.

### 이펙트 소켓

몸의 FX_WeaponBase/Tip 소켓은 숨긴 뼈에 있어서 함께 사라진다. 그래서 무기 메시에 `TrailBase`/`TrailTip` 소켓을 넣었다(`ue_import_hero_weapons.py`).
- 무기 궤적, 예고 섬광, 칼끝 빛이 무기를 따라간다.
- 낫은 자루 위쪽에서 날 끝까지, 대검은 가드에서 칼끝까지다.

### 함정

- 대검 가져오기에서 StaticMesh 파일만 빠졌다(재질·텍스처는 저장됨). 하나씩 가져오고 `save_directory`를 부르게 했다(`HW_WEAPONS=kain_greatsword`).
- 소켓 목록은 Python에서 protected라 `find_socket`으로 확인한다.

### 확인

- showcase 라인업: 네 명이 각자 무기를 든다.
- 카인 측면 컷: 대검이 손에 있다.
- skillfx 네 명 모두 `ok=1`.
- 휴대폰 APK 빌드 중(태블릿 R5KL30AA5CF 연결됨).

## 2. 의상 시안 11장 — «추가로 아인이랑 세라 입힐거»

`art/concept/outfits/`(README에 잠정 분류)
- 단발: 아인 7장
- 장발·올림머리: 세라 3장
- 마네킹(Uri): 미정

로드맵상 외형은 전투 시스템 다음이다. 그때 이 시안으로 장비/의상 슬롯 데이터부터 만든다.

## 3. 다음

- 무기 날의 방향(Twist)과 크기를 휴대폰에서 보고 다듬는다.
- 세라 무기 결정 뒤 교체한다.
- 의상: 디렉터에게 분류 확인을 받는다.
