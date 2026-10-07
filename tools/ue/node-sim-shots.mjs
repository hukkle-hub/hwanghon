/* 시뮬레이터 리플레이를 몇 시점 찍는다 (docs/design/201 §9).
     node tools/ue/node-sim-shots.mjs <이름> '<opts JSON>' 30,90,180 [폴더]
   tools/serve.cjs 가 8777 에 떠 있어야 한다. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [name = 'run', opts = '{}', times = '60,120,180', out = ROOT + '/.node-sim'] = process.argv.slice(2);
fs.mkdirSync(ROOT + '/.node-sim', {recursive: true}); fs.mkdirSync(out, {recursive: true});
const data = '.node-sim/' + name + '.json';
console.log(execFileSync('node', [ROOT + '/tools/ue/node-sim.cjs', '--json', ROOT + '/' + data, '--opts', opts], {encoding: 'utf8'}).trim());
const b = await chromium.launch(), p = await b.newPage({viewport: {width: 1120, height: 1000}});
for (const t of times.split(',')) {
  await p.goto(`http://127.0.0.1:8777/tools/ue/node-sim.html?data=/${data}&t=${t}`);
  await p.waitForSelector('body[data-ready="1"]');
  await p.screenshot({path: `${out}/${name}-${t}.png`, fullPage: true});
}
await b.close(); console.log('찍음', out);
