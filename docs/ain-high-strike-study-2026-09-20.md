# High strike study and review-tool correction

## Correction to earlier reports
Training `parts3d.head` is a render marker, not a selectable combat part in the current training stages. The old local review panel silently measured the head after `battle.input('target','head')` was rejected and the attack remained aimed at the core. Therefore earlier head misses were NOT valid evidence of a head-targeted gameplay failure.

The review tool now selects a stage that actually contains the requested combat part. If no stage contains it, it labels the result as a local pose experiment, overrides only visual aim, and explicitly does not claim damage validation. Normal production selection/rules are unchanged.

## New experimental skill1 high hook
- Raised hook pose with backward shaft lean, reach-limited two-hand IK, no bone stretching or collider enlargement.
- Broader preparation and recovery removed intermediate arm angular spikes (initial experiment failed the existing 8° adjacent-sample threshold; corrected version passes).
- Head fixture (0.09,3.15,0.89): 0.4219m blade-surface distance < 0.488m radius; yaw/translation fixture also passes. Old pose fails this fixture.
- Live local **pose experiment**, head around y=2.97m, player distance 1.20m: 0.248m < 0.488m. Screenshot captured.
- 159 tests pass; 19 pose variants including high strike, max wrist 6.92°, adjacent joint 7.839°, palm residual 0.0003mm, original 59,999 triangles unchanged.

Not a completed all-skill high-target system: skill3/ult candidates did not pass and are not enabled. No new head damage mechanic was added. Exact arm aesthetics still need close-up animation review, not just a rear gameplay screenshot.

## Deployment caution
New upstream deployment notes and render.yaml document ephemeral `/tmp/hwanghon` storage. Another Render restart may lose current accounts/guilds. Do not redeploy merely to publish this experiment without resolving data preservation or explicit reset approval. Existing Render release d6cfe7d was confirmed live on 2026-09-20 06:07 UTC.
