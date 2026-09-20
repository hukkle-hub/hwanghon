/* 황혼 — 스튜디오 환경맵 (IBL)
   금속·가죽이 «반사할 것» 이 없으면 무광 플라스틱으로 보인다. 지금 던전·뷰어 어디에도
   scene.environment 가 없어서 강철 건틀릿과 천 조각이 같은 질감으로 나왔다.

   외부 HDRI 를 받지 않고, 발광면 몇 개로 방을 만들어 PMREMGenerator 로 굽는다
   (three 의 RoomEnvironment 와 같은 수법이되 «황혼» 의 색으로). 새 vendor 파일이 없다.

     var tex = TW_ENV.make(THREE, renderer, 'studio');   // 옷을 보는 화면
     scene.environment = tex; scene.environmentIntensity = 1;
     TW_ENV.apply(THREE, renderer, scene, 'dungeon', 0.35);   // 던전은 약하게

   던전에 1.0 으로 넣으면 어두운 분위기가 날아간다. 세기는 화면이 정한다. */
(function(){
  'use strict';
  var cache={};

  /* 발광 패널 하나 — [x,y,z, 가로,세로,두께, 색, 세기, 회전Y] */
  var PRESET={
    /* 옷을 보여 주는 스튜디오: 차가운 천창 + 따뜻한 키 + 붉은 킥 */
    studio:{ wall:0x0e0f13, floor:0x14151a,
      panels:[
        [ 0,  6.2,  0,   9, 0.1, 9,  0xcfd8ec, 3.4, 0   ],  /* 천창 (차가움) */
        [ 4.2, 2.6, 3.4, 5, 4.4, 0.1, 0xffe2bc, 5.2, -0.7],  /* 키 (따뜻함) */
        [-4.6, 2.0,-2.2, 5, 3.6, 0.1, 0x9fb4e0, 2.0,  0.9],  /* 필 (차가움) */
        [-1.2, 2.4,-5.0, 4, 3.0, 0.1, 0xC4342E, 3.0,  0   ],  /* 킥 (붉음) */
        [ 0,  -0.1,  0,   9, 0.1, 9,  0x6a5a4c, 0.7, 0   ]   /* 바닥 반사 */
      ]},
    /* 던전: 달빛과 붉은 비상등만. 세기는 부르는 쪽이 0.3 근처로 줄인다 */
    dungeon:{ wall:0x0a0b0e, floor:0x0e0d0c,
      panels:[
        [ 0,  7.0,  0,  12, 0.1,12,  0x8fa0c0, 1.6, 0  ],   /* 달 */
        [-5.0, 3.0,-4.0,  6, 4.0, 0.1, 0xA51C1C, 2.2, 0.5],  /* 비상등 */
        [ 5.0, 2.4, 4.0,  6, 3.2, 0.1, 0xE0C08A, 1.4,-0.5],  /* 램프 */
        [ 0,  -0.1,  0,  12, 0.1,12,  0x3a3330, 0.5, 0  ]
      ]}
  };

  function room(THREE, p){
    var s=new THREE.Scene();
    /* 안쪽을 보는 상자 = 방. uv 는 필요 없다 */
    var shell=new THREE.BoxGeometry(14,10,14); shell.deleteAttribute('uv');
    s.add(new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ color:p.wall, side:THREE.BackSide, roughness:1, metalness:0 })));
    p.panels.forEach(function(a){
      var g=new THREE.BoxGeometry(a[3],a[4],a[5]); g.deleteAttribute('uv');
      var m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:a[6] }));
      m.material.color.multiplyScalar(a[7]);          /* MeshBasic 은 세기가 없다 — 색으로 올린다 */
      m.position.set(a[0],a[1],a[2]); m.rotation.y=a[8]||0; s.add(m);
    });
    return s;
  }

  /* 굽는 데 수십 ms 가 든다. 프리셋마다 한 번만 굽고 재사용한다. */
  function make(THREE, renderer, preset){
    preset=preset||'studio';
    if(cache[preset]) return cache[preset];
    var p=PRESET[preset]||PRESET.studio;
    var gen=new THREE.PMREMGenerator(renderer); gen.compileEquirectangularShader();
    var scene=room(THREE,p), rt=gen.fromScene(scene, 0.04);
    scene.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
    gen.dispose();
    cache[preset]=rt.texture;
    return rt.texture;
  }

  function apply(THREE, renderer, scene, preset, intensity){
    try{
      scene.environment=make(THREE, renderer, preset);
      if('environmentIntensity' in scene) scene.environmentIntensity=(intensity==null?1:intensity);
      return true;
    }catch(e){ return false; }        /* 구운 것이 실패해도 화면은 그대로 뜬다 */
  }

  /* 바닥을 «빛 웅덩이» 로 — 가장자리로 갈수록 투명해져 배경에 녹는다.
     판을 통째로 칠하면 조명·반사가 다 드러나 무대가 아니라 «회색 판» 이 된다. */
  function poolTexture(THREE, size){
    size=size||256;
    var c=document.createElement('canvas'); c.width=c.height=size;
    var x=c.getContext('2d'), g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    g.addColorStop(0,   'rgba(255,255,255,1)');
    g.addColorStop(0.42,'rgba(255,255,255,0.55)');
    g.addColorStop(0.78,'rgba(255,255,255,0.12)');
    g.addColorStop(1,   'rgba(255,255,255,0)');
    x.fillStyle=g; x.fillRect(0,0,size,size);
    var t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
  }

  function dispose(){ Object.keys(cache).forEach(function(k){ cache[k].dispose&&cache[k].dispose(); }); cache={}; }
  window.TW_ENV={ make:make, apply:apply, poolTexture:poolTexture, dispose:dispose, PRESET:PRESET };
})();
