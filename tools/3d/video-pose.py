"""영상(또는 프레임 PNG 폴더) → 사람 33 관절 3D 위치 JSON — 디렉터가 만든 스킬 영상에서 모션을 뜬다 (docs/design/86).

MediaPipe Pose Landmarker(heavy) 의 «world landmarks»(미터, 골반 가운데 원점)를 프레임마다 뽑는다.
무기는 추적하지 않는다(손에 붙인다). 한 사람만, 몸 전체가 화면 안에 있어야 잘 나온다.

  python3 tools/3d/video-pose.py <영상.mp4 | 프레임폴더> <출력.json> [--fps 30] [--model pose_landmarker_heavy.task]
  모델: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
출력: {fps, n, names[33], frames:[{t, ok, world:[[x,y,z,vis]...33], img:[[u,v]...33]}]}  — world 는 MediaPipe 좌표(x 화면 오른쪽, y 아래, z 카메라에서 멀어짐)
"""
import sys, os, json, glob, argparse
import numpy as np
import cv2
import mediapipe as mp

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--fps', type=float, default=0, help='프레임 폴더일 때 초당 프레임 (영상은 파일 값)')
ap.add_argument('--model', default=os.path.join(os.path.dirname(__file__), 'pose_landmarker_heavy.task'))
a = ap.parse_args()

NAMES = ['nose','l_eye_in','l_eye','l_eye_out','r_eye_in','r_eye','r_eye_out','l_ear','r_ear','mouth_l','mouth_r',
         'l_shoulder','r_shoulder','l_elbow','r_elbow','l_wrist','r_wrist','l_pinky','r_pinky','l_index','r_index','l_thumb','r_thumb',
         'l_hip','r_hip','l_knee','r_knee','l_ankle','r_ankle','l_heel','r_heel','l_foot','r_foot']

def frames():
    if os.path.isdir(a.src):
        fs = sorted(glob.glob(os.path.join(a.src, '*.png')) + glob.glob(os.path.join(a.src, '*.jpg')))
        fps = a.fps or 30
        for i, f in enumerate(fs): yield i / fps, cv2.imread(f), fps
    else:
        cap = cv2.VideoCapture(a.src); fps = cap.get(cv2.CAP_PROP_FPS) or a.fps or 30; i = 0
        while True:
            ok, im = cap.read()
            if not ok: break
            yield i / fps, im, fps; i += 1

BaseOptions = mp.tasks.BaseOptions; PL = mp.tasks.vision.PoseLandmarker; PLO = mp.tasks.vision.PoseLandmarkerOptions
opts = PLO(base_options=BaseOptions(model_asset_path=a.model), running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=1,
           min_pose_detection_confidence=0.4, min_pose_presence_confidence=0.4, min_tracking_confidence=0.4)
out = []; FPS = 30
with PL.create_from_options(opts) as lm:
    W = H = 0
    for t, im, fps in frames():
        FPS = fps; H, W = im.shape[:2]
        rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
        r = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(round(t * 1000)))
        if not r.pose_world_landmarks: out.append({'t': round(t, 4), 'ok': False}); continue
        w = r.pose_world_landmarks[0]; p = r.pose_landmarks[0]
        out.append({'t': round(t, 4), 'ok': True,
                    'world': [[round(q.x, 5), round(q.y, 5), round(q.z, 5), round(q.visibility or 0, 3)] for q in w],
                    'img': [[round(q.x, 4), round(q.y, 4)] for q in p]})
ok = sum(1 for f in out if f['ok'])
json.dump({'fps': FPS, 'n': len(out), 'w': W, 'h': H, 'names': NAMES, 'frames': out}, open(a.out, 'w'))
print(f'{len(out)} 프레임, 사람 잡힘 {ok} ({ok / max(1, len(out)) * 100:.0f}%) → {a.out}')
