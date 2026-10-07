/* PIE 판과 시뮬을 대조한다 (docs/design/201 §8).
     node tools/ue/node-compare.mjs <UE 기록 .json> [--shots 60,120,200] [--dps 1000]
   UE 기록 = Saved/HWNode/last_run.json (또는 Saved/HWNode/runs/run_*.json). 같은 조건(정책·바리케이드·기술자·대피)으로
   시뮬을 돌리고, 핵심 순간 표를 찍고(⚠ = 한쪽에만 있거나 15초·20% 넘게 차이), --shots 면 같은 시각을 좌우로 찍는다
   (tools/serve.cjs 가 8777 에 떠 있어야 한다). 결과는 .node-sim/compare-<이름>.md · .png */
import {createRequire} from 'node:module';
import path from 'node:path'; import fs from 'node:fs'; import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(ROOT + '/');
const K = require('./tools/ue/node-compare-core.cjs'), S = require('./tools/ue/node-sim.cjs');
const a = process.argv.slice(2), get = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const file = a.find(x => x.endsWith('.json'));
if (!file) { console.log('쓰는 법: node tools/ue/node-compare.mjs <UE 기록 .json> [--shots 60,120] [--dps 1000]'); process.exit(1); }
const ue = JSON.parse(fs.readFileSync(file, 'utf8'));
if (ue.format !== 'hwnode-run/1') { console.log('hwnode-run/1 기록이 아니다: ' + file); process.exit(1); }
const N = S.load(ue.node || 'namsan_n01');
const fit = get('--dps') ? { run: S.simulate(N, { policies: ue.opt?.policies || [], barricades: ue.opt?.barricades || [], tech: ue.opt?.tech || null, evacuate: !!ue.opt?.evacuate, player: { dps: +get('--dps'), counter: 0.35 } }), dps: +get('--dps') } : K.simFor(ue, N);
const cmp = K.compare(ue, fit.run), name = path.basename(file, '.json');
const head = `## ${name} — ${ue.source === 'ue' ? 'UE (PIE)' : ue.source} ↔ 시뮬\n\n조건: 정책 ${(ue.opt?.policies || []).join(', ') || '없음'} · 바리케이드 ${(ue.opt?.barricades || []).join(', ') || '없음'} · 기술자 ${ue.opt?.tech || '—'} · 대피 ${ue.opt?.evacuate ? '예' : '아니오'} · 시뮬 플레이어 DPS ${fit.dps ?? '없음'} (플레이어 피해 몫 UE ${Math.round(100 * K.share(K.trim(ue)))}% ↔ 시뮬 ${Math.round(100 * K.share(fit.run))}%)\n\n어긋남 ${cmp.off}곳\n\n`;
const md = head + K.table(cmp, ue.source === 'ue' ? 'UE' : 'A', '시뮬') + '\n';
fs.mkdirSync(ROOT + '/.node-sim', {recursive: true});
fs.writeFileSync(`${ROOT}/.node-sim/compare-${name}.md`, md);
fs.writeFileSync(`${ROOT}/.node-sim/${name}-ue.json`, JSON.stringify(K.trim(ue)));
fs.writeFileSync(`${ROOT}/.node-sim/${name}-sim.json`, JSON.stringify(fit.run));
console.log(md);
if (get('--shots')) {
  const {chromium} = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
  const b = await chromium.launch(), p = await b.newPage({viewport: {width: 1320, height: 900}});
  for (const t of get('--shots').split(',')) {
    await p.goto(`http://127.0.0.1:8777/tools/ue/node-sim.html?data=/.node-sim/${name}-ue.json&cmp=/.node-sim/${name}-sim.json&t=${t}&node=${ue.node || 'namsan_n01'}`);
    await p.waitForSelector('body[data-ready="1"]');
    await p.screenshot({path: `${ROOT}/.node-sim/compare-${name}-${t}.png`, fullPage: true});
  }
  await b.close(); console.log('찍음 .node-sim/compare-' + name + '-*.png');
}
