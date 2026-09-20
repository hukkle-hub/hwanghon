# 갈아입을 방어구 세트 (bpy) → art/3d/gear/a_<set>_<부위>.glb
#   python3 tools/3d/build_armor.py
#
# 규약 (기존 Hi3D 조각과 같게 맞춘다 — looks.js ARMOR 의 오프셋을 그대로 쓰려면 필수):
#   · 원점 = 조각의 «중심». 붙는 위치는 looks.js 가 정한다
#   · glTF Y-up 으로 내보낸다 (Blender 는 Z-up 이므로 여기서는 Z 가 «위»)
#   · 크기는 기존 조각의 경계 상자에 맞춘다:
#       후드 0.506×0.360×0.287 · 흉갑 0.368×0.550×0.263 · 각반 0.141×0.319×0.156
#       장화 0.135×0.496×0.251 · 건틀릿 0.115×0.360×0.117   (x×y×z, glTF 기준)
#   · 한쪽만 만들고 거울로 쓰는 장갑과 달리, 다리는 L/R 을 따로 낸다(발 방향이 다르다)
#
# 기존 조각은 Hi3D 로 뽑아 3.5만~9만 정점이다. 여기 것은 절차 생성이라 2~4천 정점으로,
# 안드로이드에서 한 벌을 통째로 입어도 부담이 없다.
import bpy, bmesh, math, os
from mathutils import Vector

HERE=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(HERE,'..','..','art','3d','gear'); os.makedirs(OUT,exist_ok=True)
TEX=os.path.join(HERE,'..','..','art','3d','tex')

def mat(name,col,rough=0.6,metal=0.0,emis=None,estr=0,tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    if emis: b.inputs['Emission Color'].default_value=(*emis,1); b.inputs['Emission Strength'].default_value=estr
    if tex:
        img=bpy.data.images.load(os.path.join(TEX,tex+'.png'))
        ti=nt.nodes.new('ShaderNodeTexImage'); ti.image=img
        mix=nt.nodes.new('ShaderNodeMix'); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'
        mix.inputs['Factor'].default_value=0.75; mix.inputs[6].default_value=(*col,1)
        nt.links.new(ti.outputs['Color'],mix.inputs[7]); nt.links.new(mix.outputs[2],b.inputs['Base Color'])
    return m

parts=[]
def fin(o,m,smooth=True):
    o.data.materials.append(m)
    if smooth:
        bpy.context.view_layer.objects.active=o; bpy.ops.object.shade_smooth()
    parts.append(o); return o

def solid(o,th):
    """두께를 준다 — 껍질이 종이처럼 얇으면 옆에서 사라진다"""
    bpy.context.view_layer.objects.active=o
    md=o.modifiers.new('sol','SOLIDIFY'); md.thickness=th; md.offset=0
    bpy.ops.object.modifier_apply(modifier=md.name); return o

def bevel(o,w=0.004,seg=2):
    bpy.context.view_layer.objects.active=o
    md=o.modifiers.new('bev','BEVEL'); md.width=w; md.segments=seg; md.limit_method='ANGLE'; md.angle_limit=0.6
    bpy.ops.object.modifier_apply(modifier=md.name); return o

def tube(z0,z1,prof,m,seg=20,rings=6,th=0.008,sx=1.0,sy=1.0,cx=0.0,cy=0.0,
         open_top=True,open_bot=True,a0=0.0,a1=2*math.pi):
    """prof(k)->반지름. k=0 아래, 1 위. 열린 관 + 두께 = 갑옷 껍질.
       a0~a1 로 각도를 자르면 «팔구멍이 뚫린» 몸통판이 된다"""
    me=bpy.data.meshes.new('tube'); bm=bmesh.new(); rows=[]
    full=abs(a1-a0)>=2*math.pi-1e-6
    cols=seg if full else seg+1
    for j in range(rings+1):
        k=j/rings; z=z0+(z1-z0)*k; r=prof(k); row=[]
        for i in range(cols):
            a=a0+(a1-a0)*(i/seg)
            row.append(bm.verts.new((cx+math.cos(a)*r*sx, cy+math.sin(a)*r*sy, z)))
        rows.append(row)
    for j in range(rings):
        for i in range(cols if full else cols-1):
            i2=(i+1)%cols
            bm.faces.new((rows[j][i],rows[j][i2],rows[j+1][i2],rows[j+1][i]))
    if not open_bot: bm.faces.new(rows[0][::-1])
    if not open_top: bm.faces.new(rows[-1])
    bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('tube',me); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o
    if th: solid(o,th)
    return fin(o,m)

def dome(r,m,loc=(0,0,0),scale=(1,1,1),cut=0.0,th=0.008,seg=24,ring=10,
         a0=0.0,a1=2*math.pi):
    """반구 껍질. a0~a1 로 각도를 잘라 «앞이 트인» 모자를 만든다 —
       닫힌 공을 씌우면 얼굴이 통째로 사라진다(첫 판이 그랬다)"""
    me=bpy.data.meshes.new('dome'); bm=bmesh.new(); rows=[]
    n=ring; full=abs(a1-a0)>=2*math.pi-1e-6; ns=seg if full else seg
    for j in range(n+1):
        t=cut+(1.0-cut)*(j/n); ph=math.acos(max(-1,min(1,1-2*t*0.5)))  # 위쪽 반구
        zz=math.cos(ph)*r; rr=math.sin(ph)*r; row=[]
        for i in range(ns+(0 if full else 1)):
            a=a0+(a1-a0)*(i/ns if not full else i/ns)
            row.append(bm.verts.new((math.cos(a)*rr,math.sin(a)*rr,zz)))
        rows.append(row)
    cols=len(rows[0])
    for j in range(n):
        for i in range(cols if full else cols-1):
            i2=(i+1)%cols
            bm.faces.new((rows[j][i],rows[j][i2],rows[j+1][i2],rows[j+1][i]))
    bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('dome',me); bpy.context.collection.objects.link(o)
    o.location=loc; o.scale=scale
    bpy.context.view_layer.objects.active=o
    if th: solid(o,th)
    return fin(o,m)

def box(c,s,m,rot=(0,0,0),bev=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c); o=bpy.context.object
    o.scale=s; o.rotation_euler=rot
    bpy.ops.object.transform_apply(scale=True,rotation=True)
    if bev: bevel(o,bev)
    return fin(o,m,smooth=False)

def plate(z0,z1,rad,m,a0,a1,th=0.010,seg=10,rings=4,sx=1.0,sy=1.0,prof=None):
    """몸을 따라 휘는 판. 납작한 상자를 붙이면 가슴에 «간판» 을 단 것처럼 보인다 —
       세 번째 판에서 가장 크게 달라진 곳이다."""
    f=prof or (lambda k:1.0)
    return tube(z0,z1,lambda k:rad*f(k),m,seg=seg,rings=rings,th=th,sx=sx,sy=sy,a0=a0,a1=a1)

def torus(R,r,m,loc=(0,0,0),rot=(0,0,0),seg=24,ring=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R,minor_radius=r,major_segments=seg,
        minor_segments=ring,location=loc,rotation=rot)
    return fin(bpy.context.object,m)

def cyl(r0,r1,h,m,loc=(0,0,0),rot=(0,0,0),v=16):
    bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r0,radius2=r1,depth=h,location=loc,rotation=rot)
    return fin(bpy.context.object,m)

def sphere(r,m,loc=(0,0,0),scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r,location=loc,segments=20,ring_count=10)
    o=bpy.context.object; o.scale=scale; return fin(o,m)

def export(name,mirror=False):
    """조각을 합치고, 중심을 원점으로 옮기고, UV 를 펴서 내보낸다"""
    global parts
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1: bpy.ops.object.join()
    o=bpy.context.object; o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if mirror:
        o.scale=(-1,1,1); bpy.ops.object.transform_apply(scale=True)
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    # 중심을 원점으로 — 기존 조각의 규약
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS')
    o.location=(0,0,0); bpy.ops.object.transform_apply(location=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=0.02,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',
        export_apply=True,export_yup=True,export_animations=False)
    d=o.dimensions
    print('wrote %-22s %5d 정점  %.3f×%.3f×%.3f (Blender xyz)'%(name,len(o.data.vertices),d.x,d.y,d.z))
    parts=[]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return {
      'rubber':  mat('rubber',(0.11,0.12,0.13),0.75,0.05),
      'canvas':  mat('canvas',(0.33,0.31,0.26),0.95,0.0,tex='cloth'),
      'brass':   mat('brass',(0.62,0.48,0.22),0.38,0.9),
      'copper':  mat('copper',(0.60,0.33,0.17),0.45,0.9,tex='rust'),
      'steel':   mat('steel',(0.72,0.75,0.80),0.35,0.9,tex='steel'),
      'leather': mat('leather',(0.34,0.24,0.17),0.9,0.0,tex='leather'),
      'glass':   mat('glass',(0.55,0.62,0.58),0.15,0.2),
      'insul':   mat('insul',(0.55,0.46,0.14),0.6,0.0,tex='cloth'),
      'lamp':    mat('lamp',(0.9,0.75,0.35),0.3,0.0,(1.0,0.82,0.35),1.4),
    }

# ════════════════════════════════════════════════════════════════════
# 몸 치수 (art/3d/ain_anim.glb 실측 — 추측하지 않는다. tools/3d/README 참고)
#   머리    폭 0.240 깊이 0.234 높이 0.192 · 뼈 y 1.520 · 기하 중심 y 1.584 z 0.022
#   몸통    폭 0.304 깊이 0.258 (Spine1) · 어깨 y≈1.42 · 골반 y 0.979
#   정강이  수평 반지름 ≈0.054 (LeftLeg 중앙값)
#   팔뚝    수평 반지름 ≈0.060 (LeftForeArm 중앙값)
#   발      폭 0.095 깊이 0.125
# 첫 판은 «기존 조각의 경계 상자» 에 맞췄다가 통째로 부풀었다 — 기존 흉갑의 0.55m 는
# 늘어진 치맛자락까지 포함한 값이라, 닫힌 관으로 그 상자를 채우면 몸통이 드럼통이 된다.
# ════════════════════════════════════════════════════════════════════
HEAD_R  = 0.128    # 머리 반지름 + 두께 여유
TORSO_W = 0.156    # 몸통 반폭
TORSO_D = 0.136    # 몸통 반깊이
SHIN_R  = 0.062    # 정강이 + 여유
ARM_R   = 0.066    # 팔뚝 + 여유

# ════════════════════════════════════════════════════════════════════
# 세트 1 · 하수 정비복  (던전 03 하수 처리장)
# 두 번째 판의 교훈: 닫힌 원통은 «드럼통» 이 된다. 반드시
#   · 얼굴이 보이게 (모자는 눈높이 위만)
#   · 팔이 보이게 (몸통판은 앞뒤 두 쪽, 옆은 트인다)
#   · 값 대비를 준다 (어두운 고무 + 밝은 놋쇠). 회색 일색이면 형태가 안 읽힌다
# ════════════════════════════════════════════════════════════════════
FR=math.pi*1.5    # 앞 방향(Blender -y) = 각도 3π/2

# 1-1 방독 두건 — 눈높이 위를 덮는 모자 + 볼 가리개 + 여과통. 얼굴은 열어 둔다
M=reset()
dome(HEAD_R,M['rubber'],scale=(1.0,1.00,0.66),th=0.010)                  # 정수리 덮개
tube(-0.052,0.006,lambda k:HEAD_R*(1.00-0.02*k),M['rubber'],seg=22,rings=3,th=0.010,
     sy=0.94,a0=FR+0.62,a1=FR+2*math.pi-0.62)                            # 뒤통수 (앞은 트임)
torus(HEAD_R*1.00,0.011,M['leather'],loc=(0,0,0.004),seg=26,ring=7)      # 이마 띠
box((0,-HEAD_R*0.86,0.020),(0.118,0.044,0.016),M['brass'],rot=(0.30,0,0))# 앞 차양
for sx in (-1,1):                                                        # 볼 가리개
    box((sx*HEAD_R*0.80,-0.030,-0.036),(0.014,0.062,0.060),M['rubber'],rot=(0,0,sx*0.18))
cyl(0.024,0.024,0.038,M['brass'],loc=(0,-0.052,-0.062),rot=(math.pi/2,0,0),v=18)  # 여과통(턱 앞)
torus(0.025,0.007,M['copper'],loc=(0,-0.032,-0.062),rot=(math.pi/2,0,0),seg=18,ring=6)
export('a_drain_hood')

# 1-2 방수 작업복 — 앞판·뒤판 두 쪽. 옆이 트여 팔이 산다
M=reset()
def coat(k):     # k=0 밑단 … 1 어깨. 허리에서 잘록하게
    return 0.97-0.16*max(0.0,(k-0.28))*1.4+0.22*max(0.0,k-0.72)*3.0
for a0,a1 in ((FR-1.16,FR+1.16),(FR+math.pi-1.16,FR+math.pi+1.16)):      # 앞판·뒤판
    tube(-0.200,0.176,coat,M['canvas'],seg=13,rings=8,th=0.011,sx=TORSO_W,sy=TORSO_D,a0=a0,a1=a1)
for sx in (-1,1):                                                        # 어깨 패드(어깨 위에 얹는다)
    box((sx*0.118,0,0.176),(0.078,0.106,0.024),M['rubber'],rot=(0,sx*0.26,0))
    box((sx*0.122,0,0.152),(0.066,0.092,0.012),M['brass'],rot=(0,sx*0.26,0))
torus(TORSO_W*0.90,0.012,M['leather'],loc=(0,0,-0.128),seg=26,ring=7)    # 허리띠
box((0,-TORSO_D*0.94,-0.128),(0.054,0.022,0.038),M['brass'])             # 허리 물림쇠
for z in (0.104,0.036,-0.032):                                           # 앞섶 잠금쇠
    box((0,-TORSO_D*0.99,z),(0.038,0.018,0.022),M['brass'])
box((0,-TORSO_D*1.00,0.036),(0.014,0.016,0.150),M['leather'])            # 앞섶 선
export('a_drain_coat')

# 1-3 고무 각반
for side,nm in ((1,'a_drain_legs_R'),(-1,'a_drain_legs_L')):
    M=reset()
    tube(-0.140,0.140,lambda k:SHIN_R-0.008*k,M['rubber'],seg=18,rings=6,th=0.009)
    torus(SHIN_R,0.008,M['brass'],loc=(0,0,0.118),seg=20,ring=6)
    torus(SHIN_R-0.008,0.008,M['brass'],loc=(0,0,-0.118),seg=20,ring=6)
    plate(-0.052,0.084,1.0,M['leather'],FR-0.72,FR+0.72,th=0.011,seg=8,rings=3,
          sx=SHIN_R*1.07,sy=SHIN_R*1.07)
    export(nm, mirror=(side<0))

# 1-4 정비 장갑
M=reset()
tube(-0.150,0.110,lambda k:ARM_R-0.008+0.006*(1-k),M['canvas'],seg=18,rings=6,th=0.008)
torus(ARM_R-0.006,0.009,M['leather'],loc=(0,0,0.090),seg=20,ring=6)
torus(ARM_R-0.014,0.009,M['brass'],loc=(0,0,-0.122),seg=20,ring=6)
plate(-0.092,-0.020,1.0,M['rubber'],FR-0.78,FR+0.78,th=0.010,seg=8,rings=2,
      sx=ARM_R*1.06,sy=ARM_R*1.06)
for x in (-0.013,0.013):
    box((x,-ARM_R*0.90,-0.030),(0.010,0.008,0.026),M['brass'])
export('a_drain_gloves')

# 1-5 방수 장화
for side,nm in ((1,'a_drain_boots_R'),(-1,'a_drain_boots_L')):
    M=reset()
    tube(-0.135,0.200,lambda k:SHIN_R+0.002+0.012*k,M['rubber'],seg=18,rings=7,th=0.010)
    torus(SHIN_R+0.016,0.010,M['leather'],loc=(0,0,0.182),seg=20,ring=6)
    box((0,-0.044,-0.166),(0.090,0.146,0.058),M['rubber'])
    box((0,-0.096,-0.190),(0.078,0.050,0.020),M['brass'])
    box((0,0.022,-0.194),(0.078,0.046,0.018),M['leather'])
    export(nm, mirror=(side<0))

# ════════════════════════════════════════════════════════════════════
# 세트 2 · 절연 방호구  (던전 04 3경구 변전소)
# ════════════════════════════════════════════════════════════════════

# 2-1 절연 두건 — 차양 + 귀덮개 + 표시등. 얼굴은 열어 둔다
M=reset()
dome(HEAD_R,M['insul'],scale=(1.0,1.00,0.68),th=0.011)
tube(-0.048,0.006,lambda k:HEAD_R,M['insul'],seg=22,rings=3,th=0.011,sy=0.94,
     a0=FR+0.70,a1=FR+2*math.pi-0.70)
torus(HEAD_R*1.00,0.013,M['rubber'],loc=(0,0,0.004),seg=26,ring=7)       # 테
box((0,-HEAD_R*0.96,0.014),(0.138,0.072,0.013),M['rubber'],rot=(0.26,0,0))  # 차양
for sx in (-1,1):
    box((sx*HEAD_R*0.86,-0.010,-0.032),(0.016,0.060,0.062),M['insul'])   # 귀덮개
    cyl(0.011,0.011,0.014,M['copper'],loc=(sx*(HEAD_R+0.006),-0.010,-0.032),rot=(0,math.pi/2,0),v=12)
cyl(0.008,0.008,0.026,M['copper'],loc=(0,0.086,0.050),rot=(-0.5,0,0),v=12)  # 뒤 접지 단자
sphere(0.010,M['lamp'],loc=(0,-HEAD_R*0.84,0.062))                        # 표시등
export('a_relay_hood')

# 2-2 절연 흉갑 — 앞판·뒤판 + 구리 띠
M=reset()
def vest(k):
    return 0.96-0.14*max(0.0,(k-0.30))*1.4+0.24*max(0.0,k-0.74)*3.0
for a0,a1 in ((FR-1.12,FR+1.12),(FR+math.pi-1.12,FR+math.pi+1.12)):
    tube(-0.200,0.176,vest,M['insul'],seg=13,rings=8,th=0.012,sx=TORSO_W,sy=TORSO_D,a0=a0,a1=a1)
plate(-0.058,0.118,1.0,M['rubber'],FR-0.62,FR+0.62,th=0.014,seg=9,rings=4,
      sx=TORSO_W*1.03,sy=TORSO_D*1.03)                                   # 가슴판(몸을 따라 휜다)
for z in (0.086,0.030,-0.026):
    plate(z-0.008,z+0.008,1.0,M['copper'],FR-0.58,FR+0.58,th=0.009,seg=9,rings=1,
          sx=TORSO_W*1.07,sy=TORSO_D*1.07)                               # 구리 띠
for sx in (-1,1):
    box((sx*0.116,0,0.176),(0.074,0.100,0.023),M['rubber'],rot=(0,sx*0.24,0))
    cyl(0.013,0.013,0.022,M['copper'],loc=(sx*0.116,0,0.198),v=12)
    sphere(0.010,M['brass'],loc=(sx*0.116,0,0.212))
torus(TORSO_W*0.90,0.013,M['rubber'],loc=(0,0,-0.132),seg=26,ring=7)
box((0,-TORSO_D*0.96,-0.132),(0.058,0.022,0.040),M['copper'])
export('a_relay_vest')

# 2-3 동선 각반
for side,nm in ((1,'a_relay_legs_R'),(-1,'a_relay_legs_L')):
    M=reset()
    tube(-0.140,0.140,lambda k:SHIN_R-0.006*k,M['insul'],seg=18,rings=6,th=0.010)
    for z in (0.096,0.012,-0.072):
        torus(SHIN_R+0.003,0.007,M['copper'],loc=(0,0,z),seg=20,ring=6)
    plate(-0.067,0.083,1.0,M['rubber'],FR-0.74,FR+0.74,th=0.012,seg=8,rings=3,
          sx=SHIN_R*1.07,sy=SHIN_R*1.07)
    cyl(0.008,0.008,0.020,M['copper'],loc=(0,-SHIN_R*1.00,-0.116),rot=(0.4,0,0),v=12)
    export(nm, mirror=(side<0))

# 2-4 절연 장갑
M=reset()
tube(-0.150,0.118,lambda k:ARM_R-0.006+0.008*(1-k),M['insul'],seg=18,rings=6,th=0.009)
torus(ARM_R,0.009,M['rubber'],loc=(0,0,0.098),seg=20,ring=6)
torus(ARM_R-0.010,0.009,M['rubber'],loc=(0,0,-0.124),seg=20,ring=6)
plate(-0.093,-0.023,1.0,M['copper'],FR-0.80,FR+0.80,th=0.010,seg=8,rings=2,
      sx=ARM_R*1.06,sy=ARM_R*1.06)
for z in (-0.032,-0.086):
    box((0,-ARM_R*0.92,z),(0.038,0.008,0.012),M['brass'])
export('a_relay_gloves')

# 2-5 절연 장화
for side,nm in ((1,'a_relay_boots_R'),(-1,'a_relay_boots_L')):
    M=reset()
    tube(-0.135,0.200,lambda k:SHIN_R+0.001+0.013*k,M['insul'],seg=18,rings=7,th=0.011)
    torus(SHIN_R+0.018,0.011,M['rubber'],loc=(0,0,0.180),seg=20,ring=6)
    for z in (0.118,0.048):
        torus(SHIN_R+0.009,0.007,M['copper'],loc=(0,0,z),seg=20,ring=6)
    box((0,-0.044,-0.166),(0.090,0.146,0.060),M['insul'])
    box((0,-0.098,-0.192),(0.080,0.048,0.022),M['rubber'])
    box((0,0.022,-0.194),(0.080,0.046,0.018),M['rubber'])
    export(nm, mirror=(side<0))

print('완료')
