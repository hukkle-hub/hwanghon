/* 3D 필드 가방 · 상점 · 창고 (문서 213) — 2D 필드(mmo.html, 문서 198)의 가방을 모듈로 옮긴 것. 서버(server/field-bag.cjs)는 그대로:
   가방은 서버 프로필(items · equipment · vault · gold)을 보여 줄 뿐, 바꾸는 건 fieldBag {op, item, quantity} → 답 fieldBagDone / profile.
   장착·해제·회복약은 어디서나, 구매·판매·창고는 안전 지대(마을·쉼터 — js/mmo/safe-zones.js)에서만. 거점 마을은 길드가 빼앗기 전엔 안전 지대가 아니다. */
const CSS = `
#bag{position:fixed;inset:0;z-index:21;background:rgba(4,6,10,.72);display:flex;align-items:center;justify-content:center;pointer-events:auto}
#bag[hidden]{display:none}
#bag .bp{width:min(780px,calc(100vw - 20px));height:min(560px,calc(100dvh - 16px));display:flex;flex-direction:column;background:linear-gradient(#1a1714,#100e0c);border:1px solid #5a4a32;border-radius:8px;color:#e8dcc8;font-family:'Noto Sans KR',sans-serif;overflow:hidden}
#bag .bh{display:flex;align-items:center;gap:10px;padding:6px 8px 6px 14px;border-bottom:1px solid #3a3024;flex:none}
#bag .bh>b{font-size:16px;letter-spacing:.12em;color:#f0e2d0}
#bag .gold{font-size:13px;color:#ffd77a;font-weight:700}
#bag .safe{font-size:11px;padding:3px 8px;border-radius:10px;background:rgba(40,120,90,.35);color:#9ff0d0}#bag .safe.no{background:rgba(120,40,30,.35);color:#ffb4a0}
#bag .bx{margin-left:auto;min-width:64px;min-height:44px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.3);border-radius:6px;font-size:14px}
#bag .btabs{display:flex;gap:4px;padding:6px 8px;flex:none;overflow-x:auto}
#bag .btabs button{flex:1 0 auto;min-width:64px;min-height:44px;border:1px solid #4a3e2c;background:#1f1a14;color:#cbbba0;font:700 13px sans-serif;border-radius:6px}
#bag .btabs button.on{background:#4a3818;border-color:#c99a40;color:#ffe6b0}
#bag .btabs button:disabled{opacity:.35}
#bag .bbody{flex:1;min-height:0;overflow-y:auto;padding:4px 8px 8px}
#bag .eqrow{display:flex;gap:6px;flex-wrap:wrap;padding:4px 0 8px;border-bottom:1px dashed #3a3024;margin-bottom:8px}
#bag .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:6px}
#bag .it{position:relative;min-height:76px;border:1px solid #3a3226;border-left:3px solid var(--rc,#6e7078);background:#16130f;border-radius:5px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 3px;box-sizing:border-box;cursor:pointer}
#bag .eqrow .it{width:68px;flex:none}
#bag .it.sel{outline:2px solid #ffcf40;background:#2a2112}
#bag .it img{width:40px;height:40px;object-fit:contain;margin-bottom:2px}
#bag .it .ph{width:40px;height:40px;display:grid;place-items:center;font-size:18px;font-weight:800;color:var(--rc);margin-bottom:2px}
#bag .it b{font-size:10px;font-weight:600;line-height:1.15;text-align:center;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#bag .it i{position:absolute;right:4px;top:3px;font-style:normal;font-size:11px;font-weight:800;color:#fff;text-shadow:0 0 3px #000}
#bag .it u{position:absolute;left:4px;top:3px;text-decoration:none;font-size:9px;font-weight:800;padding:1px 3px;border-radius:3px;background:#c99a40;color:#1a1206}
#bag .it.empty{opacity:.4;border-style:dashed}
#bag .it small{font-size:10px;color:#ffd77a;font-weight:700}
#bag .empty-msg{padding:28px 10px;text-align:center;color:#9a8e7c;font-size:13px;line-height:1.6}
#bag .bdet{flex:none;border-top:1px solid #3a3024;padding:8px 10px;display:flex;gap:10px;align-items:center;min-height:64px;background:#14110e}
#bag .bdet .tx{flex:1;min-width:0;font-size:12px;line-height:1.4}
#bag .bdet .tx b{font-size:14px}#bag .bdet .tx span{color:#a89c88}
#bag .bdet .acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
#bag .bdet button{min-width:64px;min-height:44px;padding:0 12px;border:1px solid #c99a40;background:#3a2a10;color:#ffe6b0;font:700 13px sans-serif;border-radius:6px}
#bag .bdet button.sub{border-color:#5a5048;background:#221d18;color:#d8ccb8}
@media (orientation:portrait){ #bag .bp{height:min(780px,calc(100dvh - 16px))} #bag .bdet{flex-direction:column;align-items:stretch} #bag .bdet .acts{justify-content:stretch} #bag .bdet button{flex:1} }`;
const SLOTS = [['main', '무기'], ['head', '머리'], ['chest', '상의'], ['legs', '하의'], ['gloves', '장갑'], ['boots', '신발'], ['acc', '장신구']];
const esc = t => String(t == null ? '' : t).replace(/[<>&"]/g, '');
const EMPTY = { gear: '가방에 다른 장비가 없습니다.', use: '소모품이 없습니다. 마을·쉼터 상점에서 회복약을 살 수 있습니다.', mat: '재료가 없습니다. 보스를 쓰러뜨리면 떨어집니다.', vault: '창고가 비었습니다.', shop: '파는 물건이 없습니다.' };

export function createBagUI({ IT, send, profile, safe = () => null, hubBoss = () => false, toast = () => {}, onEquip = () => {} }) {
  const RAR = IT.RARITY, st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'bag'; el.hidden = true;
  el.innerHTML = '<div class="bp"><div class="bh"><b>가방</b><span class="gold"></span><span class="safe no"></span><div class="bx">닫기</div></div>'
    + '<div class="btabs"><button data-t="gear" class="on">장비</button><button data-t="use">소모품</button><button data-t="mat">재료</button><button data-t="shop">상점</button><button data-t="vault">창고</button></div>'
    + '<div class="bbody"></div><div class="bdet"></div></div>';
  document.body.appendChild(el);
  const body = el.querySelector('.bbody'), det = el.querySelector('.bdet'), gold = el.querySelector('.gold'), safeEl = el.querySelector('.safe');
  let tab = 'gear', sel = null, shop = null, wait = 0;
  const def = id => IT.get(id) || { id, name: id, rarity: 'common', type: 'material' };
  const kind = d => d.type === 'weapon' || d.type === 'armor' || d.type === 'acc' ? 'gear' : d.type === 'consumable' ? 'use' : 'mat';
  const sellOf = d => { const s = (IT.SHOP || []).find(i => i.id === d.id); return s && s.sell ? s.sell : d.stats && d.price ? Math.floor(d.price * .2) : 0; };
  const op = (o, item, quantity) => { wait = performance.now(); send({ type: 'fieldBag', op: o, item, ...(quantity ? { quantity } : {}) }); };
  function tile(id, n, opt = {}) { const d = def(id), r = RAR[d.rarity] || RAR.common, where = opt.where || tab;
    return '<div class="it' + (sel && sel.id === id && sel.where === where ? ' sel' : '') + '" style="--rc:' + r.color + '" data-id="' + esc(id) + '" data-where="' + where + '">'
      + (opt.eq ? '<u>E</u>' : '') + (n > 1 ? '<i>' + n + '</i>' : '') + '<img src="art/items/' + esc(id) + '.svg" alt="" onerror="this.outerHTML=\'<span class=ph>' + esc(String(d.name).slice(0, 1)) + '</span>\'"><b>' + esc(d.name) + '</b>' + (opt.price != null ? '<small>' + IT.fmt(opt.price) + ' G</small>' : '') + '</div>'; }
  function render() { const P = profile(), s = safe();
    gold.textContent = P ? IT.fmt(P.gold || 0) + ' G' : '—';
    safeEl.className = 'safe' + (s ? '' : ' no'); safeEl.textContent = s ? '안전 지대 · ' + s.name : hubBoss() ? '보스가 차지한 거점 — 상점 닫힘' : '상점·창고는 마을·쉼터에서';
    for (const b of el.querySelectorAll('.btabs button')) { b.classList.toggle('on', b.dataset.t === tab); b.disabled = (b.dataset.t === 'shop' || b.dataset.t === 'vault') && !s; }
    if (!P) { body.innerHTML = '<div class="empty-msg">혼자 연습에는 가방이 없습니다.<br>온라인(서버 방)에 들어가면 서버에 저장된 가방이 열립니다.</div>'; det.innerHTML = ''; return; }
    const eq = P.equipment || {}, worn = new Set(Object.values(eq)); let h = '', list = [];
    if (tab === 'gear') h += '<div class="eqrow">' + SLOTS.map(([k, l]) => eq[k] ? tile(eq[k], 1, { eq: 1, where: 'eq' }) : '<div class="it empty"><span class="ph">·</span><b>' + l + '</b></div>').join('') + '</div>';
    if (tab === 'shop') { if (!shop) { send({ type: 'fieldShop' }); h += '<div class="empty-msg">상점 목록을 받는 중…</div>'; } else list = shop.map(o => tile(o.id, 0, { price: o.price })); }
    else if (tab === 'vault') list = Object.entries(P.vault || {}).filter(([, n]) => n > 0).map(([id, n]) => tile(id, n));
    else list = Object.entries(P.items || {}).filter(([id, n]) => n > 0 && kind(def(id)) === tab && !(tab === 'gear' && worn.has(id))).map(([id, n]) => tile(id, n));
    if (list.length) h += '<div class="grid">' + list.join('') + '</div>'; else if (!(tab === 'shop' && !shop)) h += '<div class="empty-msg">' + EMPTY[tab] + '</div>';
    body.innerHTML = h; detail(); }
  function detail() { const P = profile(); if (!P || !sel) { det.innerHTML = '<div class="tx"><span>물품을 누르면 자세히 보이고 쓸 수 있습니다.</span></div>'; return; }
    const { id, where } = sel, d = def(id), r = RAR[d.rarity] || RAR.common, eq = P.equipment || {}, worn = Object.values(eq).includes(id), n = where === 'vault' ? (P.vault || {})[id] || 0 : (P.items || {})[id] || 0, s = safe();
    const stx = d.stats ? Object.entries({ atk: '공격', def: '방어', hp: 'HP', crit: '치명' }).filter(([k]) => d.stats[k]).map(([k, l]) => l + ' ' + d.stats[k]).join(' · ') : '', enh = P.gear && P.gear[id] && P.gear[id].enh;
    const acts = [], add = (o, label, q, sub) => acts.push('<button' + (sub ? ' class="sub"' : '') + ' data-op="' + o + '" data-q="' + (q || '') + '">' + label + '</button>');
    if (where === 'shop') { const o = (shop || []).find(x => x.id === id); if (o) { add('buy', '사기 ' + IT.fmt(o.price) + ' G', 1); if (!d.stats) add('buy', '10개 ' + IT.fmt(o.price * 10) + ' G', 10, 1); } }
    else if (where === 'vault') { add('withdraw', '꺼내기', 1); if (n > 1) add('withdraw', '전부 꺼내기', Math.min(99, n), 1); }
    else { if (kind(d) === 'gear') { if (worn) { if (d.slot !== 'main') add('unequip', '벗기'); } else add('equip', '장착'); }
      if (id === 'c_potion') add('use', '마시기');
      if (s && !worn && !(P.locks || {})[id] && d.type !== 'quest') { const sp = sellOf(d); if (sp) add('sell', '팔기 ' + IT.fmt(sp) + ' G', 1, 1); add('deposit', '창고에', Math.min(99, n), 1); } }
    det.innerHTML = '<div class="tx"><b style="color:' + r.color + '">' + esc(d.name) + (enh ? ' +' + enh : '') + '</b> <span>' + r.name + ' · ' + esc(IT.TYPE[d.type] || '') + (d.slot && IT.SLOT[d.slot] ? ' · ' + esc(IT.SLOT[d.slot]) : '') + (n > 1 ? ' · ' + n + '개' : '') + (worn ? ' · 착용 중' : '') + '</span><br>' + (stx ? esc(stx) + '<br>' : '') + '<span>' + esc(String(d.desc || d.effect || '').replace(/<[^>]*>/g, '')).slice(0, 90) + '</span></div><div class="acts">' + acts.join('') + '</div>'; }
  const open = () => { el.hidden = false; render(); }, close = () => { el.hidden = true; };
  el.querySelector('.bx').addEventListener('pointerdown', e => { e.stopPropagation(); close(); });
  el.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === el) close(); });   /* 판 밖을 누르면 닫는다 · 판 안 터치가 카메라·이동으로 새지 않게 */
  el.querySelector('.btabs').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; tab = b.dataset.t; sel = null; render(); });
  body.addEventListener('pointerdown', e => { const t = e.target.closest('.it[data-id]'); if (!t) return; sel = { id: t.dataset.id, where: t.dataset.where }; for (const x of body.querySelectorAll('.it.sel')) x.classList.remove('sel'); t.classList.add('sel'); detail(); });
  det.addEventListener('pointerdown', e => { const b = e.target.closest('button[data-op]'); if (!b || !sel) return; op(b.dataset.op, sel.id, +b.dataset.q || undefined); });
  return {
    el, open, close, toggle: () => (el.hidden ? open() : close()), get isOpen() { return !el.hidden; },
    tab(t) { tab = t; sel = null; render(); }, select(id, where) { sel = { id, where: where || tab }; render(); },
    /* 안전 지대를 나가면 상점·창고 탭을 닫는다 */
    safeChanged() { if (!safe() && (tab === 'shop' || tab === 'vault')) { tab = 'gear'; sel = null; } if (!el.hidden) render(); },
    /* 서버 답: true 면 여기서 처리했다 */
    onMessage(m) {
      if (m.type === 'fieldShop') { shop = Array.isArray(m.items) ? m.items : []; if (!el.hidden) render(); return true; }
      if (m.type === 'profile') { const P = m.profile; if (sel && P && sel.where !== 'shop') { const left = sel.where === 'vault' ? (P.vault || {})[sel.id] : sel.where === 'eq' ? Object.values(P.equipment || {}).includes(sel.id) : (P.items || {})[sel.id]; if (!left) sel = null; } if (!el.hidden) render(); return false; }
      if (m.type === 'fieldBagDone') { wait = 0; const r = m.result || {}, d = def(r.item);
        if (m.op === 'buy') toast(esc(d.name) + (r.quantity > 1 ? ' ×' + r.quantity : '') + ' 샀다'); else if (m.op === 'sell') toast(esc(d.name) + ' 팔았다'); else if (m.op === 'equip') { toast(esc(d.name) + ' 장착'); onEquip(); } else if (m.op === 'unequip') { toast(esc(d.name) + ' 벗음'); onEquip(); } else if (m.op === 'deposit') toast('창고에 넣었다'); else if (m.op === 'withdraw') toast('창고에서 꺼냈다');
        return m.op !== 'use'; }   /* 회복약(use)은 화면이 +HP 를 띄운다 */
      if (m.type === 'error' && wait && performance.now() - wait < 4000) { wait = 0; toast(esc(m.message)); return true; }   /* 가방 요청이 거절됨 — 이유를 보인다 */
      return false; },
  };
}
