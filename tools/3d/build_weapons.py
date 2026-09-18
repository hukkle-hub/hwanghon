# 장비 외형: 무기 6종 절차 생성 (bpy) → art/3d/weapons/<id>.glb
#   python3 tools/3d/build_weapons.py
# 규약(낫과 동일): 원점 = 자루 끝(아래), 자루 방향 = glTF +Y (Blender +Z 로 만들고 Y-up 내보내기). 오른손 그립 = 0.75 m 지점. 1 unit = 1 m
import bpy, sys, math, os
from mathutils import Vector
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art', '3d', 'weapons'); os.makedirs(OUT, exist_ok=True)
TEX=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art', '3d', 'tex')
def mat(name, col, rough=0.6, metal=0.0, emis=None, estr=0, tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    if emis: b.inputs['Emission Color'].default_value=(*emis,1); b.inputs['Emission Strength'].default_value=estr
    if tex:
        img=bpy.data.images.load(os.path.join(TEX, tex+'.png')); ti=nt.nodes.new('ShaderNodeTexImage'); ti.image=img
        mix=nt.nodes.new('ShaderNodeMix'); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'; mix.inputs['Factor'].default_value=1.0
        mix.inputs[6].default_value=(*col,1); nt.links.new(ti.outputs['Color'], mix.inputs[7]); nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    return m
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return { 'steel':mat('steel',(0.85,0.87,0.92),0.35,0.9,tex='steel'), 'rust':mat('rust',(0.62,0.56,0.52),0.8,0.45,tex='rust'), 'dark':mat('dark',(0.10,0.10,0.12),0.6,0.7), 'wood':mat('wood',(0.75,0.62,0.5),0.9,tex='wood'), 'leather':mat('leather',(0.8,0.65,0.5),0.9,tex='leather'), 'brass':mat('brass',(0.62,0.48,0.22),0.4,0.9), 'bone':mat('bone',(0.62,0.57,0.46),0.7), 'ash':mat('ash',(0.30,0.30,0.32),0.5,0.6), 'red':mat('red',(0.45,0.08,0.06),0.6,0.2,(1,0.2,0.1),0.25), 'redcloth':mat('redcloth',(0.7,0.16,0.12),1.0,0.0,tex='cloth'), 'teal':mat('teal',(0.35,0.55,0.55),0.3,0.8) }
parts=[]
def fin(o,m): o.data.materials.append(m); parts.append(o); return o
def cyl(z0,z1,r0,r1,m,verts=10,x=0,y=0,tilt=(0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=abs(z1-z0), location=(x,y,(z0+z1)/2)); o=bpy.context.object; o.rotation_euler=(tilt[0],tilt[1],0); bpy.ops.object.shade_smooth(); return fin(o,m)
def box(c,s,m,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c); o=bpy.context.object; o.scale=s; o.rotation_euler=rot; return fin(o,m)
def blade(z0,z1,w,t,m,curve=0.0,back=False):
    """납작한 날: 아래(z0)에서 위(z1)로 좁아지는 판. curve 로 x 방향 휨"""
    n=8; import bmesh
    me=bpy.data.meshes.new('blade'); bm=bmesh.new(); ring=[]
    for i in range(n+1):
        k=i/n; z=z0+(z1-z0)*k; ww=w*(1-0.85*k*k); tt=t*(1-0.6*k); xo=curve*k*k
        vs=[bm.verts.new((xo-ww, -tt,z)),bm.verts.new((xo+ww,-tt*0.4,z)),bm.verts.new((xo+ww*0.2, tt,z)),bm.verts.new((xo-ww, tt*0.4,z))] if not back else [bm.verts.new((xo-ww,-tt,z)),bm.verts.new((xo+ww,-tt,z)),bm.verts.new((xo+ww,tt,z)),bm.verts.new((xo-ww,tt,z))]
        ring.append(vs)
    for i in range(n):
        a,b=ring[i],ring[i+1]
        for j in range(4): bm.faces.new((a[j],a[(j+1)%4],b[(j+1)%4],b[j]))
    bm.faces.new(ring[0][::-1]); bm.faces.new(ring[-1]); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('blade',me); bpy.context.scene.collection.objects.link(o); bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.shade_smooth(); return fin(o,m)
def export(name):
    global parts
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT')
    for l in o.data.uv_layers.active.data: l.uv=(l.uv[0]*3.0, l.uv[1]*3.0)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'), export_format='GLB', export_apply=True, export_yup=True, export_animations=False, export_materials='EXPORT')
    print('wrote', name, len(o.data.vertices)); parts=[]

# 1. 부식된 사형 집행자 — 두꺼운 녹슨 대낫, 사슬 감은 자루, 이 빠진 넓은 날 (낫처럼 옆으로 뻗어 아래로 휨)
M=reset()
cyl(0,1.72,0.020,0.016,M['wood'],10); cyl(0.55,0.95,0.026,0.026,M['leather'],10)
for i in range(6): cyl(1.10+i*0.06,1.13+i*0.06,0.030,0.030,M['rust'],8)
cyl(1.68,1.80,0.03,0.05,M['rust'],8)                       # 이음쇠
TH=-math.pi/2-0.22; CV=-0.30
blade(1.78,1.84,0.06,0.02,M['rust']); b=blade(0,0.92,0.105,0.012,M['rust'],curve=CV,back=True); b.rotation_euler=(0,TH,0); b.location=(0.02,0,1.80)
for k in (0.32,0.5,0.68,0.84):                              # 이 빠진 자국: 날을 따라
    sx=0.95*k; xo=CV*k*k; box((0.02+math.sin(TH)*sx+math.cos(TH)*xo, 0.0, 1.80+math.cos(TH)*sx-math.sin(TH)*xo-0.02),(0.04,0.03,0.04),M['dark'])
export('w_rust_executioner')
# 2. 메마른 갈대밭 검창 — 긴 손잡이 + 청동 코등이 + 곧고 긴 양날 (청록빛)
M=reset()
cyl(0.42,1.02,0.020,0.018,M['dark'],10); cyl(0.36,0.44,0.03,0.022,M['brass'],8)
for i in range(8): cyl(0.48+i*0.065,0.50+i*0.065,0.023,0.023,M['brass'],8)
box((0,0,1.04),(0.20,0.035,0.045),M['brass']); blade(1.06,2.05,0.04,0.012,M['teal']); cyl(1.06,1.9,0.006,0.004,M['steel'],6,x=0,y=0.011)
export('w_marsh_blade')
# 3. 폐허의 장창 — 긴 자루, 잎 모양 촉, 찢어진 붉은 천
M=reset()
cyl(0,2.05,0.018,0.015,M['wood'],10); cyl(0.60,0.92,0.024,0.024,M['leather'],10); cyl(2.02,2.10,0.03,0.02,M['ash'],8)
blade(2.08,2.45,0.045,0.014,M['steel']); box((0.05,0,1.93),(0.10,0.006,0.24),M['redcloth'],rot=(0.15,0,0.5)); box((-0.06,0,1.88),(0.08,0.006,0.30),M['redcloth'],rot=(-0.1,0,-0.4))
export('w_ruin_spear')
# 4. 녹슨 집행검 — 넓은 한손 검(그립 0.75 중심)
M=reset()
cyl(0.55,0.62,0.028,0.02,M['brass'],8); cyl(0.62,0.88,0.019,0.019,M['leather'],10); box((0,0,0.90),(0.20,0.035,0.04),M['brass']); blade(0.92,1.78,0.07,0.016,M['rust']); cyl(0.95,1.55,0.008,0.006,M['dark'],6,x=0,y=0.012); box((0.05,0,1.20),(0.03,0.02,0.05),M['dark']); box((-0.055,0,1.45),(0.03,0.02,0.04),M['dark'])
export('w_rust_sword')
# 5. 재의 단도 — 왼쪽 허리에 꽂는 단검 (원점 = 칼끝 아래, 길이 0.42)
M=reset()
cyl(0,0.05,0.016,0.012,M['dark'],8); cyl(0.05,0.17,0.012,0.012,M['red'],8); box((0,0,0.18),(0.07,0.025,0.02),M['dark']); blade(0.19,0.44,0.028,0.009,M['ash'])
export('w_ash_dirk')
# 6. 갈고리 낫 — 등에 매는 소형 낫 (길이 0.75)
M=reset()
cyl(0,0.62,0.014,0.012,M['wood'],8); cyl(0.20,0.36,0.017,0.017,M['leather'],8); cyl(0.60,0.66,0.02,0.03,M['steel'],8)
b=blade(0,0.42,0.06,0.009,M['steel'],curve=-0.10,back=True); b.rotation_euler=(0,-math.pi/2+0.5,0); b.location=(0.01,0,0.65)
export('w_hook_scythe')
