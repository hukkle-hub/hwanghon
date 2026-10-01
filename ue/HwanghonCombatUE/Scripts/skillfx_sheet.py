"""Contact sheets for -HWQA=skillfx shots: one per hero, rows = skills, columns = the five shot times."""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

root = sys.argv[1]
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 18)
sk = {'ain': ['베기', '걸음', '회전', '결의', '황혼'], 'kain': ['내려침', '철벽', '회전', '강타', '모루'],
      'ryu': ['난무', '도약', '폭풍', '표식', '붉은그림자'], 'sera': ['시약', '안개', '연쇄', '결계', '촉매']}
W, H = 320, 180
for h in sk:
    if not os.path.isdir(os.path.join(root, h)):
        continue
    sheet = Image.new('RGB', (5 * W, 5 * H))
    d = ImageDraw.Draw(sheet)
    for i in range(5):
        for k, f in enumerate(sorted(glob.glob(os.path.join(root, h, f'1{i}_*.png')))[:5]):
            im = Image.open(f).convert('RGB')
            w, hh = im.size
            im = im.crop((int(w * .12), int(hh * .08), int(w * .88), int(hh * .92))).resize((W, H))
            sheet.paste(im, (k * W, i * H))
            d.text((k * W + 6, i * H + 4), f"{i + 1 if i < 4 else 'R'} {sk[h][i]}  {os.path.basename(f)[-7:-4]}", fill=(255, 235, 120), font=font)
    sheet.save(os.path.join(root, f'{h}_sheet.png'))
