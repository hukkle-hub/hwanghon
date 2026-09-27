# Animation Blueprint Contract — Vertical Slice 0.2

## Ain AnimBP

Parent class:
`HWAinAnimInstance`

Variables are filled from C++ every frame:

- `GroundSpeed`
- `Direction`
- `bInAir`
- `bLockedOn`
- `Action`
- `ActionPhase`
- `bAttackAction`
- `ComboIndex`
- `bContactWindow`

Recommended graph:

### Locomotion state machine
- Idle
- Walk/Run
- LockOn Strafe
- Jump/Fall

### Combat overlay
Use Action to select:
- Attack1
- Attack2
- Attack3
- Smash
- Dodge
- Jump
- Counter
- Hit
- Stagger

Do not route combo through Idle.

Attack1 end → Attack2 start
Attack2 end → Attack3 start

must be direct transitions.

### B&S-style chain intent
- Attack1: readable open
- Attack2: smallest anticipation / reverse cut
- Attack3: largest body drive/follow

## Boss AnimBP

Parent class:
`HWBossAnimInstance`

Variables:
- `BossState`
- `PatternId`
- `StatePhase`
- `bTell`
- `bStrike`
- `bRecover`
- `bBigPattern`
- `GroundSpeed`

Every pattern must have:
tell pose → strike → recovery.

Do not fade to Idle between chain beats.

### Initial pattern animation slots
- HookCombo
- Charge
- Slam
- Spin
- GroundWave

### Quality contract
Trail/VFX OFF:
- player combo idle leak = 0 frames
- boss tell silhouette readable
- contact ±2 frames
- boss recoil 2–3 frames max
- recovery visually matches punish window
