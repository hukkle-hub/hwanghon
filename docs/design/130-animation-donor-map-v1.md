# 130. 황혼 Animation Donor Map v1

## 목표

애니메이션을 처음부터 전부 만들지 않는다.

1. 무료/합법 donor를 확보한다.
2. UE5 IK Retargeter로 황혼 캐릭터에 이전한다.
3. Control Rig로 골반/가슴/손/발/무기만 수정한다.
4. Motion Warping/Distance Matching으로 거리와 속도를 게임 규칙에 맞춘다.
5. 황혼 contact timing은 기존 Combat System 값이 권한 원본이다.

**Donor animation = 초벌 모션.**
최종 캐릭터 정체성은 반드시 황혼용 수정 패스에서 만든다.

---

# 1. 가장 먼저 받을 것

## A. Game Animation Sample — 공통 이동의 기준

용도:
- idle
- walk
- jog
- sprint
- turn
- stop
- jump/fall
- traversal

장점:
- UE5 Mannequin 기반
- 500+ game-ready animations
- Motion Matching sample 포함
- Epic 문서에서 애니메이션을 자체 프로젝트로 Migrate 가능

황혼에서는 공격 모션 donor가 아니라 **공통 이동 품질 기준**으로 사용.

최종 경로:
`/Game/Hwanghon/Animation/Final/<Character>/Locomotion`

---

# 2. Ain — 낫 / 빠른 방향 전환

## donor 우선순위

1. Countess
2. Kwang
3. Quaternius UAL2
4. 직접 Rokoko capture

## 슬롯

| 황혼 슬롯 | 1차 donor | 2차 donor | 수정 방향 |
|---|---|---|---|
| Locomotion | Game Animation Sample | UAL | 가벼운 중심 이동 |
| Dodge | Countess | UAL2 | 끝 자세가 Attack1 준비자세가 되도록 |
| Attack1 | Countess | Kwang | 골반 선행, 낫 shaft 양손 간격 |
| Attack2 | Kwang | Countess | Attack1 follow에서 역방향 회전 직결 |
| Attack3 | Kwang | UAL2 | body drive 가장 크게 |
| Smash | Kwang | custom mocap | hold → pelvis drop → contact |
| Counter | Kwang | Countess | 짧은 anticipation, 즉시 되받기 |
| Ultimate | Rokoko custom | Countess/Kwang 조각 | 낫 전용 고유 실루엣 |

## Ain 변형 규칙

- donor 검격의 손목만 낫에 맞추지 말고 **pelvis → chest → shoulder → hands** 순으로 재구성.
- 낫의 긴 shaft 때문에 양손 간격을 고정한다.
- Attack1/2/3 사이 neutral/idle pose 금지.
- Attack2는 가장 중요:
  - Attack1 follow pose에서 시작.
  - 반대방향 pelvis yaw가 torso보다 먼저.
  - weapon re-cock 최소화.
- blade contact는 기존 combat timing을 유지.
- 기본 trail OFF 상태에서 몸 동작만으로 타격 방향이 보여야 한다.

---

# 3. Kain — 대검 / 중량

## donor 우선순위

1. Greystone
2. Kwang
3. Feng Mao
4. UAL2
5. 직접 Rokoko capture

## 슬롯

| 황혼 슬롯 | donor | 수정 방향 |
|---|---|---|
| Locomotion | Game Animation Sample | stride를 약간 넓히고 상체 흔들림 억제 |
| Attack1 | Greystone | 대검 선행 금지, 발/골반 먼저 |
| Attack2 | Kwang | 방향 반전 연결용 |
| Attack3 | Greystone | 큰 follow-through |
| Smash | Greystone | anticipation/hold를 황혼 타이밍에 맞춤 |
| Guard | Greystone | Kain 방어 silhouette |
| Counter | Kwang | 짧은 반격 |
| Pivot | Feng Mao | 큰 무기 자세 전환 donor |
| Ultimate | custom Rokoko | 카인 대표 대검 모션 |

## Kain 변형 규칙

- 대검이 몸을 끌고 다니는 것처럼 보이면 실패.
- **feet → pelvis → back → shoulder → greatsword** 순서.
- donor 원본보다 anticipation은 길게, 실제 strike 구간은 짧게.
- support foot가 contact 순간 미끄러지면 안 된다.
- follow-through를 줄이지 않는다.
- Smash contact 이후 weapon이 즉시 neutral로 돌아오지 않게 한다.

---

# 4. Ryu — 빠른 연속 전투

## donor 우선순위

1. Serath
2. Countess
3. UAL2

## 슬롯

| 황혼 슬롯 | donor | 수정 방향 |
|---|---|---|
| Locomotion | Game Animation Sample | 빠른 stop/turn |
| Dodge | Countess | 낮은 중심 |
| Attack1 | Serath | 짧은 recovery |
| Attack2 | Serath | 1타 follow에서 직결 |
| Attack3 | Serath | finisher silhouette |
| Skill3 | UAL2 melee combo | 3-hit timing 재배치 |
| Ultimate | Serath + custom edit | 다단 hit timing에 맞춰 분할 |

## Ryu 변형 규칙

- 단순 playback speed 상승 금지.
- recovery 자체를 줄이고 다음 attack anticipation과 합친다.
- COM을 Ain보다 낮게.
- feet pivot를 명확히 하여 빠른 공격도 turntable처럼 보이지 않게 한다.

---

# 5. Sera — 투척 / 지원 / 장치

## donor 우선순위

1. Morigesh
2. Phase
3. Dekker
4. Mixamo
5. custom Rokoko

## 슬롯

| 황혼 슬롯 | donor | 수정 방향 |
|---|---|---|
| Locomotion | Game Animation Sample | 중립적인 이동 |
| Throw | Morigesh | 실제 투사체 release frame 지정 |
| Support | Phase | 회복/보호 제스처 |
| Device cast | Dekker | 시약/장치 interaction |
| Dodge | Phase | 짧은 sidestep |
| Ultimate | custom Rokoko | 촉매 투척/폭발 고유 동작 |

## Sera 변형 규칙

- 마법사처럼 과도하게 팔을 휘두르지 않는다.
- throw 손의 release frame과 gameplay projectile spawn을 일치.
- off-hand는 bottle/device를 보호/조작하는 역할.
- support skill은 공격 스킬보다 silhouette가 부드럽고 열려 있어야 한다.

---

# 6. Boss — 큰 체중 + 명확한 Tell

## donor 우선순위

1. Sevarog
2. Grux
3. Rampage
4. UAL2

## 패턴

| 황혼 패턴 | donor | 핵심 |
|---|---|---|
| Idle | Sevarog | 호흡/체중 이동 |
| Approach | Grux | 마지막 걸음이 공격 stance |
| HookCombo | Grux | 공격 사이 idle 금지 |
| Charge | Grux | low stance → burst → pass-through |
| Slam | Sevarog | lift → hold → pelvis drop |
| Spin | Grux | planted foot/pelvis 기반 |
| Jump Slam | Rampage | jump/land 체중감 |
| Ground Wave | Sevarog | 큰 tell + 순간 strike |
| Stagger | Rampage | 방향성 recoil |
| Break | Rampage | 명확한 punish window |
| Death | Rampage | 체중이 실제로 무너지는 느낌 |

## 보스 변형 규칙

- donor 전체 클립을 그대로 사용하지 않는다.
- Tell / Strike / Recovery 세 부분으로 잘라 황혼 Pattern timing에 재조립.
- Tell은 극단 pose를 hold.
- Strike는 짧고 빠르게.
- Recovery pose 자체가 “지금 공격 가능”을 알려야 한다.
- Spin은 root를 회전시키기만 하는 turntable 금지.
- Charge는 target을 통과한 뒤 감속/회전.

---

# 7. 잡몹

## 빠른 방법

1. Paragon Minions
2. Quaternius Universal Base Characters + UAL
3. Quaternius Bestiary는 라이선스/사용조건을 해당 다운로드 시점에 별도 기록

잡몹은 Hero 캐릭터보다 donor 수정량을 줄여도 된다.

필수:
- idle
- move
- attack
- hit
- death
- optional elite tell

---

# 8. 직접 모캡이 필요한 모션

무료 donor로 억지로 해결하지 않는다.

직접 찍을 가치가 높은 모션:

- Ain 낫 Ultimate
- Ain Smash
- Kain 대표 Greatsword Smash
- Kain Ultimate
- Boss signature pattern 1~2개

Rokoko Vision/Create:
- 직접 촬영 영상만 사용.
- Paragon animation을 AI 서비스 입력으로 업로드하지 않는다.
- capture 후 FBX export → UE IK Retargeter.

---

# 9. 모션 변형 공통 순서

1. **Retarget Pose**
   - source/target A/T pose 차이 수정.
2. **Pelvis**
   - 높이, yaw, root 방향.
3. **Feet**
   - planted foot contact.
4. **Chest**
   - pelvis보다 1~4 frames 늦은 torque.
5. **Hands**
   - weapon socket와 양손 간격.
6. **Weapon arc**
   - contact에서 실제 타깃과 만나게.
7. **Root distance**
   - Motion Warping으로 gameplay range에 맞춤.
8. **Recovery**
   - 다음 행동 시작 pose와 연결.
9. **Combat timing**
   - 기존 `HitAt/CancelAt/Duration`과 시각 contact 비교.
10. **VFX OFF QA**
   - 몸 동작만 보고 합격 여부 판단.

---

# 10. 품질 Gate

## Player
- combo idle leak = 0
- visual contact ↔ combat event <= 2 frames @60fps
- planted foot slide target <= 2cm
- pelvis yaw discontinuity <= 12°
- chest yaw discontinuity <= 15°
- Attack1 < Attack2 < Attack3 amplitude
- dodge end → next anticipation 자연 연결

## Boss
- tell / strike / recovery silhouette만 보고 구분 가능
- normal hit reaction <= 3 frames
- break는 일반 stagger보다 명확
- charge/spin/slam 각각 body mechanics가 다름

## Donor Identity
아래 중 하나라도 느껴지면 수정 부족:
- “Countess 공격 같다”
- “Greystone 그대로 같다”
- 원본 무기 길이가 몸에 남아 있음
- 원본 character stance가 황혼 캐릭터 디자인보다 강함

최종 목표는 **donor를 알아볼 수 없게 만드는 것**이 아니라,
황혼 캐릭터의 신체/무기/전투 규칙에 맞게 충분히 재저작하는 것이다.
