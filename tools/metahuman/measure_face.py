import json, sys, cv2, mediapipe as mp, numpy as np
out = {}
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.2) as fm:
    for p in sys.argv[1:]:
        im = cv2.imread(p); h, w = im.shape[:2]
        r = fm.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
        if not r.multi_face_landmarks:
            out[p] = None; continue
        L = np.array([[l.x * w, l.y * h] for l in r.multi_face_landmarks[0].landmark])
        d = lambda a, b: float(np.linalg.norm(L[a] - L[b]))
        cheek = d(234, 454)                       # face width at the cheekbones
        eyes = d(33, 263)
        out[p] = {"jaw_angle/cheek": round(d(172, 397) / cheek, 3), "lowjaw/cheek": round(d(136, 365) / cheek, 3),
                  "chin_w/cheek": round(d(149, 378) / cheek, 3), "nose_chin/eye_w": round(d(1, 152) / eyes, 3),
                  "mouth_chin/eye_w": round(d(14, 152) / eyes, 3), "face_h/cheek": round(d(10, 152) / cheek, 3)}
for k, v in out.items():
    print(k.split('/')[-1], v)
