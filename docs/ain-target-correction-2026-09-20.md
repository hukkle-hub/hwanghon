# Training target correction

Claude's a78282d (recruitment and server filters) deployed successfully before this correction.

## Changes
- Shared Ain rig receives rendered training-boss bone target in solo and online.
- skill1, skill3 and ult translate the common two-hand path toward nearby core-height targets. Bounds: lateral ±0.30m, vertical -0.20..+0.35m, forward -0.20..+0.30m in avatar-root coordinates.
- Quintic contact-time envelope and smooth distance/height falloff avoid hard on/off boundaries. Existing paired reach solver still constrains arms; no limb stretch or independent wrist rotation.
- Damage rules, skill timing, collider sizes and original GLB are unchanged. This is visual correction, not new authoritative mesh collision.

## Verification
- Old failing core fixture (0.11, 2.58, 0.58): corrected mesh distances skill1 0.3346m, skill3 0.3203m, ult 0.3248m; core radius 0.390m. Negative control without target adaptation reproduces skill1 miss.
- Same fixtures pass under avatar translation (4,0,-7) and yaw 1.2 radians.
- 18 pose variants × 241 samples, including moving-target paths: max palm residual 0.0003mm, adjacent joint step 7.839°, wrist bend 6.92°. Bone lengths unchanged.
- Real local battle skill1 at 1.30m: mesh-to-core 0.199m < 0.390m. Screenshot downloaded and inspected.
- 159 automated tests pass with Claude's recruitment changes.

## Explicit limits
- Head at y≈3.15m remains outside this near-core adaptation. Translation-only and limited pitch experiments failed; they are not shipped as a purported fix. It needs a distinct high-strike/reach solution with visual validation.
- Training boss only; other bosses, all possible trajectories, and live two-player visual synchronization are not certified by these tests.
- Online receives the latest rendered boss target on the next avatar frame; authoritative state is not modified.
- S25 Ultra thermal/FPS/touch testing still requires the physical device.
