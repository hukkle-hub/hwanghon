# 갈대습지 보스 「모르버스」 — bpy 절차 생성 (프리미티브 조립 + 사족 뼈대 + 절차 클립) → GLB
#   python3 tools/3d/build_marsh_boss.py art/3d/boss_marsh.glb
# 규약: 1 unit = 1 m, 정면 -Y(Blender) → 내보내기 후 +Z, 발바닥 z=0. 뼈 이름은 mixamorig: 접두사 없이 게임이 strip 해서 읽음
# 클립: idle walk atk_bolt(돌진) atk_flame(포효) atk_hammer(강타) atk_scythe(꼬리) atk_drop(광란) hit stagger down up death
# 파괴 부위 노드: piece_back(등 견갑) piece_legf(앞다리 갑각) piece_tail(꼬리 가시) — 뼈에 부모, 게임이 이름으로 떼어낸다
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix, Euler, Quaternion
OUT=sys.argv[-1]; random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene; sc.render.fps=24
def V(x,y,z): return Vector((x,y,z))

# ---------- 재질 ----------
def mat(name, col, rough=0.9, metal=0.0, emis=None, estr=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    if emis: b.inputs['Emission Color'].default_value=(*emis,1); b.inputs['Emission Strength'].default_value=estr
    return m
SKIN=mat('skin',(0.16,0.14,0.12),0.95); HIDE=mat('hide',(0.10,0.09,0.08),0.9); BONE=mat('bone',(0.58,0.53,0.42),0.7)
PLATE=mat('plate',(0.22,0.20,0.17),0.6,0.35); CORE=mat('core',(0.9,0.2,0.1),0.4,0,(1.0,0.22,0.08),6.0); EYE=mat('eye',(1,0.4,0.2),0.3,0,(1.0,0.45,0.15),8.0)
CLAW=mat('claw',(0.35,0.32,0.28),0.5,0.2)

# ---------- 뼈대 (head→tail) ----------
J={}
J['Hips']=(V(0,0.9,2.05), V(0,0.0,2.10))
J['Spine']=(V(0,0.0,2.10), V(0,-0.95,2.22)); J['Spine1']=(V(0,-0.95,2.22), V(0,-1.85,2.35)); J['Spine2']=(V(0,-1.85,2.35), V(0,-2.65,2.42))
J['Neck']=(V(0,-2.65,2.42), V(0,-3.25,2.62)); J['Head']=(V(0,-3.25,2.62), V(0,-4.25,2.50)); J['Jaw']=(V(0,-3.35,2.35), V(0,-4.15,2.15))
J['Tail1']=(V(0,0.9,2.05), V(0,1.9,2.15)); J['Tail2']=(V(0,1.9,2.15), V(0,2.9,2.05)); J['Tail3']=(V(0,2.9,2.05), V(0,3.8,1.75))
LEGS={}
for side,sx in (('R',1),('L',-1)):
    J['F%s_Up'%side]=(V(sx*0.95,-2.25,2.05), V(sx*1.05,-2.05,1.15)); J['F%s_Low'%side]=(V(sx*1.05,-2.05,1.15), V(sx*1.10,-2.35,0.28)); J['F%s_Foot'%side]=(V(sx*1.10,-2.35,0.28), V(sx*1.10,-2.95,0.02))
    J['B%s_Up'%side]=(V(sx*0.90,0.25,1.95), V(sx*1.00,0.55,1.05)); J['B%s_Low'%side]=(V(sx*1.00,0.55,1.05), V(sx*1.05,0.25,0.25)); J['B%s_Foot'%side]=(V(sx*1.05,0.25,0.25), V(sx*1.05,-0.35,0.02))
PARENT={'Hips':None,'Spine':'Hips','Spine1':'Spine','Spine2':'Spine1','Neck':'Spine2','Head':'Neck','Jaw':'Head','Tail1':'Hips','Tail2':'Tail1','Tail3':'Tail2'}
for s in 'RL': PARENT.update({'F%s_Up'%s:'Spine2','F%s_Low'%s:'F%s_Up'%s,'F%s_Foot'%s:'F%s_Low'%s,'B%s_Up'%s:'Hips','B%s_Low'%s:'B%s_Up'%s,'B%s_Foot'%s:'B%s_Low'%s})
ORDER=['Hips','Spine','Spine1','Spine2','Neck','Head','Jaw','Tail1','Tail2','Tail3']+[p%s for s in 'RL' for p in ('F%s_Up','F%s_Low','F%s_Foot','B%s_Up','B%s_Low','B%s_Foot')]
arm_data=bpy.data.armatures.new('Armature'); arm=bpy.data.objects.new('Armature',arm_data); sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT')
for n in ORDER:
    eb=arm_data.edit_bones.new(n); eb.head,eb.tail=J[n]; p=PARENT[n]
    if p: eb.parent=arm_data.edit_bones[p]; eb.use_connect=False
bpy.ops.object.mode_set(mode='OBJECT')
for pb in arm.pose.bones: pb.rotation_mode='XYZ'

# ---------- 메시 조립 ----------
parts=[]   # (obj, bone)
def finish(o, m, bone, group):
    o.data.materials.append(m); vg=o.vertex_groups.new(name=bone); vg.add(list(range(len(o.data.vertices))),1.0,'REPLACE'); group.append((o,bone)); return o
def cyl(p1,p2,r1,r2,m,bone,group=None,verts=10):
    d=p2-p1; L=d.length; bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=L, location=(p1+p2)/2)
    o=bpy.context.object; o.rotation_mode='QUATERNION'; o.rotation_quaternion=Vector((0,0,1)).rotation_difference(d.normalized()); bpy.ops.object.shade_smooth()
    return finish(o,m,bone,group if group is not None else parts)
def ball(c,s,m,bone,group=None,sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=c); o=bpy.context.object; o.scale=s; bpy.ops.object.shade_smooth()
    return finish(o,m,bone,group if group is not None else parts)
def spike(base,dirv,L,r,m,bone,group=None):
    return cyl(base, base+dirv.normalized()*L, r, 0.0, m, bone, group, 6)
def bx(c,s,m,bone,group=None,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c); o=bpy.context.object; o.scale=s; o.rotation_euler=rot
    return finish(o,m,bone,group if group is not None else parts)

# 몸통: 엉덩이·허리·가슴 (뒤로 갈수록 좁음)
ball(V(0,0.45,2.05), V(1.05,1.0,0.85), SKIN, 'Hips')
ball(V(0,-0.5,2.15), V(1.05,0.95,0.9), SKIN, 'Spine')
ball(V(0,-1.4,2.28), V(1.15,0.95,1.0), SKIN, 'Spine1')
ball(V(0,-2.25,2.35), V(1.25,0.9,1.05), SKIN, 'Spine2')
# 가슴 핵 (붉은 발광) + 갈비 흔적
ball(V(0,-2.55,1.75), V(0.22,0.18,0.22), CORE, 'Spine2')
for i in range(4): ball(V(0,-1.9+i*0.35,1.55), V(0.9,0.08,0.35), HIDE, 'Spine1' if i<2 else 'Spine')
# 목·머리·턱
cyl(V(0,-2.65,2.42), V(0,-3.3,2.62), 0.48, 0.38, SKIN, 'Neck')
ball(V(0,-3.7,2.55), V(0.48,0.62,0.42), SKIN, 'Head')
bx(V(0,-4.15,2.5), V(0.55,0.5,0.32), SKIN, 'Head')
bx(V(0,-3.75,2.18), V(0.5,0.85,0.16), HIDE, 'Jaw')
for sx in (1,-1):
    ball(V(sx*0.28,-3.95,2.72), V(0.09,0.07,0.07), EYE, 'Head')
    spike(V(sx*0.3,-3.4,2.85), V(sx*0.4,0.3,1), 0.55, 0.09, BONE, 'Head')          # 뿔
    for k in range(4): spike(V(sx*0.24,-4.3+k*0.15,2.42), V(0,0,-1), 0.18, 0.035, BONE, 'Head')   # 윗니
    for k in range(3): spike(V(sx*0.2,-4.2+k*0.2,2.22), V(0,0,1), 0.16, 0.03, BONE, 'Jaw')       # 아랫니
# 등 가시(고정) — 척추를 따라
for i,(y,bn) in enumerate([(0.55,'Hips'),(0.1,'Spine'),(-0.35,'Spine'),(-0.8,'Spine1'),(-1.25,'Spine1'),(-1.7,'Spine2'),(-2.15,'Spine2')]):
    h=0.45+0.25*math.sin(i*0.9); spike(V(0,y,2.75+0.1*(i>2)), V(0,0.35,1), h, 0.11, BONE, bn)
# 꼬리
cyl(V(0,0.9,2.05), V(0,1.9,2.15), 0.42, 0.30, SKIN, 'Tail1'); cyl(V(0,1.9,2.15), V(0,2.9,2.05), 0.30, 0.20, SKIN, 'Tail2'); cyl(V(0,2.9,2.05), V(0,3.8,1.75), 0.20, 0.06, SKIN, 'Tail3')
for i in range(3): spike(V(0,1.2+i*0.45,2.35), V(0,0.3,1), 0.3, 0.06, BONE, 'Tail1' if i<2 else 'Tail2')
# 다리 (윗다리 굵게, 아랫다리, 발 + 발톱)
for side,sx in (('R',1),('L',-1)):
    for pre,leg in (('F','F%s'%side),('B','B%s'%side)):
        up,lo,ft=J[leg+'_Up'],J[leg+'_Low'],J[leg+'_Foot']
        cyl(up[0],up[1],0.42,0.30,SKIN,leg+'_Up'); ball(up[0],V(0.5,0.5,0.45),SKIN,leg+'_Up' if pre=='F' else leg+'_Up')
        cyl(lo[0],lo[1],0.30,0.20,SKIN,leg+'_Low'); ball(lo[0],V(0.3,0.3,0.3),SKIN,leg+'_Low')
        ball(ft[1]+V(0,0.1,0.14), V(0.3,0.42,0.16), HIDE, leg+'_Foot')
        for k,dx in enumerate((-0.16,0,0.16)): spike(ft[1]+V(dx,-0.2,0.12), V(dx*0.5,-1,-0.35), 0.4, 0.06, CLAW, leg+'_Foot')
# 파괴 부위 (별도 오브젝트, 뼈에 부모)
pieces={}
grp=[]; 
for i in range(3): bx(V(0,-0.6-i*0.45,2.95), V(0.95-0.1*i,0.34,0.12), PLATE, 'Spine1', grp, rot=(0.25,0,0)); spike(V(0.35*(i%2*2-1),-0.6-i*0.45,3.0), V(0.4*(i%2*2-1),0.2,1), 0.5, 0.09, BONE, 'Spine1', grp)
pieces['piece_back']=('Spine1',grp)
grp=[]
for sx in (1,-1): bx(V(sx*1.15,-2.15,1.55), V(0.42,0.5,0.6), PLATE, 'F%s_Up'%('R' if sx>0 else 'L'), grp, rot=(0,0,0)); spike(V(sx*1.3,-2.3,1.7), V(sx*1,-0.3,0.3), 0.45, 0.08, BONE, 'F%s_Up'%('R' if sx>0 else 'L'), grp)
pieces['piece_legf']=('FR_Up',grp)
grp=[]
spike(V(0,3.55,1.9), V(0,1,0.6), 0.75, 0.10, BONE, 'Tail3', grp); spike(V(0.12,3.4,1.95), V(0.6,0.8,0.3), 0.4, 0.06, BONE, 'Tail3', grp); spike(V(-0.12,3.4,1.95), V(-0.6,0.8,0.3), 0.4, 0.06, BONE, 'Tail3', grp)
pieces['piece_tail']=('Tail3',grp)

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); return o
mesh=join([o for o,_ in parts], 'Boss_Mesh')
mesh.parent=arm; mod=mesh.modifiers.new('Armature','ARMATURE'); mod.object=arm
def bone_parent(o, bone):
    o.parent=arm; o.parent_type='BONE'; o.parent_bone=bone
    pb=arm.pose.bones[bone]; M=arm.matrix_world@pb.matrix@Matrix.Translation((0,pb.bone.length,0)); o.matrix_parent_inverse=M.inverted()
for name,(bone,objs) in pieces.items():
    po=join([o for o,_ in objs], name)
    # 조각은 뼈 하나에 통째로 따라가므로 스킨 대신 뼈 부모
    for vg in list(po.vertex_groups): po.vertex_groups.remove(vg)
    bone_parent(po, bone)

# ---------- 절차 클립 ----------
def clip(name, dur, fn, hold=False):
    """fn(t01, key) — key(bone, rot=(x,y,z) rad, loc=(x,y,z)) 로 프레임마다 자세 지정"""
    act=bpy.data.actions.new(name); arm.animation_data_create(); arm.animation_data.action=act
    n=max(2,int(dur*24)+1)
    for f in range(n):
        t=f/(n-1)
        for pb in arm.pose.bones: pb.rotation_euler=(0,0,0); pb.location=(0,0,0)
        def key(b, rot=None, loc=None):
            pb=arm.pose.bones[b]
            if rot: pb.rotation_euler=(pb.rotation_euler[0]+rot[0], pb.rotation_euler[1]+rot[1], pb.rotation_euler[2]+rot[2])
            if loc: pb.location=(pb.location[0]+loc[0], pb.location[1]+loc[1], pb.location[2]-loc[2])   # 뼈 로컬: +Y=앞, +Z=아래 → z 는 위가 양수가 되게 뒤집음
        fn(t, key)
        for pb in arm.pose.bones: pb.keyframe_insert('rotation_euler', frame=f); pb.keyframe_insert('location', frame=f)
    arm.animation_data.action=None
    tr=arm.animation_data.nla_tracks.new(); tr.name=name; st=tr.strips.new(name,0,act); st.name=name
    return act
S=math.sin; C=math.cos; TAU=math.pi*2
def ease(t): return t*t*(3-2*t)
def pulse(t, a, b):  # 0..1 ramp inside [a,b], 1 after b
    return 0 if t<a else 1 if t>b else ease((t-a)/(b-a))
def bump(t, a, b):   # up then down inside [a,b]
    if t<a or t>b: return 0
    k=(t-a)/(b-a); return S(k*math.pi)
LEGS_=[p%s for s in 'RL' for p in ('F%s','B%s')]
def breathe(t, key, amp=1.0):
    key('Spine1', rot=(0.02*S(t*TAU)*amp,0,0)); key('Spine2', rot=(0.02*S(t*TAU)*amp,0,0)); key('Hips', loc=(0,0,0.03*S(t*TAU)*amp))
    key('Neck', rot=(0.04*S(t*TAU+1)*amp,0,0)); key('Tail1', rot=(0,0,0.12*S(t*TAU)*amp)); key('Tail2', rot=(0,0,0.18*S(t*TAU-0.8)*amp)); key('Tail3', rot=(0,0,0.22*S(t*TAU-1.6)*amp))
def gait(t, key, amp=0.45, bob=0.06):
    # 대각선 쌍: FR+BL 동기, FL+BR 반대
    for leg,ph in (('FR',0),('BL',0),('FL',0.5),('BR',0.5)):
        a=S((t+ph)*TAU)*amp; key(leg+'_Up', rot=(a,0,0)); key(leg+'_Low', rot=(max(0,-a)*1.2,0,0)); key(leg+'_Foot', rot=(-a*0.5,0,0))
    key('Hips', loc=(0,0,bob*abs(S(t*TAU*2)))); key('Spine1', rot=(0,0.05*S(t*TAU),0)); key('Head', rot=(0.05*S(t*TAU*2),0,0)); key('Tail2', rot=(0,0,0.2*S(t*TAU)))
def f_idle(t,key): breathe(t,key)
def f_walk(t,key): gait(t,key)
def f_bolt(t,key):   # 돌진 베기: 웅크림(0~.35) → 돌진(.35~.6, 앞으로 2.4 m) → 머리 휘두르기 → 복귀
    c=bump(t,0,0.4); key('Hips', loc=(0,-0.5*c,-0.35*c)); key('Spine2', rot=(-0.25*c,0,0)); key('Neck', rot=(-0.3*c,0,0))
    for leg in LEGS_: key(leg+'_Up', rot=(0.5*c if leg[0]=='B' else -0.4*c,0,0)); key(leg+'_Low', rot=(0.6*c,0,0))
    d=pulse(t,0.35,0.55)*(1-pulse(t,0.75,1.0)); key('Hips', loc=(0,2.4*d,0.15*d)); key('Spine1', rot=(0.15*d,0,0))
    sw=bump(t,0.45,0.7); key('Head', rot=(0.2*sw,0,-0.9*sw)); key('Neck', rot=(0,0,-0.4*sw)); key('Jaw', rot=(0.5*sw,0,0))
    gait(t*2.2,key,0.5,0.03) if 0.35<t<0.8 else None
def f_flame(t,key):  # 광폭 포효: 앞다리 들고 상체 세움 → 입 벌리고 흔들기
    r=pulse(t,0,0.4)*(1-pulse(t,0.8,1.0)); key('Spine1', rot=(-0.35*r,0,0)); key('Spine2', rot=(-0.4*r,0,0)); key('Hips', loc=(0,0.3*r,0.35*r)); key('Neck', rot=(-0.35*r,0,0)); key('Head', rot=(-0.1*r,0,0))
    key('FR_Up', rot=(-1.0*r,0,-0.2*r)); key('FL_Up', rot=(-1.0*r,0,0.2*r)); key('FR_Low', rot=(1.1*r,0,0)); key('FL_Low', rot=(1.1*r,0,0)); key('BR_Low', rot=(0.5*r,0,0)); key('BL_Low', rot=(0.5*r,0,0))
    o=pulse(t,0.4,0.5)*(1-pulse(t,0.85,1.0)); key('Jaw', rot=(0.7*o,0,0)); sh=0.08*S(t*60)*o; key('Head', rot=(0,0,sh)); key('Spine2', rot=(0,0,sh*0.5))
def f_hammer(t,key): # 대지 강타: 앞다리 높이 들고(.0~.45) 내리찍기(.45~.55) → 반동
    r=pulse(t,0,0.45)*(1-pulse(t,0.45,0.56)); key('Spine2', rot=(-0.35*r,0,0)); key('Spine1', rot=(-0.2*r,0,0)); key('Hips', loc=(0,0.2*r,0.45*r)); key('Neck', rot=(-0.1*r,0,0)); key('Head', rot=(0.25*r,0,0))
    key('FR_Up', rot=(-1.3*r,0,0)); key('FL_Up', rot=(-1.3*r,0,0)); key('FR_Low', rot=(1.3*r,0,0)); key('FL_Low', rot=(1.3*r,0,0)); key('BR_Low', rot=(0.6*r,0,0)); key('BL_Low', rot=(0.6*r,0,0))
    k=bump(t,0.52,0.75); key('Hips', loc=(0,0,-0.3*k)); key('Spine2', rot=(0.25*k,0,0)); key('Head', rot=(0.3*k,0,0)); key('FR_Low', rot=(0.4*k,0,0)); key('FL_Low', rot=(0.4*k,0,0))
def f_scythe(t,key): # 꼬리 휘두르기: 몸 전체 한 바퀴 회전(꼬리 폄), 뒤쪽도 판정
    y=ease(min(1,max(0,(t-0.25)/0.55)))*TAU; key('Hips', rot=(0,0,-y)); key('Tail1', rot=(0,0,0.6*bump(t,0.2,0.9))); key('Tail2', rot=(0,0,0.5*bump(t,0.2,0.9))); key('Tail3', rot=(0,0,0.3*bump(t,0.2,0.9)))
    c=bump(t,0,0.4); key('Hips', loc=(0,0,-0.25*c)); key('Spine2', rot=(0.1*c,0,0))
    for leg in LEGS_: key(leg+'_Low', rot=(0.5*c,0,0))
def f_drop(t,key):   # 피의 광란: 빠른 좌우 발톱 연타 + 머리 흔들기
    for i,(a,b) in enumerate(((0.05,0.3),(0.3,0.55),(0.55,0.8))):
        k=bump(t,a,b); leg='FR' if i%2==0 else 'FL'; key(leg+'_Up', rot=(-1.1*k,0,(0.5 if leg=='FR' else -0.5)*k)); key(leg+'_Low', rot=(0.9*k,0,0)); key('Spine2', rot=(-0.15*k,0,(0.2 if leg=='FR' else -0.2)*k)); key('Head', rot=(0.1*k,0,(0.5 if leg=='FR' else -0.5)*k))
    key('Jaw', rot=(0.5*bump(t,0.1,0.9),0,0)); key('Neck', rot=(-0.2*bump(t,0,1),0,0)); key('Hips', loc=(0,-0.3*bump(t,0,1),0))
def f_hit(t,key):    # 피격: 뒤로 움찔
    k=bump(t,0,1); key('Hips', loc=(0,0.18*k,0)); key('Spine2', rot=(-0.12*k,0,0)); key('Neck', rot=(0.15*k,0,0)); key('Head', rot=(0.1*k,0,0.1*k))
def f_stagger(t,key):# 경직: 머리 떨구고 비틀
    k=bump(t,0,1); key('Spine1', rot=(0.15*k,0.15*S(t*TAU*2)*k,0)); key('Spine2', rot=(0.2*k,0,0.1*S(t*TAU*3)*k)); key('Neck', rot=(0.5*k,0,0)); key('Head', rot=(0.3*k,0,0)); key('Hips', loc=(0,0,-0.15*k))
    for leg in LEGS_: key(leg+'_Low', rot=(0.35*k,0,0))
def f_down(t,key):   # 격추: 다리 접고 바닥에 주저앉음
    k=pulse(t,0,0.6); key('Hips', loc=(0,0,-1.15*k)); key('Spine2', rot=(0.15*k,0,0)); key('Neck', rot=(0.55*k,0,0)); key('Head', rot=(0.25*k,0,0)); key('Jaw', rot=(0.3*k,0,0))
    for leg in LEGS_: key(leg+'_Up', rot=((0.9 if leg[0]=='B' else -0.9)*k,0,0)); key(leg+'_Low', rot=(1.6*k,0,0)); key(leg+'_Foot', rot=(-0.6*k,0,0))
    key('Tail2', rot=(0.2*k,0,0.1*S(t*TAU*2)*k))
def f_up(t,key): f_down(1-t,key)
def f_death(t,key):  # 사망: 앞으로 고꾸라지고 옆으로 기움
    k=pulse(t,0,0.7); key('Hips', loc=(0,0,-1.2*k), rot=(0,0.9*k,0)); key('Spine2', rot=(0.35*k,0,0)); key('Neck', rot=(0.7*k,0,0.2*k)); key('Head', rot=(0.3*k,0,0)); key('Jaw', rot=(0.6*k,0,0))
    for leg in LEGS_: key(leg+'_Up', rot=((0.8 if leg[0]=='B' else -0.7)*k,0,0)); key(leg+'_Low', rot=(1.5*k,0,0))
    key('Tail1', rot=(0.3*k,0,0.3*k))
for name,dur,fn in [('idle',2.4,f_idle),('walk',1.0,f_walk),('atk_bolt',1.5,f_bolt),('atk_flame',1.6,f_flame),('atk_hammer',1.4,f_hammer),('atk_scythe',1.5,f_scythe),('atk_drop',1.3,f_drop),
                    ('hit',0.4,f_hit),('stagger',1.0,f_stagger),('down',1.2,f_down),('up',0.9,f_up),('death',2.2,f_death)]:
    clip(name,dur,fn)

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=False, export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True, export_force_sampling=True, export_nla_strips=True, export_frame_step=1, export_materials='EXPORT')
import os; print('wrote', OUT, os.path.getsize(OUT)//1024, 'KB', 'verts', len(mesh.data.vertices))
