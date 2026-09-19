# 범용 캐릭터 리깅+리타게팅 (bpy 4.2): 저폴리 캐릭터 GLB(Y-up, 발 원점) → Mixamo 이름 뼈대(메시 비율로 랜드마크 추정) + KayKit(CC0) 클립 → <char>_anim.glb
#   CHAR=kain MESH=art/3d/kain_tex_lo.glb KAYKIT_DIR=... python3 tools/3d/rig_char.py art/3d/kain_anim.glb
#   무기 프로필: ain·kain = 양손(2H) 캐리 자세 + 낫/대검 궤적, ryu = 한손·쌍수 클립, sera = 던지기·주문 클립. retarget_ain.py 의 일반화판.
import bpy, numpy as np, sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # rig_core (무기 IK 공용)
from mathutils import Vector, Matrix, Quaternion
OUT=sys.argv[-1]; SD=os.environ.get('KAYKIT_DIR','.'); CHAR=os.environ.get('CHAR','ain')
AIN=os.environ.get('MESH', os.environ.get('AIN_GLB','/home/user/hwanghon/art/3d/ain_tex_lo.glb')); SCYTHE=os.environ.get('SCYTHE','')
KAY=SD+'/Rogue.glb'
GRIP=float(os.environ.get('GRIP','0.75'))   # 자루에서 오른손 그립 위치 (자루 끝 기준 m)
LEFT_OFF=0.28    # 왼손이 잡는 지점: 오른손에서 날 쪽으로 (m)
COMMON=[('walk','Walking_A'),('run','Running_A'),('roll','Dodge_Forward'),('dodgeB','Dodge_Backward'),('dodgeL','Dodge_Left'),('dodgeR','Dodge_Right'),
        ('hit','Hit_A'),('hit2','Hit_B'),('death','Death_A'),('guard','Blocking'),('guardHit','Block_Hit'),('guardUp','Block'),('cheer','Cheer'),('pickup','PickUp'),
        ('counter','Block_Attack')]   # counter: 막아 세웠다가 밀어내는 한 동작 — 카운터 연출의 본체
PROFILES={
  'ain':  dict(clips=[('idle','Unarmed_Idle'),('idle2','Idle'),('attack1','2H_Melee_Attack_Slice'),('attack2','2H_Melee_Attack_Chop'),('attack3','2H_Melee_Attack_Stab'),('smash','2H_Melee_Attack_Spin'),('ult','2H_Melee_Attack_Spinning'),
                      ('skill1','1H_Melee_Attack_Slice_Diagonal'),('skill2','Jump_Full_Short'),('skill3','1H_Melee_Attack_Slice_Horizontal'),('skill4','Spellcast_Raise'),('exec','1H_Melee_Attack_Stab')]+COMMON,
              two_hand={'idle','attack1','attack2','attack3','smash','ult','guard','guardHit','guardUp','walk','run','skill1','skill3','skill4','exec','counter'}, carry='scythe'),
  'kain': dict(clips=[('idle','Unarmed_Idle'),('idle2','Idle'),('attack1','2H_Melee_Attack_Slice'),('attack2','2H_Melee_Attack_Chop'),('attack3','2H_Melee_Attack_Stab'),('smash','2H_Melee_Attack_Spin'),('ult','2H_Melee_Attack_Spinning'),
                      ('skill1','1H_Melee_Attack_Chop'),('skill2','Jump_Full_Short'),('skill3','1H_Melee_Attack_Slice_Horizontal'),('skill4','Spellcast_Raise'),('exec','1H_Melee_Attack_Stab')]+COMMON,
              two_hand={'idle','attack1','attack2','attack3','smash','ult','guard','guardHit','guardUp','walk','run','skill1','skill3','skill4','exec','counter'}, carry='sword'),
  'ryu':  dict(clips=[('idle','Unarmed_Idle'),('idle2','Idle'),('attack1','1H_Melee_Attack_Slice_Horizontal'),('attack2','1H_Melee_Attack_Chop'),('attack3','1H_Melee_Attack_Stab'),('smash','Dualwield_Melee_Attack_Slice'),('ult','Dualwield_Melee_Attack_Chop'),
                      ('skill1','Dualwield_Melee_Attack_Stab'),('skill2','Jump_Full_Short'),('skill3','1H_Melee_Attack_Slice_Diagonal'),('skill4','Spellcast_Raise'),('exec','1H_Melee_Attack_Stab')]+COMMON,
              two_hand=set(), carry=None),
  'sera': dict(clips=[('idle','Unarmed_Idle'),('idle2','Idle'),('attack1','Throw'),('attack2','Spellcast_Shoot'),('attack3','Spellcast_Raise'),('smash','Spellcast_Long'),('ult','Spellcasting'),
                      ('skill1','1H_Ranged_Shoot'),('skill2','Jump_Full_Short'),('skill3','1H_Ranged_Shooting'),('skill4','Use_Item'),('exec','1H_Melee_Attack_Stab')]+COMMON,
              two_hand=set(), carry=None),
}
# 모션 증폭: 상체 회전을 «각도» 기준으로 키운다. 크게 휘두르는 것이 눈에 보여야 한다.
# 소스 포즈 단계에서 키우므로 양손 그립 IK 가 증폭된 자세를 기준으로 다시 풀린다 (왼손이 자루에서 떨어지지 않는다).
AMP={'attack1':1.38,'attack2':1.38,'attack3':1.32,'smash':1.45,'ult':1.45,
     'skill1':1.42,'skill2':1.24,'skill3':1.45,'skill4':1.28,'exec':1.45,'counter':1.36,
     'hit':1.18,'hit2':1.18,'guardHit':1.20}
AMP_BONES=('spine','chest','head','upperarm.l','lowerarm.l','upperarm.r','lowerarm.r')
# 모캡(CMU)으로 몸을 갈아끼우는 것은 tools/3d/mocap_apply.py 가 «이미 구운 GLB» 위에서 한다
# — 여기서 처음부터 구울 때는 KayKit 클립만 쓴다.
PROF=PROFILES[CHAR]; CLIPS=PROF['clips']; TWO_HAND=PROF['two_hand']
MAP={'hips':'Hips','spine':'Spine','chest':'Spine2','head':'Head','upperarm.l':'LeftArm','lowerarm.l':'LeftForeArm','hand.l':'LeftHand','upperarm.r':'RightArm','lowerarm.r':'RightForeArm','hand.r':'RightHand',
     'upperleg.l':'LeftUpLeg','lowerleg.l':'LeftLeg','foot.l':'LeftFoot','toes.l':'LeftToeBase','upperleg.r':'RightUpLeg','lowerleg.r':'RightLeg','foot.r':'RightFoot','toes.r':'RightToeBase','handslot.r':'RightHandSlot','handslot.l':'LeftHandSlot'}

bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene; sc.render.fps=24
# ---------- 1. 아인 메시 + 뼈대 (rig_ain.py 와 동일) ----------
bpy.ops.import_scene.gltf(filepath=AIN)
mesh=[o for o in bpy.data.objects if o.type=='MESH'][0]; mesh.name=CHAR.capitalize()+'_Mesh'
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active=mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o.type=='EMPTY': bpy.data.objects.remove(o)
co=np.array([v.co[:] for v in mesh.data.vertices])
def B(x,y,z=0.0): return Vector((x, -z, y))
HT=float(co[:,2].max()); K=HT/1.68
def outer(yf, band=0.025):
    sel=np.abs(co[:,2]-yf*HT)<band*HT
    return float(np.abs(co[sel,0]).max()) if sel.any() else 0.3*K
def center_z(yf, band=0.03):
    sel=np.abs(co[:,2]-yf*HT)<band*HT
    return float(-co[sel,1].mean()) if sel.any() else 0.0   # glTF z (앞 +)
AX=max(outer(0.79),outer(0.81),outer(0.83))-0.045*K; EX=outer(0.649)-0.045*K; HX=outer(0.482)-0.02*K     # 어깨·팔꿈치·손 x (바깥 실루엣에서 팔 반지름만큼 안쪽)
AX=max(AX,0.14*K); EX=max(EX,AX+0.02); HX=max(HX,EX+0.02)
LX=0.057*HT; TZ=center_z(0.70)
J={ 'Hips':B(0,0.583*HT,TZ), 'Spine':B(0,0.631*HT,TZ), 'Spine1':B(0,0.690*HT,TZ), 'Spine2':B(0,0.756*HT,TZ), 'Neck':B(0,0.857*HT,TZ), 'Head':B(0,0.905*HT,TZ), 'HeadTop_End':B(0,HT,TZ+0.02) }
for s_,sg in (('Left',1),('Right',-1)):
    J[s_+'Shoulder']=B(sg*0.04*K,0.839*HT,TZ); J[s_+'Arm']=B(sg*AX,0.824*HT,TZ); J[s_+'ForeArm']=B(sg*EX,0.649*HT,TZ-0.01); J[s_+'Hand']=B(sg*HX,0.482*HT,TZ); J[s_+'HandEnd']=B(sg*(HX+0.02),0.417*HT,TZ+0.01)
    J[s_+'UpLeg']=B(sg*LX*0.95,0.565*HT,TZ); J[s_+'Leg']=B(sg*LX,0.298*HT,TZ+0.02); J[s_+'Foot']=B(sg*LX,0.071*HT,TZ-0.01); J[s_+'ToeBase']=B(sg*LX,0.018*HT,TZ+0.10*K); J[s_+'Toe_End']=B(sg*LX,0.012*HT,TZ+0.17*K)
J['RightHandSlot']=B(-(HX+0.01),0.452*HT,TZ+0.03); J['RightHandSlotEnd']=B(-(HX+0.01),0.452*HT,TZ+0.14)   # 손바닥, 앞(+Z glTF)을 향함
J['LeftHandSlot']=B((HX+0.01),0.452*HT,TZ+0.03); J['LeftHandSlotEnd']=B((HX+0.01),0.452*HT,TZ+0.14)
print('landmarks HT=%.3f armX=%.3f elbowX=%.3f handX=%.3f torsoZ=%.3f'%(HT,AX,EX,HX,TZ))
BONES=[('Hips',None,'Hips','Spine'),('Spine','Hips','Spine','Spine1'),('Spine1','Spine','Spine1','Spine2'),('Spine2','Spine1','Spine2','Neck'),('Neck','Spine2','Neck','Head'),('Head','Neck','Head','HeadTop_End')]
for s in ('Left','Right'):
    BONES+=[(s+'Shoulder','Spine2',s+'Shoulder',s+'Arm'),(s+'Arm',s+'Shoulder',s+'Arm',s+'ForeArm'),(s+'ForeArm',s+'Arm',s+'ForeArm',s+'Hand'),(s+'Hand',s+'ForeArm',s+'Hand',s+'HandEnd'),
            (s+'UpLeg','Hips',s+'UpLeg',s+'Leg'),(s+'Leg',s+'UpLeg',s+'Leg',s+'Foot'),(s+'Foot',s+'Leg',s+'Foot',s+'ToeBase'),(s+'ToeBase',s+'Foot',s+'ToeBase',s+'Toe_End')]
BONES.append(('RightHandSlot','RightHand','RightHandSlot','RightHandSlotEnd')); BONES.append(('LeftHandSlot','LeftHand','LeftHandSlot','LeftHandSlotEnd'))
arm_data=bpy.data.armatures.new('Armature'); arm=bpy.data.objects.new('Armature',arm_data); sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT')
for n,p,h,t in BONES:
    eb=arm_data.edit_bones.new('mixamorig:'+n); eb.head=J[h]; eb.tail=J[t]
    if p: eb.parent=arm_data.edit_bones['mixamorig:'+p]; eb.use_connect=(J[h]-arm_data.edit_bones['mixamorig:'+p].tail).length<1e-6
bpy.ops.object.mode_set(mode='OBJECT')
R={'Hips':0.16,'Spine':0.15,'Spine1':0.15,'Spine2':0.15,'Neck':0.07,'Head':0.12}
for s in ('Left','Right'): R.update({s+'Shoulder':0.08,s+'Arm':0.07,s+'ForeArm':0.06,s+'Hand':0.06,s+'UpLeg':0.11,s+'Leg':0.09,s+'Foot':0.07,s+'ToeBase':0.06})
SKIN=[b for b in BONES if b[0] not in ('RightHandSlot','LeftHandSlot')]
names=[n for n,_,_,_ in SKIN]; H=np.array([J[h][:] for _,_,h,_ in SKIN]); T=np.array([J[t][:] for _,_,_,t in SKIN]); RAD=np.array([R[n] for n in names])
def segdist(P,A,Bv):
    AB=Bv-A; t=np.clip(((P-A)@AB)/(AB@AB+1e-12),0,1); Q=A+t[:,None]*AB; return np.linalg.norm(P-Q,axis=1)
D=np.stack([segdist(co,H[i],T[i]) for i in range(len(names))],1); X=np.abs(co[:,0]); Y=co[:,2]
for i,n in enumerate(names):
    if 'Arm' in n or 'Hand' in n or 'Shoulder' in n: D[:,i]+=np.where(X<0.14*K,0.25,0.0)
    if 'Leg' in n or 'Foot' in n or 'Toe' in n: D[:,i]+=np.where(Y>0.595*HT,0.3,0.0)
W=np.exp(-(D/RAD)**2); nearest=np.argmin(D,1); W[np.arange(len(co)),nearest]=np.maximum(W[np.arange(len(co)),nearest],1e-3)
top=np.argsort(-W,1)[:,:4]; Wt=np.take_along_axis(W,top,1); Wt/=Wt.sum(1,keepdims=True)
for n in names: mesh.vertex_groups.new(name='mixamorig:'+n)
vg=mesh.vertex_groups
for vi in range(len(co)):
    for k in range(4):
        if Wt[vi,k]>0.01: vg[int(top[vi,k])].add([vi], float(Wt[vi,k]), 'REPLACE')
mesh.parent=arm; mod=mesh.modifiers.new('Armature','ARMATURE'); mod.object=arm
for pb in arm.pose.bones: pb.rotation_mode='QUATERNION'
# ---------- 2. (선택) 무기 미리보기 부착 ----------
sroot=None
if SCYTHE:
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
# ---------- 3. 소스 (KayKit) ----------
# 리타게팅은 Rw = SP · SREST⁻¹ · TREF 라, 소스마다 «휴식 자세(SREST)» 와 «그에 대응하는
# 목표 참조 자세(TREF)» 두 개만 있으면 된다 — make_source 가 그 한 쌍을 만든다.
def rot_between(a,b): return a.normalized().rotation_difference(b.normalized())
order=[b.name for b in arm.data.bones]  # 부모 우선 (생성 순서)
parent={b.name:(b.parent.name if b.parent else None) for b in arm.data.bones}
RESTL={b.name:b.matrix_local.copy() for b in arm.data.bones}

def make_source(srcobj, label):
    srcobj.animation_data_create()
    # 목표 참조 자세: 소스 휴식 자세의 위팔 방향에 목표의 팔을 맞춘다
    # (소스가 A 포즈인데 목표를 T 로 두면 자유로운 팔이 45° 이상 들린다)
    SDIR={}
    for sname,tname in (('upperarm.l','Left'),('upperarm.r','Right')):
        sb=srcobj.data.bones[sname]; SDIR[tname]=(srcobj.matrix_world.to_3x3()@(sb.tail_local-sb.head_local)).normalized()
    for s_ in ('Left','Right'):
        pb=arm.pose.bones['mixamorig:'+s_+'Arm']; bn=arm.data.bones['mixamorig:'+s_+'Arm']
        d=(bn.tail_local-bn.head_local); q=rot_between(d,SDIR[s_])
        Rr=bn.matrix_local.to_3x3(); pb.rotation_quaternion=(Rr.inverted()@q.to_matrix()@Rr).to_quaternion()
    bpy.context.view_layer.update()
    TREF={b.name:(arm.matrix_world@arm.pose.bones[b.name].matrix).copy() for b in arm.data.bones}
    for pb in arm.pose.bones: pb.rotation_quaternion=(1,0,0,0); pb.location=(0,0,0)
    bpy.context.view_layer.update()
    SREST={b.name:(srcobj.matrix_world@b.matrix_local).copy() for b in srcobj.data.bones}
    smap={k:v for k,v in MAP.items() if k in SREST}          # 소스에 없는 뼈(모캡엔 handslot 이 없다)는 뺀다
    for side,slot in (('Right','handslot.r'),('Left','handslot.l')):
        if slot in SREST:   # 슬롯 뼈: 소스 휴식 방향을 그대로 참조로 (같은 월드 방향이 된다)
            TREF['mixamorig:'+side+'HandSlot']=Matrix.Translation(TREF['mixamorig:'+side+'HandSlot'].to_translation())@SREST[slot].to_3x3().to_4x4()
    # 골반 이동 배율: 소스 다리 길이 → 목표 다리 길이. 모캡은 m, KayKit 은 자체 단위라 소스에서 잰다.
    legs=SREST['upperleg.l'].to_translation().z-SREST['foot.l'].to_translation().z
    hip=(J['LeftUpLeg'].z-J['LeftFoot'].z)/max(1e-4,abs(legs))
    print('source %s: 다리 %.3f → hip_scale %.3f, 뼈 %d개'%(label,abs(legs),hip,len(smap)))
    return dict(label=label, arm=srcobj, SREST=SREST, TREF=TREF, map=smap,
                inv={'mixamorig:'+v:k for k,v in smap.items()}, hip=hip)

before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=KAY); new=[o for o in bpy.data.objects if o not in before]
src=[o for o in new if o.type=='ARMATURE'][0]
for o in new:
    if o.type!='ARMATURE': o.hide_set(True); o.hide_render=True
KAYSRC=make_source(src,'kaykit')

hip_scale=KAYSRC['hip']
# ---------- 4. 리타게팅 ----------
arm.animation_data_create()
import rig_core
_IK=rig_core.build(J, parent, RESTL, CHAR, PROF, LEFT_OFF)
ydir=_IK['ydir']; carry=_IK['carry']; blend_carry=_IK['blend_carry']; carry_weight=_IK['carry_weight']
relax_both=_IK['relax_both']; path_spec=_IK['path_spec']; CARRY=_IK['CARRY']; PATHS=_IK['PATHS']


def retarget(action, clip, S=None):
    S=S or KAYSRC; SRC=S['arm']; SREST=S['SREST']; TREF=S['TREF']; inv_map=S['inv']; hip_scale=S['hip']
    f0,f1=int(action.frame_range[0]),int(action.frame_range[1]); SRC.animation_data.action=action
    new=bpy.data.actions.new(clip); arm.animation_data.action=new; errs=[]
    amp=AMP.get(clip,1.0)
    for f in range(f0,f1+1):
        sc.frame_set(f)
        if amp!=1.0:
            for bn in AMP_BONES:
                pb=SRC.pose.bones.get(bn)
                if not pb: continue
                if pb.rotation_mode!='QUATERNION': pb.rotation_mode='QUATERNION'
                q=pb.rotation_quaternion.normalized(); ang=q.angle
                if ang>1e-4: pb.rotation_quaternion=Quaternion(q.axis, max(-2.8,min(2.8,ang*amp)))
            bpy.context.view_layer.update()
        SP={n:(SRC.matrix_world@SRC.pose.bones[n].matrix).copy() for n in S['map']}
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
        if PROF['carry'] is None: relax_both(world, clip)
        elif clip in CARRY: errs.append(carry(world,CARRY[clip]))
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
for o in ([sroot] if sroot else [])+[c for c in bpy.data.objects if sroot and (c.parent is sroot or (c.parent and c.parent.parent is sroot))]:
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
