# CMU 모캡 가져오기 + 클립 잘라 BVH 로 굽기.
#   python3 tools/3d/mocap.py fetch          # 원본 ASF/AMC 를 캐시로 (커밋 안 함)
#   python3 tools/3d/mocap.py scan 140_08    # 프레임 구간 고르기용 분석 (루트 높이·속도·손 높이)
#   python3 tools/3d/mocap.py build          # CLIPS 의 구간을 잘라 art/3d/mocap/*.bvh 로
#
# 출처: CMU Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu/).
#   «연구에 자유롭게 사용 가능하며, 상업 제품에 포함할 수 있다. 데이터 자체를 되파는 것만 금지.»
#   원본 AMC 는 한 편에 1~2MB 라 저장소에 넣지 않는다. 잘라낸 BVH(수십 KB)만 커밋해
#   네트워크 없이도 art/3d/*_anim.glb 를 다시 구울 수 있게 한다.
import os, sys, subprocess, math, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, 'art', '3d', 'mocap', 'src')      # .gitignore
OUT = os.path.join(ROOT, 'art', '3d', 'mocap')               # 커밋
BASE = 'http://mocap.cs.cmu.edu/subjects'

# ── 클립 목록 ────────────────────────────────────────────────────────────────
# (이름, 서브젝트, 트라이얼, 시작프레임, 끝프레임, 제자리로)
# 프레임은 «원본 120fps 기준». scan 으로 골랐다. 끝이 None 이면 끝까지.
CLIPS = [
    # 대기·호흡 — KayKit 의 대기는 뻣뻣하다. 진짜 사람의 체중 이동을 쓴다.
    #   140_06 «Idle» 은 피험자가 33° 숙이고 서 있어 못 쓴다(실측). 139_02 «Shifting Weight» 은
    #   평균 기울기 2.3°, 골반 높이 변동 0.009m — 곧게 서서 체중만 옮긴다. 전투 대기로 딱 맞다.
    ('mo_idle',        '139', '02',    0,  480, True),
    # 기상 — 지금 아예 없는 동작. 다운·처형 뒤에 쓴다.
    ('mo_getup_back',  '140', '08',  220,  700, True),   # 누운 자세에서
    ('mo_getup_face',  '140', '01',  200,  580, True),   # 엎어진 자세에서
    # 회피 — 달려와 뛰어들어 구르고 다시 일어나 달린다. 회피의 «무게» 는 여기서 온다.
    ('mo_roll',        '128', '10',   60,  340, True),
    ('mo_duck',        '127', '29',   20,  200, True),
    # 부상 — 체력이 낮을 때의 걸음
    ('mo_wounded',     '139', '19',  120,  840, True),
    # 타격 — «손목 최고속» 과 «순회전» 을 같이 본다.
    #   순회전 = 클립 안에서 몸이 돌아간 각도. 게임은 캐릭터 방향을 시뮬레이션이 잡으므로
    #   크게 돌고 끝나는 클립은 동작 뒤에 엉뚱한 쪽을 보게 된다 (실측: 대기 -105°, 스킬2 -85°).
    #   가라테 훈련(135_09·135_05)은 제자리에서 180° 돌며 반복해 쓸 구간이 없었다.
    #   143_23 «Punching» 은 한 방향으로 계속 쳐서 빠르고(7.1 m/s) 돌지 않는다(-9°).
    ('mo_strike',      '143', '23',  165,  275, True),   # 7.1 m/s, 순회전  -9°
    ('mo_strike_hard', '143', '23',  537,  647, True),   # 6.4 m/s, 순회전  -1°
    ('mo_sweep_low',   '135', '01', 2097, 2207, True),   # 抜塞 카타 5.4 m/s, 순회전 +1°
    # 검 — 내려베기. 후반부가 더 빠르지만(4.0 m/s) 84° 돈다. 돌지 않는 구간을 쓴다.
    ('mo_sword_cut',   '02',  '07',  353,  463, True),   # 2.5 m/s, 순회전 -13°
    # 막기 자세 — 카운터의 «칼 맞대기» 직전 자세
    ('mo_guard_l',     '144', '07',  925, 1055, True),
    ('mo_guard_r',     '144', '26', 1049, 1179, True),
]
FPS = 24          # 게임 클립 프레임률 (rig_char.py 와 같다)
SRC_FPS = 120.0   # CMU 원본


def _get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as r, open(path, 'wb') as f:
        f.write(r.read())
    return True


def fetch():
    subs = sorted({c[1] for c in CLIPS})
    for s in subs:
        p = os.path.join(CACHE, s, '%s.asf' % s)
        if _get('%s/%s/%s.asf' % (BASE, s, s), p): print('asf', s)
    for name, s, t, a, b, ip in CLIPS:
        p = os.path.join(CACHE, s, '%s_%s.amc' % (s, t))
        if _get('%s/%s/%s_%s.amc' % (BASE, s, s, t), p):
            print('amc %s_%s  %.1fMB' % (s, t, os.path.getsize(p) / 1e6))
    print('캐시:', CACHE)


# ── 분석: 구간 고르기 ────────────────────────────────────────────────────────
def scan(key):
    """서브젝트_트라이얼 의 루트 높이·수평 속도를 훑어 «어디서 무슨 일이 일어나는지» 를 본다."""
    s, t = key.split('_')
    amc = os.path.join(CACHE, s, '%s_%s.amc' % (s, t))
    asf = os.path.join(CACHE, s, '%s.asf' % s)
    if not os.path.exists(amc):
        _get('%s/%s/%s.asf' % (BASE, s, s), asf)
        _get('%s/%s/%s_%s.amc' % (BASE, s, s, t), amc)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import amc2bvh as A
    root, bones, scale = A.parse_asf(asf)
    fr = A.parse_amc(amc)
    print('%s: %d frames (%.1fs @120fps)' % (key, len(fr), len(fr) / 120.0))
    step = int(sys.argv[3]) if len(sys.argv) > 3 else 30      # 기본 0.25초 간격

    # 전방운동학으로 오른손목 위치까지 — 휘두르는 «순간» 은 루트가 아니라 손목이 말해준다
    order = []
    def walk(b):
        order.append(b)
        for c in b.children: walk(c)
    walk(root)
    def wrist(m):
        pos = {}; rot = {}
        for b in order:
            p = b.parent
            if p is None:
                R = A.local_rot_root(b, m.get('root', [0]*6)[3:6])
                pos[b.name] = [v * scale for v in m.get('root', [0]*6)[:3]]
            else:
                R = A.mm(rot[p.name], A.local_rot(b, m.get(b.name, [])))
            rot[b.name] = R
            if p is not None:   # 끝점 = 부모 끝점 + 길이·방향 (amc2bvh 와 같은 식)
                pos[b.name] = [pos[p.name][k] + A.mv(R, [b.direction[j]*b.length*scale for j in range(3)])[k]
                               for k in range(3)]
        return pos.get('rwrist', [0, 0, 0]), pos.get('lwrist', [0, 0, 0])

    prev = None; pw = None
    for i in range(0, len(fr), step):
        r = fr[i].get('root', [0] * 6)
        x, y, z = r[0] * scale, r[1] * scale, r[2] * scale
        rw, lw = wrist(fr[i])
        v = ws = 0.0
        dt = step / 120.0
        if prev is not None:
            v = math.hypot(x - prev[0], z - prev[1]) / dt
            ws = math.dist(rw, pw) / dt
        prev = (x, z); pw = rw
        bar = '#' * int(min(40, ws * 6))
        print('%5d %5.2fs  h=%.2f v=%4.1f  손목y=%.2f 손속=%4.1f %s'
              % (i, i / 120.0, y, v, rw[1], ws, bar))


# ── 굽기 ─────────────────────────────────────────────────────────────────────
def build():
    os.makedirs(OUT, exist_ok=True)
    here = os.path.dirname(os.path.abspath(__file__))
    for name, s, t, a, b, ip in CLIPS:
        asf = os.path.join(CACHE, s, '%s.asf' % s)
        amc = os.path.join(CACHE, s, '%s_%s.amc' % (s, t))
        if not os.path.exists(amc):
            print('없음 (fetch 먼저):', amc); continue
        dst = os.path.join(OUT, name + '.bvh')
        cmd = [sys.executable, os.path.join(here, 'amc2bvh.py'), asf, amc, dst,
               '--fps', str(FPS), '--start', str(a), '--prune']
        if b is not None: cmd += ['--end', str(b)]
        if ip: cmd += ['--inplace']
        subprocess.check_call(cmd)
    # 어느 원본에서 왔는지 남긴다 (출처 표기 + 재현용)
    with open(os.path.join(OUT, 'SOURCES.md'), 'w', encoding='utf-8') as f:
        f.write('# 모캡 출처\n\n'
                'CMU Graphics Lab Motion Capture Database — http://mocap.cs.cmu.edu/\n'
                '연구·상업 제품 사용 자유. 데이터 자체의 재판매만 금지.\n\n'
                '`tools/3d/mocap.py fetch && tools/3d/mocap.py build` 로 이 파일들을 다시 만든다.\n\n'
                '| 클립 | 원본 | 구간(120fps) | 제자리 |\n|---|---|---|---|\n')
        for name, s, t, a, b, ip in CLIPS:
            f.write('| `%s` | %s_%s | %d~%s | %s |\n' % (name, s, t, a, b if b else '끝', 'O' if ip else '-'))
    print('→', OUT)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'fetch': fetch()
    elif cmd == 'scan': scan(sys.argv[2])
    else: build()
