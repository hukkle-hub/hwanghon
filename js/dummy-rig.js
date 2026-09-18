/* 황혼 — 허수아비 2D 리그 (design-sheets/10-dummy.webp 정면 뷰에서 분리)
   좌표계: 정면 뷰 506x813. 각 파츠는 pivot(px,py) 을 축으로 회전, parent 를 따라 움직인다 */
(function(){
  var RIG = { w:498, h:815, dir:'art/dummy/', parts:[{"id": "shinL", "name": "왼 정강이", "x": 70, "y": 640, "w": 186, "h": 174, "px": 185, "py": 655, "parent": "thighL", "z": 0}, {"id": "shinR", "name": "오른 정강이", "x": 255, "y": 640, "w": 172, "h": 174, "px": 320, "py": 655, "parent": "thighR", "z": 0}, {"id": "thighL", "name": "왼 허벅지", "x": 131, "y": 470, "w": 125, "h": 191, "px": 195, "py": 485, "parent": "pelvis", "z": 1}, {"id": "thighR", "name": "오른 허벅지", "x": 255, "y": 470, "w": 109, "h": 191, "px": 305, "py": 485, "parent": "pelvis", "z": 1}, {"id": "pelvis", "name": "골반", "x": 150, "y": 340, "w": 205, "h": 191, "px": 255, "py": 380, "parent": null, "z": 2}, {"id": "upperL", "name": "왼 상박", "x": 60, "y": 140, "w": 119, "h": 151, "px": 150, "py": 150, "parent": "torso", "z": 3}, {"id": "upperR", "name": "오른 상박", "x": 328, "y": 140, "w": 112, "h": 151, "px": 356, "py": 150, "parent": "torso", "z": 3}, {"id": "foreL", "name": "왼 하박", "x": 20, "y": 265, "w": 119, "h": 146, "px": 95, "py": 275, "parent": "upperL", "z": 4}, {"id": "foreR", "name": "오른 하박", "x": 373, "y": 265, "w": 109, "h": 146, "px": 411, "py": 275, "parent": "upperR", "z": 4}, {"id": "handL", "name": "왼 손", "x": 0, "y": 390, "w": 65, "h": 141, "px": 40, "py": 405, "parent": "foreL", "z": 5}, {"id": "handR", "name": "오른 손", "x": 431, "y": 390, "w": 67, "h": 141, "px": 466, "py": 405, "parent": "foreR", "z": 5}, {"id": "torso", "name": "몸통", "x": 156, "y": 90, "w": 194, "h": 306, "px": 255, "py": 380, "parent": "pelvis", "z": 6}, {"id": "padL", "name": "왼 견갑", "x": 66, "y": 95, "w": 115, "h": 76, "px": 170, "py": 130, "parent": "torso", "z": 7}, {"id": "padR", "name": "오른 견갑", "x": 325, "y": 95, "w": 106, "h": 76, "px": 335, "py": 130, "parent": "torso", "z": 7}, {"id": "head", "name": "머리", "x": 205, "y": 0, "w": 96, "h": 101, "px": 251, "py": 95, "parent": "torso", "z": 8}],
    /* 조준·판정용 히트 영역 (정면 좌표, 부모 파츠에 붙는다) */
    hits:{ core:{ parent:'torso', cx:251, cy:180, r:44, label:'핵' }, chain:{ parent:'torso', cx:251, cy:255, r:46, label:'가슴 사슬' }, body:{ parent:'torso', cx:251, cy:330, r:52, label:'몸통' },
           shl:{ parent:'padL', cx:120, cy:132, r:44, label:'왼 견갑' }, shr:{ parent:'padR', cx:385, cy:132, r:44, label:'오른 견갑' }, head:{ parent:'head', cx:251, cy:48, r:42, label:'머리' } },
    /* 발광 오버레이 (핵·눈) */
    glow:{ core:{ parent:'torso', cx:251, cy:178, r:26 }, eyeL:{ parent:'head', cx:236, cy:46, r:5 }, eyeR:{ parent:'head', cx:266, cy:46, r:5 } }
  };
  /* ---------- 애니메이션 클립: 키프레임 { t:초, pose:{파츠:각도}, root:{dx,dy,s} } ----------
     각도 단위 도(°). 양수 = 시계방향. 클립은 첫 프레임에서 마지막 프레임까지 선형/이징 보간 */
  var IDLE = { pose:{}, root:{dx:0,dy:0,s:1} };
  RIG.clips = {
    idle:   { loop:true, keys:[ {t:0, pose:{torso:-1, head:1.5, upperL:2, upperR:-2, foreL:1, foreR:-1}, root:{dy:0}},
                                {t:1.6, pose:{torso:1, head:-1.5, upperL:-2, upperR:2, foreL:-1, foreR:1}, root:{dy:4}},
                                {t:3.2, pose:{torso:-1, head:1.5, upperL:2, upperR:-2, foreL:1, foreR:-1}, root:{dy:0}} ] },
    /* 각도 부호: 왼팔(upperL) 음수 = 몸 안쪽으로, 오른팔(upperR) 양수 = 몸 안쪽으로
       예고(windup) — 길이는 엔진의 예고 시간에 맞춰 늘려 재생 */
    tele_bolt:   { keys:[ {t:0, pose:{}}, {t:1, pose:{torso:-10, head:-6, upperR:-95, foreR:-60, handR:-20, upperL:25, foreL:15}, root:{dx:-10,dy:-6}, ease:'out'} ] },
    tele_scythe: { keys:[ {t:0, pose:{}}, {t:1, pose:{torso:-22, head:-10, upperL:-100, foreL:-30, upperR:-60, foreR:-40, thighL:-6, thighR:6}, root:{dx:-14,dy:-4}, ease:'out'} ] },
    tele_hammer: { keys:[ {t:0, pose:{}}, {t:1, pose:{torso:-14, head:-12, upperL:-140, foreL:-25, upperR:140, foreR:25, handL:-10, handR:10}, root:{dy:-22,s:1.02}, ease:'out'} ] },
    /* 타격(strike) — 예고 끝 포즈에서 시작해 휘두른다 */
    hit_bolt:    { keys:[ {t:0, pose:{torso:-10, head:-6, upperR:-95, foreR:-60, handR:-20, upperL:25, foreL:15}, root:{dx:-10,dy:-6}},
                          {t:0.12, pose:{torso:14, head:6, upperR:70, foreR:20, handR:10, upperL:-20, foreL:-10}, root:{dx:26,dy:30,s:1.08}, ease:'in'},
                          {t:0.55, pose:{}, root:{}, ease:'out'} ] },
    hit_scythe:  { keys:[ {t:0, pose:{torso:-22, head:-10, upperL:-100, foreL:-30, upperR:-60, foreR:-40}, root:{dx:-14,dy:-4}},
                          {t:0.16, pose:{torso:28, head:12, upperL:-70, foreL:-10, upperR:-110, foreR:-20, thighL:8, thighR:-8}, root:{dx:30,dy:10,s:1.05}, ease:'in'},
                          {t:0.7, pose:{}, root:{}, ease:'out'} ] },
    hit_hammer:  { keys:[ {t:0, pose:{torso:-14, head:-12, upperL:-140, foreL:-25, upperR:140, foreR:25}, root:{dy:-22,s:1.02}},
                          {t:0.14, pose:{torso:26, head:18, upperL:-30, foreL:-10, upperR:30, foreR:10, thighL:14, thighR:-14, shinL:-10, shinR:10}, root:{dy:46,s:1.1}, ease:'in'},
                          {t:0.8, pose:{}, root:{}, ease:'out'} ] },
    flinch:  { keys:[ {t:0, pose:{}}, {t:0.06, pose:{torso:-4, head:-7, upperL:-6, upperR:6}, root:{dx:6}}, {t:0.24, pose:{}, root:{}} ] },
    stagger: { keys:[ {t:0, pose:{}}, {t:0.1, pose:{torso:-16, head:-22, upperL:-30, upperR:30, foreL:-20, foreR:20, thighL:-6, thighR:6}, root:{dx:-18,dy:6}, ease:'out'}, {t:0.8, pose:{}, root:{}, ease:'in'} ] },
    down:    { hold:true, keys:[ {t:0, pose:{}}, {t:0.12, pose:{torso:-6, head:-8}, root:{dy:-8}, ease:'out'},
                                 {t:0.45, pose:{torso:22, head:30, upperL:-18, upperR:18, foreL:-12, foreR:12, handL:-6, handR:6, thighL:-14, thighR:14, shinL:12, shinR:-12}, root:{dy:96, s:0.96}, ease:'in'} ] },
    up:      { keys:[ {t:0, pose:{torso:22, head:30, upperL:-18, upperR:18, foreL:-12, foreR:12, handL:-6, handR:6, thighL:-14, thighR:14, shinL:12, shinR:-12}, root:{dy:96, s:0.96}}, {t:0.55, pose:{}, root:{}, ease:'out'} ] },
    collapse:{ hold:true, keys:[ {t:0, pose:{}}, {t:0.3, pose:{torso:-10, head:-14, upperL:-40, upperR:40}, root:{dy:-14}, ease:'out'},
                                 {t:0.9, pose:{torso:58, head:40, upperL:-30, upperR:30, foreL:-16, foreR:16, thighL:-22, thighR:22, shinL:18, shinR:-18}, root:{dy:190, s:0.92}, ease:'in'},
                                 {t:1.5, pose:{torso:62, head:44, upperL:-32, upperR:32, foreL:-16, foreR:16, thighL:-24, thighR:24, shinL:18, shinR:-18}, root:{dy:200, s:0.92}} ] }
  };
  window.TW_DUMMY_RIG = RIG;
})();
