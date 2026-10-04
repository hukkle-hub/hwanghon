"""Exact template face via a whole-rig DNA (doc 177 §7): the parametric fit kept the eyes MetaHuman-open and softened
the lids (measured), so the head mesh of MH_<name>'s exported DNA is moved onto the wrapped template itself
(DNACalib, lower LODs recalculated) and imported back with import_whole_rig - no fitting.
Template -> DNA order by UVs (as fit_hf.py); UE -> DNA axes picked by the smallest residual; placed on the current
head by centroid + scale; the neck fades to the current shape (the body joins there).
Env MH_NAME. Log whole_rig_log.txt
"""
import glob
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
LOG = "C:/w/mhlab/whole_rig_log.txt"
DNADIR = f"C:/w/mhlab/dna/{NAME}"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eal = unreal.EditorAssetLibrary
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
L = unreal.MHLabDNALibrary
try:
    char = unreal.load_asset(f"/Game/Heroes/MH_{NAME}")
    log("edit", sub.try_add_object_to_edit(char))
    os.makedirs(DNADIR, exist_ok=True)
    dp = unreal.MetaHumanDNAExportParams()
    dp.external_path = DNADIR
    dp.dna_head = True
    dp.dna_body = False
    if not (os.environ.get("MH_DNA_REUSE") == "1" and glob.glob(f"{DNADIR}/**/*_Head.dna", recursive=True)):
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_dna(char, dp)
    dnas = [f for f in glob.glob(f"{DNADIR}/**/*.dna", recursive=True) if "_shaped" not in f]
    log("dna files", dnas)
    src = dnas[0]
    P = L.read_dna_mesh_positions(src, 0)
    P = [(v.x, v.y, v.z) for v in P]
    log("dna head verts", len(P), "first", P[0])

    # template in DNA order (UV correspondence, as fit_hf.py)
    sms = [x for x in eal.list_assets(f"/Game/Template/{NAME}", recursive=True) if isinstance(unreal.load_asset(x), unreal.StaticMesh)]
    sm = unreal.load_asset(sms[0])
    npos, lpos, luv = L.get_archetype_mesh_layout(0)
    md = sm.get_static_mesh_description(0)
    uv2pos = {}
    for i in range(md.get_vertex_instance_count()):
        vi = unreal.VertexInstanceID(i)
        uv = md.get_vertex_instance_uv(vi, 0)
        p = md.get_vertex_position(md.get_vertex_instance_vertex(vi))
        uv2pos[(round(uv.x, 4), round(uv.y, 4))] = (p.x, p.y, p.z)
    T = [None] * npos
    keys = None
    for pidx, uv in zip(lpos, luv):
        if T[pidx] is None:
            k = (round(uv.x, 4), round(uv.y, 4))
            if k not in uv2pos:
                keys = keys or list(uv2pos.keys())
                k = min(keys, key=lambda q: (q[0] - uv.x) ** 2 + (q[1] - uv.y) ** 2)
            T[pidx] = uv2pos[k]
    assert len(T) == len(P), (len(T), len(P))

    def centroid(A):
        n = len(A)
        return [sum(a[j] for a in A) / n for j in range(3)]

    def rms(A, c):
        return (sum(sum((a[j] - c[j]) ** 2 for j in range(3)) for a in A) / len(A)) ** 0.5

    cP, sP = centroid(P), None
    sP = rms(P, cP)
    best = None
    for name, f in (("x,z,-y", lambda t: (t[0], t[2], -t[1])), ("x,-z,y", lambda t: (t[0], -t[2], t[1])),
                    ("x,y,z", lambda t: t), ("-x,z,y", lambda t: (-t[0], t[2], t[1]))):
        A = [f(t) for t in T]
        cA = centroid(A)
        s = sP / rms(A, cA)
        Al = [tuple((a[j] - cA[j]) * s + cP[j] for j in range(3)) for a in A]
        err = sum(sum((a[j] - p[j]) ** 2 for j in range(3)) ** 0.5 for a, p in zip(Al, P)) / len(P)
        log("axes", name, "scale", round(s, 4), "mean err", round(err, 3))
        if best is None or err < best[0]:
            best = (err, name, Al)
            cA_up, s_up = cA[2], s
    err, axes, Al = best
    # up axis of the DNA = the one with the largest spread among P (head height)
    spans = [max(p[j] for p in P) - min(p[j] for p in P) for j in range(3)]
    up = max(range(3), key=lambda j: spans[j] if abs(cP[j]) > 50 else -1)
    crown = max(p[up] for p in P)
    full, zero = crown - 21.5, crown - 26.5
    # the fade must start under the chin (it started above it: the chin kept MetaHuman's length, +22 %)
    cj = os.environ.get("MH_CHIN_JSON")
    if cj and os.path.exists(cj):
        import json as _j
        chin_t = _j.load(open(cj))["chin_z"] * 100.0              # template frame, cm (the static mesh's frame)
        A_ = [f(t) for t in T] if False else None
        chin_al = (chin_t - cA_up) * s_up + cP[up]
        full, zero = chin_al - 1.2, chin_al - 6.0
        log("chin from wrap", round(chin_t, 2), "-> aligned", round(chin_al, 2))
    D = []
    for a, p in zip(Al, P):
        w = min(1.0, max(0.0, (p[up] - zero) / (full - zero)))
        D.append(unreal.Vector((a[0] - p[0]) * w, (a[1] - p[1]) * w, (a[2] - p[2]) * w))
    mags = sorted((d.x ** 2 + d.y ** 2 + d.z ** 2) ** 0.5 for d in D)
    log("picked", axes, "err", round(err, 3), "up axis", up, "crown", round(crown, 2), "delta median", round(mags[len(mags) // 2], 3), "max", round(mags[-1], 3))
    out = src.replace(".dna", "_shaped.dna")
    log("write head", L.add_dna_mesh_deltas(src, out, 0, D, True), out)
    # the other face meshes (teeth, saliva, eyes, eye shells, lacrimal, lashes, cartilage) follow the nearest head
    # vertex, as in the template - left alone they poked through the moved lids and lips (eyes bulged, teeth showed)
    cell = 0.6
    grid = {}
    for k, p in enumerate(P):
        grid.setdefault((int(p[0] // cell), int(p[1] // cell), int(p[2] // cell)), []).append(k)

    def nearest(q):
        cx, cy, cz = int(q[0] // cell), int(q[1] // cell), int(q[2] // cell)
        for r in (1, 2, 4, 8):
            best = None
            for i in range(cx - r, cx + r + 1):
                for j in range(cy - r, cy + r + 1):
                    for k2 in range(cz - r, cz + r + 1):
                        for k in grid.get((i, j, k2), ()):
                            d = (P[k][0] - q[0]) ** 2 + (P[k][1] - q[1]) ** 2 + (P[k][2] - q[2]) ** 2
                            if best is None or d < best[0]:
                                best = (d, k)
            if best:
                return best[1]
        return 0

    cur = out
    EYE_MOVE = []
    for mi in range(1, 9):
        try:
            Q = L.read_dna_mesh_positions(src, mi)
        except Exception as e:  # noqa: BLE001
            log("mesh", mi, "read err", e)
            continue
        if not Q:
            continue
        Dq = [D[nearest((q.x, q.y, q.z))] for q in Q]
        if mi in (3, 4):
            # eyeballs move rigidly with the ring of lid skin around them (in front of the eye centre), so the
            # eyeball keeps its place behind the lids. Their nearest skin is the inner lid surface, which the wrap
            # pulled forward: the eyes stuck out 1.5 mm in front of the lids and read as wide open (measured)
            E = [(q.x, q.y, q.z) for q in Q]
            ec = [sum(e[j] for e in E) / len(E) for j in range(3)]
            er = sorted(((e[0] - ec[0]) ** 2 + (e[1] - ec[1]) ** 2 + (e[2] - ec[2]) ** 2) ** 0.5 for e in E)[len(E) // 2]
            fs = 1.0 if ec[1] > cP[1] else -1.0          # which way the face looks along y
            ring = [k for k, p in enumerate(P) if ((p[0] - ec[0]) ** 2 + (p[2] - ec[2]) ** 2) ** 0.5 < er * 1.1 and (p[1] - ec[1]) * fs > 0]
            mx = sum(D[k].x for k in ring) / len(ring); my = sum(D[k].y for k in ring) / len(ring); mz = sum(D[k].z for k in ring) / len(ring)
            # then the depth: eye front 0.09 cm behind the lid front, as on the MetaHuman archetype (even the ring
            # moved forward with the pulled lids and the eye stayed 1.4 mm proud of them)
            lid_front = sorted((P[k][1] + D[k].y) * fs for k in ring)[int(len(ring) * 0.95)]
            eye_front = max((e[1] + my) * fs for e in E)
            my -= fs * (eye_front - (lid_front - float(os.environ.get("MH_EYE_DEPTH", "0.09"))))
            mz += float(os.environ.get("MH_EYE_DZ", "0"))      # cm; a dark crescent of socket showed under the iris
            Dq = [unreal.Vector(mx, my, mz) for _ in Dq]
            EYE_MOVE.append((ec[0], unreal.Vector(mx, my, mz)))
            log("eye", mi, "ring verts", len(ring), "move", round(mx, 3), round(my, 3), round(mz, 3))
        if mi == 5 and len(EYE_MOVE) == 2:
            # the eye shell (occlusion / wet film wrapped on the eyeball) goes with its eye: left on the lids it sat in
            # front of the eyes pushed back by the depth fix and shaded the lower iris dark (director: «눈 아래 거멓다»)
            Dq = [min(EYE_MOVE, key=lambda em: abs(q.x - em[0]))[1] for q in Q]
            log("eye shell follows the eyes", len(Q))
        nxt = src.replace(".dna", f"_shaped{mi}.dna")
        ok = L.add_dna_mesh_deltas(cur, nxt, mi, Dq, True)
        log("mesh", mi, "verts", len(Q), "moved", ok)
        if ok:
            cur = nxt
    out = cur

    # check: the head written into the DNA must be the aligned template (where the weight is full)
    Wr = L.read_dna_mesh_positions(out, 0)
    errs = sorted(((Wr[k].x - Al[k][0]) ** 2 + (Wr[k].y - Al[k][1]) ** 2 + (Wr[k].z - Al[k][2]) ** 2) ** 0.5
                  for k in range(len(P)) if P[k][up] > full)
    log("check shaped head vs template (cm): median", round(errs[len(errs) // 2], 4), "p95", round(errs[int(len(errs) * 0.95)], 4), "max", round(errs[-1], 4))
    ip = unreal.ImportFromDNAParams()
    ip.import_whole_rig = True
    code = sub.import_from_face_dna(char, out, ip)
    log("import_from_face_dna", code)
    sub.commit_face_state(char)
    eal.save_loaded_asset(char)
    log("saved")
    # and what the character holds after the import: its face state as a mesh (export_geometry), read back by UV
    try:
        gp = unreal.MetaHumanGeometryExportParams()
        gp.project_path = f"/Game/ExportCheck/{NAME}"
        gp.head_skeletal_mesh = True
        gp.body_skeletal_mesh = False
        gp.full_body_skeletal_mesh = False
        gp.overwrite_existing_assets = True
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_geometry(char, gp)
        log("exported check geometry")
    except Exception:
        log("check export failed", traceback.format_exc())
except Exception:
    log("ERROR", traceback.format_exc())
unreal.SystemLibrary.quit_editor()
