# Ain motion correction — calibrated shaft and closed-grip revision

## Revision 4 — grip correction release

- Root cause: the Hi3D handle is tilted 10.67 degrees in its source coordinates. The old y-only mount left its actual right-grip centre 66.69 mm sideways from the socket. Fit the shaft over eleven cross-sections, then rotate and translate a parent group. Source mesh/texture/GLB files remain untouched; fit residual is 0.578 mm.
- Use the actual hand-local Z finger-spread axis, not X, to orient the shaft across both palms. Solve elbows on reachable circles with neutral wrists, stable upper-arm frames, and continuous weapon paths. Preserve body/lower-body clips and combat timestamps.
- Reversible left/right grip morphs close fingers and oppose the thumb. Correct triangle surfaces and weld UV-seam displacement without subdividing: 59,999 triangles before and after. Corrected local hand triangles clear a 12 mm reference shaft (minimum 12.80 mm). This is a geometric regression check, not full animated cloth/finger collision simulation.
- Keep the right hand closed and the weapon calibrated through hit/roll/dodge. Left hand can release; existing 120 ms release/regrip transition remains.
- Fourteen actual clips, 241 samples each: idle/run/guard, attack1/2/3, smash, ult, skill1/2/3/4, counter, exec. Maximum steady two-palm residual 0.0002 mm, adjacent joint step 6.607 degrees, wrist-direction bend 6.92 degrees. Transition and transformed-avatar tests also pass. Online constructor test verifies two independently corrected avatar clones do not mutate their shared source.
- Visual QA: original/closed hand closeups, actual textured attack2 closeup, skill2 side and ult rear six-pose sheets. Review supports all four skills, counter, execution and release poses, with an original/closed-hand comparison link.
- Full suite initially exposed five pre-existing Windows SQLite teardown errors: temporary folders were removed before closing their database handles. Test-only cleanup order corrected; gameplay/server persistence code unchanged. Full pre-merge suite: 132/132 passing, followed by the new online-clone regression passing.
- Scope: completed correction of the existing model's grip and arm motion, not a newly rigged character. There are no independent finger bones; existing coarse hand topology remains visible in extreme closeups. No Galaxy S25 Ultra physical-device performance claim. No paid regeneration.

The sections below retain earlier findings and rejected experiments for comparison; revision 4 supersedes their pending-grip status.

## Revision 3 — smoother weapon rotation, local only

Revision 2 was deployed successfully as commit 92a6e161fa906ad276a25217880e5e2bbfaea919. The changes in this section are a subsequent local revision, not yet deployed.

- Interpolate weapon orientation with quaternion slerp between authored keys instead of rebuilding orientation from each interpolated direction vector. Keep the existing impact at phase .42; begin the chop downswing at .20 rather than .25 to reduce peak angular velocity. Damage timing and source clips remain unchanged.
- Retain neutral wrists. Experimental shaft-aligned hands reduced socket residual but hyperextended wrists (116 degrees) or introduced elbow branch flips (up to 176 degrees). Those experimental changes were removed, not shipped.
- Add a wrist-direction regression and identify the exact clip/joint/sample of the maximum angular step. Across 241 samples in each of eight clips: maximum adjacent step 6.047 degrees (previous deployed baseline 11.431), wrist direction bend 6.92 degrees, palm residual 0.0211 mm. These measurements do not establish finger contact.
- The review now selects actual attack1/attack2/attack3/smash/ult/idle/run/guard clips, adjusts the timeline to each duration, and exports six labelled poses for the selected clip. Review remains deterministic scrubbing, not a reproduction of the runtime release transition or authoritative per-skill impact timestamp.
- Scoped suite: 83 passing tests. Original GLB, textures and other agents' working files untouched. Thumb/finger contact remains unaccepted; no finished-character claim.

## Revision 2 — implemented locally, not deployed

Deployment preparation: merged upstream through f749e7c, preserving new mocap assets, cameras, ground shadows, boss/dungeon changes and online phase cuts. Revalidated the NEW Ain GLB. Added a 120 ms smooth transition between weapon control and authored release poses, plus quintic trajectory easing (continuous acceleration at keys). During deliberate release/regrip transitions, the palm socket is not claimed to remain locked. Added both runtime modules to offline precache. Scoped suite now passes 83 tests. Finger articulation limitations below remain.

The rejected delta-smoothing prototype below is superseded by `ain-bind-repair.js` and `ain-two-hand.js`. Solo and online renderers now opt into this correction for **Ain only**. Other character models retain their existing adapters. No GLB, texture, source clip, server timing, damage value, or remote deployment was overwritten.

Inspection of the bind mesh found the old wrist at y=0.8098 m while the hand mesh is around y=0.9–0.98 m. Only 21/29 vertices had >65% influence from their respective hand bones (some were not on the actual hand). The existing hand sockets therefore were not valid visual contact points.

Changes:

- Refit forearms to (±0.245,1.16,0.012), wrists to (±0.30,0.98,0.022), and palm sockets to (±0.318,0.93,0.04), measured/tuned against this mesh's A-pose.
- Clone geometry and reweight 2,152 sleeve/hand vertices, including 444 distal hand vertices. Recompute bind inverses and replace cloned constant translation tracks for changed joints. Rest mesh vertex positions, UVs and textures stay unchanged.
- Use a shared, smooth weapon trajectory with a fixed 32 cm grip separation in character units, translated into the intersection of both arms' reachable volumes. Solve elbows from stable torso-relative poles and the bind pose. Wrists keep neutral local rotation rather than spinning to follow the shaft.
- Keep a two-handed ready pose for idle/run/guard and the endpoints of attacks. Death, hit, roll/dodge and non-combat gestures retain their authored arm poses. Their transitions still need dedicated aesthetic review; no claim of complete animation polish.
- Contact pose maps to the existing action hitAt. This is authored runtime motion, not a new mocap recording. Slash, chop and thrust paths are distinct; other skills currently reuse these families with the existing torso/lower-body animation.

Validation: the 79-test scoped suite passed, then the additional scaled/yawed-avatar regression passed. In 241 samples per idle/run/guard/attack1/attack2/attack3/smash/ult, the production adapter had maximum palm-to-shaft residual 0.0216 mm and adjacent arm-joint step 9.171 degrees. The corrected bind's undeformed mesh residual was 7.13e-8 m. Scaled (1.14), translated and yawed avatars retain contact, and death is not overridden. These are kinematic checks, not finger-contact or phone-performance acceptance.

Visual checks: front, A-pose, rear at 0.32 s, side at 0.88 s, and close-ups at 0.59/0.88 s show corrected shoulder/hand placement. Added two reversible distal-hand curl morphs (position + normal deltas) as a basic grip shape, smoothly released outside combat poses. The undeformed source positions remain unchanged. Individual finger bones, thumb articulation, precise finger-to-shaft collision, and full anatomical grip polishing remain limitations; this is not finished finger articulation. Mobile device performance and the online server session have not been device-tested. The final scoped suite has **80 passing tests**.

---

## Historical rejected prototype

Original GLB assets and production `combat-motion.js` remain unchanged. Experimental changes are isolated to `ain-rig-review.js`, `ain-motion-quality.js`, and the local `ain-pose-study.html` preview. No push or deployment.

## Reproduced

- The legacy grip target projects the shoulder onto the scythe and jumps between -0.12 and +0.12 m at the midpoint. Unconstrained CCD and a second preview IK pass prioritize target distance over anatomy.
- In the six-pose study, the baseline adds up to 164.41 degrees of forearm correction. Adjacent samples jump 28.48 degrees at the upper arm and 50.69 degrees at the forearm. These are local bone rotations, not measured mesh strain or proof of an anatomical joint limit.
- The actual model has hand and hand-slot bones, but no finger bones. A finger-closing animation cannot be implemented on this skeleton alone.
- Original attack1 itself has a rapid rotation change near 0.34–0.40 seconds; grip IK is not the only issue.

## Experimental correction

Hand-based target projection without the midpoint jump; damped joint correction capped to 25/55 degrees relative to the authored pose; correction-delta smoothing during playback; symmetric quaternion filtering in cloned clips. No source animation or combat timestamps are overwritten. The preview no longer runs a second unconstrained IK pass.

## Acceptance status: FAIL

`node tools/audit-ain-joints.mjs` samples each clip 241 times. Fresh adapters isolate comparisons. At this sampling rate, the candidate six-pose maximum adjacent upper-arm/forearm change is 3.22/6.84 degrees instead of 28.48/50.69. However, maximum left-hand-to-shaft residual grows to 18.94 cm during continuous playback (attack1: 34.11 cm). This is unacceptable and is why the candidate is NOT wired into either production renderer.

The local review uses deterministic static posing (`dt=0`) for seeking/thumbnails, so its displayed instantaneous error is not a claim about continuously filtered playback. Front/back inspection at 0.59 seconds still shows an open-palm grip. Safety tests passing do not establish visual acceptance.

## Required next repair, without regenerating the character

1. Author a stable two-handed rest grip and elbow poles together with the scythe path; solve torso/clavicle/arms as a coordinated chain instead of independently forcing the left wrist onto an existing weapon trajectory.
2. Inspect shoulder skin weights in close-up at the worst frames before deciding whether weight painting is needed. This has not yet been established numerically.
3. Add finger articulation and corresponding weights, or author a closed-grip corrective mesh/shape key if the existing geometry permits it. Do not claim wrist orientation is finger contact.
4. Require simultaneous contact (<5 cm is only the existing coarse bone-target gate), bounded/continuous rotations, no visible intersections, and front/side/back real-time + slow-motion review before integrating or deploying.
