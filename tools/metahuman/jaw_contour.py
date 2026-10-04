"""Face-outline overlay (design vs result), normalised: cheekbone points 234/454 -> (-1,0)/(1,0). Draws the lower
oval and prints the gap per jaw point in % of the cheek width. python jaw_contour.py design.png result.png out.png"""
import sys, cv2, numpy as np, mediapipe as mp
OVAL = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454]
def pts(p):
    im = cv2.imread(p); h, w = im.shape[:2]
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, min_detection_confidence=0.2) as fm:
        r = fm.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
    L = np.array([[l.x * w, l.y * h] for l in r.multi_face_landmarks[0].landmark])
    a, b = L[234], L[454]; c = (a + b) / 2; s = np.linalg.norm(b - a) / 2
    ang = np.arctan2(*(b - a)[::-1]); R = np.array([[np.cos(-ang), -np.sin(-ang)], [np.sin(-ang), np.cos(-ang)]])
    return ((L - c) @ R.T) / s
A, B = pts(sys.argv[1]), pts(sys.argv[2])
canvas = np.full((700, 700, 3), 255, np.uint8)
f = lambda q: (int(350 + q[0] * 260), int(150 + q[1] * 260))
for P, col in ((A, (40, 40, 220)), (B, (220, 120, 30))):
    cv2.polylines(canvas, [np.array([f(P[k]) for k in OVAL])], False, col, 3)
    for k in (33, 263, 1, 13): cv2.circle(canvas, f(P[k]), 5, col, -1)
cv2.putText(canvas, "red=design blue=result", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
cv2.imwrite(sys.argv[3], canvas)
for k, nm in ((172, "jaw angle R"), (397, "jaw angle L"), (150, "jaw mid R"), (379, "jaw mid L"), (148, "chin side R"), (377, "chin side L"), (152, "chin")):
    d = (B[k] - A[k]) * 50
    print(f"{nm:12s} dx {d[0]:+5.1f}%  dy {d[1]:+5.1f}%")
