/* 황혼 — 머리 장비를 쓰면 머리카락을 가린다 (docs/design/45)
   디렉터 결정: 「후드는 다 가려야지」 — 앞머리를 남기거나 후드용 납작 머리를 따로 두지 않고,
   머리 칸에 무엇이든 끼면 머리카락 조각을 통째로 숨긴다.

   숨길 수 있으려면 머리카락이 «몸과 분리된 조각» 이어야 한다. 지금은 반반이다:
     · VRoid 로 만든 맨몸(카인·류·세라) — 재질 이름이 `..._HAIR` 라 골라낼 수 있다
     · Hi3D 로 뽑은 아인·본편 넷    — 몸·머리카락이 한 메시 한 재질이라 «못 숨긴다»
   그래서 이 파일은 «찾으면 숨기고, 못 찾으면 조용히 넘어간다». 지피티가 머리카락을
   따로 내보내면(`docs/design/45` 파일 계약) 코드 수정 없이 그대로 걸린다. */
(function (g) {
  'use strict';

  /* 조각을 알아보는 규칙 — 재질 이름이 우선, 없으면 노드 이름 */
  var MAT = /_HAIR$|^hair$|_hair$/i;
  var NODE = /^hair([_.0-9]|$)|_hair([_.0-9]|$)/i;

  function isHair(o) {
    if (!o || !o.isMesh) return false;
    var m = o.material;
    if (m) {
      var ms = Array.isArray(m) ? m : [m];
      for (var i = 0; i < ms.length; i++) if (ms[i] && MAT.test(ms[i].name || '')) return true;
    }
    return NODE.test(o.name || '');
  }

  /* 모델에서 머리카락 조각을 찾아 기억해 둔다. 매번 훑지 않도록 모델에 붙여 둔다. */
  function find(root) {
    if (!root) return [];
    if (root.__twHair) return root.__twHair;
    var out = [];
    root.traverse(function (o) { if (isHair(o)) out.push(o); });
    root.__twHair = out;
    return out;
  }

  /* hidden=true 면 숨긴다. 돌려주는 값은 «실제로 건드린 조각 수».
     0 이면 이 모델은 머리카락이 몸에 붙어 있어 숨길 수 없다는 뜻이다. */
  function set(root, hidden) {
    var hs = find(root), n = 0;
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].visible === !hidden) continue;
      hs[i].visible = !hidden;
      n++;
    }
    return hs.length;
  }

  /* 장착 상태를 보고 맞춘다. 머리 칸에 무엇이든 있으면 가린다. */
  function sync(root, equipped) {
    var eq = equipped;
    if (!eq && g.TW_GEAR && TW_GEAR.state) { try { eq = TW_GEAR.state().equipped; } catch (e) { eq = null; } }
    return set(root, !!(eq && eq.head));
  }

  /* 모델을 새로 받으면 기억을 버린다 */
  function forget(root) { if (root) delete root.__twHair; }

  g.TW_HAIR = { sync: sync, set: set, find: find, forget: forget, isHair: isHair, MAT: MAT, NODE: NODE };
})(typeof globalThis !== 'undefined' ? globalThis : window);
