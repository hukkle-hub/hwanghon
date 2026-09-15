/* 황혼 UI — 서비스워커: 같은 출처 자산은 캐시 우선, 폰트 CDN 은 네트워크 우선 후 캐시
   캐시 저장소는 출처 단위로 공유되므로 'tw-' 접두 캐시만 관리한다(상위 SNS 앱 캐시 agent-platform-* 는 건드리지 않음) */
var VERSION = 'tw-v2';
var ASSETS = ["art/back-ain.webp","art/back-kain.webp","art/back-ryu.webp","art/back-sera.webp","art/boss-anatomy.webp","art/boss-marsh.webp","art/char-inventory.webp","art/char-profile.webp","art/char-result.webp","art/face-ain.webp","art/face-kain.webp","art/face-ryu.webp","art/face-sera.webp","art/forge-kain.webp","art/full-ain.webp","art/full-kain.webp","art/full-ryu.webp","art/full-sera.webp","art/lobby-city.webp","art/office-brief.webp","art/portrait-ain.webp","art/portrait-kain.webp","art/portrait-ryu.webp","art/portrait-sera.webp","art/side-ain.webp","art/side-kain.webp","art/side-ryu.webp","art/side-sera.webp","art/story-city.webp","art/thumbs/battle.webp","art/thumbs/characters.webp","art/thumbs/craft.webp","art/thumbs/forge.webp","art/thumbs/inventory.webp","art/thumbs/office.webp","art/thumbs/party.webp","art/thumbs/profile.webp","art/thumbs/quest.webp","art/thumbs/result.webp","battle.html","benchmark.html","characters.html","compare.html","craft.html","css/mobile.css","css/tokens.css","css/ui.css","forge.html","index.html","inventory.html","js/icons.js","js/inventory.js","js/items.js","js/ui.js","js/world.js","manifest.json","office.html","party.html","profile.html","quest.html","result.html"];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(ASSETS.map(function(a){ return new Request(a, {cache:'reload'}); })).catch(function(){}); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k.indexOf('tw-')===0 && k!==VERSION; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin){
    e.respondWith(caches.match(req).then(function(r){ return r || fetch(req).then(function(res){ var cp=res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); return res; }); }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(fetch(req).then(function(res){ var cp=res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); return res; }).catch(function(){ return caches.match(req); }));
  }
});
