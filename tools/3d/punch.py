# 스킬 모션에 «손맛» 을 넣는다 — 이미 구운 <char>_anim.glb 위에서.
#
# 왜 필요한가. 28개 클립을 같은 잣대로 재 보니 스킬만 딴 게임이었다:
#
#              최고속   체간요우   정지%
#   attack1     48.6      23°      72%
#   attack2     49.1      43°      89%
#   skill1       9.1       1°       6%
#   skill3      11.2       0°       3%
#   ult         20.0       0°       5%
#
# 원인은 소스다. skill1/3 은 «1H_Melee_Attack_*» 한손 잔동작이고 skill2 는 그냥
# «Jump_Full_Short» 다. rig_char.py 의 AMP 는 회전 «진폭» 만 키우므로 이걸 못 고친다 —
# 점프를 1.24배 키워도 궁극기가 되지 않는다.
#
# 손맛은 진폭이 아니라 «대비» 에서 나온다. 느린 예비동작 → 폭발하는 몇 프레임 →
# 붙잡는 마무리. 그건 타이밍 문제이므로 «시간을 다시 배분» 해야 한다.
#
#   1. 시간 워프 — 출력 t 에서 소스 s = w(t) 를 읽으면 속도는 v_src(w(t)) · w'(t) 다.
#      접점에서 w' 를 크게(STRIKE), 양 끝에서 작게(WINDUP·RECOVER) 잡으면
#      «느린 예비 → 폭발 → 붙잡는 마무리» 가 만들어진다.
#
#      여기서 한 번 틀렸다. 처음엔 w(0)=0, w(1)=1 을 고정했는데, ult 처럼 소스
#      최고속이 t=0.109 로 이른 클립은 판정(0.5) 앞에 놓을 «소스 재료» 가 없다.
#      그러면 남은 소스가 전부 뒤로 밀려 꼬리가 1.8배로 빨리 감기고, 그 꼬리가
#      새 최고속이 돼 버린다 — 측정하니 ult 가 0.964 에서 최고속이 났다.
#
#      그래서 양 끝을 «고정하지 않는다». 실제로 재생할 소스 구간 [s0, s1] 을
#      바깥 기울기(WINDUP·RECOVER)로부터 «역산» 한다. s0 이 0 아래로 내려가면
#      첫 포즈를 붙잡고(예비 정지), s1 이 1 을 넘으면 마지막 포즈를 붙잡는다(여운).
#      바깥이 1 배를 넘는 일이 구조적으로 없어진다.
#
#   2. 체간 요우 — 척추 뼈의 로컬 Y(뼈 방향) 둘레로 비튼다. 예비에서 반대로 감았다가
#      접점에서 풀린다. 팔만 휘두르던 것이 몸을 싣게 된다.
#
# 그리고 «어디에» 맞출 것인가. 재 보니 클립의 최고속과 엔진의 판정 시점이 어긋나 있었다:
#
#   클립      소스 최고속   js/dungeons.js clipContacts   어긋남
#   skill3      0.230              0.55                  −0.32
#   ult         0.150              0.50                  −0.35
#   counter     0.590              0.48                  +0.11
#
# 휘두르는 그림이 판정보다 한참 먼저 끝나 있었다. 그래서 워프의 고정점을 «소스의
# 최고속» 이 아니라 «엔진의 판정 시점» 으로 잡는다 — 최고속이 거기로 옮겨 온다.
#
# ⚠ 이 도구는 «두 번 돌리면 안 된다» (멱등하지 않다). 이미 워프된 클립에 다시 워프를
#   걸면 두 배로 눌린다 — 실제로 exec 를 추가하려고 네 캐릭터에 다시 돌렸다가
#   skill1·2·3·4·counter 가 이중으로 워프돼 시험 셋이 깨졌다 (체간 34° → 10°).
#   이미 구운 GLB 에 «새 클립 하나만» 더 넣을 때는 --only 로 범위를 좁혀라.
#
# 사용: python3 tools/3d/punch.py --glb art/3d/ain_anim.glb [--only exec] [--dry]
import bpy, sys, os, math, json
from mathutils import Vector, Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPINE = ['mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2']
HANDS = ['mixamorig:LeftHand', 'mixamorig:RightHand']
FPS = 60
WINDUP = 0.35     # 예비 구간이 소스를 소화하는 배속 (1 보다 작으면 느려진다)
RECOVER = 0.45    # 마무리 구간의 배속

# js/dungeons.js 의 motion.clipContacts 와 같아야 한다 (tests/punch.test.mjs 가 고정한다).
#
# 2026-09 갱신 — 이 도구의 계측 방식에 한계가 있었다. 여기서는 «손 위치» 로
# 최고속을 쟀고, 리그를 안 씌운 «원본 클립» 을 봤다. 그런데 화면에 나오는 것은
#   (1) 낫의 «날 끝» 이 때리는 그림이고 (손이 아니다)
#   (2) 두 손 그립 + 체간 스윙 리그를 «씌운» 자세다 (원본이 아니다)
# 그래서 tools/3d/swing-measure.html 로 파이프라인 그대로 다시 골랐다.
# 여기 손대지 않았던 smash·exec·ult 가 크게 어긋나 있었다:
#   smash 0.78 → 0.30 (접점 날끝 2.1 → 37.4 m/s), exec 0.58 → 0.18, ult 0.50 → 0.22
# docs/design/66-scythe-weight.md
CONTACT = {'attack1': 0.38, 'attack2': 0.52, 'attack3': 0.50, 'smash': 0.30, 'ult': 0.22,
           'skill1': 0.50, 'skill2': 0.50, 'skill3': 0.55, 'skill4': 0.50,
           'counter': 0.48, 'exec': 0.18}

# 클립별 처방. a = 출력 쪽 접점 창(정규화), b = 그 창에 몰아넣을 소스 시간, yaw = 체간 총 회전(도).
# b > a 이면 접점이 빨라지고 나머지가 느려진다. 기본 공격이 23~43° 이므로 그 대역을 목표로.
RX = {
    'skill1': dict(a=0.085, k=2.4, yaw=30.0),
    'skill2': dict(a=0.095, k=2.2, yaw=26.0),
    'skill3': dict(a=0.080, k=2.6, yaw=34.0),
    'counter': dict(a=0.090, k=2.2, yaw=24.0),
    # 계측기를 고치고 나서 추가된 셋. 끝프레임 되감기 스파이크를 최고속으로 읽고 있어서
    # skill4 가 45.3 m/s 로 «멀쩡» 해 보였는데, 실제로는 4.6 m/s·정지 0% 로 제일 나빴다.
    # skill4 는 소스(Spellcast_Raise)에 빠른 구간이 아예 없어 시간 재배분이 거의 안 먹는다
    # (4.6 → 5.2 m/s). 소스를 갈아야 하는 건이라 여기서는 자세만 정돈한다.
    'skill4': dict(a=0.090, k=2.4, yaw=14.0),

# 손대지 «않는» 것들, 그리고 이유 —
#   exec   : 두 번 시도했고 두 번 다 안 됐다. 이유가 바뀌었으니 적어 둔다.
#            처음엔 「도달 검사가 깨진다」고 적었는데, 그 검사가 빨갰던 진짜 이유는
#            따로 있었다 (docs/design/55). 그래서 다시 넣어 봤더니 —
#            exec 소스의 최고속은 t=0.138 에 있는데 엔진 판정은 0.58 이다. 워프가
#            읽는 소스 구간이 [0, 0.488] 로 잘려 «뒤쪽 절반이 통째로 버려진다»:
#              최고속 13.8 → 20.7 m/s 로 오르지만 체간 34° → 10°, 정지 67% → 88%,
#              그리고 처형이 표적에 못 닿는다.
#            시간 재배분으로 풀 문제가 아니다. exec 는 «소스를 갈아야» 한다
#            (docs/design/54 §4). 지금은 손대지 않는다.
#   ult·smash : 둘 다 온몸 회전 기술이다. 워프가 «엉덩이가 도는가» 검사를 깬다 —
#            회전을 시간으로 압축하면 골반 요우의 총량이 줄어든다. 회전 기술은
#            시간만 주무를 게 아니라 회전 자체를 키워야 한다. 전용 처리가 필요하다.
#   attack3: exec 와 같은 도달 검사에 걸린다.
# 셋 다 docs/design/49 에 남긴다.
}


def pchip(xs, ys):
    """단조 3차 에르미트. 워프가 뒤로 가면 애니메이션이 튄다 — 단조성이 필수다."""
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        i = 0
        while i < n - 2 and x > xs[i + 1]:
            i += 1
        t = (x - xs[i]) / h[i]
        h00 = 2 * t ** 3 - 3 * t ** 2 + 1
        h10 = t ** 3 - 2 * t ** 2 + t
        h01 = -2 * t ** 3 + 3 * t ** 2
        h11 = t ** 3 - t ** 2
        return h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1]
    return f


def yaw_shape(t, tc):
    """예비에서 반대로 감았다가 접점에서 풀고 조금 남긴다. −1 … +1 정규화."""
    ks = [(0.0, 0.0), (tc * 0.55, -1.0), (tc * 0.92, -0.35), (tc, 0.25),
          (min(1.0, tc + 0.13), 1.0), (1.0, 0.45)]
    xs = [k[0] for k in ks]
    ys = [k[1] for k in ks]
    # x 가 겹치면 pchip 이 0 으로 나눈다
    for i in range(1, len(xs)):
        if xs[i] <= xs[i - 1]:
            xs[i] = xs[i - 1] + 1e-3
    return pchip(xs, ys)(t)


def main(glb, dry=False, only=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    bpy.context.view_layer.objects.active = arm
    pbs = {b.name: b for b in arm.pose.bones}
    missing = [n for n in SPINE + HANDS if n not in pbs]
    if missing:
        sys.exit('뼈 없음: ' + ', '.join(missing))

    report = []
    for act in list(bpy.data.actions):
        # 구운 GLB 를 다시 들이면 액션 이름이 «clip_Armature» 가 된다
        base = act.name.split('_Armature')[0]
        if only and base not in only:
            continue
        rx = RX.get(base)
        if not rx:
            continue
        arm.animation_data.action = act
        f0, f1 = act.frame_range
        # 접점 구간을 짧은 출력 시간에 몰아넣으므로, 그 몇 프레임이 촘촘해야 계단이 안 보인다
        n = max(28, 2 * int(round(f1 - f0)))

        # --- 1) 소스를 등간격으로 떠서 접점(손 최고속) 찾기 ---
        def pose_at(fr):
            bpy.context.scene.frame_set(int(fr), subframe=float(fr) - int(fr))
            bpy.context.view_layer.update()
            return {b.name: (b.matrix_basis.to_quaternion(), b.location.copy()) for b in arm.pose.bones}

        hand = []
        for i in range(n + 1):
            fr = f0 + (f1 - f0) * i / n
            bpy.context.scene.frame_set(int(fr), subframe=float(fr) - int(fr))
            bpy.context.view_layer.update()
            hip = arm.matrix_world @ pbs['mixamorig:Hips'].head
            hand.append(max((arm.matrix_world @ pbs[h].head - hip).length for h in HANDS)
                        and [(arm.matrix_world @ pbs[h].head - hip) for h in HANDS])
        spd = []
        for i in range(1, len(hand)):
            spd.append(max((hand[i][k] - hand[i - 1][k]).length for k in range(len(hand[i]))))
        tc = (spd.index(max(spd)) + 0.5) / len(spd)          # 소스에서 최고속이 난 시각
        tgt = CONTACT.get(base, 0.42)                         # 엔진이 판정하는 시각
        tgt = min(0.88, max(0.12, tgt))

        # --- 2) 워프: 출력 tgt 에서 소스 tc 를 읽게 한다 → 최고속이 판정 시점으로 옮겨 온다 ---
        a = min(rx['a'], tgt * 0.85, (1 - tgt) * 0.85)
        k = rx['k']                                    # 접점 구간의 배속
        s0 = tc - k * a - WINDUP * (tgt - a)           # 예비 구간이 끝나는 소스 시각에서 역산
        s1 = tc + k * a + RECOVER * (1 - tgt - a)
        xs = [0.0, tgt - a, tgt, tgt + a, 1.0]
        ys = [s0, tc - k * a, tc, tc + k * a, s1]
        # 소스 밖은 «붙잡는다» — 첫/마지막 포즈에서 멈춘다
        ys = [min(1.0, max(0.0, y)) for y in ys]
        for i in range(1, len(xs)):
            if xs[i] <= xs[i - 1]:
                xs[i] = xs[i - 1] + 1e-3
            if ys[i] <= ys[i - 1]:
                ys[i] = ys[i - 1] + 1e-3
        warp = pchip(xs, ys)

        # --- 3) 새 포즈 표 만들기 (워프된 소스를 읽고 체간 요우를 얹는다) ---
        out = []
        for i in range(n + 1):
            t = i / n
            s = min(1.0, max(0.0, warp(t)))
            fr = f0 + (f1 - f0) * s
            p = pose_at(fr)
            k = yaw_shape(t, tgt) * math.radians(rx['yaw']) / (2 * len(SPINE))
            for sb in SPINE:
                q, loc = p[sb]
                p[sb] = (q @ Quaternion((0, 1, 0), k), loc)   # 뼈 로컬 Y = 뼈 방향 = 비틀기 축
            out.append((f0 + (f1 - f0) * t, p))

        if dry:
            report.append((base, tc, tgt, n))
            continue

        # --- 3b) 쿼터니언 부호 이어 붙이기 ---
        # q 와 −q 는 같은 회전이지만 키 사이를 선형 보간하면 «먼 길» 로 돈다.
        # 안 맞추면 관절이 한 프레임에 55 도씩 튄다 (tests/ain-*.test.mjs 의 joint spike).
        for name in out[0][1]:
            prev = None
            for _fr, p_ in out:
                q, loc = p_[name]
                if prev is not None and q.dot(prev) < 0:
                    q = Quaternion((-q.w, -q.x, -q.y, -q.z))
                    p_[name] = (q, loc)
                prev = q

        # --- 4) 되쓰기 ---
        for b_ in arm.pose.bones:
            b_.rotation_mode = 'QUATERNION'
        act.fcurves.clear()
        arm.animation_data.action = act
        for fr, p in out:
            for name, (q, loc) in p.items():
                pb = pbs[name]
                pb.rotation_quaternion = q
                pb.location = loc
                pb.keyframe_insert('rotation_quaternion', frame=fr)
                pb.keyframe_insert('location', frame=fr)
        report.append((base, tc, tgt, n))

    for nm, tc, tg, n in report:
        print('PUNCH %-8s 소스최고속 %.3f → 판정 %.3f  프레임 %d' % (nm, tc, tg, n), file=sys.stderr)
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
    g = a[a.index('--glb') + 1] if '--glb' in a else os.path.join(ROOT, 'art/3d/ain_anim.glb')
    only = set(a[a.index('--only') + 1].split(',')) if '--only' in a else None
    main(g, '--dry' in a, only)
