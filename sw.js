/* 황혼 UI — 서비스워커
   · BUILD 는 배포 워크플로가 커밋 해시로 치환한다 → 배포마다 새 버전이 자동 설치되고, 열려 있는 화면은 스스로 새로고침한다
   · HTML/CSS/JS/JSON 은 네트워크 우선(오프라인일 때만 캐시), 아트(webp)는 캐시 우선
   · 캐시 저장소는 출처 단위로 공유되므로 'tw-' 접두 캐시만 관리한다 */
var BUILD = '__BUILD__';
var VERSION = 'tw-' + (BUILD.indexOf('__') === 0 ? 'dev' : BUILD);
var ASSETS = ["arena.html","art/3d/ain_anim.glb","art/3d/ain_scythe_v02.glb","art/ain/back-armL.webp","art/ain/back-armR.webp","art/ain/back-legL.webp","art/ain/back-legR.webp","art/ain/back-torso.webp","art/ain/front-armL.webp","art/ain/front-armR.webp","art/ain/front-legL.webp","art/ain/front-legR.webp","art/ain/front-torso.webp","art/ain/side-arm.webp","art/ain/side-legB.webp","art/ain/side-legF.webp","art/ain/side-torso.webp","art/back-ain.webp","art/back-kain.webp","art/back-ryu.webp","art/back-sera.webp","art/boss-anatomy.webp","art/boss-marsh.webp","art/char-inventory.webp","art/char-profile.webp","art/char-result.webp","art/dummy-back.webp","art/dummy-front.webp","art/dummy-side.webp","art/dummy/foreL.webp","art/dummy/foreR.webp","art/dummy/handL.webp","art/dummy/handR.webp","art/dummy/head.webp","art/dummy/padL.webp","art/dummy/padR.webp","art/dummy/pelvis.webp","art/dummy/shinL.webp","art/dummy/shinR.webp","art/dummy/thighL.webp","art/dummy/thighR.webp","art/dummy/torso.webp","art/dummy/upperL.webp","art/dummy/upperR.webp","art/env/barrel.webp","art/env/crate.webp","art/env/fence.webp","art/env/fpost.webp","art/env/gate.webp","art/env/ground.webp","art/env/ground_n.webp","art/env/post.webp","art/env/ring.webp","art/env/sign.webp","art/env/straw.webp","art/env/torch.webp","art/env/wall.webp","art/env/wall_n.webp","art/face-ain.webp","art/face-kain.webp","art/face-ryu.webp","art/face-sera.webp","art/forge-kain.webp","art/full-ain.webp","art/full-kain.webp","art/full-ryu.webp","art/full-sera.webp","art/lobby-city.webp","art/office-brief.webp","art/portrait-ain.webp","art/portrait-kain.webp","art/portrait-ryu.webp","art/portrait-sera.webp","art/side-ain.webp","art/side-kain.webp","art/side-ryu.webp","art/side-sera.webp","art/story-city.webp","art/thumbs/arena.webp","art/thumbs/battle.webp","art/thumbs/characters.webp","art/thumbs/craft.webp","art/thumbs/dungeon.webp","art/thumbs/forge.webp","art/thumbs/game.webp","art/thumbs/inventory.webp","art/thumbs/office.webp","art/thumbs/party.webp","art/thumbs/profile.webp","art/thumbs/quest.webp","art/thumbs/result.webp","battle.html","benchmark.html","characters.html","compare.html","craft.html","css/battle.css","css/mobile.css","css/tokens.css","css/ui.css","dungeon.html","forge.html","game.html","index.html","inventory.html","js/ain-rig.js","js/combat.js","js/dummy-rig.js","js/dungeon.js","js/dungeons.js","js/game-dungeon.js","js/icons.js","js/inventory.js","js/items.js","js/rig-phaser.js","js/rig.js","js/save.js","js/sfx.js","js/skirmish.js","js/ui.js","js/world-sim.js","js/world.js","manifest.json","maps/d01.json","maps/yard-tiles.png","office.html","party.html","profile.html","quest.html","result.html","vendor/phaser.min.js","vendor/three/BufferGeometryUtils.js","vendor/three/DRACOLoader.js","vendor/three/GLTFLoader.js","vendor/three/KTX2Loader.js","vendor/three/OrbitControls.js","vendor/three/SkeletonUtils.js","vendor/three/meshopt_decoder.module.js","vendor/three/three.module.js","viewer.html"];
/* 이 워커가 설치되는 시점에 이전 워커가 있었는가 → 있었다면 열린 화면들은 옛 버전이므로 활성화 직후 직접 다시 불러온다 */
var HAD_PREVIOUS = !!(self.registration && self.registration.active);
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(ASSETS.map(function(a){ return new Request(a, {cache:'reload'}); })).catch(function(){}); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k.indexOf('tw-')===0 && k!==VERSION; }).map(function(k){ return caches.delete(k); })); })
    .then(function(){ return self.clients.claim(); })
    .then(function(){ return self.clients.matchAll({type:'window'}); })
    .then(function(cs){ cs.forEach(function(c){
      /* 옛 화면(이전 워커가 띄운 것)은 navigate 로 강제 재로드 — 옛 ui.js 에 수신 코드가 없어도 갱신된다. 실패하면 메시지로 대체 */
      var msg = function(){ try{ c.postMessage({type:'TW_UPDATED', version:VERSION}); }catch(e){} };
      if (HAD_PREVIOUS && c.navigate) c.navigate(c.url).catch(msg); else msg();
    }); }));
});
self.addEventListener('message', function(e){ if (e.data && e.data.type === 'TW_VERSION' && e.source) e.source.postMessage({type:'TW_VERSION', version:VERSION}); });
function isCode(url, req){ return req.mode === 'navigate' || /\.(html|css|js|json|webmanifest)$/.test(url.pathname) || url.pathname.slice(-1) === '/'; }
self.addEventListener('fetch', function(e){
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin){
    if (isCode(url, req)){
      e.respondWith(fetch(req, {cache:'no-store'}).then(function(res){ var cp=res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); return res; })
        .catch(function(){ return caches.match(req).then(function(r){ return r || caches.match(url.pathname.replace(/[^\/]*$/, 'index.html')); }); }));
    } else {
      e.respondWith(caches.match(req).then(function(r){ return r || fetch(req).then(function(res){ var cp=res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); return res; }); }));
    }
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(fetch(req).then(function(res){ var cp=res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); return res; }).catch(function(){ return caches.match(req); }));
  }
});
