# 황혼 v12 — P3 모바일 안정성

P0~P2 뒤 적용하는 보수적인 성능 패스.

## 환경 그림자
- 모바일 auto/medium: barrel/crate/console/door 등 Hi3D 환경 소품은 `castShadow=false`.
- 모바일 high와 PC: 기존 환경 그림자 유지.
- 아인·보스 그림자는 모든 medium/high에서 그대로 유지.
- 바닥 `receiveShadow`도 유지.

## 스킬 순간광
- PC: 기존 짧은 PointLight 유지.
- 모바일: P0의 캐릭터 fill/rim과 VFX sprite/arc를 사용하고 일회성 PointLight 생성·제거는 생략.
- 목적은 라이트 개수 변경에 따른 shader variant 전환/fragment 비용을 줄이는 것.

## 하지 않은 것
- 해상도 강제 저하 없음.
- 그림자 맵 크기 변경 없음.
- 캐릭터/보스 그림자 제거 없음.
- VFX 개수 일괄 축소 없음.
- combat 규칙 변경 없음.

실기 60초 측정 전에는 더 공격적인 최적화를 하지 않는다.
