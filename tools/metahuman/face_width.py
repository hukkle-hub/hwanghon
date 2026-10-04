import sys, cv2, numpy as np, mediapipe as mp
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, min_detection_confidence=0.2) as fm:
    for p in sys.argv[1:]:
        im = cv2.imread(p); h, w = im.shape[:2]
        r = fm.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
        L = np.array([[l.x * w, l.y * h] for l in r.multi_face_landmarks[0].landmark])
        d = lambda a, b: float(np.linalg.norm(L[a] - L[b]))
        eyes = d(468, 473)          # pupil to pupil
        print(p, {"cheek/pupils": round(d(234, 454) / eyes, 3), "jawangle/pupils": round(d(172, 397) / eyes, 3), "chin_w/pupils": round(d(148, 377) / eyes, 3),
                  "nose_chin/pupils": round(d(1, 152) / eyes, 3), "eye_chin/pupils": round((d(468, 152) + d(473, 152)) / 2 / eyes, 3)})
