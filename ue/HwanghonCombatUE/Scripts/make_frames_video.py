"""
Encode a folder of numbered PNG frames (f_00000.png ...) to H.264 MP4.
  python Scripts/make_frames_video.py <frames_dir> <out.mp4> [fps]
Needs imageio-ffmpeg (pip install imageio-ffmpeg).
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg


def main():
    frames, out = Path(sys.argv[1]), Path(sys.argv[2])
    fps = sys.argv[3] if len(sys.argv) > 3 else "15"
    files = sorted(frames.glob("f_*.png"))
    if not files:
        print(f"no frames in {frames}")
        return
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-framerate", fps,
                    "-i", str(frames / "f_%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22",
                    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", str(out)], check=True)
    print(f"{out} ({len(files)} frames @ {fps} fps = {len(files) / float(fps):.1f} s)")


if __name__ == "__main__":
    main()
