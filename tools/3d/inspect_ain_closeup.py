"""Render actual exported GLB closeups, not concept images."""
import bpy,sys,os
from mathutils import Vector
src,out=[os.path.abspath(p) for p in sys.argv[sys.argv.index('--')+1:]]
os.makedirs(out,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for t in arm.animation_data.nla_tracks:t.mute=True
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24
sc.render.resolution_x=1100;sc.render.resolution_y=1100;sc.render.resolution_percentage=100
sc.world=bpy.data.worlds.new('studio');sc.world.use_nodes=True
sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.25,.3,1)
sc.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for pos,power in [((2,-3,3),500),((-2,-1,2),400),((0,3,3),600)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=3
 o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;sc.camera=cam;cam.data.type='ORTHO'
for name,clip,bone,scale,offset in [('face','idle','Head',.46,(.3,-3,.1)),('shoulder','counter','Spine2',.9,(.6,-3,.4)),('attack','attack1','Spine2',.95,(.6,-3,.4)),('hand','counter','RightHand',.36,(.5,-3,1))]:
 a=bpy.data.actions.get(clip);arm.animation_data.action=a
 if a.slots:arm.animation_data.action_slot=a.slots[0]
 sc.frame_set(int(sum(a.frame_range)/2));bpy.context.view_layer.update()
 target=arm.matrix_world@arm.pose.bones['mixamorig:'+bone].head
 cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
 sc.render.filepath=os.path.join(out,name+'.png');bpy.ops.render.render(write_still=True)
