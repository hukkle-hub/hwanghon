"""Non-production binding experiment; preserve runtime body and all source files."""
import bpy, bmesh, sys, os, json
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from build_body import char_bones, skin_weights, apply_weights, seg_dist, adjacency
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out=os.path.abspath(sys.argv[sys.argv.index('--')+1]);os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'art/3d/ain_body.glb'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for o in list(bpy.data.objects):
    if o.type=='MESH': bpy.data.objects.remove(o,do_unlink=True)
arm.animation_data.action=None
for t in arm.animation_data.nla_tracks:t.mute=True
for b in arm.pose.bones:b.matrix_basis.identity()
candidate=os.path.abspath(sys.argv[sys.argv.index('--')+2]) if len(sys.argv)>sys.argv.index('--')+2 else os.path.join(ROOT,'art/3d/base/ain_base_candidate.glb')
bpy.ops.import_scene.gltf(filepath=candidate)
body=next(o for o in bpy.data.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=body
bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# glTF duplicates vertices at UV seams. Independent smoothing there tears skin.
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001)
bm.to_mesh(body.data);bm.free();body.data.update()
B=char_bones(arm); names=[n for n in B if not n.endswith('Slot')]
verts=[v.co.copy() for v in body.data.vertices]
faces=[list(p.vertices) for p in body.data.polygons]
W=[]
arm_names={s+n for s in ['Left','Right'] for n in ['Arm','ForeArm','Hand','Shoulder']}
for p in verts:
    nearest=min(names,key=lambda n:seg_dist(p,*B[n]))
    if nearest in arm_names:
        side='Left' if nearest.startswith('Left') else 'Right'
        allowed=[n for n in names if n in arm_names and n.startswith(side)]
    else:allowed=[n for n in names if n not in arm_names]
    ds=sorted((seg_dist(p,*B[n]),n) for n in allowed)[:4]
    ws={n:1/(d**3+1e-6) for d,n in ds};total=sum(ws.values())
    W.append({n:w/total for n,w in ws.items()})
adj=adjacency(len(verts),faces)
for _ in range(8):
    result=[]
    for i,w in enumerate(W):
        acc=dict(w)
        for j in adj[i]:
            for n,v in W[j].items():acc[n]=acc.get(n,0)+v
        top=sorted(acc.items(),key=lambda x:x[1],reverse=True)[:4];total=sum(v for _,v in top)
        result.append({n:v/total for n,v in top})
    W=result
# Preserve rigid skull/hair instead of bleeding shoulder weights into hair tips.
for i,p in enumerate(verts):
    if p.z>1.49:W[i]={'Head':1.0}
apply_weights(body,W)
if '--auto-weights' in sys.argv:
    body.vertex_groups.clear()
    for bone in arm.data.bones:bone.use_deform=not bone.name.endswith('Slot')
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);arm.select_set(True)
    bpy.context.view_layer.objects.active=arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    missing=[v for v in body.data.vertices if not v.groups]
    print('HEAT_UNWEIGHTED',len(missing),'OF',len(body.data.vertices))
    if len(missing)>len(body.data.vertices)*.25:raise RuntimeError('Automatic binding failed on over 25 percent of mesh')
    for v in missing:
        fallback={'Head':1.0} if v.co.z>1.43 else W[v.index]
        for n,w in fallback.items():
            g=body.vertex_groups.get('mixamorig:'+n) or body.vertex_groups.new(name='mixamorig:'+n)
            g.add([v.index],w,'REPLACE')
    # Keep hair fragments on the head and use the same four influences in
    # Blender as in the exported mobile GLB (avoid silent exporter pruning).
    head=body.vertex_groups.get('mixamorig:Head')
    for v in body.data.vertices:
        weighted=sorted([(g.group,g.weight) for g in v.groups],key=lambda x:x[1],reverse=True)[:4]
        if v.co.z>1.43:weighted=[(head.index,1.)]
        for g in list(v.groups):body.vertex_groups[g.group].remove([v.index])
        total=sum(w for _,w in weighted)
        for gi,w in weighted:body.vertex_groups[gi].add([v.index],w/total,'REPLACE')
    for bone in arm.data.bones:bone.use_deform=True
body.name=body.data.name='ain_modular_rig_candidate'
body.parent=arm;body.matrix_parent_inverse=arm.matrix_world.inverted()
mod=next((m for m in body.modifiers if m.type=='ARMATURE'),None)
if mod is None:mod=body.modifiers.new('Ain_existing_skeleton','ARMATURE')
mod.object=arm
orphans=sum(not v.groups for v in body.data.vertices)
assert orphans==0
for t in arm.animation_data.nla_tracks:t.mute=False
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);arm.select_set(True)
dest=os.path.join(out,'ain_modular_rig_candidate.glb')
bpy.ops.export_scene.gltf(filepath=dest,export_format='GLB',use_selection=True,export_animations=True,export_yup=True)
# Render evidence from actual imported animation actions, not invented poses.
for t in arm.animation_data.nla_tracks:t.mute=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.25,.3,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for pos,power in [((2,-3,3),500),((-2,-1,2),400),((0,3,3),600)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=3
    o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.7,-3,1.1));cam=bpy.context.object;scene.camera=cam
cam.data.type='ORTHO';cam.data.ortho_scale=2.1
cam.rotation_euler=(Vector((0,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
evidence=[]
for clip in ['idle','attack1','counter','roll']:
    action=bpy.data.actions.get(clip);arm.animation_data.action=action
    if action.slots:arm.animation_data.action_slot=action.slots[0]
    frame=int(sum(action.frame_range)/2);scene.frame_set(frame)
    deps=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(deps)
    points=[ev.matrix_world@v.co for v in ev.data.vertices]
    bounds=[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]
    evidence.append(dict(clip=clip,frame=frame,bounds=bounds))
    scene.render.filepath=os.path.join(out,clip+'.png');bpy.ops.render.render(write_still=True)
with open(os.path.join(out,'rig_report.json'),'w') as f:json.dump(dict(status='EXPERIMENT_NOT_RUNTIME_APPROVED',method='bone_heat_with_head_pin_and_four_influences' if '--auto-weights' in sys.argv else 'distance_initial',unweighted_vertices=orphans,clips=[a.name for a in bpy.data.actions],evidence=evidence,limitations=['No deformation retopology','No finger bones in existing skeleton','No separate garments yet','Pose landmarks have not been fitted to candidate anatomy']),f,indent=2)
