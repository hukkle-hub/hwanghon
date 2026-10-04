"""MH_<name> from the wrapped template with the high-frequency delta KEPT (doc 177).
import_from_template hard-codes bDisableHighFrequencyDelta=true, which pulled the face back into the MetaHuman
model space (brow ridge, hooded lids, proportions lost - measured). Here: the template's static mesh UVs are matched
to the archetype DNA layout (MHLabTools C++), giving head vertices in DNA order -> fit_state_to_target_vertices with
disable_high_frequency_delta False.
Env MH_NAME, MH_HF (1 = keep detail, default), MH_ALIGN (srt|none). Log fit_hf_log.txt.
"""
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
LOG = "C:/w/mhlab/fit_hf_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eal = unreal.EditorAssetLibrary
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
try:
    sms = [x for x in eal.list_assets(f"/Game/Template/{NAME}", recursive=True) if isinstance(unreal.load_asset(x), unreal.StaticMesh)]
    sm = unreal.load_asset(sms[0])
    ok = True
    npos, lpos, luv = unreal.MHLabDNALibrary.get_archetype_mesh_layout(0)
    log("dna head", ok, "positions", npos, "layouts", len(lpos))

    md = sm.get_static_mesh_description(0)
    uv2pos = {}
    n_inst = md.get_vertex_instance_count()
    for i in range(n_inst):
        vi = unreal.VertexInstanceID(i)
        uv = md.get_vertex_instance_uv(vi, 0)
        p = md.get_vertex_position(md.get_vertex_instance_vertex(vi))
        uv2pos[(round(uv.x, 4), round(uv.y, 4))] = p
    log("template instances", n_inst, "unique uvs", len(uv2pos))

    target = [None] * npos
    miss = 0
    keys = None
    for pidx, uv in zip(lpos, luv):
        if target[pidx] is not None:
            continue
        k = (round(uv.x, 4), round(uv.y, 4))
        p = uv2pos.get(k)
        if p is None:
            # nearest UV (rounding at a boundary)
            if keys is None:
                keys = list(uv2pos.keys())
            k = min(keys, key=lambda q: (q[0] - uv.x) ** 2 + (q[1] - uv.y) ** 2)
            p = uv2pos[k]
            miss += 1
        target[pidx] = p
    log("matched", sum(1 for t in target if t is not None), "of", npos, "by nearest", miss)

    PRESET = "Aera"
    dst = f"/Game/Heroes/MH_{NAME}"
    if eal.does_asset_exist(dst):
        eal.delete_asset(dst)
    char = eal.duplicate_asset(f"/MetaHumanCharacter/Optional/Presets/{PRESET}", dst)
    log("character", char, "edit", sub.try_add_object_to_edit(char))

    opt = unreal.FitToTargetOptions()
    opt.alignment_options = {"srt": unreal.MetaHumanAlignmentOptions.SCALING_ROTATION_TRANSLATION,
                             "none": unreal.MetaHumanAlignmentOptions.NONE}[os.environ.get("MH_ALIGN", "srt")]
    opt.adapt_neck = True
    opt.disable_high_frequency_delta = os.environ.get("MH_HF", "1") != "1"
    fp = unreal.MetaHumanCharacterFitToVerticesParams()
    fp.options = opt
    fp.head_vertices = [unreal.Vector(t.x, t.y, t.z) for t in target]
    log("fit options", opt)
    res = sub.fit_state_to_target_vertices(char, fp)
    log("fit", res)
    sub.commit_face_state(char)
    eal.save_loaded_asset(char)
    log("saved")
except Exception:
    log("ERROR", traceback.format_exc())
unreal.SystemLibrary.quit_editor()
