# Device settings and contact audit — 2026-09-20

## Shipped scope
- Solo dungeon pause menu: Auto / Low / Medium / High. Changes immediately update render resolution and shadow configuration. Auto fallback never overrides manual tiers or persists a lighting preference change.
- Pixel budgets: 1.0 / 1.8 / 3.2 million pixels. Safe mode remains low. Geometry, grip IK, combat timing and damage rules are unchanged.
- Small non-touch windows can use the dungeon's mobile layout, matching its renderer size classification. Other pages retain their existing layout policy.
- Settings wrap labels with their controls; short screens scroll inside the overlay rather than enlarge the stage.
- Local weaponReview panel accepts 0.8–3m distance and boss part selection. This measures actual blade mesh to unchanged target radius; it does not substitute a mesh collision rule for server damage rules.

## Evidence
- 154 tests pass, including 27 nearby target offsets for skill1 / skill3 / ult, high unreachable-target negative control, and portrait/landscape/high-DPI pixel budgets.
- Browser viewport 360×800: low canvas 324×720; switching to high immediately produces 360×800 at this browser's DPR=1. Overlay bounds x=14.4..345.6 (before final label-pair grouping).
- Browser viewport 800×360: settings remain within viewport and scroll internally. Screenshot inspected.
- Actual skill1 at 1.2m: blade surface to core 0.251m, radius 0.390m: contact.
- Actual skill1 targeting head at 1.2m: blade surface distance 0.731m, radius 0.488m: MISS. Current fixed trajectory is not universally target-height adaptive.

## Not complete
- High head targets and moving-target tracking need shared solo/online trajectory work; do not claim all parts, distances or bosses pass.
- Quality selector currently applies to solo game3d, not the separate online renderer.
- Browser size checks are not S25 Ultra GPU, thermal or touch-latency measurements. Physical device performance remains unverified.
- Original GLB and damage hitbox sizes unchanged. No paid assets or regeneration.
