/* 황혼 UI — 서비스워커
   · BUILD 는 배포 워크플로가 커밋 해시로 치환한다 → 배포마다 새 버전이 자동 설치되고, 열려 있는 화면은 스스로 새로고침한다
   · HTML/CSS/JS/JSON 은 네트워크 우선(오프라인일 때만 캐시), 아트(webp)는 캐시 우선
   · 캐시 저장소는 출처 단위로 공유되므로 'tw-' 접두 캐시만 관리한다 */
var BUILD = '__BUILD__';
var VERSION = 'tw-' + (BUILD.indexOf('__') === 0 ? 'dev' : BUILD);
var ASSETS = ["js/party-avatar.js", "js/party-wire.js", "css/party-online.css", "js/party-online.js", "js/party-rpg.js", "css/party-rpg.css", "arena.html", "art/3d/ain_anim.glb", "art/3d/boss_anim.glb", "art/3d/boss_marsh.glb", "art/3d/boss_marsh_v2.glb", "art/3d/ain_scythe_tex.glb", "art/3d/props/barrel.glb", "art/3d/props/blast_door.glb", "art/3d/props/console.glb", "art/3d/props/crate.glb", "art/3d/props/dummy_a.glb", "art/3d/props/dummy_b.glb", "art/3d/props/dummy_c.glb", "art/3d/props/fan.glb", "art/3d/props/pillar.glb", "art/3d/props/rubble.glb", "art/3d/props/tank_glow.glb", "art/3d/props/wall_panel.glb", "art/ain/back-armL.webp", "art/ain/back-armR.webp", "art/ain/back-legL.webp", "art/ain/back-legR.webp", "art/ain/back-torso.webp", "art/ain/front-armL.webp", "art/ain/front-armR.webp", "art/ain/front-legL.webp", "art/ain/front-legR.webp", "art/ain/front-torso.webp", "art/ain/side-arm.webp", "art/ain/side-legB.webp", "art/ain/side-legF.webp", "art/ain/side-torso.webp", "art/back-ain.webp", "art/back-kain.webp", "art/back-ryu.webp", "art/back-sera.webp", "art/boss-anatomy.webp", "art/boss-marsh.webp", "art/char-inventory.webp", "art/char-profile.webp", "art/char-result.webp", "art/dummy-back.webp", "art/dummy-front.webp", "art/dummy-side.webp", "art/dummy/foreL.webp", "art/dummy/foreR.webp", "art/dummy/handL.webp", "art/dummy/handR.webp", "art/dummy/head.webp", "art/dummy/padL.webp", "art/dummy/padR.webp", "art/dummy/pelvis.webp", "art/dummy/shinL.webp", "art/dummy/shinR.webp", "art/dummy/thighL.webp", "art/dummy/thighR.webp", "art/dummy/torso.webp", "art/dummy/upperL.webp", "art/dummy/upperR.webp", "art/env/barrel.webp", "art/env/crate.webp", "art/env/fence.webp", "art/env/fpost.webp", "art/env/gate.webp", "art/env/ground.webp", "art/env/ground_n.webp", "art/env/post.webp", "art/env/ring.webp", "art/env/sign.webp", "art/env/straw.webp", "art/env/torch.webp", "art/env/wall.webp", "art/env/wall_n.webp", "art/face-ain.webp", "art/face-kain.webp", "art/face-ryu.webp", "art/face-sera.webp", "art/forge-kain.webp", "art/full-ain.webp", "art/full-kain.webp", "art/full-ryu.webp", "art/full-sera.webp", "art/lobby-city.webp", "art/office-brief.webp", "art/portrait-ain.webp", "art/portrait-kain.webp", "art/portrait-ryu.webp", "art/portrait-sera.webp", "art/side-ain.webp", "art/side-kain.webp", "art/side-ryu.webp", "art/side-sera.webp", "art/story-city.webp", "art/thumbs/arena.webp", "art/thumbs/battle.webp", "art/thumbs/characters.webp", "art/thumbs/craft.webp", "art/thumbs/dungeon.webp", "art/thumbs/forge.webp", "art/thumbs/game.webp", "art/thumbs/game3d.webp", "art/thumbs/inventory.webp", "art/thumbs/office.webp", "art/thumbs/party.webp", "art/thumbs/profile.webp", "art/thumbs/quest.webp", "art/thumbs/result.webp", "art/title-ain.webp", "battle.html", "benchmark.html", "board.html", "characters.html", "compare.html", "craft.html", "css/battle.css", "css/mobile.css", "css/tokens.css", "css/ui.css", "dungeon.html", "forge.html", "game.html", "game3d.html", "index.html", "inventory.html", "title.html", "lobby.html", "art/lobby-bg.webp", "art/items/a_black_greaves.svg", "art/items/a_hood.svg", "art/items/a_ranger_boots.svg", "art/items/a_reed_cuirass.svg", "art/items/a_steel_gauntlet.svg", "art/items/acc_band.svg", "art/items/acc_blood_ring.svg", "art/items/acc_charm.svg", "art/items/c_antidote.svg", "art/items/c_potion.svg", "art/items/c_throw.svg", "art/items/c_tool.svg", "art/items/m_alloy.svg", "art/items/m_bone.svg", "art/items/m_booster.svg", "art/items/m_core.svg", "art/items/m_dew.svg", "art/items/m_fiber.svg", "art/items/m_heart.svg", "art/items/m_oil.svg", "art/items/m_ore.svg", "art/items/m_shard.svg", "art/items/q_fragment.svg", "art/items/q_record.svg", "art/items/w_ash_dirk.svg", "art/items/w_hook_scythe.svg", "art/items/w_marsh_blade.svg", "art/items/w_marsh_scythe.svg", "art/items/w_ruin_spear.svg", "art/items/w_rust_executioner.svg", "art/items/w_rust_sword.svg", "js/ain-rig.js", "js/combat.js", "js/combat-motion.js", "js/boss-director.js", "js/dungeon-content.js", "js/dungeon-run.js", "js/dungeon-props.js", "js/pump-boss.js", "js/relay-boss.js", "js/root-boss.js", "js/hauler-boss.js", "js/ward-boss.js", "js/dummy-rig.js", "js/dungeon.js", "js/dungeons.js", "js/game-dungeon.js", "js/game3d.js", "js/icons.js", "js/inventory.js", "js/items.js", "js/rig-phaser.js", "js/rig.js", "js/save.js", "js/sfx.js", "js/skirmish.js", "js/ui.js", "js/world-sim.js", "js/world.js", "manifest.json", "maps/d01.json", "maps/yard-tiles.png", "office.html", "offline.html", "shelter.html", "js/shelter.js", "recruit.html", "js/recruit.js", "admin.html", "js/admin.js", "looks.html", "js/looks-screen.js", "party.html", "profile.html", "quest.html", "result.html", "shop.html", "story.html", "js/story.js", "js/grade.js", "js/looks.js", "js/studio-env.js", "js/pose-fix.js", "js/mat-fix.js", "js/wind.js", "js/lobby3d.js", "art/3d/tex/wood.png", "art/3d/tex/steel.png", "art/3d/tex/rust.png", "art/3d/tex/leather.png", "art/3d/tex/cloth.png", "art/3d/tex/olive.png", "art/face-matteo.webp", "vendor/phaser.min.js", "vendor/three/BufferGeometryUtils.js", "vendor/three/DRACOLoader.js", "vendor/three/GLTFLoader.js", "vendor/three/KTX2Loader.js", "vendor/three/OrbitControls.js", "vendor/three/SkeletonUtils.js", "vendor/three/meshopt_decoder.module.js", "vendor/three/three.module.js", "viewer.html", "art/3d/gear/a_black_greaves_L.glb", "art/3d/gear/a_black_greaves_R.glb", "art/3d/gear/a_hood.glb", "art/3d/gear/a_ranger_boots_L.glb", "art/3d/gear/a_ranger_boots_R.glb", "art/3d/gear/a_reed_cuirass.glb", "art/3d/gear/a_steel_gauntlet.glb", "art/3d/gear/acc_band.glb", "art/3d/gear/acc_blood_ring.glb", "art/3d/gear/acc_charm.glb", "art/3d/gear/w_ash_dirk.glb", "art/3d/gear/w_hook_scythe.glb", "art/3d/gear/w_kain_greatsword.glb", "art/3d/gear/w_marsh_blade.glb", "art/3d/gear/w_ruin_spear.glb", "art/3d/gear/w_rust_executioner.glb", "art/3d/gear/w_rust_sword.glb", "art/3d/gear/w_sera_flask.glb", "art/3d/kain_anim.glb", "art/3d/kain_tex_lo.glb", "art/3d/ryu_anim.glb", "art/3d/ryu_tex_lo.glb", "art/3d/sera_anim.glb", "art/3d/sera_tex_lo.glb", "art/items/w_kain_greatsword.svg", "art/items/w_ryu_dagger.svg", "art/items/w_sera_flask.svg", "js/skill-math.js", "js/weapon-trail.js", "js/skills.js", "skills.html", "art/items/w_ryu_shiv.svg", "art/items/w_ryu_twinfang.svg", "art/items/w_sera_reagent.svg", "art/items/w_sera_vial.svg"];
/* 이 워커가 설치되는 시점에 이전 워커가 있었는가 → 있었다면 열린 화면들은 옛 버전이므로 활성화 직후 직접 다시 불러온다 */
var HAD_PREVIOUS = !!(self.registration && self.registration.active);
ASSETS.push('js/ain-bind-repair.js','js/ain-two-hand.js','js/ain-grip-shape.js','js/ain-grip-ik.js','js/ain-scythe-mount.js');
ASSETS.push('js/marsh-motion.js','js/training-presentation.js','js/frame-metrics.js','js/boss-motion.js');
ASSETS.push('js/graphics-profile.js','js/combat-quality.js','js/boss-contact-volumes.js');
ASSETS=ASSETS.concat(['swing','hit','hit_heavy','counter','counter_perfect','execute','brk','roll','tele','phase','explore','boss'].map(function(name){return 'art/audio/'+name+'.wav';}));
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){
    var list=ASSETS.filter(function(a,i){ return ASSETS.indexOf(a)===i; }), failed=[];
    return Promise.all(list.map(function(a){
      return c.add(new Request(a, {cache:'reload'})).catch(function(){ failed.push(a); });
    })).then(function(){
      if (failed.length) console.warn('[tw-sw] 프리캐시 실패 '+failed.length+'/'+list.length+':', failed.slice(0,8));
    });
  }).then(function(){ return self.skipWaiting(); }));
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
        .catch(function(){ return caches.match(req).then(function(r){ if (r) return r;
          return caches.match(url.pathname.replace(/[^\/]*$/, 'index.html')).then(function(home){
            if (home) return home;
            return req.mode === 'navigate' ? caches.match('offline.html') : undefined; }); }); }));
    } else {
      e.respondWith(caches.match(req).then(function(r){ return r || fetch(req).then(function(res){ var cp=res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); return res; }); }));
    }
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(fetch(req).then(function(res){ var cp=res.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); return res; }).catch(function(){ return caches.match(req); }));
  }
});
