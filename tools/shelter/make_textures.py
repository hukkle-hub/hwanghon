# 강남 벙커 재질 텍스처 (docs/design/155) — EP01 벙커 디자인 시트의 «재질 / 색감» 과 원문의 묘사로 만든 반복 텍스처.
#   python tools/shelter/make_textures.py            -> art/shelter/tex/T_HW_B1_<name>_{C,N,ORM}.png
# 모두 주기 노이즈(FFT)라 이음매 없이 반복된다. C = 베이스 컬러(sRGB), N = 노멀(DirectX 아닌 OpenGL 아님: UE = +Y 위, 아래 참고),
# ORM = R AO, G 거칠기, B 금속성(선형).
#   concrete  노후 콘크리트 — 물 자국이 지도처럼 번진 회색 (L4624), 잔금
#   floor     바닥 — 더 어두운 콘크리트, 기름 얼룩, 긁힘
#   steel     도장 철판 — 1 m 패널, 이음매·리벳, 벗겨진 도장 아래 녹, 녹물 자국
#   rust      녹슨 금속
#   wood      낡은 판재 (작업대·상자)
#   canvas    거친 천 / 캔버스
#   hazard    경고 표시 줄무늬 (노랑·검정, 닳음)
#   rubber    고무 바닥 (매트)
#   grime     저주파 얼룩 — 반복을 깨는 매크로 변화
#   posters   실종자 벽보 (L285 «빛바랜 얼굴 수백 개») — 얼굴을 지어내지 않는다: 빛바랜 사진 자리 + 글줄
#   screen    CRT 화면 — 초록 주사선 (L576)
import os
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'art', 'shelter', 'tex')
os.makedirs(OUT, exist_ok=True)
RNG = np.random.default_rng(1774)


def noise(n, beta=2.0, lo=1.0, hi=None, seed=None):
    """Periodic 1/f^beta noise, 0..1. lo/hi = band in cycles per tile."""
    r = np.random.default_rng(seed) if seed is not None else RNG
    w = r.standard_normal((n, n))
    F = np.fft.fft2(w)
    fx = np.fft.fftfreq(n) * n
    f = np.sqrt(fx[None, :] ** 2 + fx[:, None] ** 2)
    f[0, 0] = 1
    amp = 1.0 / f ** (beta / 2)
    amp[f < lo] = 0
    if hi:
        amp[f > hi] = 0
    x = np.real(np.fft.ifft2(F * amp))
    x -= x.min()
    return x / max(x.max(), 1e-9)


def stretch(n, sx, sy, beta=2.0, seed=None):
    """Anisotropic periodic noise (streaks): sx, sy = relative frequency scale."""
    r = np.random.default_rng(seed) if seed is not None else RNG
    F = np.fft.fft2(r.standard_normal((n, n)))
    fx = np.fft.fftfreq(n) * n
    f = np.sqrt((fx[None, :] * sx) ** 2 + (fx[:, None] * sy) ** 2)
    f[0, 0] = 1
    x = np.real(np.fft.ifft2(F / f ** (beta / 2)))
    x -= x.min()
    return x / max(x.max(), 1e-9)


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def normal_from(h, strength):
    """UE normal map (OpenGL-style green flipped to DirectX: UE expects +Y down? UE uses DirectX convention - green = -dY)."""
    gy, gx = np.gradient(h * strength)
    # periodic gradient at the edges
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nx, ny, nz = -gx, gy, np.ones_like(h)   # DirectX: +Y points down the image
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5


def save(name, color, height, rough, metal=None, ao=None, nstrength=4.0):
    n = color.shape[0]
    metal = np.zeros((n, n)) if metal is None else metal
    ao = np.ones((n, n)) if ao is None else ao
    lin = np.clip(color, 0, 1)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f'T_HW_B1_{name}_C.png'))
    Image.fromarray((normal_from(height, nstrength * n / 512) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f'T_HW_B1_{name}_N.png'))
    orm = np.stack([np.clip(ao, 0, 1), np.clip(rough, 0, 1), np.clip(metal, 0, 1)], -1)
    Image.fromarray((orm * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f'T_HW_B1_{name}_ORM.png'))
    print(name, n, 'mean colour', np.round(lin.reshape(-1, 3).mean(0), 3))


def rgb(c):
    return np.array(c, dtype=float)[None, None, :]


def lerp3(a, b, t):
    return a + (b - a) * t[..., None]


# ---------------------------------------------------------------- concrete (walls): grey, speckle, map-like water stains
def concrete(n=1024, base=(0.20, 0.195, 0.185), name='concrete', stains=True):
    big = noise(n, 2.2, 1, 12)
    fine = noise(n, 1.0, 40)
    speck = (noise(n, 0.3, 120) > 0.78).astype(float)
    c = rgb(base) * (0.82 + 0.3 * big[..., None]) * (0.92 + 0.12 * fine[..., None])
    c = c * (1 - 0.18 * speck[..., None])
    h = 0.6 * fine + 0.3 * big - 0.25 * speck
    if stains:   # «물 자국이 지도처럼 번져» — low-frequency blotches with darker tide lines
        s = noise(n, 2.6, 1, 8)
        m = smooth(s, 0.55, 0.62)
        edge = smooth(s, 0.55, 0.57) - smooth(s, 0.58, 0.62)
        m = m * 0.6 * smooth(noise(n, 1.0, 20), 0.2, 0.8) + m * 0.4   # broken, not solid blobs
        c = lerp3(c, c * rgb((0.86, 0.84, 0.79)), m) * (1 - 0.12 * np.clip(edge, 0, 1)[..., None])
        drip = stretch(n, 6, 0.4) ** 3
        c = c * (1 - 0.22 * drip[..., None])
    ridged = 1 - np.abs(noise(n, 1.6, 3, 60) * 2 - 1)
    crack = smooth(ridged, 0.965, 0.99)
    c = c * (1 - 0.55 * crack[..., None])
    h = h - 0.8 * crack
    rough = 0.86 + 0.1 * fine - 0.1 * (m if stains else 0)
    save(name, c, h, rough, ao=1 - 0.35 * crack)


# ---------------------------------------------------------------- floor: darker, oil, scuffs
def floor(n=1024):
    big = noise(n, 2.2, 1, 10)
    fine = noise(n, 0.9, 50)
    c = rgb((0.11, 0.107, 0.10)) * (0.8 + 0.35 * big[..., None]) * (0.9 + 0.15 * fine[..., None])
    oil = smooth(noise(n, 2.8, 2, 10), 0.66, 0.8) * (0.5 + 0.5 * noise(n, 1.0, 25))
    c = lerp3(c, rgb((0.07, 0.07, 0.065)), 0.4 * oil)
    scuff = stretch(n, 0.15, 5) ** 4   # long horizontal scuffs
    c = c * (1 + 0.35 * scuff[..., None])
    grit = (noise(n, 0.2, 150) > 0.8).astype(float)
    c = c * (1 - 0.15 * grit[..., None])
    h = 0.6 * fine - 0.3 * grit
    save('floor', c, h, 0.8 + 0.15 * fine - 0.45 * oil)


# ---------------------------------------------------------------- painted steel plates: 1 m panels, seams, rivets, chips
def steel(n=1024, panels=2):
    p = n // panels
    y, x = np.mgrid[0:n, 0:n]
    seam = ((x % p) < 4) | ((y % p) < 4)
    rivet = np.zeros((n, n), bool)
    for k in range(0, n, 32):
        for off in (10, p - 10):
            for c0 in range(off, n, p):
                rr = (x - c0) ** 2 + (y - k) ** 2 < 16
                rivet |= rr
                rr = (y - c0) ** 2 + (x - k) ** 2 < 16
                rivet |= rr
    paint = rgb((0.11, 0.13, 0.15)) * (0.85 + 0.3 * noise(n, 1.8, 2, 30)[..., None])
    chip = smooth(noise(n, 1.4, 4) * 0.6 + noise(n, 0.8, 40) * 0.4, 0.62, 0.66)
    rust = rgb((0.30, 0.14, 0.06)) * (0.7 + 0.6 * noise(n, 1.0, 20)[..., None])
    c = lerp3(paint, rust, chip)
    drip = stretch(n, 8, 0.3) ** 2.5 * smooth(noise(n, 2, 1, 6), 0.4, 0.7)
    c = lerp3(c, rgb((0.26, 0.12, 0.05)), np.clip(0.8 * drip, 0, 1))
    c[seam] *= 0.35
    c[rivet] = c[rivet] * 1.6
    h = -0.9 * seam + 0.8 * rivet - 0.3 * chip + 0.1 * noise(n, 1, 60)
    rough = 0.55 + 0.35 * chip + 0.1 * drip
    metal = 0.15 + 0.35 * chip
    save('steel', c, h, rough, metal, ao=1 - 0.5 * seam)


def rust(n=512):
    a, b = noise(n, 1.6, 2), noise(n, 0.8, 30)
    pit = (noise(n, 0.4, 80) > 0.75).astype(float)
    flake = smooth(noise(n, 1.2, 8), 0.55, 0.6)
    c = lerp3(rgb((0.16, 0.07, 0.03)), rgb((0.45, 0.23, 0.09)), a) * (0.7 + 0.6 * b[..., None])
    c = lerp3(c, rgb((0.10, 0.06, 0.04)), 0.6 * flake) * (1 - 0.3 * pit[..., None])
    save('rust', c, 0.6 * a + 0.5 * b - 0.4 * pit + 0.3 * flake, 0.85 + 0.1 * b, 0.35 * (1 - a))


def wood(n=512):
    y, x = np.mgrid[0:n, 0:n]
    plank = (y // (n // 4)) % 2
    grain = stretch(n, 0.08, 3, 1.4)
    c = rgb((0.22, 0.14, 0.08)) * (0.7 + 0.5 * grain[..., None]) * (0.9 + 0.15 * plank[..., None])
    gap = (y % (n // 4)) < 3
    c[gap] *= 0.3
    wear = smooth(noise(n, 2, 1, 10), 0.55, 0.8)
    c = lerp3(c, c * 1.12, wear)
    save('wood', c, 0.5 * grain - 0.8 * gap, 0.75 + 0.15 * grain)


def canvas(n=512):
    y, x = np.mgrid[0:n, 0:n]
    weave = (np.sin(x * np.pi / 2) * np.sin(y * np.pi / 2)) * 0.5 + 0.5
    dirt = noise(n, 2.2, 1, 12)
    c = rgb((0.27, 0.23, 0.16)) * (0.85 + 0.2 * weave[..., None]) * (0.75 + 0.4 * dirt[..., None])
    save('canvas', c, weave * 0.4 + dirt * 0.2, 0.92 + 0.05 * weave, nstrength=2)


def hazard(n=512):
    y, x = np.mgrid[0:n, 0:n]
    band = ((x + y) // (n // 4)) % 2
    c = np.where(band[..., None] == 0, rgb((0.55, 0.40, 0.04)), rgb((0.03, 0.03, 0.03)))
    wear = smooth(noise(n, 1.2, 6), 0.6, 0.7)
    c = lerp3(c, rgb((0.18, 0.17, 0.16)), wear)
    scratch = stretch(n, 0.1, 6) ** 6
    c = c * (1 - 0.4 * scratch[..., None])
    save('hazard', c, -0.3 * wear, 0.6 + 0.3 * wear, 0.2 * wear)


def rubber(n=512):
    y, x = np.mgrid[0:n, 0:n]
    k = n // 16
    dia = (np.abs(((x % k) - k / 2)) + np.abs(((y % k) - k / 2))) < k * 0.22
    c = rgb((0.06, 0.065, 0.06)) * (0.85 + 0.3 * noise(n, 2, 1, 10)[..., None])
    c[dia] *= 1.3
    save('rubber', c, dia * 0.7, 0.9 - 0.15 * dia)


def grime(n=512):
    g = noise(n, 2.4, 1, 6)
    c = np.repeat(g[..., None], 3, -1)
    save('grime', c, g * 0, np.ones((n, n)))


def posters(w=1024, h=512, cols=8, rows=4):
    """A wall of faded missing-person sheets: paper, a faded photo area, lines of text. No faces are drawn."""
    c = np.ones((h, w, 3)) * rgb((0.06, 0.055, 0.05))
    pw, ph = w // cols, h // rows
    r = np.random.default_rng(285)
    height = np.zeros((h, w))
    for i in range(cols):
        for j in range(rows):
            x0, y0 = i * pw + r.integers(3, 12), j * ph + r.integers(3, 10)
            x1, y1 = x0 + pw - r.integers(12, 24), y0 + ph - r.integers(10, 20)
            tone = rgb((0.62, 0.58, 0.47)) * r.uniform(0.6, 1.0)
            c[y0:y1, x0:x1] = tone
            height[y0:y1, x0:x1] = 0.3
            # the photo: a faded grey rectangle (someone's picture, not drawn)
            px0, py0 = x0 + (x1 - x0) // 5, y0 + 8
            px1, py1 = x1 - (x1 - x0) // 5, y0 + (y1 - y0) * 3 // 5
            c[py0:py1, px0:px1] = tone * r.uniform(0.45, 0.7)
            for t in range(4):   # text lines
                ty = py1 + 8 + t * 7
                if ty + 3 < y1:
                    c[ty:ty + 3, x0 + 8:x1 - 8 - r.integers(0, 30)] *= 0.55
    yellow = noise(max(w, h), 2, 1, 10)[:h, :w]
    c = c * (0.75 + 0.35 * yellow[..., None])
    Image.fromarray((np.clip(c, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(os.path.join(OUT, 'T_HW_B1_posters_C.png'))
    print('posters', w, h)


def screen(n=256):
    y, x = np.mgrid[0:n, 0:n]
    scan = 0.6 + 0.4 * (np.sin(y * np.pi / 2) ** 2)
    glow = np.exp(-(((x - n / 2) / (n * 0.6)) ** 2 + ((y - n / 2) / (n * 0.6)) ** 2))
    g = noise(n, 1.8, 2, 20)
    c = rgb((0.10, 0.55, 0.30)) * (scan * glow * (0.6 + 0.4 * g))[..., None]
    Image.fromarray((np.clip(c, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(os.path.join(OUT, 'T_HW_B1_screen_C.png'))
    print('screen', n)


# signs: names from the design sheet (B-1, B-2, «인력사무소 STAFFING OFFICE», 보급고) and the novel (의무실, 각인 평가소,
# 지하 훈련장, 출격문, 비상 탈출구 = the sheet's «비상 탈출구»). Hand-painted on a steel plate, paint worn.
SIGNS = {
    'b1': (['B-1'], (0.85, 0.83, 0.78), 1.0),
    'b2': (['B-2'], (0.78, 0.16, 0.10), 1.0),
    'manpower': (['인력사무소', 'STAFFING OFFICE'], (0.86, 0.80, 0.66), 0.55),
    'supply': (['보급고'], (0.86, 0.80, 0.66), 0.8),
    'medical': (['의무실'], (0.86, 0.86, 0.84), 0.8),
    'rank': (['각인 평가소'], (0.86, 0.80, 0.66), 0.7),
    'training': (['지하 훈련장'], (0.86, 0.80, 0.66), 0.7),
    'gate': (['출격문'], (0.92, 0.70, 0.10), 0.8),
    'exit': (['비상 탈출구'], (0.80, 0.20, 0.12), 0.7),
}


def signs(w=1024, h=256):
    from PIL import ImageDraw, ImageFont
    for key, (lines, ink, scale) in SIGNS.items():
        r = np.random.default_rng(abs(hash(key)) % 1000)
        plate = rgb((0.07, 0.075, 0.08)) * (0.8 + 0.4 * noise(w, 1.6, 2, 30)[:h, :w, None])
        mask = Image.new('L', (w, h), 0)
        d = ImageDraw.Draw(mask)
        big = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', int(h * 0.62 * scale))
        small = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', int(h * 0.2))
        if len(lines) == 1:
            d.text((w / 2, h / 2), lines[0], font=big, fill=255, anchor='mm')
        else:
            d.text((w / 2, h * 0.40), lines[0], font=big, fill=255, anchor='mm')
            d.text((w / 2, h * 0.82), lines[1], font=small, fill=255, anchor='mm')
        m = np.asarray(mask, dtype=float) / 255
        wear = smooth(noise(w, 1.1, 8)[:h, :w], 0.25, 0.4)   # paint lost in patches
        m = m * wear
        c = plate * (1 - m[..., None]) + rgb(ink) * m[..., None] * (0.8 + 0.3 * noise(w, 1, 20)[:h, :w, None])
        rust = smooth(stretch(w, 6, 0.4)[:h, :w], 0.7, 0.9)   # drips from the top edge
        c = lerp3(c, rgb((0.28, 0.13, 0.05)), 0.6 * rust)
        lin = np.clip(c, 0, 1)
        srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
        Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f'T_HW_B1_sign_{key}_C.png'))
    print('signs', len(SIGNS))


def paint(n=512):
    """Worn solid paint (tinted per use: walkway lines, markings) - chips show the concrete."""
    chip = smooth(noise(n, 1.2, 6) * 0.7 + noise(n, 0.8, 40) * 0.3, 0.58, 0.63)
    c = rgb((0.8, 0.8, 0.78)) * (0.85 + 0.2 * noise(n, 1.5, 4)[..., None])
    c = lerp3(c, rgb((0.12, 0.115, 0.11)), chip)
    save('paint', c, -0.2 * chip, 0.55 + 0.35 * chip)


def emblem(n=1024):
    """The floor marking in the core (sheet: a painted circle in the hall floor) - rings and eight spokes (the octagon),
    worn by feet. No logo is invented."""
    y, x = np.mgrid[0:n, 0:n]
    r = np.hypot(x - n / 2, y - n / 2) / (n / 2)
    t = np.arctan2(y - n / 2, x - n / 2)
    ink = ((np.abs(r - 0.92) < 0.025) | (np.abs(r - 0.78) < 0.012) | (np.abs(r - 0.35) < 0.02)).astype(float)
    spokes = (np.abs(np.sin(4 * t)) < 0.035) & (r > 0.36) & (r < 0.78)
    ink = np.maximum(ink, spokes.astype(float))
    ink *= smooth(noise(n, 1.1, 6), 0.42, 0.58) * (1 - 0.7 * smooth(noise(n, 2, 1, 5), 0.5, 0.75))   # worn by feet
    base = rgb((0.11, 0.107, 0.10)) * (0.8 + 0.35 * noise(n, 2.2, 1, 10)[..., None])
    c = base * (1 - ink[..., None]) + rgb((0.36, 0.33, 0.26)) * ink[..., None]   # old paint, dimmed by dirt
    lin = np.clip(c, 0, 1)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'T_HW_B1_sign_emblem_C.png'))
    print('emblem')


def hand_map(w=1024, h=640):
    """A hand-drawn district map on the wall (sheet: the map wall; L576 «서울 남부 구역도») - river band, roads,
    grid squares, red marks. Drawn, not surveyed: no real streets are claimed."""
    from PIL import ImageDraw
    r = np.random.default_rng(576)
    paper = rgb((0.55, 0.51, 0.42)) * (0.75 + 0.35 * noise(max(w, h), 2, 1, 10)[:h, :w, None])
    img = Image.fromarray((np.clip(paper, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    xs = np.linspace(0, w, 40)
    ys = h * 0.22 + 40 * np.sin(xs / 140) + 25 * np.sin(xs / 57)
    d.line(list(zip(xs, ys)), fill=(70, 88, 96), width=46)          # the river
    for k in range(22):                                                # roads
        x0, y0 = r.uniform(0, w), r.uniform(h * 0.3, h)
        pts = [(x0, y0)]
        for _ in range(6):
            x0 += r.uniform(-160, 160)
            y0 += r.uniform(-90, 90)
            pts.append((x0, y0))
        d.line(pts, fill=(60, 52, 40), width=int(r.integers(2, 5)))
    for gx in range(0, w, 128):                                        # grid
        d.line([(gx, 0), (gx, h)], fill=(110, 100, 80), width=1)
    for gy in range(0, h, 128):
        d.line([(0, gy), (w, gy)], fill=(110, 100, 80), width=1)
    for k in range(14):                                                # red marks and crosses
        x0, y0 = r.uniform(40, w - 40), r.uniform(h * 0.3, h - 40)
        if k % 3:
            d.ellipse([x0 - 16, y0 - 16, x0 + 16, y0 + 16], outline=(150, 30, 20), width=4)
        else:
            d.line([(x0 - 14, y0 - 14), (x0 + 14, y0 + 14)], fill=(150, 30, 20), width=5)
            d.line([(x0 - 14, y0 + 14), (x0 + 14, y0 - 14)], fill=(150, 30, 20), width=5)
    img.save(os.path.join(OUT, 'T_HW_B1_sign_map_C.png'))
    print('map')


if __name__ == '__main__':
    paint()
    emblem()
    hand_map()
    signs()
    concrete()
    floor()
    steel()
    rust()
    wood()
    canvas()
    hazard()
    rubber()
    grime()
    posters()
    screen()
