# CMU 모캡 (ASF/AMC) → BVH. 의존성 없는 순수 파이썬.
#   python3 tools/3d/amc2bvh.py 02.asf 02_07.amc out.bvh [--start 120 --end 260 --fps 24 --inplace]
#
# 왜 BVH 인가: bpy 에 기본 임포터가 있고, rig_char.py 의 리타게팅이 «소스 아마추어 + 액션» 만
# 있으면 돌아가기 때문이다. ASF/AMC 를 직접 읽는 임포터를 쓰는 것보다 파이프라인이 짧다.
#
# 좌표 규약 (CalciferZh/amc-parser 와 같은 해석, CMU 데이터로 검증됨):
#   · 뼈 b 의 축 프레임 C_b 는 ASF 의 `axis` 오일러(항상 XYZ)에서 만든다.
#   · AMC 의 회전값 R_b 는 그 축 프레임 «안에서» 의 회전이라, 전역 기준으로 돌려놓으면
#       L_b = C_b · R_b · C_b⁻¹        (부모 기준 로컬 회전)
#       M_b = M_parent · L_b           (누적 전역 회전)
#     끝점은 parent_end + length_b · M_b · direction_b.
#   · BVH 는 관절마다 축 프레임이 없다. 관절 J_b 를 «부모 뼈의 끝점» 에 두면
#       OFFSET(J_b) = length_parent · direction_parent,  채널 회전 = L_b
#     가 그대로 맞는다. 루트는 OFFSET 0 에 이동 채널을 쓴다.
#   · 길이 단위: ASF `:units length` (CMU 는 0.45). 인치 기준이라
#       m = value / 0.45 · 2.54 / 100   → 대퇴골 7.59 → 0.43 m (성인 치수와 맞는다)
import sys, math, os, re

# ---------- 작은 3x3 행렬 ----------
def mm(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def mv(a, v):
    return [sum(a[i][k] * v[k] for k in range(3)) for i in range(3)]
def mt(a):
    return [[a[j][i] for j in range(3)] for i in range(3)]   # 회전행렬이므로 전치 = 역행렬
def rx(t):
    c, s = math.cos(t), math.sin(t); return [[1,0,0],[0,c,-s],[0,s,c]]
def ry(t):
    c, s = math.cos(t), math.sin(t); return [[c,0,s],[0,1,0],[-s,0,c]]
def rz(t):
    c, s = math.cos(t), math.sin(t); return [[c,-s,0],[s,c,0],[0,0,1]]
def euler_xyz(x, y, z):
    """ASF 의 XYZ 순서: X 먼저 적용 → R = Rz·Ry·Rx"""
    return mm(mm(rz(z), ry(y)), rx(x))

def to_euler_zyx(M):
    """R = Rz(z)·Ry(y)·Rx(x) 로 분해해 (x,y,z) 라디안 반환. BVH 채널 순서 Zrot Yrot Xrot 과 짝."""
    sy = -M[2][0]
    sy = max(-1.0, min(1.0, sy))
    y = math.asin(sy)
    if abs(sy) > 0.99999:            # 짐벌: x 를 0 으로 두고 z 에 몰아준다
        x = 0.0
        z = math.atan2(-M[0][1], M[1][1])
    else:
        x = math.atan2(M[2][1], M[2][2])
        z = math.atan2(M[1][0], M[0][0])
    return x, y, z

# ---------- ASF ----------
class Bone:
    __slots__ = ('name','direction','length','C','Cinv','dof','children','parent')
    def __init__(self, name):
        self.name = name; self.direction = [0.0,0.0,0.0]; self.length = 0.0
        self.C = [[1,0,0],[0,1,0],[0,0,1]]; self.Cinv = self.C; self.dof = []
        self.children = []; self.parent = None

def parse_asf(path):
    txt = open(path, encoding='utf-8', errors='replace').read()
    lines = [l.rstrip() for l in txt.splitlines()]
    unit_len = 0.45; deg = True
    bones = {}
    root = Bone('root'); root.dof = []
    bones['root'] = root
    i = 0; section = None
    while i < len(lines):
        l = lines[i].strip()
        if l.startswith(':'):
            section = l.split()[0][1:]
            if section == 'root':
                i += 1
                while i < len(lines) and not lines[i].strip().startswith(':'):
                    p = lines[i].split()
                    if p and p[0] == 'axis':
                        pass            # CMU 루트 축은 항상 XYZ·0 이다
                    i += 1
                continue
            i += 1; continue
        if section == 'units':
            p = l.split()
            if len(p) >= 2 and p[0] == 'length': unit_len = float(p[1])
            if len(p) >= 2 and p[0] == 'angle': deg = (p[1].lower() == 'deg')
        elif section == 'bonedata' and l == 'begin':
            b = None; i += 1
            while i < len(lines) and lines[i].strip() != 'end':
                p = lines[i].split()
                if p:
                    if p[0] == 'name': b = Bone(p[1])
                    elif p[0] == 'direction': b.direction = [float(x) for x in p[1:4]]
                    elif p[0] == 'length': b.length = float(p[1])
                    elif p[0] == 'axis':
                        a = [math.radians(float(x)) if deg else float(x) for x in p[1:4]]
                        b.C = euler_xyz(*a); b.Cinv = mt(b.C)
                    elif p[0] == 'dof': b.dof = [d.lower() for d in p[1:]]
                i += 1
            bones[b.name] = b
        elif section == 'hierarchy' and l not in ('begin','end') and l:
            p = l.split()
            par = bones[p[0]]
            for c in p[1:]:
                bones[c].parent = par; par.children.append(bones[c])
        i += 1
    scale = (1.0 / unit_len) * 2.54 / 100.0     # ASF 길이단위 → m
    return root, bones, scale

# ---------- AMC ----------
def parse_amc(path):
    frames = []; cur = None
    for raw in open(path, encoding='utf-8', errors='replace'):
        l = raw.strip()
        if not l or l.startswith('#') or l.startswith(':'): continue
        if re.fullmatch(r'\d+', l):
            cur = {}; frames.append(cur); continue
        if cur is None: continue
        p = l.split()
        cur[p[0]] = [float(x) for x in p[1:]]
    return frames

# ---------- 포즈 ----------
AXIS_IDX = {'rx': 0, 'ry': 1, 'rz': 2}

def local_rot(bone, vals):
    """AMC 값 → 부모 기준 로컬 회전 L = C·R·C⁻¹"""
    e = [0.0, 0.0, 0.0]
    for d, v in zip(bone.dof, vals):
        if d in AXIS_IDX: e[AXIS_IDX[d]] = math.radians(v)
    return mm(mm(bone.C, euler_xyz(*e)), bone.Cinv)

# ---------- BVH ----------
# 손가락·엄지는 CMU 에서 거의 고정값이고 우리 리그에도 없다. 빼면 채널이 12개 줄고
# 파일이 20% 가벼워진다 (잘라낸 BVH 는 저장소에 들어가므로 크기가 의미가 있다).
PRUNE = ('lfingers', 'rfingers', 'lthumb', 'rthumb', 'lhand', 'rhand')

def prune(root, names=PRUNE):
    def walk(b):
        b.children = [c for c in b.children if c.name not in names]
        for c in b.children: walk(c)
    walk(root)

def heading(root, m):
    """이 프레임에서 몸이 향한 방향(라디안). CMU 는 Y-up 이라 XZ 평면의 각도.
       좌우 고관절 축을 루트 회전으로 돌려 재고, 그 축과 위를 외적해 정면을 얻는다.
       (lhipjoint/rhipjoint 는 CMU 에서 dof 가 없어 루트 회전만 받는다 — 그래서 이 계산으로 충분하다)"""
    M = local_rot_root(root, m.get('root', [0] * 6)[3:6])
    kid = {c.name: c for c in root.children}
    l, r = kid.get('lhipjoint'), kid.get('rhipjoint')
    if not l or not r: return 0.0
    d = [l.direction[k] * l.length - r.direction[k] * r.length for k in range(3)]
    side = mv(M, d)
    fwd = (-side[2], 0.0, side[0])          # side × up
    if abs(fwd[0]) < 1e-9 and abs(fwd[2]) < 1e-9: return 0.0
    return math.atan2(fwd[0], fwd[2])


def write_bvh(root, frames, scale, out, fps=120, inplace=False, srcfps=120.0):
    order = []
    def walk(b):
        order.append(b)
        for c in b.children: walk(c)
    walk(root)

    lines = ['HIERARCHY']
    def offset_of(b):
        """관절 b 의 OFFSET = 부모 뼈의 방향 × 길이 (루트는 0)"""
        p = b.parent
        if p is None or p.length == 0.0: return (0.0, 0.0, 0.0)
        return tuple(p.direction[k] * p.length * scale for k in range(3))
    def emit(b, depth):
        ind = '  ' * depth
        if b.parent is None:
            lines.append('ROOT %s' % b.name)
        else:
            lines.append('%sJOINT %s' % (ind, b.name))
        lines.append('%s{' % ind)
        o = offset_of(b)
        lines.append('%s  OFFSET %.6f %.6f %.6f' % (ind, o[0], o[1], o[2]))
        if b.parent is None:
            lines.append('%s  CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation' % ind)
        else:
            lines.append('%s  CHANNELS 3 Zrotation Yrotation Xrotation' % ind)
        if b.children:
            for c in b.children: emit(c, depth + 1)
        else:
            lines.append('%s  End Site' % ind)
            lines.append('%s  {' % ind)
            lines.append('%s    OFFSET %.6f %.6f %.6f' % (ind, b.direction[0]*b.length*scale,
                                                          b.direction[1]*b.length*scale,
                                                          b.direction[2]*b.length*scale))
            lines.append('%s  }' % ind)
        lines.append('%s}' % ind)
    emit(root, 0)

    # 프레임 리샘플 (120fps 원본 → 게임 24fps)
    step = srcfps / float(fps)
    idx = []
    t = 0.0
    while int(round(t)) < len(frames):
        idx.append(int(round(t))); t += step
    rows = []
    # 방향 정규화: CMU 배우가 캡처장에서 향하고 있던 방향이 루트 회전에 그대로 들어 있다.
    # 이동만 지우고 두면 캐릭터가 «옆을 본 채» 로 굳는다 (실측: 대기 클립 -105°).
    # 첫 프레임의 몸 방향을 재서 그만큼 되돌린다. 클립 안에서 도는 동작은 그대로 남는다.
    yaw0 = heading(root, frames[idx[0]]) if (inplace and idx) else 0.0
    UNSPIN = euler_xyz(0.0, -yaw0, 0.0) if abs(yaw0) > 1e-9 else None
    net = math.degrees(heading(root, frames[idx[-1]]) - heading(root, frames[idx[0]])) if idx else 0.0
    net = (net + 180) % 360 - 180

    for n, fi in enumerate(idx):
        m = frames[fi]
        pos = m.get('root', [0, 0, 0, 0, 0, 0])
        tr = [pos[0] * scale, pos[1] * scale, pos[2] * scale]
        if inplace:
            tr[0] = tr[2] = 0.0      # 수평 이동을 «완전히» 없앤다 (상하 반동은 남긴다).
            # 게임은 캐릭터를 시뮬레이션이 옮긴다 — 클립이 같이 움직이면 두 배로 미끄러진다.
        vals = ['%.5f' % v for v in tr]
        for b in order:
            if b.parent is None:
                L = local_rot_root(b, pos[3:6])
                if UNSPIN is not None: L = mm(UNSPIN, L)
            else:
                L = local_rot(b, m.get(b.name, []))
            x, y, z = to_euler_zyx(L)
            vals += ['%.5f' % math.degrees(z), '%.5f' % math.degrees(y), '%.5f' % math.degrees(x)]
        rows.append(' '.join(vals))

    lines.append('MOTION')
    lines.append('Frames: %d' % len(rows))
    lines.append('Frame Time: %.8f' % (1.0 / fps))
    lines += rows
    open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return len(rows), net

def local_rot_root(b, rxyz):
    e = [math.radians(v) for v in rxyz]
    return mm(mm(b.C, euler_xyz(*e)), b.Cinv)

def main():
    a = sys.argv[1:]
    pos = [x for x in a if not x.startswith('--')]
    def opt(name, d=None):
        if '--' + name in a: return a[a.index('--' + name) + 1]
        return d
    asf, amc, out = pos[0], pos[1], pos[2]
    fps = float(opt('fps', 24))
    start = int(opt('start', 0)); end = opt('end')
    inplace = '--inplace' in a
    root, bones, scale = parse_asf(asf)
    if '--prune' in a: prune(root)
    frames = parse_amc(amc)
    end = len(frames) if end is None else int(end)
    frames = frames[start:end]
    n, net = write_bvh(root, frames, scale, out, fps=fps, inplace=inplace)
    # 순회전(net): 클립 안에서 몸이 돌아간 각도. 게임은 캐릭터 방향을 시뮬레이션이 잡으므로
    # 크게 돌고 끝나는 클립은 동작이 끝난 뒤 엉뚱한 쪽을 보게 된다 — 30° 넘으면 경고한다.
    warn = '   ⚠ 순회전 %+.0f°' % net if abs(net) > 30 else ''
    print('%s  %d frames @ %gfps  (원본 %d, %.2fs)  순회전 %+.0f°%s'
          % (os.path.basename(out), n, fps, end - start, n / fps, net, warn))

if __name__ == '__main__':
    main()
