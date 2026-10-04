import sys, cv2, mediapipe as mp, numpy as np
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.2) as fm:
    for p in sys.argv[1:]:
        im = cv2.imread(p); h, w = im.shape[:2]
        r = fm.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
        if not r.multi_face_landmarks:
            print(p, None); continue
        L = np.array([[l.x * w, l.y * h] for l in r.multi_face_landmarks[0].landmark])
        d = lambda a, b: float(np.linalg.norm(L[a] - L[b]))
        ew = (d(33, 133) + d(362, 263)) / 2
        gap = (d(52, 159) + d(282, 386)) / 2          # lower brow line -> upper lid, above the pupil
        open_ = (d(159, 145) + d(386, 374)) / 2        # eye opening at the pupil
        print(p.split('/')[-1], {"brow_gap/eye_w": round(gap / ew, 3), "open/eye_w": round(open_ / ew, 3)})
