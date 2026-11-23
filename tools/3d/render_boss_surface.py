"""Render exported makePoser surfaces, without importing animation through another engine.
blender -b -P render_boss_surface.py -- manifest.json output-dir [--zoom 1] [--yaw 45] [--elev 30]
Clay geometry QA only; never evidence of game materials, AI or camera behavior.
"""
import argparse, array, json, math, os, sys
import bpy
from mathutils import Vector
ap=argparse.ArgumentParser(); ap.add_argument('manifest'); ap.add_argument('output'); ap.add_argument('--zoom',type=float,default=1); ap.add_argument('--yaw',type=float,default=45); ap.add_argument('--elev',type=float,default=30)
args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]); data=json.load(open(args.manifest,encoding='utf8')); directory=os.path.dirname(os.path.abspath(args.manifest)); os.makedirs(args.output,exist_ok=True)
def numbers(file,kind):
    result=array.array(kind)
    with open(os.path.join(directory,file),'rb') as src: result.frombytes(src.read())
    if sys.byteorder!='little': result.byteswap()
    return result
verts=numbers(data['frames'][0]['file'],'f'); ix=numbers(data['indexFile'],'I')
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; scene.render.engine='BLENDER_WORKBENCH'; scene.render.resolution_x=960; scene.render.resolution_y=720; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'; scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True
scene.display.shading.background_type='WORLD'; scene.world=bpy.data.worlds.new('QA World'); scene.world.color=(.12,.15,.18)
mesh=bpy.data.meshes.new('Evaluated surface'); mesh.from_pydata(list(zip(*[iter(verts)]*3)),[],list(zip(*[iter(ix)]*3))); mesh.update()
body=bpy.data.objects.new('Actual evaluated boss surface',mesh); scene.collection.objects.link(body)
mat=bpy.data.materials.new('Diagnostic clay only'); mat.diffuse_color=(.65,.62,.57,1); body.data.materials.append(mat)
for p in mesh.polygons: p.use_smooth=True
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003)); floor=bpy.context.object; fm=bpy.data.materials.new('Floor'); fm.diffuse_color=(.24,.29,.34,1); floor.data.materials.append(fm)
cam=bpy.data.objects.new('QA camera',bpy.data.cameras.new('QA camera')); scene.collection.objects.link(cam); scene.camera=cam; cam.data.lens=45
extent=Vector(data['bounds']['max'])-Vector(data['bounds']['min']); radius=extent.length/2; distance=radius/math.sin(cam.data.angle_y/2)*1.1/args.zoom; yaw=math.radians(args.yaw); elev=math.radians(args.elev)
for i,frame in enumerate(data['frames']):
    target=Vector(((frame['bounds']['min'][0]+frame['bounds']['max'][0])/2,-(frame['bounds']['min'][2]+frame['bounds']['max'][2])/2,(frame['bounds']['min'][1]+frame['bounds']['max'][1])/2))
    cam.location=target+Vector((math.sin(yaw)*distance,-math.cos(yaw)*distance,math.tan(elev)*distance)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    mesh.vertices.foreach_set('co',numbers(frame['file'],'f')); mesh.update(); bpy.context.view_layer.update()
    out=os.path.join(os.path.abspath(args.output),f'pose-{i:03d}.png')
    if os.path.exists(out): raise RuntimeError('Refusing to repeat existing rendered frame: '+out)
    scene.render.filepath=out; bpy.ops.render.render(write_still=True); print('[surface-frame]',i,frame['time'],out,flush=True)
with open(os.path.join(args.output,'render-info.json'),'w',encoding='utf8') as dst: json.dump({'manifest':os.path.abspath(args.manifest),'sourceSha256':data['sha256'],'clip':data['clip'],'frames':len(data['frames']),'zoom':args.zoom,'yaw':args.yaw,'elev':args.elev,'scope':data['method'],'approved':False},dst,indent=2)
