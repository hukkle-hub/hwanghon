# 장비 외형 재질 텍스처 6종 절차 생성 (PIL) → art/3d/tex/<name>.png (256², 타일링)
#   python3 tools/3d/gen_tex.py
# looks.js 조각 재질과 build_weapons.py 무기 재질이 색상과 곱해 쓴다. 결정적(seed 7).
import os, math, random
from PIL import Image, ImageDraw, ImageFilter
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art', '3d', 'tex'); os.makedirs(OUT, exist_ok=True)
N=256; rnd=random.Random(7)
def noise(scale, octaves=3):
    """타일링 값잡음 0..1"""
    img=Image.new('L',(N,N),128); px=img.load(); acc=[[0.0]*N for _ in range(N)]; amp=1.0; tot=0
    for o in range(octaves):
        g=max(2,int(scale/(2**o))); grid=[[rnd.random() for _ in range(g)] for _ in range(g)]
        for y in range(N):
            for x in range(N):
                fx=x/N*g; fy=y/N*g; x0=int(fx); y0=int(fy); tx=fx-x0; ty=fy-y0; tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty)
                a=grid[y0%g][x0%g]; b=grid[y0%g][(x0+1)%g]; c=grid[(y0+1)%g][x0%g]; d=grid[(y0+1)%g][(x0+1)%g]
                acc[y][x]+=amp*((a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty)
        tot+=amp; amp*=0.5
    for y in range(N):
        for x in range(N): px[x,y]=int(255*acc[y][x]/tot)
    return img
def colorize(gray, lo, hi):
    out=Image.new('RGB',(N,N)); po=out.load(); pg=gray.load()
    for y in range(N):
        for x in range(N):
            t=pg[x,y]/255; po[x,y]=tuple(int(lo[i]+(hi[i]-lo[i])*t) for i in range(3))
    return out
def save(img, name): img.save(os.path.join(OUT, name+'.png'), optimize=True); print('wrote', name)
# 나무: 세로 결 + 잡음
g=noise(6); px=g.load()
for y in range(N):
    for x in range(N): px[x,y]=int(min(255, px[x,y]*0.6 + 60*abs(math.sin((x*0.11)+math.sin(y*0.02)*2))+ 30))
save(colorize(g,(60,38,20),(110,78,44)),'wood')
# 강철: 미세 잡음 + 가로 스크래치
g=noise(24,2); px=g.load(); d=ImageDraw.Draw(g)
for i in range(60): y=rnd.randrange(N); d.line((0,y,N,y), fill=rnd.randrange(90,170))
g=g.filter(ImageFilter.GaussianBlur(0.5)); save(colorize(g,(120,124,132),(168,172,180)),'steel')
# 녹: 얼룩 + 검은 점
g=noise(5); px=g.load(); d=ImageDraw.Draw(g)
for i in range(120): x=rnd.randrange(N); y=rnd.randrange(N); r=rnd.randrange(1,4); d.ellipse((x-r,y-r,x+r,y+r), fill=rnd.randrange(0,60))
save(colorize(g,(55,28,16),(120,72,42)),'rust')
# 가죽: 잔결 + 굵은 얼룩
g=noise(16,3); save(colorize(g,(56,36,20),(84,56,32)),'leather')
# 천: 직조 격자
g=noise(32,2); px=g.load()
for y in range(N):
    for x in range(N):
        w=((x//3)+(y//3))%2; px[x,y]=int(px[x,y]*0.5+ (40 if w else 60) + 30)
save(colorize(g,(34,32,38),(58,56,64)),'cloth')
# 올리브(갈대 엮음): 사선 줄기
g=noise(12,2); px=g.load()
for y in range(N):
    for x in range(N): px[x,y]=int(px[x,y]*0.55 + 50*abs(math.sin((x+y)*0.18)) + 25)
save(colorize(g,(48,56,30),(78,88,48)),'olive')
