"""Render a Level Sequence to a PNG frame sequence with Movie Render Queue, then quit (docs/design/164).

  UnrealEditor.exe <uproject> -ExecCmds="py Scripts/ue_render_sequence.py" -HWMap=/Game/... -HWSeq=/Game/... -HWOut=<dir>
      [-HWRes=1280x720] [-HWWarm=60]
Frames land in <dir>/<seq>.<frame>.png; tools/video makes the mp4.
"""
import sys

import unreal


def arg(name, default=None):
    for a in sys.argv + unreal.SystemLibrary.get_command_line().split():
        if a.startswith(f"-{name}="):
            return a.split("=", 1)[1].strip('"')
    return default


def log(m):
    unreal.log(f"[HWRender] {m}")


S = {"frames": 0, "started": False}


def start():
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(arg("HWMap"))
    subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    queue = subsystem.get_queue()
    for j in list(queue.get_jobs()):
        queue.delete_job(j)
    job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
    job.sequence = unreal.SoftObjectPath(arg("HWSeq"))
    job.map = unreal.SoftObjectPath(arg("HWMap"))
    job.job_name = "hw_render"
    cfg = job.get_configuration()
    w, h = (int(v) for v in arg("HWRes", "1280x720").split("x"))
    out = cfg.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    out.output_directory = unreal.DirectoryPath(arg("HWOut"))
    out.output_resolution = unreal.IntPoint(w, h)
    out.file_name_format = "frame.{frame_number}"
    out.flush_disk_writes_per_shot = True
    cfg.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    cfg.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
    aa = cfg.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
    aa.engine_warm_up_count = int(arg("HWWarm", "60"))
    aa.render_warm_up_count = 30
    aa.use_camera_cut_for_warm_up = False
    executor = unreal.MoviePipelinePIEExecutor()

    def done(ex, ok):
        log(f"finished ok={ok}")
        unreal.SystemLibrary.quit_editor()

    executor.on_executor_finished_delegate.add_callable(done)
    S["executor"] = executor   # keep it alive
    subsystem.render_queue_with_executor_instance(executor)
    log(f"rendering {arg('HWSeq')} at {w}x{h} to {arg('HWOut')}")


def tick(dt):
    S["frames"] += 1
    if not S["started"] and S["frames"] > 60:
        S["started"] = True
        unreal.unregister_slate_post_tick_callback(handle)
        start()


handle = unreal.register_slate_post_tick_callback(tick)
