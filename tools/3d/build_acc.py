# 장신구 3종 절차 생성 (bpy) → art/3d/gear/acc_*.glb. 원점 = 조각 중심, glTF Y-up. 반지: 손가락 축 = Y(뼈 방향). 목걸이: 줄 고리 축 = Y, 부적이 -Y(아래)
#   python3 tools/3d/build_acc.py
import bpy, math, os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','art','3d','gear'); os.makedirs(OUT,exist_ok=True)
TEX=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','art','3d','tex')
def mat(name,col,rough=0.5,metal=0.0,emis=None,estr=0,tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    if emis: b.inputs['Emission Color'].default_value=(*emis,1); b.inputs['Emission Strength'].default_value=estr
    if tex:
        img=bpy.data.images.load(os.path.join(TEX,tex+'.png')); ti=nt.nodes.new('ShaderNodeTexImage'); ti.image=img; mix=nt.nodes.new('ShaderNodeMix'); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'; mix.inputs['Factor'].default_value=0.6
        mix.inputs[6].default_value=(*col,1); nt.links.new(ti.outputs['Color'],mix.inputs[7]); nt.links.new(mix.outputs[2],b.inputs['Base Color'])
    return m
parts=[]
def fin(o,m): o.data.materials.append(m); bpy.ops.object.shade_smooth(); parts.append(o); return o
def torus(R,r,m,loc=(0,0,0),rot=(0,0,0),seg=32,ring=12): bpy.ops.mesh.primitive_torus_add(major_radius=R,minor_radius=r,major_segments=seg,minor_segments=ring,location=loc,rotation=rot); return fin(bpy.context.object,m)
def sphere(r,m,loc=(0,0,0),scale=(1,1,1)): bpy.ops.mesh.primitive_uv_sphere_add(radius=r,location=loc,segments=24,ring_count=12); o=bpy.context.object; o.scale=scale; return fin(o,m)
def cyl(r0,r1,h,m,loc=(0,0,0),rot=(0,0,0),v=20): bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r0,radius2=r1,depth=h,location=loc,rotation=rot); return fin(bpy.context.object,m)
def export(name):
    global parts
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=0.02,scale_to_bounds=True); bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',export_apply=True,export_yup=True,export_animations=False)
    print('wrote',name,len(o.data.vertices)); parts=[]
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return { 'gold':mat('gold',(0.55,0.42,0.16),0.35,1.0), 'red':mat('red',(0.55,0.06,0.05),0.3,0.1,(1,0.15,0.1),0.6), 'copper':mat('copper',(0.62,0.34,0.18),0.55,1.0,tex='rust'), 'leather':mat('leather',(0.5,0.34,0.22),0.9,0.0,tex='leather'), 'brass':mat('brass',(0.62,0.48,0.22),0.4,0.9), 'thread':mat('thread',(0.5,0.08,0.08),0.9,0.0) }
# 1. 핏빛 인장 반지: 손가락 축 = Blender Z(→glTF Y). 반지 안지름 9 mm, 인장면은 +Y(Blender) 쪽(손등 = 뼈 -z... looks.js 회전으로 맞춤)
M=reset()
torus(0.0095,0.0018,M['gold'],rot=(0,0,0))
cyl(0.0055,0.0055,0.0025,M['gold'],loc=(0,0.0105,0),rot=(math.pi/2,0,0),v=24)          # 인장 받침(타원 대신 원)
cyl(0.0042,0.0042,0.0012,M['red'],loc=(0,0.0122,0),rot=(math.pi/2,0,0),v=24)            # 붉은 인장면
export('acc_blood_ring')
# 2. 부적 목걸이: 줄 고리(원환) + 가죽 주머니 + 붉은 실 + 청동 방울. 줄 축 = Z(목 뼈 방향)
M=reset()
torus(0.075,0.0015,M['leather'],rot=(-0.35,0,0),seg=40,ring=6)                            # 목줄(앞으로 기울임)
sphere(0.014,M['leather'],loc=(0,-0.075,-0.075),scale=(1,0.6,1.4))                        # 주머니(앞 아래)
torus(0.0125,0.0015,M['thread'],loc=(0,-0.075,-0.064),rot=(math.pi/2,0,0),seg=24,ring=6)  # 붉은 실
sphere(0.005,M['brass'],loc=(0,-0.078,-0.098))                                            # 방울
export('acc_charm')
# 3. 구리 밴드
M=reset()
torus(0.0095,0.0022,M['copper'],seg=32,ring=10)
export('acc_band')
