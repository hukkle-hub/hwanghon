# 이미 구운 <char>_anim.glb 에 CMU 모캡 클립만 갈아끼운다 (bpy 4.2).
#   CHAR=ain python3 tools/3d/mocap_apply.py art/3d/ain_anim.glb
#
# 왜 rig_char.py 를 다시 안 돌리는가: 그쪽은 KayKit 원본(Rogue.glb, CC0)이 있어야 처음부터
# 굽는다. 모캡은 «몇 개 클립만» 바꾸는 일이라 이미 구운 GLB 의 리그를 그대로 쓰는 편이
# 빠르고, 나머지 16개 클립을 건드릴 위험도 없다. 무기 IK 는 rig_core 로 공유한다.
#
# 하는 일
#   1. <char>_anim.glb 임포트 → 아마추어·메시·기존 클립(NLA)
#   2. 뼈 휴식 위치에서 관절 랜드마크 J 를 되찾아 rig_core 구성
#   3. art/3d/mocap/*.bvh 임포트 → CMU 뼈 이름을 KayKit 규약으로 → 소스 참조 자세
#   4. MOCAP 표의 클립만 리타게팅해 해당 NLA 트랙을 교체
#   5. 다시 GLB 로
import bpy, sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig_core
from mathutils import Vector, Matrix

OUT = sys.argv[-1]
CHAR = os.environ.get('CHAR', 'ain')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.environ.get('BASE', os.path.join(ROOT, 'art', '3d', CHAR + '_anim.glb'))
MOCAP_DIR = os.environ.get('MOCAP_DIR', os.path.join(ROOT, 'art', '3d', 'mocap'))

# 모캡으로 «몸» 을 갈아끼우는 클립. 손그림 KayKit 이 못 주는 것만 바꾼다 —
# 체중 이동, 예비동작, 회복. 무기 궤도는 rig_core 의 PATHS/CARRY 가 계속 그린다.
#   idle     140_06  서서 숨쉬며 체중을 옮기는 대기 (기존 대기는 뻣뻣했다)
#   (roll 은 뺐다: CMU 구르기는 2.3초짜리 «장애물 다이브» 인데 우리 회피는 0.45초라
#    5배로 압축된다 — 가져오려던 무게가 오히려 사라진다. 손그림 회피를 유지한다.)
#   attack3  135_09  가라테 순찌르기 — 손목 최고 5.0 m/s
#   skill2   135_01  발색 카타의 최고 타 — 9.0 m/s (원래는 제자리 점프였다)
#   skill4   135_05  하단 쓸기 — 6.8 m/s (원래는 주문 동작이었다)
MOCAP = {'idle': 'mo_idle', 'attack3': 'mo_strike',
         'skill2': 'mo_strike_hard', 'skill4': 'mo_sweep_low',
         'brake': 'mo_brake'}
# 캐릭터별 제외: 모캡 몸통 위에서 무기 그립이 버티지 못하는 조합.
#   kain 의 attack3 은 대검 양손 그립이 가라테 런지 자세에서 14.6cm 벌어진다
#   (원본 0.001m → 모캡 0.146m, tools 측정). 나머지는 0.09m 이하라 유지한다.
MOCAP_SKIP = {}
PROFILES = {
    'ain':  dict(two_hand={'idle', 'attack1', 'attack2', 'attack3', 'smash', 'ult', 'guard', 'guardHit', 'guardUp', 'walk', 'run', 'skill1', 'skill3', 'skill4', 'exec', 'counter'}, carry='scythe'),
    'kain': dict(two_hand={'idle', 'attack1', 'attack2', 'attack3', 'smash', 'ult', 'guard', 'guardHit', 'guardUp', 'walk', 'run', 'skill1', 'skill3', 'skill4', 'exec', 'counter'}, carry='sword'),
    'ryu':  dict(two_hand=set(), carry=None),
    'sera': dict(two_hand=set(), carry=None),
}
for _p in PROFILES.values():
    if _p['two_hand']: _p['two_hand'] = _p['two_hand'] | {'brake'}   # 제동도 무기를 든 채 달리는 자세다
PROF = PROFILES[CHAR]; TWO_HAND = PROF['two_hand']
CMU2KAY = {'root': 'hips', 'lowerback': 'spine', 'thorax': 'chest', 'head': 'head',
           'lhumerus': 'upperarm.l', 'lradius': 'lowerarm.l', 'lwrist': 'hand.l',
           'rhumerus': 'upperarm.r', 'rradius': 'lowerarm.r', 'rwrist': 'hand.r',
           'lfemur': 'upperleg.l', 'ltibia': 'lowerleg.l', 'lfoot': 'foot.l', 'ltoes': 'toes.l',
           'rfemur': 'upperleg.r', 'rtibia': 'lowerleg.r', 'rfoot': 'foot.r', 'rtoes': 'toes.r'}
MAP = {'hips': 'Hips', 'spine': 'Spine', 'chest': 'Spine2', 'head': 'Head',
       'upperarm.l': 'LeftArm', 'lowerarm.l': 'LeftForeArm', 'hand.l': 'LeftHand',
       'upperarm.r': 'RightArm', 'lowerarm.r': 'RightForeArm', 'hand.r': 'RightHand',
       'upperleg.l': 'LeftUpLeg', 'lowerleg.l': 'LeftLeg', 'foot.l': 'LeftFoot', 'toes.l': 'LeftToeBase',
       'upperleg.r': 'RightUpLeg', 'lowerleg.r': 'RightLeg', 'foot.r': 'RightFoot', 'toes.r': 'RightToeBase'}

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = 24

# ---------- 1. 기존 캐릭터 ----------
bpy.ops.import_scene.gltf(filepath=BASE)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
order = [b.name for b in arm.data.bones]
parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
RESTL = {b.name: b.matrix_local.copy() for b in arm.data.bones}
# 기존 클립: NLA 트랙에 하나씩 들어 있다
old_tracks = {t.name: t for t in arm.animation_data.nla_tracks} if arm.animation_data else {}
print('불러온 클립 %d개: %s' % (len(old_tracks), ' '.join(sorted(old_tracks))))

# ---------- 2. 관절 랜드마크 되찾기 ----------
# rig_char.py 는 메시에서 J 를 추정해 뼈를 세웠다. 뼈가 이미 있으니 거꾸로 읽으면 같은 값이다.
J = {}
for b in arm.data.bones:
    J[b.name.replace('mixamorig:', '')] = b.head_local.copy()
for s_ in ('Left', 'Right'):     # 끝점만 있는 랜드마크
    J[s_ + 'HandEnd'] = arm.data.bones['mixamorig:' + s_ + 'Hand'].tail_local.copy()
_IK = rig_core.build(J, parent, RESTL, CHAR, PROF)
carry = _IK['carry']; blend_carry = _IK['blend_carry']; carry_weight = _IK['carry_weight']
relax_both = _IK['relax_both']; path_spec = _IK['path_spec']
CARRY = _IK['CARRY']; PATHS = _IK['PATHS']

# ---------- 3. 모캡 소스 ----------
def rot_between(a, b): return a.normalized().rotation_difference(b.normalized())

def facing(a):
    """휴식 자세의 정면 (좌우 고관절 축 × 위). 소스마다 다른 정면을 맞추려고 잰다."""
    M = a.matrix_world.to_3x3()
    L = a.data.bones['upperleg.l' if 'upperleg.l' in a.data.bones else 'mixamorig:LeftUpLeg']
    R = a.data.bones['upperleg.r' if 'upperleg.r' in a.data.bones else 'mixamorig:RightUpLeg']
    side = M @ (L.head_local - R.head_local); side.z = 0
    if side.length < 1e-5: return Vector((0, -1, 0))
    return side.normalized().cross(Vector((0, 0, 1))).normalized()

def load_mocap():
    files = sorted(f for f in os.listdir(MOCAP_DIR) if f.endswith('.bvh'))
    holder = None
    for f in files:
        before = set(bpy.data.objects)
        bpy.ops.import_anim.bvh(filepath=os.path.join(MOCAP_DIR, f), global_scale=1.0,
                                use_fps_scale=False, update_scene_fps=False, update_scene_duration=False,
                                rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y')
        obj = [x for x in bpy.data.objects if x not in before and x.type == 'ARMATURE'][0]
        act = obj.animation_data.action
        if holder is None:
            holder = obj
            for b in holder.data.bones:    # 액션이 붙어 있는 동안 바꿔야 fcurve 경로가 따라온다
                if b.name in CMU2KAY: b.name = CMU2KAY[b.name]
        else:
            for fc in act.fcurves:         # 같은 뼈대이므로 경로만 고쳐 첫 아마추어에 재사용
                for k, v in CMU2KAY.items():
                    fc.data_path = fc.data_path.replace('pose.bones["%s"]' % k, 'pose.bones["%s"]' % v)
            bpy.data.objects.remove(obj)
        act.name = os.path.splitext(f)[0]; act.use_fake_user = True
    # 정면을 목표 리그와 맞춘다 (SREST 와 SP 가 함께 도는 게 아니라 켤레가 되므로 방향이 중요하다)
    holder.rotation_mode = 'XYZ'
    f0 = facing(holder); f1 = facing(arm)
    holder.rotation_euler.z += math.atan2(f1.y, f1.x) - math.atan2(f0.y, f0.x)
    bpy.context.view_layer.update()
    print('모캡 %d개, 정면 보정 %.1f°' % (len(files), math.degrees(holder.rotation_euler.z)))
    return holder

src = load_mocap()
src.animation_data_create()

# 목표 참조 자세(TREF): 소스 «휴식 자세» 와 같은 모양으로 목표 리그를 세워 둔 것.
# 리타게팅이 Rw = SP·SREST⁻¹·TREF 라, SREST 와 TREF 가 같은 «모양» 이라야 소스의 회전이
# 그대로 옮겨온다. KayKit 은 목표와 거의 같은 차렷 자세라 팔만 맞춰도 됐지만,
# CMU ASF 의 휴식 자세는 다리가 20° 벌어져 있고 척추도 기울어 있어 — 팔만 맞추면
# 그 차이가 «주저앉고 숙인» 자세로 그대로 구워진다(실측: 골반 -15cm, 상체 +30°).
# 그래서 매핑된 모든 뼈의 방향을 소스 휴식 자세에 맞춘다. 부모부터 차례로, 그때그때의
# 월드 방향을 재서 돌린다 (부모를 돌리면 자식도 따라 돌기 때문).
SMAP0 = {k: v for k, v in MAP.items() if k in src.data.bones}
INV0 = {'mixamorig:' + v: k for k, v in SMAP0.items()}
for tn in order:
    sn = INV0.get(tn)
    # 루트는 뺀다: BVH 루트는 자식 OFFSET 이 전부 0 이라 «길이 0» 이고, 임포터가 임의의
    # 방향을 붙인다 (임포트 로그의 zero length node found: root). 그 방향에 골반을 맞추면
    # 몸 전체가 그만큼 기운다 — 실측 상체 기울기 25°. 루트 회전은 SP·SREST⁻¹ 이
    # 같은 프레임끼리 상쇄하므로 맞출 필요도 없다.
    if not sn or sn == 'hips': continue
    sb = src.data.bones[sn]
    tgt = (src.matrix_world.to_3x3() @ (sb.tail_local - sb.head_local))
    if tgt.length < 1e-6: continue
    bpy.context.view_layer.update()
    pb = arm.pose.bones[tn]
    M = arm.matrix_world @ pb.matrix
    cur = M.to_3x3() @ Vector((0, 1, 0))
    if cur.length < 1e-6: continue
    q = rot_between(cur, tgt)
    pos = M.translation.copy()
    pb.matrix = (arm.matrix_world.inverted()
                 @ Matrix.Translation(pos) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pos) @ M)
bpy.context.view_layer.update()
TREF = {b.name: (arm.matrix_world @ arm.pose.bones[b.name].matrix).copy() for b in arm.data.bones}
for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
bpy.context.view_layer.update()
SREST = {b.name: (src.matrix_world @ b.matrix_local).copy() for b in src.data.bones}
SMAP = {k: v for k, v in MAP.items() if k in SREST}
inv_map = {'mixamorig:' + v: k for k, v in SMAP.items()}
# 손 슬롯은 모캡에 없다 → 손을 그대로 따라가게 둔다 (무기는 rig_core 가 다시 잡는다)
legs = abs(SREST['upperleg.l'].to_translation().z - SREST['foot.l'].to_translation().z)
hip_scale = (J['LeftUpLeg'].z - J['LeftFoot'].z) / max(1e-4, legs)
print('소스 다리 %.3fm → hip_scale %.3f, 매핑 뼈 %d개' % (legs, hip_scale, len(SMAP)))

# ---------- 4. 리타게팅 ----------
arm.animation_data_create()

# 반복 재생하는 클립: 마지막 N 프레임을 첫 프레임 쪽으로 당겨 이음매를 없앤다.
# (모캡은 «한 번 지나간» 구간이라 끝과 시작이 다르다 — 그대로 두면 대기에서 한 번씩 튄다)
LOOP = {'idle'}
LOOP_N = 8

def loop_blend(act, last):
    for fc in act.fcurves:
        ks = {int(round(k.co[0])): k for k in fc.keyframe_points}
        if 0 not in ks: continue
        v0 = ks[0].co[1]
        for i in range(1, LOOP_N + 1):
            f = last - LOOP_N + i
            if f <= 0 or f not in ks: continue
            w = i / float(LOOP_N)          # 끝으로 갈수록 첫 프레임에 가깝게
            k = ks[f]; d = (v0 - k.co[1]) * w
            k.co[1] += d; k.handle_left[1] += d; k.handle_right[1] += d

# 발 심기 기준: 휴식 자세에서 발가락이 바닥 위 어느 높이에 있는가
REST_FOOT = min(RESTL['mixamorig:%sToeBase' % s_].to_translation().z for s_ in ('Left', 'Right'))

def retarget(action, clip, actname=None):
    """clip 은 «게임 클립 이름» 이라야 한다 — CARRY/PATHS/TWO_HAND 를 이 이름으로 찾는다.
       예전엔 'idle_mo' 를 넘겨 조회가 전부 빗나갔고, 무기 자세가 통째로 적용되지 않았다."""
    f0, f1 = int(action.frame_range[0]), int(action.frame_range[1])
    src.animation_data.action = action
    new = bpy.data.actions.new(actname or clip); arm.animation_data.action = new; errs = []
    # BVH 의 휴식 자세는 루트가 «원점» 이다 (OFFSET 0). 그대로 SREST 와 빼면 골반이
    # 통째로 1m 떠오른다. 그래서 루트 이동은 «이 클립의 첫 프레임» 을 기준으로 잡고,
    # 남는 오차는 아래에서 발을 바닥에 심어 없앤다.
    sc.frame_set(f0)
    S0 = (src.matrix_world @ src.pose.bones['hips'].matrix).to_translation()
    minfoot = 1e9; rootkeys = []
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        SP = {n: (src.matrix_world @ src.pose.bones[n].matrix).copy() for n in SMAP}
        world = {}
        for n in order:
            p = parent[n]; pw = world[p] if p else Matrix.Identity(4)
            if n in inv_map:
                s = inv_map[n]
                Rw = SP[s].to_3x3() @ SREST[s].to_3x3().inverted() @ TREF[n].to_3x3()
                if p: pos = pw @ (RESTL[p].inverted() @ RESTL[n]).to_translation()
                else: pos = RESTL[n].to_translation() + (SP[s].to_translation() - S0) * hip_scale
                M = Rw.to_4x4(); M.translation = pos; world[n] = M
            else:
                world[n] = pw @ (RESTL[p].inverted() @ RESTL[n]) if p else RESTL[n].copy()
        # 무기: 모캡은 맨손이므로 여기서 다시 잡게 한다
        if PROF['carry'] is None: relax_both(world, clip)
        elif clip in CARRY: errs.append(carry(world, CARRY[clip]))
        elif clip in PATHS: errs.append(carry(world, path_spec(PATHS[clip], (f - f0) / max(1, (f1 - f0)))))
        elif clip in TWO_HAND: errs.append(blend_carry(world, CARRY['idle'], carry_weight(f - f0, f1 - f0 + 1)))
        for n in order:
            p = parent[n]; pw = world[p] if p else Matrix.Identity(4); pb = arm.pose.bones[n]
            basis = (RESTL[p].inverted() @ RESTL[n]).inverted() @ pw.inverted() @ world[n] if p else RESTL[n].inverted() @ world[n]
            pb.rotation_quaternion = basis.to_quaternion(); pb.keyframe_insert('rotation_quaternion', frame=f - f0)
            if not p: pb.location = basis.to_translation(); pb.keyframe_insert('location', frame=f - f0)
        minfoot = min(minfoot, min(world['mixamorig:%sToeBase' % s_].to_translation().z for s_ in ('Left', 'Right')))
    # 발 심기: 클립 전체에서 발이 가장 낮았던 순간을 휴식 자세의 발 높이에 맞춘다.
    # (구르기처럼 오르내리는 클립도 «가장 낮은 점» 만 맞추므로 상하 궤적은 그대로 남는다)
    dz = REST_FOOT - minfoot
    if abs(dz) > 1e-4:
        rootname = order[0]
        off = RESTL[rootname].inverted().to_3x3() @ Vector((0, 0, dz))
        for fc in new.fcurves:
            if not fc.data_path.endswith('location'): continue
            d = (off.x, off.y, off.z)[fc.array_index]
            for k in fc.keyframe_points:
                k.co[1] += d; k.handle_left[1] += d; k.handle_right[1] += d
        print('  발 심기 %s: %+.3f m' % (clip, dz))
    if clip in LOOP: loop_blend(new, f1 - f0)
    for fc in new.fcurves:
        for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    if errs: print('  왼손 최대 오차 %s %.3f' % (clip, max(errs)))
    return new

swapped = {}
for clip, moname in MOCAP.items():
    if clip in MOCAP_SKIP.get(CHAR, ()):
        print('건너뜀 %s (%s 는 이 클립에서 그립이 벌어진다)' % (clip, CHAR)); continue
    a = bpy.data.actions.get(moname)
    if not a: print('모캡 액션 없음:', moname); continue
    # brake 처럼 원본에 없던 클립은 NLA 트랙을 새로 만든다 (기존 클립은 교체)
    if clip not in old_tracks: old_tracks[clip] = arm.animation_data.nla_tracks.new(); old_tracks[clip].name = clip
    swapped[clip] = retarget(a, clip, clip + '_mo')
    print('교체 %s ← %s (%d프레임)' % (clip, moname, int(a.frame_range[1] - a.frame_range[0]) + 1))

# ---------- 5. NLA 교체 + 내보내기 ----------
arm.animation_data.action = None
for clip, act in swapped.items():
    tr = old_tracks[clip]
    for st in list(tr.strips): tr.strips.remove(st)
    st = tr.strips.new(clip, 0, act); st.name = clip
# 모캡 소스와 임포트 부산물 제거
bpy.data.objects.remove(src)
for o in bpy.data.objects: o.hide_set(False)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=False, export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True,
                          export_vertex_color='MATERIAL', export_force_sampling=True,
                          export_nla_strips=True, export_frame_step=1)
print('→', OUT, '· 교체한 클립:', ' '.join(sorted(swapped)))
