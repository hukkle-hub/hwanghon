/* 필드 방 접속 (문서 206 §8) — 3D 필드가 2D 필드(mmo.html)와 «같은 서버 · 같은 방 · 같은 계정» 에 들어간다.
   규약은 mmo.html connectNet 과 같다: hello → welcome(토큰) → (캐릭터 없으면 만들기) → fieldJoin → fieldJoined → 0.1초마다 field.
   저장소 열쇠도 같다(tw:party-token:<서버>) — 2D 로 놀던 캐릭터 그대로 3D 로 들어온다. 서버는 바꾸지 않는다. */
export const PARTY_DEFAULT = 'hwanghon-party.onrender.com';
export function partyServer(q, loc = location) {
  const v = q.get('server') || '';
  if (!v) return /\.github\.io$/.test(loc.hostname) ? { host: PARTY_DEFAULT, secure: true } : { host: loc.host, secure: loc.protocol === 'https:' };
  try { const u = new URL(/^(https?|wss?):\/\//.test(v) ? v.replace(/^ws/, 'http') : 'https://' + v); return { host: u.host, secure: u.protocol === 'https:' }; } catch { return null; }
}
/* onMessage(m) — 들어간 뒤 오는 모든 것(field · bossHit · announce · profile · error …). onStatus(text) — 기다리는 동안 보일 글 */
export function connectField({ q, zone, gate, char, look, onMessage, onStatus = () => {} }) {
  return new Promise((resolve, reject) => {
    const sv = partyServer(q); if (!sv) return reject(Error('서버 주소 오류'));
    const tokenKey = 'tw:party-token:' + sv.host, store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
    const ws = new WebSocket((sv.secure ? 'wss:' : 'ws:') + '//' + sv.host + '/party-socket'); let profile = null, tries = 0, net = null;
    const slow = /onrender\.com$/.test(sv.host), timer = setTimeout(() => { reject(Error('접속 시간 초과')); try { ws.close(); } catch {} }, slow ? 35000 : 15000);   /* 잠든 무료 서버는 깨는 데 30초쯤 */
    const wake = slow && setTimeout(() => onStatus('서버를 깨우는 중… (처음엔 30초쯤)'), 3500);
    const send = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    const named = () => { const n = (store.get('tw:party-name') || '요원') + (tries ? String(Math.random() * 9000 + 1000 | 0) : ''); tries++; send({ type: 'character', name: n.replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 16) || '요원' + (Math.random() * 9000 + 1000 | 0), character: char }); };
    const join = () => send({ type: 'fieldJoin', zone, gate: gate || undefined, look });   /* gate: 다른 지역 문으로 넘어왔으면 그 문 앞에서 (서버가 자리를 정한다) */
    ws.onopen = () => send({ type: 'hello', token: store.get(tokenKey), name: store.get('tw:party-name') || '요원' });
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; }
      if (!net) {
        if (m.type === 'welcome') { store.set(tokenKey, m.token); profile = m.profile; if (profile.characterCreated) join(); else named(); return; }
        if (m.type === 'profile' && profile && !profile.characterCreated && m.profile.characterCreated) { profile = m.profile; join(); return; }
        if (m.type === 'error' && profile && !profile.characterCreated && /이름|이미/.test(m.message) && tries < 5) { named(); return; }
        if (m.type === 'fieldJoined') { clearTimeout(timer); clearTimeout(wake); net = { ws, send, profile, joined: m }; resolve(net); onMessage(m); return; }
        if (m.type === 'error') onStatus('접속 오류 — ' + m.message);
        /* 입장 응답보다 먼저 온 장면도 넘긴다 — 서버는 상대 정보를 «처음 보일 때 한 번만» 싣는다. 버리면 그 사람이 영영 안 보인다 (2D 필드 connectNet 도 이렇게 한다) */
        if (m.type === 'field' || m.type === 'announce') onMessage(m);
        return; }
      if (m.type === 'profile') net.profile = m.profile;
      onMessage(m); };
    ws.onclose = () => { clearTimeout(timer); clearTimeout(wake); if (net) { net.closed = true; onMessage({ type: 'closed' }); } else reject(Error('접속 실패')); };
  });
}
/* 서버 시계: 가장 지연이 적은 표본(가장 큰 serverAt − 받은 시각)을 고르고 거꾸로 가지 않는다 — mmo.html syncBossClock 과 같다 */
export function serverClock() {
  const samples = new Float64Array(8).fill(-Infinity); let n = 0, i = 0, off = 0, last = 0;
  return { sync(serverAt) { if (!Number.isFinite(serverAt)) return; samples[i++ % 8] = serverAt - Date.now(); n = Math.min(8, n + 1); let best = -Infinity; for (let k = 0; k < n; k++) best = Math.max(best, samples[k]); off = best; if (n === 1) last = serverAt; },
    now() { const t = Date.now() + off; if (t > last) last = t; return last; } };
}
