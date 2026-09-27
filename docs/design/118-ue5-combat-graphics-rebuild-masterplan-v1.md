# 118. 디렉터 문서 — 황혼 3D 전투·그래픽 전면 리빌드 마스터 기획서 v1 (UE5 Vertical Slice) — 2026-09-27 업로드 원문

> 디렉터 업로드 `HWANGHON_UE5_COMBAT_GRAPHICS_REBUILD_MASTERPLAN_V1_KR.md` 를 그대로 보존한다. 문서 116(v12 패스)·117(블소 레볼루션 레퍼런스)의 후속 방향. 이 컨테이너에는 UE5 가 없으므로 §24 «즉시 시작» 1~6 은 여기서 실행할 수 없다 — Phase A(벤치마크 고정)·C(모션 우선 검수 잣대)·§19 품질 게이트는 현재 three.js 검수 도구(P6 감사·frame 로그·swing-measure)로 그대로 잰다.

---

# 황혼 3D 전투·그래픽 전면 리빌드 마스터 기획서 v1

작성일: 2026-09-27
목표: Blade & Soul Revolution NEXT급 모바일 액션 RPG 체감 품질을 기준선으로 삼아 황혼의 3D 전투 클라이언트와 그래픽 파이프라인을 재설계한다.

## 0. 결론

기존 Three.js 전투는 버리지 않고 전투 규칙·밸런스·데이터 참조본으로 남긴다.

새 3D 전투는 UE5 모바일 기반 Vertical Slice로 새로 만든다. 처음부터 전체 게임을 옮기지 않고 아래 20~30초 장면 하나를 상용 품질까지 완성한다.

- 플레이어: 아인
- 보조 플레이어: 카인
- 보스: d01 계열 1종
- 공간: 서한역 계열 전투방 1개
- 시퀀스: 접근 → 아인 1→2→3 → smash → 보스 연계 → 회피 → player hit → counter → stagger/break → 큰 기술 1회

이 장면 하나가 통과한 뒤 전체 게임으로 확장한다.

## 1. 품질 목표

첫 5초만 봐도:
- 프로토타입이 아니라 출시 가능한 게임처럼 보인다.
- 캐릭터가 몸 전체로 무기를 다룬다.
- 보스가 의도를 가진 전투원처럼 보인다.
- VFX는 접점을 강화하고 모션을 가리지 않는다.
- 어두운 장면에서도 피부/천/금속/바닥 재질이 구분된다.
- UI가 많아도 전투 실루엣이 읽힌다.
- 모바일 실기기에서 frame pacing이 안정적이다.

주 레퍼런스:
- Blade & Soul Revolution / NEXT
- Blade & Soul 2 일부 보스/VFX
- Elden Ring Rellana: tell/strike/recovery
- Monster Hunter: 중량 무기 관성
- Vindictus: 접점/피격반응

## 2. 현재 프로젝트에서 살릴 것

### 전투 규칙/데이터
- damage
- stamina
- hitAt
- dodge/counter/jumpOnly
- boss phase/pattern
- stagger/break
- combo timing
- 캐릭터 스탯
- 스킬 구조
- 아이템/보상
- UI 정보 구조

### 검수 개념
- swing/contact timing
- plant error
- combo handoff
- boss reaction timing
- frame metrics

## 3. 재작성할 것

- Three.js 전투용 애니메이션 재생 계층
- 과도하게 누적된 procedural motion patch
- weapon trail 표현
- boss recoil/flash
- 현재 d01 조명
- 상용 기준 이하 캐릭터/보스 원본 mesh

원칙:
좋은 원본 animation + runtime correction 2~4개.
나쁜 원본 + 보정 다수 구조를 끝낸다.

## 4. 엔진 전략

Blade & Soul Revolution은 2026년 5월 NEXT 업데이트에서 UE4에서 UE5로 엔진을 업그레이드했다. 황혼도 블소급 그래픽을 목표로 한다면 UE5 기반 검증을 우선한다.

단 전체 이전은 Vertical Slice 합격 뒤 결정한다.

순서:
1. UE5 테스트 프로젝트
2. 아인/보스/서한역 한 장면
3. 20~30초 전투 완성
4. Android 실기기 성능 측정
5. Three.js 버전과 A/B
6. 결과가 우세하면 본격 이전

## 5. 모바일 렌더링 전략

### High Tier
- Android Vulkan
- Mobile Deferred 우선 검토
- 선택적 dynamic lighting
- reflection capture / SSR 가능 범위
- SSAO / decal
- hero shadow
- FSR 또는 적절한 업스케일

### Mid Tier
- 경량 Deferred 또는 Forward
- baked/static lighting 중심
- 제한된 dynamic shadow
- reduced particles
- reduced material complexity

### Low Tier
- Forward
- baked lighting
- simplified materials
- reduced transparent FX
- reduced shadow casters

금지:
- Nanite 필수 전제
- Lumen 상시 전제
- desktop renderer를 기본 전제로 잡기

Lumen은 high-end Android 실험 옵션으로만 취급한다.

## 6. Vertical Slice 공간

서한역 계열 지하 철도/산업 공간.

필요 요소:
- concrete
- wet floor
- rail
- steel
- ceiling light
- emergency red accent
- fog/dust
- debris
- depth layers

조명:
- cool ambient
- warm key
- restrained red accent
- neutral fill
- character rim
- contact light

검정/빨강 덩어리 화면 금지.

## 7. 캐릭터 아트 기준

### 아인
- 얼굴 새 기준 mesh
- shoulder/elbow/hip/knee deformation 재작업
- twist bone 검토
- 손/손가락
- 의상 layer
- hero-quality scythe
- skin / hair / fabric / leather / metal 재질 분리
- Hero / LOD1 / LOD2

### 카인
- 대검을 버틸 body silhouette
- 판금/가죽/천 roughness 분리
- hero-quality greatsword
- edge profile / engraving / material response

## 8. 애니메이션 파이프라인

힘 전달:
발 → 골반 → 몸통 → 어깨 → 팔 → 무기 → 접점 → follow-through

금지:
- 팔만 움직이는 공격
- attack마다 idle reset
- root와 발이 따로 노는 motion
- trail이 실제 motion보다 먼저 읽힘

제작 순서:
1. 고품질 authored/mocap source
2. retarget
3. contact retime
4. foot cleanup
5. weapon IK
6. additive presentation
7. VFX

## 9. 아인 전투 모션

### 1타
- 공격 선을 연다.
- 지지발 명확.
- 골반 선행.
- 끝 pose를 neutral로 돌리지 않는다.

### 2타
가장 중요.
- 1타 반동을 역방향으로 사용.
- neutral reset 금지.
- 작은 preparation.
- pelvis reverse first.
- chest follows.
- arms last.

### 3타
- 가장 큰 silhouette.
- 가장 큰 body drive.
- 강한 follow-through.
- finisher reaction.

합격:
- 1→2 idle frame 0
- 2→3 idle frame 0
- contact timing ±2 frame
- foot slide ≤2cm 목표
- attack3 visual amplitude > attack2 > attack1

## 10. 카인 전투 모션

정의:
느린 대검이 아니라 짧게 폭발하고 무겁게 회수되는 대검.

기본 연계:
- attack1: 체중 싣기
- attack2: reverse
- attack3: 큰 마무리

smash:
lift → hold → explosive strike → bite → heavy follow → settle

hold와 strike 속도 차이를 확실히 만든다.

## 11. 보스 애니메이션

모든 패턴:
tell → compression → strike → contact → follow → recovery

필수:
- 기본 2~3타 combo
- lunge
- slam
- spin
- big skill
- counterable attack

### 관통 돌진
low stance → compression → burst → pass-through → deceleration → turn

### 내려찍기
lift → body compression → hold → pelvis drop → impact → knee/spine compression → recovery

### 회전
plant foot → pelvis rotation → chest delay → weapon arc → foot exchange → final stop

## 12. 피격 반응

강도 계층:
light < combo finisher < smash < counter < stagger < break/down

접점 순서:
1. weapon/body contact
2. hitstop
3. target recoil
4. contact FX
5. material sound
6. damage number

숫자/FX가 몸 반응보다 먼저 나오면 실패.

## 13. 이동/회피

직접 transition:
- locomotion → attack
- attack → dodge
- dodge → attack
- jump landing → attack
- counter → follow-up

중간 idle pose 금지.

## 14. 카메라

기본전투:
- 안정
- 전신/weapon arc 읽기
- 과한 shake 없음

큰 기술:
- 제한적 FOV 변화
- 제한적 camera impulse

카메라로 나쁜 animation을 가리지 않는다.

## 15. VFX

motion pass 뒤에 작업.

평타:
- thin arc
- contact spark
- small debris

finisher:
- stronger slash
- stronger contact flash

smash:
- ground debris
- dust
- larger impact

counter:
- sharp spark
- short white impact
- material response

금지:
- full-screen flash 남발
- 흰 ribbon plate
- 보스 전체 red silhouette
- 모든 공격 과도한 bloom

## 16. 사운드

아인:
body/cloth → shaft → blade whoosh → air cut → material contact → body impact → low-end thump → tail

카인:
armor → large blade displacement → heavy transient → low-end impact → longer tail

재질:
- flesh
- metal
- wood/armor
- core

## 17. UI

Vertical Slice에서는 UI 기능 추가 금지.

유지:
- HP
- stamina
- skills
- boss HP
- target
- counter cue

감소:
- 중앙 안내
- 과밀 damage numbers
- 불필요 텍스트

## 18. 성능 전략

Hero budget 우선:
- player
- boss
- weapon
- near environment

먼저 줄일 것:
1. transparent particle overdraw
2. environment shadow caster
3. expensive postprocess
4. distant mesh
5. 고비용 material

마지막까지 유지:
- player/boss silhouette
- contact timing
- hero shadow
- weapon readability
- 핵심 facial/material cues

## 19. 품질 게이트

### Motion
Trail OFF 상태에서:
- combo idle leak 0
- visual contact ↔ hit ≤2 frames
- boss recoil ≤2~3 frames
- foot slide ≤2cm 목표
- tell/strike/recovery silhouette 구별

### Graphics
- skin/cloth/metal 구별
- silhouette 분리
- black crush 없음
- wet floor/concrete/metal 식별
- weapon material 분리

### VFX
- motion 가리지 않음
- light < finisher < smash/counter hierarchy
- afterimage가 recovery 뒤까지 남지 않음

### Audio
화면 없이도 light/finisher/smash/counter 구별.

### Mobile
- 실제 Android
- FPS
- p95/p99
- 50ms spike
- CPU/GPU
- draw calls
- triangles
- texture/peak memory
- shader hitch

## 20. 개발 단계

### Phase A — Benchmark Lock
- B&S NEXT reference
- Ain/Kain/Boss shot list
- material/lighting reference
- 20초 storyboard

### Phase B — UE5 Combat Graybox
- arena
- player capsule
- boss capsule
- lock-on
- movement
- attack timing
- hit detection
- dodge/counter
- boss patterns

### Phase C — Animation First
- Ain 1/2/3
- Ain smash
- dodge/counter seams
- boss combo/lunge/slam/big
- reactions

VFX 최소.

### Phase D — Hero Character
- Ain
- Kain
- boss
- weapons
- rig/deformation

### Phase E — Materials & Lighting
- skin
- hair
- cloth
- leather
- metal
- station materials
- lighting

### Phase F — VFX / Audio / Camera
motion 합격 후.

### Phase G — Mobile Optimization
- device profile
- quality tier
- LOD/HLOD
- texture streaming
- PSO/shader hitch
- animation budget

### Phase H — Expansion
Vertical Slice 합격 뒤:
- 전체 UE 이전 여부
- dungeon pipeline
- character pipeline
- multiplayer/server integration

## 21. 첫 Slice 필요 에셋

Ain:
- body/head/hair/outfit/scythe
- idle/locomotion/3hit/smash/dodge/jump/counter/hit

Boss:
- idle/walk/turn/combo/lunge/slam/spin/big/hit/stagger/break/recover

Environment:
- floor/wall/rail/steel/light/debris/decal/fog

## 22. Vertical Slice 전 금지

- 새 던전
- 새 성장 시스템
- 신규 UI 페이지
- 신규 장비 시스템
- PvP
- 캐릭터 양산
- 신규 스토리 시스템

품질 먼저, 양은 나중.

## 23. 성공 정의

1. Trail/HUD 최소 상태에서도 전투가 멋있다.
2. 아인의 몸이 무기보다 먼저 읽힌다.
3. 카인의 무게가 관성으로 느껴진다.
4. 보스 공격을 silhouette만으로 구별한다.
5. recovery가 punish window를 설명한다.
6. 피격이 숫자보다 몸으로 먼저 읽힌다.
7. 소재가 구별된다.
8. 어두운 장면에서도 silhouette가 죽지 않는다.
9. 모바일에서 frame pacing이 안정적이다.
10. 첫 5초가 prototype처럼 보이지 않는다.

## 24. 즉시 시작 작업

1. UE5 Vertical Slice 프로젝트 생성
2. 서한역 graybox
3. Ain capsule/lock-on/movement
4. 기존 황혼 basic combat timing 이식
5. boss graybox
6. 20초 sequence 완성
7. Ain attack1/2/3 원본 animation 제작
8. boss 핵심 패턴 3종 animation
9. 접점/reaction 계측
10. Hero model/lighting 단계 이동

## 25. 운영 원칙

모든 작업은 이 질문으로 판정한다.

“이 변경이 20초 Vertical Slice를 블소급에 더 가깝게 만드는가?”

아니면 보류한다.
