N01 tier-5 six-role review candidates — 2026-10-10

Body ids: G5_WALKER, G5_RUNNER, G5_BREAKER, G5_STALKER, G5_ARMORED,
G5_RESONATOR. Human anatomy/core-only infection; original approved references
remain the design authority. These assets do not silently approve themselves.

Each species: full GLB (2048 PNG) and mobile GLB (1024 PNG, <=20,000 triangles).
65-joint skin, embedded PNG, no Draco/meshopt compression. All body-specific
skills plus idle/walk/hit/die. Runner also run; Armored three attack clips.
Validation JSON is technical evidence only, not a substitute for video QA.

Body source: six existing Hi3D downloads, retained unchanged outside this
repository in output/monster-bodies-v11/incoming. No further generation paid.
Local editing: bind/deformation repair, separate core, retargeted animation,
LOD/PNG compaction. Native face/clothing retained; no character regeneration.
Walker and Runner hands: local MakeHuman/MPFB CC0 base mesh, cropped from
art/3d/src/mh/kain_base_mpfb.glb. See docs/design/81-character-pipeline-mpfb.md and
art/3d/base/README.md for existing source provenance. Donor original unmodified.
Replacement hand geometry is wrist-connected and forearm-weighted at cuff.
Fingers are relaxed silhouettes; independent grasp animation is not supplied.
Walker soles: closed caps made from the native lower-shoe vertices/weights,
offset outward 0.8mm to avoid coplanar flicker and merged into the existing
body primitive/material. This repairs the dark side/toe void without replacing
the face, upper boot, body or animation samples. High/mobile remain <=3 materials.

Actual integration, deliberately opt-in for director review:
world3d.html?offline=1&n01Candidates=1
Add &n01Detail=high for full model instead of mobile.
tools/3d/n01-six-review.html — actual runtime loader/role-AI review fixtures.
tools/3d/n01-crowd-review.html — 20 monsters + 10 existing hero LODs.

Server code is on a separate feature branch. No main push or Render redeploy.
No new drop/XP/clock/invasion policy. Production N01 facility/NPC event
producer is not included; role context and host strike adapter are supplied.
S25 Ultra hardware FPS/heat/long-session memory are not measured here.
