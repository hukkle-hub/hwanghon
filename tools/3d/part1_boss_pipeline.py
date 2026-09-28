"""Hi3D 보스 몸 하나를 스토리 전투까지 (docs/design/151).

  python tools/3d/part1_boss_pipeline.py <id> <hi3d 결과.glb> [--no-ue]

1. 원본을 art/3d/src/part1_hi3d/<id>.glb 로 보관
2. Blender: 키(story_episodes.json "bodies")에 맞춰 리깅(사람 뼈대) 또는 정적 → art/3d/part1/<id>[_static].glb
3. 자세 확인 시트 → art/review/part1/<id>_poses.png
4. 사람 뼈대면 DefaultGame.ini 에 boss_<id> 몸 등록
5. story_episodes.json 을 다시 만든다 (그 보스의 모든 전투가 새 몸을 입는다)
6. UE: Scripts/ue_boss_part1_setup.py 로 가져오기 + DA_Boss_<id>
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
UE = r"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
UPROJECT = os.path.join(ROOT, "ue", "HwanghonCombatUE", "HwanghonCombatUE.uproject")
INI = os.path.join(ROOT, "ue", "HwanghonCombatUE", "Config", "DefaultGame.ini")
EPISODES = os.path.join(ROOT, "ue", "HwanghonCombatUE", "Content", "Data", "story_episodes.json")
HOLD = {"clave": "mixamorig:LeftHand"}   # the shutter rides the left hand (L1774-L1796)


def run(cmd, **kw):
    print("$", " ".join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
    for line in (r.stdout + r.stderr).splitlines():
        if line.startswith(("[rig]", "[poses]", "Traceback", "Error")) or "[HWBoss" in line:
            print("  ", line)
    if r.returncode != 0:
        sys.exit(f"failed: {cmd[0]} ({r.returncode})")
    return r


def register_ini(bid):
    line = (f'+Characters=(Id="boss_{bid}",Mesh="/Game/Bosses/Part1/{bid}/SkeletalMeshes/{bid}.{bid}",'
            f'AnimationSet="/Game/Animation/Boss/DA_Boss_{bid}.DA_Boss_{bid}",MeshYaw=-90,MeshScale=1.0)')
    text = open(INI, encoding="utf-8").read()
    if f'Id="boss_{bid}"' in text:
        return
    anchor = '+Characters=(Id="boss",'
    i = text.index(anchor)
    j = text.index("\n", i)
    open(INI, "w", encoding="utf-8", newline="").write(text[:j + 1] + line + "\n" + text[j + 1:])
    print(f"   DefaultGame.ini: boss_{bid}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    bid, src = args[0], os.path.abspath(args[1])
    bodies = {b["id"]: b for b in json.load(open(EPISODES, encoding="utf-8"))["bodies"].values()}
    body = bodies[bid]
    keep = os.path.join(ROOT, "art", "3d", "src", "part1_hi3d", f"{bid}.glb")
    os.makedirs(os.path.dirname(keep), exist_ok=True)
    if os.path.abspath(src) != keep:
        shutil.copyfile(src, keep)
    static = body["kind"] == "static"
    out = os.path.join(ROOT, "art", "3d", "part1", f"{bid}_static.glb" if static else f"{bid}.glb")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    extra = ["--static"] if static else ([f"--hold={HOLD[bid]}"] if bid in HOLD else [])
    run([BLENDER, "-b", "--python-exit-code", "1", "-P", os.path.join(ROOT, "tools", "3d", "rig_boss_template.py"), "--",
         keep, str(body["height"]), out] + extra)
    if not static:
        review = os.path.join(ROOT, "art", "review", "part1")
        os.makedirs(review, exist_ok=True)
        run([BLENDER, "-b", "--python-exit-code", "1", "-P", os.path.join(ROOT, "tools", "3d", "render_boss_poses.py"), "--",
             out, os.path.join(review, f"{bid}.png")])
        from PIL import Image
        clips = ["idle", "walk", "atk_slam", "atk_spin", "hit", "death"]
        shots = [os.path.join(review, f"{bid}_{c}.png") for c in clips]
        shots = [p for p in shots if os.path.exists(p)]
        sheet = Image.new("RGB", (420 * len(shots), 520))
        for k, p in enumerate(shots):
            sheet.paste(Image.open(p).convert("RGB"), (420 * k, 0))
            os.remove(p)
        sheet.save(os.path.join(review, f"{bid}_poses.png"))
        print(f"   poses: art/review/part1/{bid}_poses.png")
        register_ini(bid)
    run([sys.executable, os.path.join(ROOT, "tools", "story", "build_story_episodes.py")])
    if "--no-ue" not in sys.argv:
        env = dict(os.environ, HW_BOSSES=bid)
        run([UE, UPROJECT, f'-ExecutePythonScript={os.path.join(ROOT, "ue", "HwanghonCombatUE", "Scripts", "ue_boss_part1_setup.py").replace(os.sep, "/")}',
             "-unattended", "-nullrhi", "-nosplash"], env=env)
    print(f"done: {bid} -> {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
