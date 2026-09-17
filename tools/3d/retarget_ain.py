# KayKit(CC0) 클립 → 아인 Mixamo 이름 뼈대 리타게팅 + 낫 소켓 + GLB 내보내기 (bpy 4.2)
import bpy, numpy as np, sys, math, os
from mathutils import Vector, Matrix, Quaternion
OUT=sys.argv[-1]; SD=os.environ.get('KAYKIT_DIR','.')
AIN=os.environ.get('AIN_GLB','/home/user/hwanghon/art/3d/ain_hi3d_vcol_v1.glb'); SCYTHE='/home/user/hwanghon/art/3d/ain_scythe_tex.glb'; KAY=SD+'/Rogue.glb'
GRIP=0.75        # 낫 자루에서 오른손 그립 위치 (자루 끝 기준 m)
LEFT_OFF=0.28    # 왼손이 잡는 지점: 오른손에서 날 쪽으로 (m)
CLIPS=[('idle','2H_Melee_Idle'),('walk','Walking_A'),('run','Running_A'),('roll','Dodge_Forward'),('dodgeB','Dodge_Backward'),('dodgeL','Dodge_Left'),('dodgeR','Dodge_Right'),
       ('attack1','2H_Melee_Attack_Slice'),('attack2','2H_Melee_Attack_Chop'),('attack3','2H_Melee_Attack_Stab'),('smash','2H_Melee_Attack_Spin'),('ult','2H_Melee_Attack_Spinning'),
       ('hit','Hit_A'),('hit2','Hit_B'),('death','Death_A'),('guard','Blocking'),('guardHit','Block_Hit'),('guardUp','Block'),('cheer','Cheer'),('pickup','PickUp'),('idle2','Idle')]
TWO_HAND={'idle','attack1','attack2','attack3','smash','ult','guard','guardHit','guardUp','walk','run'}
MAP={'hips':'Hips','spine':'Spine','chest':'Spine2','head':'Head','upperarm.l':'LeftArm','lowerarm.l':'LeftForeArm','hand.l':'LeftHand','upperarm.r':'RightArm','lowerarm.r':'RightForeArm','hand.r':'RightHand',
     'upperleg.l':'LeftUpLeg','lowerleg.l':'LeftLeg','foot.l':'LeftFoot','toes.l':'LeftToeBase','upperleg.r':'RightUpLeg','lowerleg.r':'RightLeg','foot.r':'RightFoot','toes.r':'RightToeBase','handslot.r':'RightHandSlot'}

bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene; sc.render.fps=24
# ---------- 1. 아인 메시 + 뼈대 (rig_ain.py 와 동일) ----------
bpy.ops.import_scene.gltf(filepath=AIN)
mesh=[o for o in bpy.data.objects if o.type=='MESH'][0]; mesh.name='Ain_Mesh'
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active=mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o.type=='EMPTY': bpy.data.objects.remove(o)
co=np.array([v.co[:] for v in mesh.data.vertices])
def B(x,y,z=0.0): return Vector((x, -z, y))
J={ 'Hips':B(0,0.98), 'Spine':B(0,1.06), 'Spine1':B(0,1.16), 'Spine2':B(0,1.27), 'Neck':B(0,1.44), 'Head':B(0,1.52), 'HeadTop_End':B(0,1.68,0.02) }
for s,sg in (('Left',1),('Right',-1)):
    J[s+'Shoulder']=B(sg*0.04,1.41); J[s+'Arm']=B(sg*0.17,1.385); J[s+'ForeArm']=B(sg*0.25,1.09,-0.01); J[s+'Hand']=B(sg*0.315,0.81,0.0); J[s+'HandEnd']=B(sg*0.335,0.70,0.01)
    J[s+'UpLeg']=B(sg*0.09,0.95); J[s+'Leg']=B(sg*0.095,0.50,0.02); J[s+'Foot']=B(sg*0.095,0.12,-0.01); J[s+'ToeBase']=B(sg*0.095,0.03,0.10); J[s+'Toe_End']=B(sg*0.095,0.02,0.17)
J['RightHandSlot']=B(-0.325,0.76,0.03); J['RightHandSlotEnd']=B(-0.325,0.76,0.14)   # 손바닥, 앞(+Z glTF)을 향함
BONES=[('Hips',None,'Hips','Spine'),('Spine','Hips','Spine','Spine1'),('Spine1','Spine','Spine1','Spine2'),('Spine2','Spine1','Spine2','Neck'),('Neck','Spine2','Neck','Head'),('Head','Neck','Head','HeadTop_End')]
for s in ('Left','Right'):
    BONES+=[(s+'Shoulder','Spine2',s+'Shoulder',s+'Arm'),(s+'Arm',s+'Shoulder',s+'Arm',s+'ForeArm'),(s+'ForeArm',s+'Arm',s+'ForeArm',s+'Hand'),(s+'Hand',s+'ForeArm',s+'Hand',s+'HandEnd'),
            (s+'UpLeg','Hips',s+'UpLeg',s+'Leg'),(s+'Leg',s+'UpLeg',s+'Leg',s+'Foot'),(s+'Foot',s+'Leg',s+'Foot',s+'ToeBase'),(s+'ToeBase',s+'Foot',s+'ToeBase',s+'Toe_End')]
BONES.append(('RightHandSlot','RightHand','RightHandSlot','RightHandSlotEnd'))
arm_data=bpy.data.armatures.new('Armature'); arm=bpy.data.objects.new('Armature',arm_data); sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT')
for n,p,h,t in BONES:
    eb=arm_data.edit_bones.new('mixamorig:'+n); eb.head=J[h]; eb.tail=J[t]
    if p: eb.parent=arm_data.edit_bones['mixamorig:'+p]; eb.use_connect=(J[h]-arm_data.edit_bones['mixamorig:'+p].tail).length<1e-6
bpy.ops.object.mode_set(mode='OBJECT')
R={'Hips':0.16,'Spine':0.15,'Spine1':0.15,'Spine2':0.15,'Neck':0.07,'Head':0.12}
for s in ('Left','Right'): R.update({s+'Shoulder':0.08,s+'Arm':0.07,s+'ForeArm':0.06,s+'Hand':0.06,s+'UpLeg':0.11,s+'Leg':0.09,s+'Foot':0.07,s+'ToeBase':0.06})
SKIN=[b for b in BONES if b[0]!='RightHandSlot']
names=[n for n,_,_,_ in SKIN]; H=np.array([J[h][:] for _,_,h,_ in SKIN]); T=np.array([J[t][:] for _,_,_,t in SKIN]); RAD=np.array([R[n] for n in names])
def segdist(P,A,Bv):
    AB=Bv-A; t=np.clip(((P-A)@AB)/(AB@AB+1e-12),0,1); Q=A+t[:,None]*AB; return np.linalg.norm(P-Q,axis=1)
D=np.stack([segdist(co,H[i],T[i]) for i in range(len(names))],1); X=np.abs(co[:,0]); Y=co[:,2]
for i,n in enumerate(names):
    if 'Arm' in n or 'Hand' in n or 'Shoulder' in n: D[:,i]+=np.where(X<0.14,0.25,0.0)
    if 'Leg' in n or 'Foot' in n or 'Toe' in n: D[:,i]+=np.where(Y>1.0,0.3,0.0)
W=np.exp(-(D/RAD)**2); nearest=np.argmin(D,1); W[np.arange(len(co)),nearest]=np.maximum(W[np.arange(len(co)),nearest],1e-3)
top=np.argsort(-W,1)[:,:4]; Wt=np.take_along_axis(W,top,1); Wt/=Wt.sum(1,keepdims=True)
for n in names: mesh.vertex_groups.new(name='mixamorig:'+n)
vg=mesh.vertex_groups
for vi in range(len(co)):
    for k in range(4):
        if Wt[vi,k]>0.01: vg[int(top[vi,k])].add([vi], float(Wt[vi,k]), 'REPLACE')
mesh.parent=arm; mod=mesh.modifiers.new('Armature','ARMATURE'); mod.object=arm
for pb in arm.pose.bones: pb.rotation_mode='QUATERNION'
# ---------- 2. 낫: RightHandSlot 뼈에 부착 ----------
before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=SCYTHE); new=[o for o in bpy.data.objects if o not in before]
roots=[o for o in new if o.parent is None]
sroot=bpy.data.objects.new('Scythe',None); sc.collection.objects.link(sroot)
for o in roots: o.parent=sroot
# 낫 GLB 는 Y-up(자루 방향 +Y) → importer 가 Z-up 으로 회전: 자루가 Blender +Z. 슬롯 뼈 Y축(뼈 방향)에 자루를 맞춤: 뼈 로컬에서 Z→Y 회전
slot=arm.pose.bones['mixamorig:RightHandSlot']; slotL=arm.data.bones['mixamorig:RightHandSlot'].length
sroot.parent=arm; sroot.parent_type='BONE'; sroot.parent_bone='mixamorig:RightHandSlot'
sroot.matrix_parent_inverse=Matrix.Identity(4)
sroot.rotation_mode='XYZ'; sroot.rotation_euler=(-math.pi/2,0,0)   # 오브젝트 +Z → 뼈 +Y
sroot.location=(0,-slotL-GRIP,0)                                    # 뼈 부모는 tail 원점: head 로 -length, 그립만큼 더 아래
# ---------- 3. KayKit 소스 ----------
before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=KAY); new=[o for o in bpy.data.objects if o not in before]
src=[o for o in new if o.type=='ARMATURE'][0]
for o in new:
    if o.type!='ARMATURE': o.hide_set(True); o.hide_render=True
src.animation_data_create()
# 목표 참조 자세(T 포즈): 팔을 수평으로
def rot_between(a,b): return a.normalized().rotation_difference(b.normalized())
for s,sg in (('Left',1),('Right',-1)):
    pb=arm.pose.bones['mixamorig:'+s+'Arm']; bn=arm.data.bones['mixamorig:'+s+'Arm']
    d=(bn.tail_local-bn.head_local); q=rot_between(d,Vector((sg,0,0)))
    # 월드 회전 q 를 뼈 로컬 basis 로: basis = inv(rest_rot) q rest_rot
    Rr=bn.matrix_local.to_3x3(); pb.rotation_quaternion=(Rr.inverted()@q.to_matrix()@Rr).to_quaternion()
bpy.context.view_layer.update()
TREF={b.name:(arm.matrix_world@arm.pose.bones[b.name].matrix).copy() for b in arm.data.bones}
for pb in arm.pose.bones: pb.rotation_quaternion=(1,0,0,0); pb.location=(0,0,0)
bpy.context.view_layer.update()
SREST={b.name:(src.matrix_world@b.matrix_local).copy() for b in src.data.bones}
# 슬롯 뼈: 소스 handslot 의 휴식 방향을 그대로 참조로 씀 (같은 월드 방향이 됨)
TREF['mixamorig:RightHandSlot']=Matrix.Translation(TREF['mixamorig:RightHandSlot'].to_translation())@SREST['handslot.r'].to_3x3().to_4x4()
order=[b.name for b in arm.data.bones]  # 부모 우선 (생성 순서)
parent={b.name:(b.parent.name if b.parent else None) for b in arm.data.bones}
RESTL={b.name:b.matrix_local.copy() for b in arm.data.bones}
inv_map={'mixamorig:'+v:k for k,v in MAP.items()}
hip_scale=(0.95-0.12)/(0.519-0.145)
# ---------- 4. 리타게팅 ----------
arm.animation_data_create()
def ydir(M): return (M.to_3x3()@Vector((0,1,0))).normalized()
def rot_to(a,b): return a.normalized().rotation_difference(b.normalized()).to_matrix()
def child_pos(world,p,n): return world[p]@(RESTL[p].inverted()@RESTL[n]).to_translation()
def setrot(world,n,R3,pos): M=R3.to_4x4(); M.translation=pos; world[n]=M
def char_frame(world):
    """캐릭터 기준 축 (right, up, fwd) — Hips 의 yaw 만 사용"""
    hips=world['mixamorig:Hips']; fwd=hips.to_3x3()@Vector((0,-1,0)); fwd=Vector((fwd.x,fwd.y,0))
    fwd=fwd.normalized() if fwd.length>1e-4 else Vector((0,-1,0)); up=Vector((0,0,1)); right=fwd.cross(up).normalized()
    return right,up,fwd
def solve_arm(world, side, T, pole):
    """2-본 해석 IK: side 의 Arm/ForeArm 을 손 머리가 T 에 오도록. Hand 는 로컬 회전 유지. 반환: 오차"""
    A='mixamorig:'+side+'Arm'; F='mixamorig:'+side+'ForeArm'; Hn='mixamorig:'+side+'Hand'
    L1=(J[side+'ForeArm']-J[side+'Arm']).length; L2=(J[side+'Hand']-J[side+'ForeArm']).length
    S=world[A].to_translation(); d=T-S; D=min(d.length,(L1+L2)*0.995); d.normalize()
    n=pole-d*pole.dot(d)
    if n.length<1e-4: n=Vector((0,0,-1))-d*(Vector((0,0,-1)).dot(d))
    n.normalize(); a=(L1**2-L2**2+D**2)/(2*D); h=math.sqrt(max(L1**2-a**2,0.0)); E=S+d*a+n*h; T2=S+d*D
    R1=world[A].to_3x3(); R2=world[F].to_3x3(); R3=world[Hn].to_3x3(); loc2=R1.inverted()@R2; loc3=R2.inverted()@R3
    R1n=rot_to(R1@Vector((0,1,0)),E-S)@R1; setrot(world,A,R1n,S)
    E2=child_pos(world,A,F); R2f=R1n@loc2; R2n=rot_to(R2f@Vector((0,1,0)),T2-E2)@R2f; setrot(world,F,R2n,E2)
    setrot(world,Hn,R2n@loc3,child_pos(world,F,Hn))
    return (world[Hn].to_translation()-T).length
def ik_left(world, off=None):
    """왼손을 낫 자루 위 지점(오른손 슬롯에서 날 쪽 +off / 자루 끝 쪽 -off)에. 닿지 않으면 오른손 쪽으로 당김."""
    slot=world['mixamorig:RightHandSlot']; sp=slot.to_translation(); sd=ydir(slot)
    S=world['mixamorig:LeftArm'].to_translation(); L1=(J['LeftForeArm']-J['LeftArm']).length; L2=(J['LeftHand']-J['LeftForeArm']).length; reach=(L1+L2)*0.98
    off=LEFT_OFF if off is None else off; sg=1 if off>=0 else -1; off=abs(off); T=sp+sd*off*sg
    while (T-S).length>reach and off>0.10: off-=0.02; T=sp+sd*off*sg
    right,up,fwd=char_frame(world); pole=(-fwd*0.6-right*0.5-up*0.6).normalized()
    return solve_arm(world,'Left',T,pole)
RREL=None
def carry(world, spec):
    """무기 주도 자세: 오른손 위치·자루 방향·날 방향을 캐릭터 기준으로 지정 → 오른팔 IK, 슬롯 회전, 왼손 자루 IK"""
    global RREL
    if RREL is None: RREL=(RESTL['mixamorig:RightHand'].inverted()@RESTL['mixamorig:RightHandSlot']).to_3x3()
    right,up,fwd=char_frame(world); hp=world['mixamorig:Hips'].to_translation()
    def v(t): return right*t[0]+up*t[1]+fwd*t[2]
    T=hp+v(spec['rh']); sd=v(spec['shaft']).normalized(); bd=v(spec['blade']); bd=(bd-sd*bd.dot(sd)).normalized()
    pole=(-fwd*0.5+right*0.7-up*0.5).normalized(); err=solve_arm(world,'Right',T,pole)
    # 슬롯 월드 회전: Y=자루, X=-날, Z=X×Y
    X=-bd; Y=sd; Z=X.cross(Y).normalized(); Rs=Matrix((X,Y,Z)).transposed()
    # 오른손 회전은 슬롯에서 역산 (손목이 무기를 따라감)
    Hn='mixamorig:RightHand'; hpos=world[Hn].to_translation(); Rh=Rs@RREL.inverted(); setrot(world,Hn,Rh,hpos)
    setrot(world,'mixamorig:RightHandSlot',Rs,child_pos(world,Hn,'mixamorig:RightHandSlot'))
    if spec.get('left') is not None: ik_left(world, spec['left'])
    return err
# 캐릭터 기준 (right, up, fwd) 오프셋 — Hips 원점(≈0.98 m)
CARRY={
  'idle': dict(rh=(0.27,0.10,0.24), shaft=(-0.18,0.94,-0.28), blade=(0,0.25,1), left=-0.36),
  'idle2':dict(rh=(0.27,0.10,0.24), shaft=(-0.18,0.94,-0.28), blade=(0,0.25,1), left=-0.36),
  'walk': dict(rh=(0.28,0.06,0.22), shaft=(-0.18,0.94,-0.28), blade=(0,0.25,1), left=-0.36),
  'run':  dict(rh=(0.30,-0.06,-0.08), shaft=(-0.12,0.42,-0.90), blade=(0,1,0.4), left=None),
  'guard':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
  'guardHit':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
  'guardUp':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
}

ARMS=['mixamorig:RightArm','mixamorig:RightForeArm','mixamorig:RightHand','mixamorig:RightHandSlot','mixamorig:LeftArm','mixamorig:LeftForeArm','mixamorig:LeftHand']
def blend_carry(world, spec, w):
    """world(소스 리타겟) 와 carry 자세를 팔 뼈에 대해 w 로 섞음 (회전 slerp, 위치는 체인 재계산)"""
    if w<=0.001: return ik_left(world)
    W2={k:v.copy() for k,v in world.items()}; carry(W2,spec)
    if w>=0.999:
        for k in ARMS: world[k]=W2[k]
        return 0.0
    for k in ARMS:
        qa=world[k].to_quaternion(); qb=W2[k].to_quaternion(); q=qa.slerp(qb,w)
        p=parent[k]; pos=child_pos(world,p,k); setrot(world,k,q.to_matrix(),pos)
    off=w*spec['left']+(1-w)*LEFT_OFF
    return ik_left(world, off if abs(off)>0.08 else (0.08 if off>=0 else -0.08))
def ease(t): return t*t*(3-2*t)
def carry_weight(i,n,frac=0.22):
    m=max(2,int(n*frac)); 
    if i<m: return ease(1-i/m)
    if i>n-1-m: return ease(1-(n-1-i)/m)
    return 0.0

# ---------- 낫 전용 공격 궤적: 캐릭터 기준 (right, up, fwd) 키프레임. t 는 0..1 (클립 진행) ----------
IDLE_K=dict(rh=(0.27,0.10,0.24), shaft=(-0.18,0.94,-0.28), blade=(0,0.25,1), left=-0.36)
PATHS={
  # 베기: 오른쪽 뒤로 당겼다가 가슴 높이에서 왼쪽으로 크게 쓸어 벤다 (날이 앞장)
  'attack1':[(0.0,IDLE_K),
             (0.20,dict(rh=(0.48,0.32,-0.18), shaft=(0.55,0.45,-0.70), blade=(-0.7,0.1,0.7), left=-0.40)),
             (0.34,dict(rh=(0.18,0.28,0.42), shaft=(-0.15,0.12,0.98), blade=(-1,0,0), left=-0.40)),
             (0.46,dict(rh=(-0.30,0.26,0.22), shaft=(-0.95,0.12,0.28), blade=(-0.3,0,-0.95), left=-0.40)),
             (0.62,dict(rh=(-0.28,0.20,0.18), shaft=(-0.85,0.35,0.35), blade=(0,0.3,0.95), left=-0.38)),
             (1.0,IDLE_K)],
  # 내려찍기: 머리 위 뒤로 들어 올렸다가 앞으로 내리꽂는다 (날끝이 땅을 찍는다)
  'attack2':[(0.0,IDLE_K),
             (0.22,dict(rh=(0.32,0.58,-0.12), shaft=(0.12,0.72,-0.68), blade=(0,0.6,0.8), left=-0.40)),
             (0.36,dict(rh=(0.18,0.55,0.25), shaft=(0.05,0.30,0.95), blade=(0,-0.5,0.85), left=-0.40)),
             (0.44,dict(rh=(0.15,0.12,0.58), shaft=(0,-0.40,0.92), blade=(0,-0.92,0.35), left=-0.42)),
             (0.62,dict(rh=(0.15,0.05,0.52), shaft=(0,-0.48,0.88), blade=(0,-0.92,0.35), left=-0.42)),
             (0.82,dict(rh=(0.22,0.18,0.30), shaft=(-0.2,0.62,0.76), blade=(0,0.2,1), left=-0.38)),
             (1.0,IDLE_K)],
  # 찌르기(갈고리 당기기): 자루를 수평으로 눕혀 앞으로 찌른 뒤 날로 걸어 당긴다
  'attack3':[(0.0,IDLE_K),
             (0.18,dict(rh=(0.36,0.22,-0.22), shaft=(0.05,0.05,1), blade=(0,-1,0), left=-0.42)),
             (0.34,dict(rh=(0.10,0.26,0.68), shaft=(0,0.02,1), blade=(0,-1,0), left=-0.42)),
             (0.48,dict(rh=(0.28,0.24,0.12), shaft=(0.08,0.18,0.98), blade=(0,-1,0.1), left=-0.42)),
             (0.70,dict(rh=(0.27,0.15,0.20), shaft=(-0.2,0.80,0.55), blade=(0,0.2,1), left=-0.38)),
             (1.0,IDLE_K)],
  # 회전: 자루를 수평으로 뻗은 채 몸과 함께 돈 뒤 마무리 찍기
  'smash':  [(0.0,IDLE_K),
             (0.15,dict(rh=(0.42,0.30,-0.10), shaft=(0.6,0.15,-0.78), blade=(-0.75,0.1,0.6), left=-0.40)),
             (0.30,dict(rh=(0.22,0.32,0.42), shaft=(-0.3,0.05,0.95), blade=(-1,0,0), left=-0.42)),
             (0.55,dict(rh=(0.22,0.32,0.42), shaft=(-0.3,0.05,0.95), blade=(-1,0,0), left=-0.42)),
             (0.68,dict(rh=(0.25,0.55,0.05), shaft=(0.05,0.55,-0.83), blade=(0,0.6,0.8), left=-0.40)),
             (0.78,dict(rh=(0.15,0.10,0.58), shaft=(0,-0.42,0.90), blade=(0,-0.92,0.35), left=-0.42)),
             (0.90,dict(rh=(0.18,0.08,0.52), shaft=(0,-0.45,0.89), blade=(0,-0.92,0.35), left=-0.42)),
             (1.0,IDLE_K)],
}
def _lerp3(a,b,k): return tuple(a[i]+(b[i]-a[i])*k for i in range(3))
def path_spec(keys, t):
    for i in range(len(keys)-1):
        t0,a=keys[i]; t1,b=keys[i+1]
        if t<=t1:
            k=0 if t1<=t0 else (t-t0)/(t1-t0); k=k*k*(3-2*k)
            return dict(rh=_lerp3(a['rh'],b['rh'],k), shaft=_lerp3(a['shaft'],b['shaft'],k), blade=_lerp3(a['blade'],b['blade'],k), left=a['left']+(b['left']-a['left'])*k)
    return dict(keys[-1][1])

def retarget(action, clip):
    f0,f1=int(action.frame_range[0]),int(action.frame_range[1]); src.animation_data.action=action
    new=bpy.data.actions.new(clip); arm.animation_data.action=new; errs=[]
    for f in range(f0,f1+1):
        sc.frame_set(f)
        SP={n:(src.matrix_world@src.pose.bones[n].matrix).copy() for n in MAP}
        world={}
        for n in order:
            p=parent[n]; pw=world[p] if p else Matrix.Identity(4)
            if n in inv_map:
                s=inv_map[n]; Rw=SP[s].to_3x3()@SREST[s].to_3x3().inverted()@TREF[n].to_3x3()
                if p: pos=pw@(RESTL[p].inverted()@RESTL[n]).to_translation()
                else: pos=RESTL[n].to_translation()+(SP[s].to_translation()-SREST[s].to_translation())*hip_scale
                M=Rw.to_4x4(); M.translation=pos; world[n]=M
            else:
                world[n]=pw@(RESTL[p].inverted()@RESTL[n]) if p else RESTL[n].copy()
        if clip in CARRY: errs.append(carry(world,CARRY[clip]))
        elif clip in PATHS: errs.append(carry(world, path_spec(PATHS[clip], (f-f0)/max(1,(f1-f0)))))
        elif clip in TWO_HAND: errs.append(blend_carry(world,CARRY['idle'],carry_weight(f-f0,f1-f0+1)))
        for n in order:
            p=parent[n]; pw=world[p] if p else Matrix.Identity(4); pb=arm.pose.bones[n]
            basis=(RESTL[p].inverted()@RESTL[n]).inverted()@pw.inverted()@world[n] if p else RESTL[n].inverted()@world[n]
            pb.rotation_quaternion=basis.to_quaternion(); pb.keyframe_insert('rotation_quaternion',frame=f-f0)
            if not p: pb.location=basis.to_translation(); pb.keyframe_insert('location',frame=f-f0)
    for fc in new.fcurves:
        for k in fc.keyframe_points: k.interpolation='LINEAR'
    if errs: print('  left-hand max err',clip,round(max(errs),3))
    return new
made=[]
for clip,srcname in CLIPS:
    a=bpy.data.actions.get(srcname+'_Rig') or bpy.data.actions.get(srcname)
    if not a: print('missing',srcname); continue
    made.append((clip,retarget(a,clip))); print('retargeted',clip,srcname,int(a.frame_range[1]-a.frame_range[0])+1,'frames')
for o in [sroot]+[c for c in bpy.data.objects if c.parent is sroot or (c.parent and c.parent.parent is sroot)]:
    try: bpy.data.objects.remove(o)
    except: pass
# ---------- 6. NLA 트랙 + 내보내기 ----------
arm.animation_data.action=None
for clip,act in made:
    tr=arm.animation_data.nla_tracks.new(); tr.name=clip; st=tr.strips.new(clip,0,act); st.name=clip
for o in list(bpy.data.objects):
    if o is src or (o.parent is src) or o.name.startswith(('Rogue','Knife','1H_','2H_','Throwable')): 
        try: bpy.data.objects.remove(o)
        except: pass
for o in bpy.data.objects: o.hide_set(False)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=False, export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True, export_vertex_color='MATERIAL', export_force_sampling=True, export_nla_strips=True, export_frame_step=1)
print('exported',OUT)
