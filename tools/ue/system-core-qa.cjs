#!/usr/bin/env node
/* SYSTEM CORE 실검수 — 실제 UE 5.8 클라이언트(-game -nullrhi)를 띄워 게이트를 확인한다.
 *
 *   node tools/ue/system-core-qa.cjs local        1P: 저장 v2→v3, 캐릭터 선택 유지·Pawn, 로컬 던전
 *   node tools/ue/system-core-qa.cjs 2p           2P: d03, 서로 다른 캐릭터, down(분출구)/revive, 클리어·보상 저장
 *   node tools/ue/system-core-qa.cjs 4p           4P: d03, 스케일·위협·부위·페이즈·탐험·위험지대·전멸·재도전·재접속
 *   node tools/ue/system-core-qa.cjs all
 *
 * 서버는 이 프로세스 안에서 server/index.cjs(createPartyServer)로 띄운다 — 권위는 그대로 server/raid.cjs.
 * UE 쪽 봇은 Private/Tests/HWSystemQASubsystem 이며 실제 입력 매핑(키 → Pawn → 네트워크 브리지 → 의도)으로 논다.
 * 테스트 계정 준비만 여기서 한다: 전원 d03 해금, 2P 는 장비를 갖춘 숙련 계정(xp·방어구).
 * 결과: ue/HwanghonCombatUE/Saved/SystemQA/<시각>/summary.json · summary.md */
'use strict';
const fs = require('node:fs'), path = require('node:path'), {spawn} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const UE_ROOT = process.env.UE58_ROOT || 'C:\\Program Files\\Epic Games\\UE_5.8';
const EDITOR = path.join(UE_ROOT, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
const PROJECT = path.join(ROOT, 'ue', 'HwanghonCombatUE', 'HwanghonCombatUE.uproject');
const SAVES = path.join(ROOT, 'ue', 'HwanghonCombatUE', 'Saved', 'SaveGames');
const SLOT = path.join(SAVES, 'HwanghonCombatUE_Profile_v1.sav');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = process.env.QA_OUT || path.join(ROOT, 'ue', 'HwanghonCombatUE', 'Saved', 'SystemQA', stamp);
const C = require(path.join(ROOT, 'server', 'content.cjs'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
fs.mkdirSync(OUT, {recursive: true});

function launch(name, map, args, dir) {
  const logFile = path.join(dir, name + '.log');
  const full = [PROJECT, map, '-game', '-nullrhi', '-nosound', '-unattended', '-nosplash', '-NoLoadingScreen',
    '-nop4', `-abslog=${logFile}`, '-ExecCmds=t.MaxFPS 60', ...args];
  const child = spawn(EDITOR, full, {stdio: 'ignore', windowsHide: true});
  child.done = new Promise(res => child.on('exit', code => res(code)));
  child.qaName = name;
  log('launch', name, map, args.filter(a => a.startsWith('-HWQA=') || a.startsWith('-HWCharacter=')).join(' '));
  return child;
}
async function run(name, map, args, dir, timeoutMs) {
  const child = launch(name, map, args, dir);
  const timer = setTimeout(() => { log('timeout, killing', name); child.kill(); }, timeoutMs);
  const code = await child.done; clearTimeout(timer);
  const out = args.find(a => a.startsWith('-HWQAOut='))?.slice(9);
  const report = out && fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
  log('exit', name, 'code', code, report ? `ok=${report.ok} ${report.why}` : 'no report');
  return report;
}
const gatesOf = r => r && r.gates || {};
const pass = (r, g) => !!(gatesOf(r)[g] && gatesOf(r)[g].pass);
const detail = (r, g) => gatesOf(r)[g] ? gatesOf(r)[g].detail : 'missing';

/* ------------------------------------------------------------------ 1P */
async function local() {
  const dir = path.join(OUT, 'local'); fs.mkdirSync(dir, {recursive: true});
  const q = (n, extra) => ['-HWQA=' + extra.mode, `-HWQAOut=${path.join(dir, n + '.json')}`, ...extra.args];
  const results = {};
  if (fs.existsSync(SLOT)) fs.rmSync(SLOT);
  results.writev2 = await run('writev2', '/Game/Maps/HW_Frontend', q('writev2', {mode: 'writev2', args: []}), dir, 180e3);
  results.migrate = await run('migrate', '/Game/Maps/HW_Frontend', q('migrate', {mode: 'select', args: ['-HWQAExpect=ain', '-HWQASelect=kain']}), dir, 180e3);
  const chain = [['kain', 'ryu'], ['ryu', 'sera'], ['sera', 'ain'], ['ain', 'ryu']];
  results.relaunch = [];
  for (const [expect, next] of chain) {
    results.relaunch.push(await run('check_' + expect, '/Game/Maps/Hwanghon_OnlineRaid',
      q('check_' + expect, {mode: 'local', args: ['-HWQACheckOnly', `-HWQAExpect=${expect}`, `-HWQASelect=${next}`]}), dir, 180e3));
  }
  results.dungeon = await run('dungeon_ryu', '/Game/Maps/Hwanghon_OnlineRaid?HWDungeon=relay',
    q('dungeon_ryu', {mode: 'local', args: ['-HWQAExpect=ryu', '-HWQADungeon=relay']}), dir, 40 * 60e3);
  const g = [];
  g.push(['v2 저장 작성', pass(results.writev2, 'v2_written'), detail(results.writev2, 'v2_written')]);
  g.push(['v2→v3 마이그레이션(ain 기본값)', pass(results.migrate, 'selection_persisted') && results.migrate.disk_version_before === 2,
    `디스크 v${results.migrate?.disk_version_before} → 로드 ${results.migrate?.selected_before}; ` + detail(results.migrate, 'selection_saved')]);
  for (const r of results.relaunch) {
    const id = r?.identity || {};
    g.push([`재실행 후 선택 유지·Pawn (${id.expected})`, ['selection_persisted', 'pawn_class', 'single_pawn', 'kit_matches', 'selection_saved'].every(k => pass(r, k)),
      `${id.local_selection} → ${id.pawn_class} ×${id.player_pawns}, kit ${id.kit_id}; ` + detail(r, 'selection_saved')]);
  }
  const d = results.dungeon;
  for (const k of ['selection_persisted', 'pawn_class', 'dungeon_rooms', 'skills_1_4', 'ultimate', 'boss_phases', 'boss_break', 'part_lock_break', 'wipe_retry', 'dungeon_complete'])
    g.push(['1P 던전 ' + k, pass(d, k), detail(d, k)]);
  return {name: '1P local', gates: g, reports: results};
}

/* ------------------------------------------------------------------ 2P / 4P */
function gridFile(dir, level) {
  const L = C.levels[level], file = path.join(dir, 'grid.json');
  fs.writeFileSync(file, JSON.stringify({cell: L.cell, rows: L.rows}));
  return file;
}
async function online(n) {
  const scenario = n + 'p', level = 'd03';
  const dir = path.join(OUT, scenario), share = path.join(dir, 'share'); fs.mkdirSync(share, {recursive: true});
  // UE(libwebsockets) sends "Origin: http://<address>" without the port. Production (default port) matches its Host;
  // a local server on another port needs the address allow-listed — the server's existing ALLOWED_ORIGINS switch.
  process.env.ALLOWED_ORIGINS = [process.env.ALLOWED_ORIGINS, 'http://127.0.0.1'].filter(Boolean).join(',');
  const {createPartyServer} = require(path.join(ROOT, 'server', 'index.cjs'));
  const app = createPartyServer({dataDir: path.join(dir, 'server-data')});
  const addr = await app.listen(0, '127.0.0.1');
  const server = `http://127.0.0.1:${addr.port}`;
  log(scenario, 'server', server, 'level', level);
  const chars = ['ain', 'kain', 'ryu', 'sera'].slice(0, n), letters = 'ABCD';
  const grid = gridFile(dir, level);
  const base = i => [`-HWServer=${server}`, `-HWName=Guest${letters[i]}`, `-HWCharacter=${chars[i]}`,
    `-HWCharacterName=Test${chars[i][0].toUpperCase()}${chars[i].slice(1)}`, '-HWQA=net', `-HWQARole=${i ? 'guest' : 'host'}`,
    `-HWQAIndex=${i}`, `-HWQAPlayers=${n}`, `-HWQALevel=${level}`, `-HWQAShare=${share}`, `-HWQAGrid=${grid}`,
    ...(n === 2 ? ['-HWQAVictim=1'] : [])];
  const clients = [];
  for (let i = 0; i < n; i++) {
    clients[i] = launch(`client${i}`, '/Game/Maps/HW_Frontend', [...base(i), `-HWQAOut=${path.join(dir, `client${i}.json`)}`], dir);
    await sleep(4000);
  }
  // Test fixture: wait for every client's first character creation, then prepare the accounts.
  const ids = [];
  for (let t = 0; t < 240 && ids.length < n; t++) {
    await sleep(1000);
    for (let i = 0; i < n; i++) if (!ids[i] && fs.existsSync(path.join(share, `client${i}.json`))) ids[i] = JSON.parse(fs.readFileSync(path.join(share, `client${i}.json`), 'utf8'));
  }
  if (ids.filter(Boolean).length < n) throw Error(scenario + ': not every client created its character');
  const before = {};
  for (const c of ids) {
    const p = app.store.public(c.id); before[c.id] = {gold: p.gold, xp: p.xp, clears: {...p.clears}, character: p.character, name: p.name, created: p.characterCreated};
    app.store.mutate(c.id, 'qa-fixture', p => {
      p.quests = {...(p.quests || {}), training: 'claimed', marsh: 'claimed'};   // d03 unlock
      if (n <= 2) { p.xp = Math.max(p.xp, 22800); Object.assign(p.equipment, {chest: 'a_sluice_cuirass', legs: 'a_sluice_greaves', gloves: 'a_sluice_gauntlet', boots: 'a_sluice_boots', head: 'a_sluice_helm', acc: 'acc_charm'}); }
    });
  }
  log(scenario, 'accounts ready', ids.map(c => `${c.name}/${c.character}`).join(', '));
  fs.writeFileSync(path.join(share, 'go'), '1');

  const limit = Date.now() + (n >= 4 ? 30 : 22) * 60e3;
  let resumed = null, killedAt = 0;
  // Threat is server-internal (the snapshot strips it). Record, at the moment each pattern starts,
  // the target the server chose and every player's target score (threat − distance×10, raid.cjs target()).
  const serverTele = [];
  const hook = setInterval(() => {
    for (const room of app.rooms.values()) {
      const raid = room.raid; if (!raid || raid.__qa) continue; raid.__qa = true;
      const event = raid.event.bind(raid);
      raid.event = (type, data = {}) => {
        if (type === 'telegraph' && data.beat === 1) {
          const live = [...raid.players.values()].filter(p => raid.alive(p) && p.connected);
          serverTele.push({t: raid.time, target: data.target, scores: Object.fromEntries(live.map(p => [p.character, Math.round(p.threat - raid.world.dist(p.x, p.y, raid.boss.x, raid.boss.y) * 10)])),
            targetChar: raid.players.get(data.target)?.character, threat: Object.fromEntries(live.map(p => [p.character, Math.round(p.threat)]))});
        }
        return event(type, data);
      };
    }
  }, 100);
  while (Date.now() < limit) {
    await sleep(1000);
    if (n === 1 && !fs.existsSync(path.join(share, 'end'))) {
      // Solo: nobody can revive, so the run ends at the clear or after five minutes of authoritative fight.
      const raid = [...app.rooms.values()].map(r => r.raid).find(Boolean);
      if (raid && (raid.state === 'clear' || (raid.state === 'fight' && raid.time > 300))) {
        log('1p: raid', raid.state, 'rt', raid.time.toFixed(0), '-> end'); fs.writeFileSync(path.join(share, 'end'), '1p');
      }
    }
    if (n >= 4 && !resumed && fs.existsSync(path.join(share, 'retried'))) {
      if (!killedAt) killedAt = Date.now();
      if (Date.now() - killedAt > 6000) {
        log('4p: killing client2 to test token recovery after a crash');
        clients[2].kill(); await clients[2].done;
        const tok = JSON.parse(fs.readFileSync(path.join(share, 'client2.json'), 'utf8')).token;
        resumed = launch('client2_resume', '/Game/Maps/HW_Frontend',
          [...base(2), `-HWToken=${tok}`, '-HWQAResume', `-HWQAOut=${path.join(dir, 'client2_resume.json')}`], dir);
        clients[2] = resumed;
      }
    }
    const exited = await Promise.all(clients.map(c => Promise.race([c.done.then(() => true), sleep(1).then(() => false)])));
    if (exited.every(Boolean)) break;
    if (fs.existsSync(path.join(share, 'end'))) {
      const endAt = fs.statSync(path.join(share, 'end')).mtimeMs;
      if (Date.now() - endAt > 60e3) { clients.forEach(c => c.kill()); break; }
    }
  }
  clients.forEach(c => c.kill());
  await Promise.all(clients.map(c => c.done));
  const reports = [];
  for (let i = 0; i < n; i++) {
    const f = path.join(dir, `client${i}.json`); reports[i] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  }
  const resumeReport = fs.existsSync(path.join(dir, 'client2_resume.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'client2_resume.json'), 'utf8')) : null;
  const after = {};
  for (const c of ids) { const p = app.store.public(c.id); after[c.id] = {gold: p.gold, xp: p.xp, clears: {...p.clears}, character: p.character, created: p.characterCreated, name: p.name}; }
  clearInterval(hook);
  fs.writeFileSync(path.join(dir, 'server-telegraphs.json'), JSON.stringify(serverTele, null, 1));
  await app.close();
  return evaluate(n, level, ids, reports, resumeReport, before, after, serverTele);
}

function samples(r) { return r && r.timeline || []; }
function evaluate(n, level, ids, reports, resumeReport, before, after, serverTele) {
  const g = [], host = reports[0], stage = C.arenas[C.levels[level].arena].stages, scale = 1 + .65 * (n - 1);
  const all = reports.filter(Boolean);
  // character creation (server type: character) + server-priority pawn
  for (const [i, r] of reports.entries()) {
    const c = ids[i], s = after[c.id];
    g.push([`P${i + 1} 온라인 캐릭터 생성 → 서버 저장`, pass(r, 'online_character_created') && s.created && s.character === c.character,
      `${detail(r, 'online_character_created')}; store: created=${s.created} ${s.name}/${s.character}`]);
    g.push([`P${i + 1} 서버 캐릭터로 단일 Pawn`, ['pawn_class', 'single_pawn', 'kit_matches', 'no_character_switch'].every(k => pass(r, k)),
      `${detail(r, 'pawn_class')}; ${detail(r, 'single_pawn')}`]);
  }
  g.push([`${n}P 캐릭터 각자 독립(교대 없음)`, (() => {
    const seen = new Map();
    for (const s of samples(host)) for (const p of s.players) { if (!seen.has(p.id)) seen.set(p.id, new Set()); seen.get(p.id).add(p.char); }
    return seen.size === n && [...seen.values()].every(v => v.size === 1) && new Set([...seen.values()].map(v => [...v][0])).size === n;
  })(), 'timeline: 한 플레이어 = 한 캐릭터, 전원 서로 다름']);
  // boss hp scale
  const firstFight = samples(host).find(s => s.st === 'fight' && s.ph === 0);
  const want = Math.round(stage[0].hp * scale);
  g.push([`보스 HP 스케일 ${scale.toFixed(2)}`, !!firstFight && firstFight.boss.max === want, `max ${firstFight?.boss.max} (기대 ${want} = ${stage[0].hp}×${scale.toFixed(2)})`]);
  // independent movement / damage / skills / ult
  const last = samples(host).filter(s => s.players?.length).at(-1) || {players: []};
  const dmg = last.players.map(p => `${p.char}:${Math.round(p.dmg)}`).join(' ');
  g.push(['독립 이동·공격(각자 피해)', last.players.length === n && last.players.every(p => p.dmg > 0), dmg]);
  const skillUse = {}, ultUse = {};
  for (const s of samples(host)) for (const p of s.players) {
    skillUse[p.char] = skillUse[p.char] || [0, 0, 0, 0]; (p.cds || []).forEach((v, i) => { if (v > 0) skillUse[p.char][i] = 1; });
    ultUse[p.char] = ultUse[p.char] || {full: false, used: false}; if (p.ult >= 100) ultUse[p.char].full = true; else if (ultUse[p.char].full && p.ult < 60) ultUse[p.char].used = true;
  }
  g.push(['스킬 1~4 (서버 쿨다운 관측)', Object.values(skillUse).every(v => v.every(Boolean)), JSON.stringify(skillUse)]);
  g.push(['궁극기 (게이지 100 → 소모)', Object.values(ultUse).some(v => v.used), JSON.stringify(ultUse)]);
  if (n === 1) {
    // Solo authority (v2.4): the server starts a one-member room; everything below still comes from raid.cjs.
    g.push(['1인 서버 레이드 출격', host?.party_size === 1 && samples(host).some(s => s.st === 'fight'), `party_size ${host?.party_size}, fight ${samples(host).some(s => s.st === 'fight')}`]);
    const raidSamples = samples(host).filter(s => ['explore', 'fight'].includes(s.st));
    const bossSync = samples(host).filter(s => s.st === 'fight' && s.ue_boss_hp != null);
    const bossOk = bossSync.filter(s => Math.abs(s.ue_boss_hp - s.boss.hp) <= Math.max(1, s.boss.max * .02)).length;
    g.push(['UE 보정 (보스 HP = 서버)', bossSync.length > 0 && bossOk >= bossSync.length * .9, `${bossOk}/${bossSync.length} 샘플, 원격 아바타 0 (${raidSamples.filter(s => s.ue_remote_avatars === 0).length}/${raidSamples.length})`]);
    const end = samples(host).at(-1);
    g.push(['전투 진행 (클리어 또는 5분)', !!end && (end.st === 'clear' || end.boss?.hp < end.boss?.max), `마지막 ${end?.st} stage ${end?.ph} 보스 ${Math.round(end?.boss?.hp)}/${end?.boss?.max}`]);
    return {name: `${n}P online (${level})`, gates: g, reports: {count: all.length}};
  }
  // parts / threat
  const broken = new Set();
  for (const s of samples(host)) for (const p of s.boss?.parts || []) if (p.broken) broken.add(`${s.ph}:${p.id}`);
  g.push(['부위 타깃·파괴 (서버 판정)', broken.size > 0, [...broken].join(', ') || '없음']);
  // Server: the chosen target is the top threat score; UE: every client sees the same target in its telegraph events.
  let agree = 0, counted = 0, switches = 0;
  serverTele.forEach((t, i) => { const e = Object.entries(t.scores); if (e.length >= 2) { counted++; if (e.sort((a, b) => b[1] - a[1])[0][0] === t.targetChar) agree++; }
    if (i && serverTele[i - 1].target !== t.target) switches++; });
  const ueTargets = new Set((host?.telegraphs || []).map(t => t.target));
  const tanked = Object.entries(serverTele.reduce((m, t) => (m[t.targetChar] = (m[t.targetChar] || 0) + 1, m), {})).map(e => e.join(' ')).join(', ');
  g.push(['위협 → 보스 타깃 변화', counted > 0 && agree >= counted * .9 && switches > 0 && ueTargets.size >= 2,
    `서버 패턴 ${serverTele.length}회: 최고 위협(threat−거리×10) 대상 일치 ${agree}/${counted}, 타깃 전환 ${switches}회 (${tanked}); UE 가 본 타깃 ${ueTargets.size}명`]);
  // UE reconciliation / presentation
  const raidSamples = samples(host).filter(s => ['explore', 'fight'].includes(s.st));
  const remoteOk = raidSamples.filter(s => s.ue_remote_avatars === n - 1).length;
  const bossSync = samples(host).filter(s => s.st === 'fight' && s.ue_boss_hp != null);
  const bossOk = bossSync.filter(s => Math.abs(s.ue_boss_hp - s.boss.hp) <= Math.max(1, s.boss.max * .02)).length;
  g.push(['UE 표시·보정 (원격 아바타·보스 HP)', remoteOk >= raidSamples.length * .9 && bossOk >= bossSync.length * .9,
    `원격 아바타 ${n - 1}명 ${remoteOk}/${raidSamples.length} 샘플, UE 보스 HP=서버 ${bossOk}/${bossSync.length}`]);
  if (n === 2) {
    const victim = reports[1];
    g.push(['Down', pass(victim, 'down'), detail(victim, 'down')]);
    g.push(['Revive 3초 → 30% HP', pass(victim, 'revive_30pct') && (host?.counters?.revives_done || 0) > 0, detail(victim, 'revive_30pct')]);
    const c0 = ids[0].id;
    g.push(['보스 클리어 → 보상 서버 저장', pass(host, 'clear_reward') && after[c0].gold > before[c0].gold && Object.keys(after[c0].clears).length > Object.keys(before[c0].clears).length,
      `${detail(host, 'clear_reward')}; gold ${before[c0].gold}→${after[c0].gold}, clears ${JSON.stringify(after[c0].clears)}`]);
  } else {
    const phases = new Set(samples(host).map(s => s.ph));
    g.push(['보스 페이즈 전환 (동기)', phases.has(1), `관측 stage ${[...phases].join(',')}`]);
    const breaks = (host?.counters?.ev_down || 0) + samples(host).filter(s => s.boss?.state === 'downed').length;
    g.push(['보스 브레이크(다운)', breaks > 0, `down 이벤트 ${host?.counters?.ev_down || 0}`]);
    const hz = new Set(); for (const s of samples(host)) for (const h of s.hazards || []) hz.add(h.startsWith('arena_') ? 'arena:' + h.split(':')[1] : 'exp:' + h.split(':')[1]);
    g.push(['위험지대 (탐험·아레나 위상 동기)', ['exp:warning', 'exp:active', 'arena:active'].every(k => hz.has(k)), [...hz].join(' ')]);
    const nodes = samples(host).map(s => [s.nodes_done, s.nodes]).at(-1) || [0, 0];
    const interacts = all.reduce((a, r) => a + (r.counters?.tap_Interact ? 1 : 0), 0);
    const gateOpen = samples(host).some(s => s.gate_open);
    g.push(['탐험 노드·상호작용·게이트', gateOpen && (host?.counters?.ev_interact || 0) >= 4 && interacts >= 3 && samples(host).some(s => s.st === 'fight'),
      `노드 ${nodes[0]}/${nodes[1]}, interact 이벤트 ${host?.counters?.ev_interact || 0}, 상호작용한 클라이언트 ${interacts}, 게이트 열림 ${gateOpen}`]);
    const hazardUE = samples(host).filter(s => s.hazards?.length).every(s => s.ue_hazard_proxies >= s.hazards.length);
    g.push(['UE 위험지대·노드 프록시', hazardUE && samples(host).some(s => s.ue_node_proxies > 0 && s.ue_gate_proxies > 0), '프록시 수 ≥ 스냅샷 수']);
    g.push(['전멸 (all-down wipe)', pass(host, 'wipe'), detail(host, 'wipe')]);
    g.push(['재도전 (체크포인트·전원 회복)', pass(host, 'retry'), detail(host, 'retry')]);
    g.push(['재접속 (같은 프로세스, 토큰)', pass(reports[3], 'reconnect_token'), detail(reports[3], 'reconnect_token')]);
    g.push(['재접속 (프로세스 재시작, -HWToken)', pass(resumeReport, 'resume_same_player') && pass(resumeReport, 'pawn_class'),
      `${detail(resumeReport, 'resume_same_player')}; ${detail(resumeReport, 'pawn_class')}`]);
    // cross-client sync: same server time → same boss hp / phase
    let cmp = 0, same = 0;
    for (const s of samples(host).filter(s => s.st === 'fight')) for (const r of all.slice(1)) {
      const o = samples(r).find(x => Math.abs(x.rt - s.rt) < .15 && x.st === s.st); if (!o) continue; cmp++;
      if (o.ph === s.ph && Math.abs(o.boss.hp - s.boss.hp) <= s.boss.max * .01) same++;
    }
    g.push(['클라이언트 간 동기 (보스 HP·페이즈)', cmp > 0 && same >= cmp * .95, `${same}/${cmp} 비교 일치`]);
  }
  return {name: `${n}P online (${level})`, gates: g, reports: {count: all.length}};
}

(async () => {
  const which = process.argv[2] || 'all';
  const backup = path.join(OUT, 'savegames_backup');
  fs.mkdirSync(SAVES, {recursive: true});
  fs.cpSync(SAVES, backup, {recursive: true});
  const out = [];
  try {
    if (which === 'local' || which === 'all') out.push(await local());
    if (['1p', '2p', '4p', 'all'].includes(which)) {
      // Local save says "sera" so the online pawn must come from the server profile instead.
      await run('select_sera', '/Game/Maps/HW_Frontend', ['-HWQA=select', '-HWQASelect=sera', `-HWQAOut=${path.join(OUT, 'select_sera.json')}`], OUT, 180e3);
    }
    if (which === '1p' || which === 'all') out.push(await online(1));
    if (which === '2p' || which === 'all') out.push(await online(2));
    if (which === '4p' || which === 'all') out.push(await online(4));
  } finally {
    fs.rmSync(SAVES, {recursive: true, force: true});
    fs.cpSync(backup, SAVES, {recursive: true});
  }
  let md = '', failed = 0;
  for (const s of out) {
    md += `\n### ${s.name}\n\n| 게이트 | 결과 | 근거 |\n|---|---|---|\n`;
    for (const [name, ok, why] of s.gates) { md += `| ${name} | ${ok ? 'PASS' : '**FAIL**'} | ${String(why).replace(/\|/g, '/')} |\n`; if (!ok) failed++; }
  }
  fs.writeFileSync(path.join(OUT, 'summary.md'), md);
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(out.map(s => ({name: s.name, gates: s.gates})), null, 1));
  console.log(md);
  console.log(`\n${failed ? failed + ' gate(s) FAILED' : 'ALL GATES PASS'} — ${OUT}`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 2; });
