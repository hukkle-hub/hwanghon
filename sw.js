/* 황혼 UI — 서비스워커
   · BUILD 는 배포 워크플로가 커밋 해시로 치환한다 → 배포마다 새 버전이 자동 설치되고, 열려 있는 화면은 스스로 새로고침한다
   · HTML/CSS/JS/JSON 은 네트워크 우선(오프라인일 때만 캐시), 아트(webp)는 캐시 우선
   · 캐시 저장소는 출처 단위로 공유되므로 'tw-' 접두 캐시만 관리한다 */
var BUILD = '__BUILD__';
var VERSION = 'tw-' + (BUILD.indexOf('__') === 0 ? 'dev' : BUILD);
var ASSETS = ["art/back-ain.webp", "art/back-kain.webp", "art/back-ryu.webp", "art/back-sera.webp", "art/boss-anatomy.webp", "art/boss-marsh.webp", "art/char-inventory.webp", "art/char-profile.webp", "art/char-result.webp", "art/face-ain.webp", "art/face-kain.webp", "art/face-ryu.webp", "art/face-sera.webp", "art/forge-kain.webp", "art/full-ain.webp", "art/full-kain.webp", "art/full-ryu.webp", "art/full-sera.webp", "art/lobby-city.webp", "art/office-brief.webp", "art/portrait-ain.webp", "art/portrait-kain.webp", "art/portrait-ryu.webp", "art/portrait-sera.webp", "art/side-ain.webp", "art/side-kain.webp", "art/side-ryu.webp", "art/side-sera.webp", "art/story-city.webp", "art/thumbs/battle.webp", "art/thumbs/characters.webp", "art/thumbs/craft.webp", "art/thumbs/forge.webp", "art/thumbs/inventory.webp", "art/thumbs/office.webp", "art/thumbs/party.webp", "art/thumbs/profile.webp", "art/thumbs/quest.webp", "art/thumbs/result.webp", "battle.html", "benchmark.html", "characters.html", "compare.html", "craft.html", "css/mobile.css", "css/tokens.css", "css/ui.css", "forge.html", "index.html", "inventory.html", "js/icons.js", "js/inventory.js", "js/items.js", "js/ui.js", "js/world.js", "manifest.json", "office.html", "party.html", "profile.html", "quest.html", "result.html"];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(ASSETS.map(function(a){ return new Request(a, {cache:'reload'}); })).catch(function(){}); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k.indexOf('tw-')===0 && k!==VERSION; }).map(function(k){ return caches.delete(k); })); })
    .then(function(){ return self.clients.claim(); })
    .then(function(){ return self.clients.matchAll({type:'window'}); })
    .then(function(cs){ cs.forEach(function(c){ try{ c.postMessage({type:'TW_UPDATED', version:VERSION}); }catch(e){} }); }));
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
