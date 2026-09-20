"""Sample every exported clip for extreme edge stretching; does not certify anatomy."""
import bpy,sys,os,json,numpy as np
src,out=[os.path.abspath(p) for p in sys.argv[sys.argv.index('--')+1:]]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
a=next(o for o in bpy.data.objects if o.type=='ARMATURE');m=next(o for o in bpy.data.objects if o.type=='MESH')
for t in a.animation_data.nla_tracks:t.mute=True
edges=np.array([tuple(e.vertices) for e in m.data.edges]);base=np.array([tuple(v.co) for v in m.data.vertices])
length=np.linalg.norm(base[edges[:,0]]-base[edges[:,1]],axis=1);use=length>.001
results=[]
for action in bpy.data.actions:
 a.animation_data.action=action
 if action.slots:a.animation_data.action_slot=action.slots[0]
 for frame in np.linspace(*action.frame_range,5):
  bpy.context.scene.frame_set(int(frame));dg=bpy.context.evaluated_depsgraph_get();ev=m.evaluated_get(dg)
  p=np.array([tuple(v.co) for v in ev.data.vertices]);ratio=np.linalg.norm(p[edges[:,0]]-p[edges[:,1]],axis=1)[use]/length[use]
  results.append(dict(clip=action.name,frame=int(frame),p99=float(np.percentile(ratio,99)),max=float(ratio.max()),edges_over_3=int((ratio>3).sum())))
with open(out,'w') as f:json.dump(dict(source=src,samples=results,worst=max(results,key=lambda r:r['max']),note='Edge strain screening only; no collision or anatomical certification'),f,indent=2)
