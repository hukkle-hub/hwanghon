# 달리기가 «미끄러지는» 것을 고친다 — 이미 구운 <char>_anim.glb 위에서.
#
# 왜. 엔진은 캐릭터를 4.60 m/s 로 옮기는데(js/dungeon.js player.speed 230 px ÷ 50 px/m),
# run 클립이 낼 수 있는 지면 속도는 2.64 m/s 다 (보폭 0.96 m × 2걸음 × 1.38 사이클/s).
# 차이 1.96 m/s — 이동의 43%가 «발이 땅을 안 딛고 흐르는» 스케이트다.
# 액션 게임에서 제일 먼저 싸구려로 읽히는 지점이다 (docs/design/54).
#
# 배속만 올리면(1.15 → 2.0) 빨리감기처럼 보인다. 보폭 자체를 키워야 한다.
#
# 방법. 다리 관절의 «회전 각» 을 키운다 (축은 그대로, 각만 배수).
#   · 고관절(UpLeg)을 크게, 무릎(Leg)은 조금만 — 무릎까지 같이 키우면 만화가 된다
#   · 팔도 조금 키운다. 보폭만 커지고 팔이 그대로면 상체가 죽어 보인다
#   · 키운 뒤 «디딤발이 원래 높이에 그대로 닿도록» 엉덩이를 매 프레임 올린다.
#     이걸 안 하면 발이 바닥을 뚫거나 공중에 뜬다.
#   · 디딤발은 «그 프레임에서 원래 더 낮았던 쪽» 으로 고른다 (min 을 다시 재면
#     스윙발이 내려온 순간 엉뚱한 발을 기준 삼는다).
#
# 사용: python3 tools/3d/stride.py --glb art/3d/ain_anim.glb [--leg 1.9] [--knee 1.25] [--dry]
import bpy, sys, os, math
from mathutils import Quaternion, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HIPS = 'mixamorig:Hips'
FEET = ['mixamorig:LeftFoot', 'mixamorig:RightFoot']
UPLEG = ['mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg']
KNEE = ['mixamorig:LeftLeg', 'mixamorig:RightLeg']
ARM = ['mixamorig:LeftArm', 'mixamorig:RightArm', 'mixamorig:LeftForeArm', 'mixamorig:RightForeArm']
CLIPS = ('run', 'walk')


def scale_angle(q, k):
    """회전축은 두고 각만 k 배. k=1 이면 그대로."""
    if k == 1.0:
        return q.copy()
    axis = q.axis
    angle = q.angle
    if angle > math.pi:                            # −π..π 로 접는다
        angle -= 2 * math.pi
    if axis.length < 1e-9:
        return q.copy()
    return Quaternion(axis, angle * k)


def mean_quat(qs):
    """부호를 맞춰 평균 낸 뒤 정규화. 한 사이클의 «평균 자세»."""
    acc = Quaternion((0, 0, 0, 0))
    ref = qs[0]
    for q in qs:
        w = -1.0 if q.dot(ref) < 0 else 1.0
        acc.w += q.w * w; acc.x += q.x * w; acc.y += q.y * w; acc.z += q.z * w
    if acc.magnitude < 1e-9:
        return Quaternion()
    acc.normalize()
    return acc


def amplify(q, mean, k):
    """«평균 자세로부터의 흔들림» 만 k 배 한다.

    처음엔 basis 쿼터니언의 절대 각을 그대로 k 배 했는데 보폭이 1.27 m 에서 멈췄다
    (leg 를 1.9 → 3.0 까지 올려도 그대로). 달리기의 고관절 회전은 «일정한 굽힘 +
    앞뒤 스윙» 인데, 절대 각을 키우면 굽힘까지 같이 커져 다리가 한쪽으로 고정될 뿐
    스윙 폭은 안 는다. 보폭을 만드는 건 평균이 아니라 «평균에서 벗어난 양» 이다."""
    if k == 1.0:
        return q.copy()
    rel = mean.inverted() @ q
    return mean @ scale_angle(rel, k)


def main(glb, kleg=1.9, kknee=1.25, karm=1.35, dry=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    bpy.context.view_layer.objects.active = arm
    pbs = {b.name: b for b in arm.pose.bones}
    for n in [HIPS] + FEET + UPLEG + KNEE:
        if n not in pbs:
            sys.exit('뼈 없음: ' + n)

    def update():
        bpy.context.view_layer.update()

    def foot_z(i):
        return (arm.matrix_world @ pbs[FEET[i]].head).z

    report = []
    for act in list(bpy.data.actions):
        base = act.name.split('_Armature')[0]
        if base not in CLIPS:
            continue
        arm.animation_data.action = act
        f0, f1 = act.frame_range
        n = max(24, 2 * int(round(f1 - f0)))

        # --- 1) 원래 포즈와 원래 발 높이를 먼저 떠 둔다 ---
        src = []
        for i in range(n + 1):
            fr = f0 + (f1 - f0) * i / n
            bpy.context.scene.frame_set(int(fr), subframe=float(fr) - int(fr))
            update()
            pose = {b.name: (b.matrix_basis.to_quaternion(), b.location.copy()) for b in arm.pose.bones}
            src.append((fr, pose, [foot_z(0), foot_z(1)]))
        # 한 사이클의 «평균 자세» — 스윙만 키우기 위한 기준
        mean = {nm: mean_quat([p[nm][0] for _f, p, _z in src]) for nm in (UPLEG + KNEE + ARM) if nm in src[0][1]}

        # --- 2) 액션을 떼어 낸다. 이게 이 도구에서 제일 크게 틀렸던 곳이다.
        #        액션이 붙어 있으면 view_layer.update() 가 F커브로 포즈를 «되돌린다».
        #        그래서 «고치고 → 다시 재고 → 또 고치는» 되먹임이 전혀 수렴하지 않고
        #        엉덩이 보정이 9.87 m 까지 튀어 캐릭터가 화면 밖으로 날아갔다.
        #        소스는 위에서 이미 다 떠 놨으니 여기서부터는 수동 포즈만 쓴다. ---
        for b in arm.pose.bones:
            b.rotation_mode = 'QUATERNION'
        arm.animation_data.action = None
        hips = pbs[HIPS]

        def apply(pose):
            for nm, (q, l) in pose.items():
                pbs[nm].rotation_quaternion = q
                pbs[nm].location = l
            update()

        # 엉덩이 location 의 어느 축이 «위» 인지 실측한다 (뼈 로컬 축이라 가정하지 않는다)
        apply(src[0][1])
        base_z = foot_z(0)
        gain, axis_i = None, None
        for ai in (1, 2, 0):                       # y(뼈 방향) → z → x 순으로 시험
            l0 = src[0][1][HIPS][1]
            v = list(l0); v[ai] += 0.1
            hips.location = Vector(v)
            update()
            d = foot_z(0) - base_z
            hips.location = l0.copy(); update()
            if abs(d) > 0.02:
                gain, axis_i = 0.1 / d, ai
                break
        if gain is None:
            sys.exit('엉덩이를 올릴 축을 못 찾았다')

        # --- 3) 각을 키우고 디딤발을 원래 높이에 맞춘다 ---
        out = []
        hipMax = [0.0]
        for i, (fr, pose, oz) in enumerate(src):
            plant = 0 if oz[0] <= oz[1] else 1     # 그 프레임에서 «원래» 더 낮았던 발
            new = {k: (q.copy(), l.copy()) for k, (q, l) in pose.items()}
            for nm in UPLEG:
                new[nm] = (amplify(pose[nm][0], mean[nm], kleg), pose[nm][1])
            for nm in KNEE:
                new[nm] = (amplify(pose[nm][0], mean[nm], kknee), pose[nm][1])
            for nm in ARM:
                if nm in pose:
                    new[nm] = (amplify(pose[nm][0], mean[nm], karm), pose[nm][1])
            apply(new)
            # 엉덩이 높이 보정 (몇 번 반복하면 수렴한다)
            loc = new[HIPS][1].copy()
            for _ in range(6):
                err = oz[plant] - foot_z(plant)
                if abs(err) < 1e-4:
                    break
                v = list(loc); v[axis_i] += max(-0.3, min(0.3, err * gain)); loc = Vector(v)
                hips.location = loc
                update()
            new[HIPS] = (new[HIPS][0], loc)
            d = (loc - pose[HIPS][1]).length
            if d > hipMax[0]:
                hipMax[0] = d
            out.append((fr, new))

        # --- 4) 쿼터니언 부호 이어 붙이기 (punch.py 와 같은 이유) ---
        for name in out[0][1]:
            prev = None
            for _fr, p_ in out:
                q, l = p_[name]
                if prev is not None and q.dot(prev) < 0:
                    q = Quaternion((-q.w, -q.x, -q.y, -q.z))
                    p_[name] = (q, l)
                prev = q

        if dry:
            report.append((base, n, 'dry · 엉덩이 보정 최대 %.3f m' % hipMax[0]))
            continue

        arm.animation_data.action = act
        act.fcurves.clear()
        for fr, p in out:
            for name, (q, l) in p.items():
                pb = pbs[name]
                pb.rotation_quaternion = q
                pb.location = l
                pb.keyframe_insert('rotation_quaternion', frame=fr)
                pb.keyframe_insert('location', frame=fr)
        report.append((base, n, 'ok · 엉덩이 보정 최대 %.3f m' % hipMax[0]))

    for nm, n, st in report:
        print('STRIDE %-6s 프레임 %d  다리×%.2f 무릎×%.2f 팔×%.2f  %s'
              % (nm, n, kleg, kknee, karm, st), file=sys.stderr)
    if dry:
        return
    bpy.ops.object.select_all(action='SELECT')
    kw = dict(filepath=glb, export_format='GLB', use_selection=True, export_animations=True,
              export_apply=False, export_yup=True, export_materials='EXPORT',
              export_image_format='JPEG')
    try:
        bpy.ops.export_scene.gltf(export_jpeg_quality=88, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    print('저장 %s  %d KB' % (glb, os.path.getsize(glb) // 1024), file=sys.stderr)


if __name__ == '__main__':
    a = sys.argv
    def opt(k, d):
        return float(a[a.index(k) + 1]) if k in a else d
    g = a[a.index('--glb') + 1] if '--glb' in a else os.path.join(ROOT, 'art/3d/ain_anim.glb')
    main(g, opt('--leg', 1.9), opt('--knee', 1.25), opt('--arm', 1.35), '--dry' in a)
