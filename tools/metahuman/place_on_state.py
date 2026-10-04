"""Move a mesh made in the template frame (fit_hair.py output) into the built character's frame (doc 177 §9):
the whole-rig face sits where the fitted state was (scaled/shifted from the template) - measure that similarity
between the wrapped template's skin and the exported state's skin (same topology and vertex order), apply it.

blender -b -P tools/metahuman/place_on_state.py -- template.fbx state.fbx in.glb out.fbx
"""
import os
import sys

import bpy
import numpy as np

a = sys.argv[sys.argv.index("--") + 1:]
TPL, STATE, IN, OUT = a[:4]
BODY = a[4] if len(a) > 4 else None     # the built body (export_geo MH_BODY=1): hair pushed out of it
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def load_fbx(p):
    before = set(sc.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(p))
    m = next(o for o in set(sc.objects) - before if o.type == "MESH")
    bpy.ops.object.select_all(action="DESELECT")
    m.select_set(True)
    bpy.context.view_layer.objects.active = m
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    head = {k for k, mt in enumerate(m.data.materials) if mt and "Head" in mt.name}
    idx = sorted({v for f in m.data.polygons if f.material_index in head for v in f.vertices})
    P = np.array([m.data.vertices[i].co[:] for i in idx])
    for o in set(sc.objects) - before:
        bpy.data.objects.remove(o, do_unlink=True)
    return P


A, B = load_fbx(TPL), load_fbx(STATE)


def slab_w(P, z):
    q = P[np.abs(P[:, 2] - z) < 0.008]
    return q[:, 0].max() - q[:, 0].min()


def nose_y(P, crown):
    q = P[(np.abs(P[:, 2] - (crown - 0.11)) < 0.01) & (np.abs(P[:, 0]) < 0.02)]
    return q[:, 1].min()


# vertex order differs between the two exports: place by landmarks of the shape - crown, forehead width, nose depth
cA, cB = A[:, 2].max(), B[:, 2].max()
s = slab_w(B, cB - 0.05) / slab_w(A, cA - 0.05)
xA = (A[:, 0].max() + A[:, 0].min()) / 2
xB = (B[:, 0].max() + B[:, 0].min()) / 2
ca = np.array([xA, nose_y(A, cA), cA])
cb = np.array([xB, nose_y(B, cB), cB])
print("PLACE scale", round(s, 4), "crown", round(cA, 4), "->", round(cB, 4), "nose y", round(ca[1], 4), "->", round(cb[1], 4))
bpy.ops.import_scene.gltf(filepath=os.path.abspath(IN))
# extra meshes made in the same template frame (fit_brows.py brows): moved the same way. EXTRA_GLB=a.glb,b.glb
for ex in [x for x in os.environ.get("EXTRA_GLB", "").split(",") if x]:
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(ex))
for o in sc.objects:
    if o.type == "MESH":
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        V = np.array([v.co[:] for v in o.data.vertices])
        o.data.vertices.foreach_set("co", ((V - ca) * s + cb).ravel())
        o.data.update()
# body collision: hair that the face-landmark warp left inside the shoulders/chest/back is pushed 8 mm outside,
# and the push spreads along the hair surface (max-smoothing) so strands bend instead of tearing
if BODY:
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    before = set(sc.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(BODY))
    body = next(o for o in set(sc.objects) - before if o.type == "MESH")
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    for o in [x for x in sc.objects if x.type == "MESH" and x is not body]:
        me_ = o.data
        V = np.array([v.co[:] for v in me_.vertices])
        D = np.zeros_like(V)
        for k in range(len(V)):
            loc, nrm, _i, d = bvh.find_nearest(Vector(V[k]))
            if loc is None or d > 0.08:
                continue
            gap = (Vector(V[k]) - loc).dot(nrm)
            if gap < 0.008:
                D[k] = np.array(nrm) * (0.008 - gap)
        E = np.array([e.vertices[:] for e in me_.edges])
        need = np.linalg.norm(D, axis=1)
        print("PLACE body: inside", int((need > 0).sum()), "of", len(V), "max push mm", round(1000 * need.max(), 1))
        for _ in range(25):
            acc = np.zeros_like(D)
            cnt = np.zeros(len(V))
            np.add.at(acc, E[:, 0], D[E[:, 1]])
            np.add.at(acc, E[:, 1], D[E[:, 0]])
            np.add.at(cnt, E[:, 0], 1)
            np.add.at(cnt, E[:, 1], 1)
            avg = acc / np.maximum(cnt, 1)[:, None]
            m = np.linalg.norm(avg, axis=1) > np.linalg.norm(D, axis=1)
            D[m] = 0.6 * avg[m] + 0.4 * D[m]
        me_.vertices.foreach_set("co", (V + D).ravel())
        me_.update()
    bpy.data.objects.remove(body, do_unlink=True)
# HAIR_BELOW=d: keep only the hair mesh below crown-d (m) - the long tail under a shorter groom (Sera: the MetaHuman
# long straight groom ends at the chest, the design hair reaches the hips)
if os.environ.get("HAIR_BELOW"):
    import bmesh as _bm
    cut = cb[2] - float(os.environ["HAIR_BELOW"])
    for o in [x for x in sc.objects if x.type == "MESH"]:
        b_ = _bm.new()
        b_.from_mesh(o.data)
        _bm.ops.delete(b_, geom=[f for f in b_.faces if f.calc_center_median().z > cut], context="FACES")
        _bm.ops.delete(b_, geom=[v for v in b_.verts if not v.link_faces], context="VERTS")
        b_.to_mesh(o.data)
        b_.free()
        print("PLACE hair below", round(cut, 3), "verts", len(o.data.vertices))
# hair cap: the built head's scalp above the hairline, 1.5 mm out, its own dark material - gaps between the hair
# clumps showed the pale MetaHuman scalp (a light spot on Ain's crown). HAIR_CAP=1
if os.environ.get("HAIR_CAP") == "1":
    import bmesh
    before = set(sc.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(STATE))
    st_ = next(o for o in set(sc.objects) - before if o.type == "MESH")
    for o in set(sc.objects) - before:
        if o is not st_:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    st_.select_set(True)
    bpy.context.view_layer.objects.active = st_
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # the FBX importer's armature scale did not always reach the mesh data (cm values showed up): bake the world
    # matrix into the vertices
    from mathutils import Matrix
    mw_ = st_.matrix_world.copy()
    for p_ in [st_.parent] if st_.parent else []:
        pass
    st_.data.transform(mw_)
    st_.matrix_world = Matrix.Identity(4)
    if max(v.co.z for v in st_.data.vertices) > 10.0:      # a second FBX import in one session came in at x100 (cm)
        st_.data.transform(Matrix.Scale(0.01, 4))
    head_m = {k for k, mt in enumerate(st_.data.materials) if mt and "Head" in mt.name}
    bm = bmesh.new()
    bm.from_mesh(st_.data)
    top_ = max(v.co.z for v in bm.verts)
    ny = cb[1]
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        front = c.y < ny + 0.075           # the face side of the head
        if f.material_index not in head_m or c.z < top_ - (0.065 if front else 0.13):
            kill.append(f)
    print("PLACE cap faces", len(bm.faces), "kill", len(kill), "top", round(top_, 3), "ny", round(float(ny), 3), "head mats", head_m)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * 0.0015
    bm.to_mesh(st_.data)
    bm.free()
    st_.data.materials.clear()
    cap_m = bpy.data.materials.new("HairCap")
    cap_m.diffuse_color = (0.01, 0.01, 0.012, 1)
    st_.data.materials.append(cap_m)
    st_.name = "HairCap"
    print("PLACE hair cap verts", len(st_.data.vertices))
# the texture as its own PNG: the FBX's embedded texture does not survive the UE import (the hair came in green-grey)
def base_color_image():
    for o_ in sc.objects:
        for sl in getattr(o_, "material_slots", []):
            if not (sl.material and sl.material.use_nodes):
                continue
            for nd in sl.material.node_tree.nodes:
                if nd.type == "BSDF_PRINCIPLED" and nd.inputs["Base Color"].is_linked:
                    src_ = nd.inputs["Base Color"].links[0].from_node
                    while src_.type != "TEX_IMAGE" and src_.inputs and any(i.is_linked for i in src_.inputs):
                        src_ = next(i for i in src_.inputs if i.is_linked).links[0].from_node
                    if src_.type == "TEX_IMAGE":
                        return src_.image
    return None


# the base colour map of each mesh (the first image in the file was the metal/rough map: the hair came out orange):
# the biggest mesh (the hair) -> <out>_albedo.png, others -> <out>_<name>_albedo.png
def base_color_image_of(o_):
    for sl in o_.material_slots:
        if not (sl.material and sl.material.use_nodes):
            continue
        for nd in sl.material.node_tree.nodes:
            if nd.type == "BSDF_PRINCIPLED" and nd.inputs["Base Color"].is_linked:
                src_ = nd.inputs["Base Color"].links[0].from_node
                while src_.type != "TEX_IMAGE" and src_.inputs and any(i.is_linked for i in src_.inputs):
                    src_ = next(i for i in src_.inputs if i.is_linked).links[0].from_node
                if src_.type == "TEX_IMAGE":
                    return src_.image
    return None


meshes_ = sorted([o for o in sc.objects if o.type == "MESH" and o.name != "HairCap"],
                 key=lambda o: (o.name.lower().startswith("brows"), -len(o.data.vertices)))    # the hair first, extras after
for k_, o_ in enumerate(meshes_):
    im_ = base_color_image_of(o_)
    if im_ is None or im_.size[0] == 0:
        continue
    base_ = os.path.splitext(os.path.abspath(OUT))[0]
    im_.filepath_raw = base_ + ("_albedo.png" if k_ == 0 else f"_{o_.name.split('.')[0].lower()}_albedo.png")
    im_.file_format = "PNG"
    im_.save()
    print("PLACE albedo", o_.name, im_.filepath_raw, im_.size[:])
    # dark hair: the parting painted in the Hi3D texture read as a light spot - pulled down (the hair only)
    if k_ == 0 and os.environ.get("HAIR_DARKEN") == "1":
        arr = np.array(im_.pixels[:]).reshape(-1, 4)
        L = 0.2126 * arr[:, 0] + 0.7152 * arr[:, 1] + 0.0722 * arr[:, 2]
        hi = L > 0.18
        arr[hi, :3] *= (0.18 / np.maximum(L[hi], 1e-4))[:, None]
        im_.pixels = arr.ravel()
        im_.save()
        print("PLACE darkened px", int(hi.sum()))
# FBX with the template's axes: the same round trip the face template took (UE -> Blender -> UE)
bpy.ops.export_scene.fbx(filepath=os.path.abspath(OUT), use_selection=False, object_types={"MESH"}, apply_unit_scale=True,
                         axis_forward="-Y", axis_up="Z", mesh_smooth_type="FACE", path_mode="COPY", embed_textures=True)
print("PLACE out", OUT)
