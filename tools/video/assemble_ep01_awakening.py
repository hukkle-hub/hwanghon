"""EP01 scarecrow awakening (docs/design/163): join the five clips A-E the director made in Gemini/Veo, burn the
novel's lines as subtitles at the order sheet's times, and keep the clips' own sound.

  python tools/video/assemble_ep01_awakening.py [--dir art/video/ep01_awakening] [--out <mp4>]

Each clip is trimmed to 8 s and scaled to 1920x1080. Missing clips are skipped (their lines too), so a partial set
can be looked at. Subtitles: 원문 대사만 (마감본 EP01), nothing invented (doc 163 §4).
"""
import argparse
import os
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
CLIP_S = 8.0
ORDER = "ABCDE"
# (clip, start s within the clip, end s, speaker, line) - 마감본 EP01 L393, L409, L427-L429
LINES = [
    ("A", 2.3, 4.6, "카인", "머리통을 깨부숴주마!"),
    ("B", 6.0, 8.0, "카인", "…셋 다 끝으로 걸었네."),
    ("C", 3.0, 5.0, "아인", "카인! 물러나!"),
    ("C", 5.4, 7.6, "카인", "…뭐?"),
]


def has_audio(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return "Audio:" in r.stderr


def ass_time(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="art/video/ep01_awakening")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    clips = [(k, os.path.join(a.dir, f"{k}.mp4")) for k in ORDER if os.path.exists(os.path.join(a.dir, f"{k}.mp4"))]
    if not clips:
        sys.exit(f"no clips in {a.dir} (A.mp4 … E.mp4)")
    out = a.out or os.path.join(a.dir, "ep01_awakening.mp4")
    offset = {k: i * CLIP_S for i, (k, _) in enumerate(clips)}

    ass = os.path.join(a.dir, "subs.ass")
    with open(ass, "w", encoding="utf-8") as f:
        f.write("[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\n"
                "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginV\n"
                "Style: Line,Malgun Gothic,54,&H00F0F0F0,&H00101010,&H80000000,0,1,3,1,2,70\n\n[Events]\n"
                "Format: Layer, Start, End, Style, Text\n")
        for k, s, e, who, text in LINES:
            if k in offset:
                f.write(f"Dialogue: 0,{ass_time(offset[k] + s)},{ass_time(offset[k] + e)},Line,{text}\n")

    cmd = [FF, "-y", "-hide_banner", "-loglevel", "error"]
    for _, p in clips:
        cmd += ["-t", str(CLIP_S), "-i", p]
    parts = []
    for i, (_, p) in enumerate(clips):
        parts.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,"
                     f"setsar=1,fps=24,trim=0:{CLIP_S},setpts=PTS-STARTPTS[v{i}]")
        if has_audio(p):
            parts.append(f"[{i}:a]aresample=48000,atrim=0:{CLIP_S},apad=whole_dur={CLIP_S},asetpts=PTS-STARTPTS[a{i}]")
        else:
            parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{CLIP_S}[a{i}]")
    n = len(clips)
    parts.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[vc][ac]")
    sub = ass.replace("\\", "/").replace(":", "\\:")
    parts.append(f"[vc]subtitles='{sub}'[vo]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[vo]", "-map", "[ac]",
            "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out]
    subprocess.run(cmd, check=True)
    print(f"{out}: {n} clips, {n * CLIP_S:.0f} s")


if __name__ == "__main__":
    main()
