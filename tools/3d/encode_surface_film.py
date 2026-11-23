"""Encode an existing numbered PNG render without rendering it again.
The bundled capture ffmpeg has MJPEG pipe input but no PNG decoder/file demuxer.
"""
import argparse, io, pathlib, subprocess
from PIL import Image
ap=argparse.ArgumentParser(); ap.add_argument('ffmpeg'); ap.add_argument('frames'); ap.add_argument('output'); ap.add_argument('--fps',type=int,default=30); args=ap.parse_args()
files=sorted(pathlib.Path(args.frames).glob('pose-*.png')); output=pathlib.Path(args.output).resolve()
if not files or args.fps<=0: raise RuntimeError('Need rendered PNG frames and a positive frame rate')
if output.exists(): raise RuntimeError('Refusing to overwrite an encoded film')
output.parent.mkdir(parents=True,exist_ok=True)
with open(output.with_suffix('.encode.log'),'wb') as log:
    proc=subprocess.Popen([args.ffmpeg,'-n','-hide_banner','-loglevel','warning','-f','image2pipe','-framerate',str(args.fps),'-vcodec','mjpeg','-i','pipe:0','-c:v','libvpx','-b:v','4M','-crf','10','-pix_fmt','yuv420p','-an',str(output)],stdin=subprocess.PIPE,stderr=log)
    try:
        for file in files:
            with Image.open(file) as image:
                packed=io.BytesIO(); image.convert('RGB').save(packed,format='JPEG',quality=95); proc.stdin.write(packed.getvalue())
    except BrokenPipeError: pass
    finally:
        proc.stdin.close(); code=proc.wait()
if code: raise RuntimeError(f'Encoder failed ({code}); see {output.with_suffix(".encode.log")}')
print(f'{len(files)} rendered frames at {args.fps} fps -> {output}')
