# Combat Rules Sync — Three.js → UE Vertical Slice

UE 0.5부터 기존 황혼의 “연계 취소 vs 방어 취소” 차이를 유지한다.

## 기본 3타

- duration: 0.66
- hitAt: 0.24
- active: 0.09
- combo cancel: 0.48
- defCancel: 0.06
- defense cancel = 0.24 + 0.09 + 0.06 = **0.39**

즉:
- 0.39s부터 dodge/jump escape 가능
- 다음 combo timing은 기존처럼 늦게 유지

## Smash

Ain:
- duration: 1.15
- hitAt: 0.48
- active: 0.14
- combo cancel: 0.91
- defense cancel = 0.48 + 0.14 + 0.06 = **0.68**

## Dodge
- stamina 25
- iframe 0.30
- cooldown 0.45

## Jump
- stamina 15
- airborne rule timer 0.45
- cooldown 0.8
- jumpOnly만 회피
- 일반 공격에는 공중 무적 없음

## Hitstop
player와 boss state clock을 같은 길이로 멈춘다.

초기:
- light 0.09
- combo finisher 0.13
- smash 0.21

이 단계에서는 카메라/월드 전체 time dilation을 사용하지 않는다.
Animation/VFX가 붙으면 필요 시 hitstop presentation을 분리 검수한다.
