# MPFB2 로 사람 만들기·굽기·내보내기 (docs/design/81). make(spec) → bake(메시에 체형·가림 굽기) → export(glb)
import bpy, os, json
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.exportservice import ExportService
def make(spec):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    st = HumanService.get_default_deserialization_settings()
    st.update({'subdiv_levels':0,'load_clothes':True,'detailed_helpers':False,'scale':0.1,'override_skin_model':'MAKESKIN','override_eyes_model':'MAKESKIN','override_clothes_model':'MAKESKIN'})
    return HumanService.deserialize_from_dict(json.loads(json.dumps(spec)), st)
def bake(b):
    bpy.context.view_layer.objects.active = b
    TargetService.bake_targets(b)
    ExportService.bake_modifiers_remove_helpers(b, bake_masks=True, remove_helpers=True)
def export(out):
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=False, export_animations=False, export_skins=True, export_morph=True, export_image_format='JPEG')
def render(b, out, dist=0.75, dz=-0.12, res=480):
    import math
    sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.samples=16; sc.cycles.device='CPU'; sc.render.resolution_x=res; sc.render.resolution_y=res
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera=cam
    top=max((b.matrix_world@v.co).z for v in b.data.vertices)
    cam.location=(0,-dist,top+dz); cam.rotation_euler=(math.radians(90),0,0); cam.data.lens=60
    l=bpy.data.objects.new('l',bpy.data.lights.new('l','SUN')); l.data.energy=4; l.rotation_euler=(math.radians(60),0,math.radians(20)); sc.collection.objects.link(l)
    sc.world=bpy.data.worlds.new('w'); sc.world.use_nodes=True; sc.world.node_tree.nodes['Background'].inputs[1].default_value=0.6
    sc.render.filepath=out; bpy.ops.render.render(write_still=True)
