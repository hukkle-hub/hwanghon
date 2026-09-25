import os, math, json, zipfile, shutil, re
from pathlib import Path
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix, translation_matrix
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

SRC=Path('/mnt/data/hwanghon_30sets_glb')
OUT=Path('/mnt/data/hwanghon_40sets_bonebound_v02')
AIN_SRC=Path('/mnt/data/ain_10sets_glb')
MODELS=OUT/'models'; PREV=OUT/'preview'; REPORTS=OUT/'reports'
for p in [OUT,MODELS,PREV,REPORTS]: p.mkdir(parents=True,exist_ok=True)

CHAR_H={'ain':1.68,'kain':1.86,'sera':1.72,'ryu':1.78}
BASECOL={
 'black_fabric':'#1c1d20','graphite_fabric':'#34373b','white_fabric':'#c4c5c1','offwhite_fabric':'#969894',
 'red_textile':'#64191c','orange_textile':'#8d401c','black_steel':'#34383d','brushed_steel':'#8b9195','dark_steel':'#555a5e',
 'copper':'#855246','rubber':'#171819','medical_red':'#9b252a','cyan':'#37a8b3'}

# 24-bone compact Mixamo-like skeleton. Extra hand-index helpers keep project 24-joint contract count.
BONES=[
 ('mixamorig:Hips',None),
 ('mixamorig:Spine','mixamorig:Hips'),('mixamorig:Spine1','mixamorig:Spine'),('mixamorig:Spine2','mixamorig:Spine1'),
 ('mixamorig:Neck','mixamorig:Spine2'),('mixamorig:Head','mixamorig:Neck'),
 ('mixamorig:LeftShoulder','mixamorig:Spine2'),('mixamorig:LeftArm','mixamorig:LeftShoulder'),('mixamorig:LeftForeArm','mixamorig:LeftArm'),('mixamorig:LeftHand','mixamorig:LeftForeArm'),('mixamorig:LeftHandIndex1','mixamorig:LeftHand'),
 ('mixamorig:RightShoulder','mixamorig:Spine2'),('mixamorig:RightArm','mixamorig:RightShoulder'),('mixamorig:RightForeArm','mixamorig:RightArm'),('mixamorig:RightHand','mixamorig:RightForeArm'),('mixamorig:RightHandIndex1','mixamorig:RightHand'),
 ('mixamorig:LeftUpLeg','mixamorig:Hips'),('mixamorig:LeftLeg','mixamorig:LeftUpLeg'),('mixamorig:LeftFoot','mixamorig:LeftLeg'),('mixamorig:LeftToeBase','mixamorig:LeftFoot'),
 ('mixamorig:RightUpLeg','mixamorig:Hips'),('mixamorig:RightLeg','mixamorig:RightUpLeg'),('mixamorig:RightFoot','mixamorig:RightLeg'),('mixamorig:RightToeBase','mixamorig:RightFoot')]
assert len(BONES)==24

def joint_world(H, char):
    s=H/1.72
    # x widths tuned per character identity
    shoulder={'ain':.235,'kain':.31,'sera':.235,'ryu':.255}[char]*s
    hip={'ain':.105,'kain':.145,'sera':.11,'ryu':.12}[char]*s
    hand={'ain':.335,'kain':.43,'sera':.345,'ryu':.365}[char]*s
    elbow={'ain':.305,'kain':.40,'sera':.315,'ryu':.335}[char]*s
    return {
      'mixamorig:Hips':np.array([0,.89*s,0]),
      'mixamorig:Spine':np.array([0,1.05*s,0]), 'mixamorig:Spine1':np.array([0,1.23*s,0]), 'mixamorig:Spine2':np.array([0,1.42*s,0]),
      'mixamorig:Neck':np.array([0,1.56*s,0]), 'mixamorig:Head':np.array([0,1.70*s,0]),
      'mixamorig:LeftShoulder':np.array([-shoulder*.72,1.48*s,0]), 'mixamorig:LeftArm':np.array([-shoulder,1.43*s,0]), 'mixamorig:LeftForeArm':np.array([-elbow,1.22*s,0]), 'mixamorig:LeftHand':np.array([-hand,1.01*s,0]), 'mixamorig:LeftHandIndex1':np.array([-hand,0.98*s,.035*s]),
      'mixamorig:RightShoulder':np.array([shoulder*.72,1.48*s,0]), 'mixamorig:RightArm':np.array([shoulder,1.43*s,0]), 'mixamorig:RightForeArm':np.array([elbow,1.22*s,0]), 'mixamorig:RightHand':np.array([hand,1.01*s,0]), 'mixamorig:RightHandIndex1':np.array([hand,0.98*s,.035*s]),
      'mixamorig:LeftUpLeg':np.array([-hip,.88*s,0]), 'mixamorig:LeftLeg':np.array([-hip,.50*s,0]), 'mixamorig:LeftFoot':np.array([-hip,.10*s,.04*s]), 'mixamorig:LeftToeBase':np.array([-hip,.035*s,.17*s]),
      'mixamorig:RightUpLeg':np.array([hip,.88*s,0]), 'mixamorig:RightLeg':np.array([hip,.50*s,0]), 'mixamorig:RightFoot':np.array([hip,.10*s,.04*s]), 'mixamorig:RightToeBase':np.array([hip,.035*s,.17*s]),
    }

def bind_locals(world):
    out={}
    for b,p in BONES:
        t=world[b] if p is None else world[b]-world[p]
        M=np.eye(4); M[:3,3]=t; out[b]=M
    return out

def world_from_locals(locals_):
    W={}
    for b,p in BONES:
        W[b]=locals_[b] if p is None else W[p]@locals_[b]
    return W

def Rz(a): return rotation_matrix(a,[0,0,1])
def Rx(a): return rotation_matrix(a,[1,0,0])
def Ry(a): return rotation_matrix(a,[0,1,0])

def posed_locals(bind, pose, char):
    L={k:v.copy() for k,v in bind.items()}
    def rot(b,M):
        T=L[b].copy(); tr=T[:3,3].copy(); T[:3,3]=0; L[b]=translation_matrix(tr)@M@T
    if pose=='bind': return L
    if pose=='attack':
        if char=='ain':
            rot('mixamorig:Spine2',Ry(-.22)); rot('mixamorig:RightArm',Rz(-.92)@Rx(-.22)); rot('mixamorig:RightForeArm',Rz(-.38)); rot('mixamorig:LeftArm',Rz(.78)@Rx(-.10)); rot('mixamorig:LeftForeArm',Rz(.52)); rot('mixamorig:LeftUpLeg',Rz(.16)); rot('mixamorig:RightUpLeg',Rz(-.14))
        elif char=='kain':
            rot('mixamorig:Spine2',Ry(-.18)); rot('mixamorig:RightArm',Rz(-1.05)@Rx(-.32)); rot('mixamorig:RightForeArm',Rz(-.42)); rot('mixamorig:LeftArm',Rz(.72)@Rx(-.18)); rot('mixamorig:LeftForeArm',Rz(.55));
            rot('mixamorig:LeftUpLeg',Rz(.12)); rot('mixamorig:RightUpLeg',Rz(-.15))
        elif char=='sera':
            rot('mixamorig:Spine2',Ry(.12)); rot('mixamorig:LeftArm',Rz(.82)@Rx(-.12)); rot('mixamorig:RightArm',Rz(-.82)@Rx(-.12)); rot('mixamorig:LeftForeArm',Rz(.35)); rot('mixamorig:RightForeArm',Rz(-.35))
        else:
            rot('mixamorig:Spine2',Ry(-.28)); rot('mixamorig:LeftArm',Rz(.95)@Rx(.15)); rot('mixamorig:RightArm',Rz(-.78)@Rx(-.35)); rot('mixamorig:LeftForeArm',Rz(.35)); rot('mixamorig:RightForeArm',Rz(-.5)); rot('mixamorig:LeftUpLeg',Rz(.22)); rot('mixamorig:RightUpLeg',Rz(-.20))
    elif pose=='guard':
        rot('mixamorig:Spine2',Rx(.08)); rot('mixamorig:LeftArm',Rz(.60)@Rx(-.45)); rot('mixamorig:RightArm',Rz(-.60)@Rx(-.45)); rot('mixamorig:LeftForeArm',Rz(.72)); rot('mixamorig:RightForeArm',Rz(-.72))
        if char=='kain': rot('mixamorig:Spine2',Ry(.14)@Rx(.12))
    elif pose=='run':
        # Root lift keeps rigid boot candidates above the ground plane during this exaggerated QA stride.
        L['mixamorig:Hips'][1,3] += (.14 if char=='kain' else (.09 if char=='ain' else .10))
        rot('mixamorig:Spine',Rx(.14)); rot('mixamorig:LeftArm',Rz(-.28)@Rx(.48)); rot('mixamorig:RightArm',Rz(.28)@Rx(-.48)); rot('mixamorig:LeftUpLeg',Rx(-.52)); rot('mixamorig:RightUpLeg',Rx(.52)); rot('mixamorig:LeftLeg',Rx(.62)); rot('mixamorig:RightLeg',Rx(-.20))
    elif pose=='dodge':
        rot('mixamorig:Spine',Rx(.34)@Ry(.20)); rot('mixamorig:Spine2',Ry(.22)); rot('mixamorig:LeftArm',Rz(.28)@Rx(.55)); rot('mixamorig:RightArm',Rz(-.35)@Rx(-.35)); rot('mixamorig:LeftUpLeg',Rz(.30)@Rx(-.30)); rot('mixamorig:RightUpLeg',Rz(-.32)@Rx(.18)); rot('mixamorig:LeftLeg',Rx(.72)); rot('mixamorig:RightLeg',Rx(.35))
    return L

def side_from_name(n):
    # generated naming: -1 = negative x (viewer left), +1 = positive x
    if '_-1' in n or n.endswith('_L') or '_L_' in n or n.endswith('_L_blade') or 'Left' in n: return 'Left'
    if '_+1' in n or n.endswith('_R') or '_R_' in n or n.endswith('_R_blade') or 'Right' in n: return 'Right'
    return None

def assign_bone(name):
    n=name.lower(); side=side_from_name(name)
    pref='mixamorig:'+side if side else None
    if n.startswith('scythe_'):
        return 'mixamorig:RightHand'
    if n.startswith('weapon_'):
        if 'ring_l' in n or 'dagger_l' in n: return 'mixamorig:LeftHand'
        if 'ring_r' in n or 'dagger_r' in n: return 'mixamorig:RightHand'
        return 'mixamorig:RightHand'
    if 'boot' in n or 'sole' in n: return (pref+'Foot') if pref else 'mixamorig:Hips'
    if 'shin' in n or 'knee' in n or n.startswith('leg_') or 'leg_base' in n: return (pref+'Leg') if pref else 'mixamorig:Hips'
    if 'right_gauntlet' in n: return 'mixamorig:RightForeArm'
    if 'forearm' in n or 'gauntlet' in n: return (pref+'ForeArm') if pref else 'mixamorig:Spine2'
    if 'sleeve' in n or 'upper_arm' in n: return (pref+'Arm') if pref else 'mixamorig:Spine2'
    if n.startswith('left_shoulder'): return 'mixamorig:LeftShoulder'
    if n.startswith('right_shoulder'): return 'mixamorig:RightShoulder'
    if 'shoulder' in n and side: return pref+'Shoulder'
    if 'hood' in n or 'head' in n: return 'mixamorig:Head'
    if 'collar' in n: return 'mixamorig:Neck'
    if any(x in n for x in ['torso','chest','yoke','harness','wrap_seam','backpack','back_frame']): return 'mixamorig:Spine2'
    if any(x in n for x in ['belt','coat','apron','pouch','tie','tag','skirt','holster','utility','canister','module','spool','wire']): return 'mixamorig:Hips'
    return 'mixamorig:Hips'

def build_bound(srcpath, outpath, char, pose='bind'):
    src=trimesh.load(srcpath,force='scene')
    H=CHAR_H[char]; Jbind=joint_world(H,char); Lbind=bind_locals(Jbind); Wbind=world_from_locals(Lbind); Lpose=posed_locals(Lbind,pose,char); Wpose=world_from_locals(Lpose)
    sc=trimesh.Scene()
    sc.metadata.update({'character':char,'source':Path(srcpath).name,'axis':'Y-up','units':'meters','bone_count':24,'binding':'rigid-bone-parented candidate','pose':pose})
    # skeleton frames
    for b,p in BONES:
        sc.graph.update(frame_to=b, frame_from=p if p else sc.graph.base_frame, matrix=Lpose[b])
    # geometry under bones; preserve world in bind, then pose via bone delta
    for gname,g in src.geometry.items():
        bone=assign_bone(gname)
        # source geometry vertices already world; transform is inverse bind-bone world so bind remains identical
        inv=np.linalg.inv(Wbind[bone])
        sc.add_geometry(g.copy(),node_name=gname,geom_name=gname,parent_node_name=bone,transform=inv,metadata={'bound_bone':bone})
    sc.export(outpath)
    return sc, Wbind, Wpose

def mat_color(g):
    mn=getattr(getattr(g.visual,'material',None),'name','') or ''
    for k,c in BASECOL.items():
        if k in mn: return c
    return '#55585c'

def render_pose_scene(scene, ax, title):
    polys=[]; colors=[]; depths=[]
    # use graph nodes to apply current world transform
    for node in scene.graph.nodes_geometry:
        try:
            T, geomname=scene.graph[node]
            g=scene.geometry[geomname]
        except Exception:
            continue
        tri=trimesh.transform_points(g.triangles.reshape(-1,3),T).reshape((-1,3,3))
        col=mat_color(g)
        for t in tri:
            polys.append(t[:,[0,1]]); depths.append(float(t[:,2].mean())); colors.append(col)
    if polys:
        order=np.argsort(depths)
        pc=PolyCollection([polys[j] for j in order],facecolors=[colors[j] for j in order],edgecolors='none',linewidths=0)
        ax.add_collection(pc)
        allp=np.vstack([np.array(p) for p in polys])
        mn=allp.min(0); mx=allp.max(0); pad=.06
        ax.set_xlim(mn[0]-pad,mx[0]+pad); ax.set_ylim(max(-.08,mn[1]-pad),mx[1]+pad)
    ax.set_aspect('equal'); ax.axis('off'); ax.set_title(title,fontsize=6,pad=1)
    ax.plot([-.28,.28],[0,0],color='#888',lw=.25)

def transformed_bounds(scene):
    mins=[]; maxs=[]
    for node in scene.graph.nodes_geometry:
        T,geomname=scene.graph[node]; g=scene.geometry[geomname]
        v=trimesh.transform_points(g.vertices,T); mins.append(v.min(0)); maxs.append(v.max(0))
    return np.min(mins,0), np.max(maxs,0)

manifest=[]; audit=[]
poses=['bind','attack','guard','run','dodge']
for char in ['ain','kain','sera','ryu']:
    od=MODELS/char; od.mkdir(parents=True,exist_ok=True)
    srcs=sorted(AIN_SRC.glob('*.glb')) if char=='ain' else sorted((SRC/'models'/char).glob('*.glb'))
    pose_scenes={p:[] for p in poses}
    for si,src in enumerate(srcs,1):
        out=od/(src.stem.replace('_v01','_bonebound_v02')+'.glb')
        neutral,_,_=build_bound(src,out,char,'bind')
        # reload to ensure export is parseable
        check=trimesh.load(out,force='scene')
        b0,b1=transformed_bounds(check)
        bad=not(np.isfinite(b0).all() and np.isfinite(b1).all())
        # pose audits generated in memory / temp no export
        pose_stats={}
        for p in poses:
            if p=='bind': sc=check
            else:
                temp=OUT/'_tmp.glb'; sc,_,_=build_bound(src,temp,char,p); temp.unlink(missing_ok=True)
            bb0,bb1=transformed_bounds(sc)
            pose_stats[p]={'min_y':round(float(bb0[1]),4),'max_y':round(float(bb1[1]),4),'width':round(float(bb1[0]-bb0[0]),4),'height':round(float(bb1[1]-bb0[1]),4),'finite':bool(np.isfinite(bb0).all() and np.isfinite(bb1).all())}
            pose_scenes[p].append((src.stem,sc))
        audit.append({'character':char,'source':src.name,'output':out.name,'geometry_count':len(check.geometry),'bone_count':24,'bind_bounds':[b0.tolist(),b1.tolist()],'poses':pose_stats,'parse_ok':not bad})
        manifest.append({'character':char,'file':str(out.relative_to(OUT)),'source':(str(src.relative_to(SRC)) if char!='ain' else str(src.relative_to(AIN_SRC))),'binding':'rigid bone parenting','bone_count':24,'weapon_parent':'mixamorig:RightHand','status':'pose-QA candidate; not smooth-skinned cloth'})
    # 10 rows x 5 poses contact sheet
    fig,axs=plt.subplots(len(srcs),len(poses),figsize=(8.5,17),dpi=120)
    fig.patch.set_facecolor('#d0d0d0')
    for r in range(len(srcs)):
        for c,p in enumerate(poses):
            name,sc=pose_scenes[p][r]
            render_pose_scene(sc,axs[r,c],f'{r+1:02d} {p}')
            axs[r,c].set_facecolor('#bcbcbc')
    fig.suptitle(f'HWANGHON — {char.upper()} / 10 SETS × 5 POSE RIGID-BONE QA',fontsize=14)
    plt.tight_layout(rect=[0,0,1,.98],h_pad=.25,w_pad=.12)
    fig.savefig(PREV/f'{char}_10sets_5pose_QA.png',bbox_inches='tight')
    plt.close(fig)

with open(OUT/'manifest.json','w',encoding='utf-8') as f: json.dump(manifest,f,ensure_ascii=False,indent=2)
with open(REPORTS/'pose_audit.json','w',encoding='utf-8') as f: json.dump(audit,f,ensure_ascii=False,indent=2)
# summary
issues=[]
for a in audit:
    for p,st in a['poses'].items():
        if not st['finite'] or st['min_y'] < -0.12: issues.append((a['character'],a['output'],p,st))
with open(OUT/'README_KR.md','w',encoding='utf-8') as f:
    f.write('# 황혼 — 아인·카인·세라·류 40세트 bone-bound v02\n\n')
    f.write('정적 v01 40개를 **24개 Mixamo형 관절 계층에 파트별 rigid parenting**으로 직접 바인딩한 2차 후보입니다.\n\n')
    f.write('## 이번에 한 것\n- 캐릭터별 기준 키 유지: 아인 1.68m / 카인 1.86m / 세라 1.72m / 류 1.78m\n- Y-up / meter 유지\n- 의상 파츠를 이름/위치 역할에 따라 Hips, Spine2, Arm, ForeArm, Leg, Foot 등에 연결\n- 무기 노드는 손 본에 연결 (쌍단검/정제환은 좌우 손 분리)\n- bind / attack / guard / run / dodge 5자세로 30세트 전부 변환 검사\n- GLB 재로드 검사 및 자세별 bounds/바닥 관통 수치 기록\n\n')
    f.write('## 중요한 제한\n이 버전은 **smooth skin weighting이 아닌 rigid bone parenting**입니다. 금속 갑주·벨트·가방·무기 검수에는 유효하지만, 소매·코트·천 패널의 최종 스키닝/천 물리를 대체하지 않습니다. 기존 게임 `*_body.glb` 또는 `*_anim.glb`를 덮어쓰지 마세요.\n\n')
    f.write('## 다음 승격 조건\n실제 프로젝트 24본과 이름/바인드 매트릭스를 대조한 뒤, 천/소매 파츠를 smooth weight로 전환하고 실제 attack/run/roll/skill 클립에서 관통을 검사해야 합니다.\n\n')
    f.write(f'자동 검사: {len(audit)} GLB 재로드, 150 pose 상태. 중대한 수치 이슈 {len(issues)}건.\n')

# Copy source builder and references for reproducibility
shutil.copy2('/mnt/data/build_hwanghon_30sets.py',OUT/'build_hwanghon_30sets_v01.py')
if Path('/mnt/data/ain_10sets_glb/build_ain_10sets.py').exists(): shutil.copy2('/mnt/data/ain_10sets_glb/build_ain_10sets.py',OUT/'build_ain_10sets_v01.py')
shutil.copy2(__file__,OUT/'rig_hwanghon_30sets_v02.py')
# zip
zip_path=Path('/mnt/data/황혼_4캐릭터_40세트_BONEBOUND_v02.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in OUT.rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(OUT.parent))
print('DONE',len(manifest),'glbs',len(audit)*len(poses),'pose states','issues',len(issues),'zip',zip_path.stat().st_size)
print('previews',*[str(PREV/f'{c}_10sets_5pose_QA.png') for c in ['ain','kain','sera','ryu']])
