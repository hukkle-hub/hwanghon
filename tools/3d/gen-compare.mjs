/* 생성기 비교 시트 찍기 — tools/3d/gen-compare.html 을 헤드리스로 열어 PNG 한 장 + 표(JSON)를 남긴다.
     node tools/3d/gen-compare.mjs <A.glb> <B.glb> <이름> [out.png] [A이름] [B이름] [입력 접두어 art/3d/src/part1_views/clave]
   tools/serve.cjs 가 8777 에 떠 있어야 한다. 경로는 저장소 루트 기준. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs'; import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [a, b, name = '', out = ROOT + '/.node-shots/gen-compare.png', la = 'Hi3D', lb = 'Varco3D', ref = ''] = process.argv.slice(2);
const rel = p => '/' + path.relative(ROOT, path.resolve(p));
const url = `http://127.0.0.1:8777/tools/3d/gen-compare.html?a=${encodeURIComponent(rel(a))}` + (b ? `&b=${encodeURIComponent(rel(b))}` : '') + `&la=${encodeURIComponent(la)}&lb=${encodeURIComponent(lb)}&name=${encodeURIComponent(name)}` + (ref ? `&ref=${encodeURIComponent(rel(ref))}` : '');
const br = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader']}), p = await br.newPage({viewport: {width: 1440, height: 900}});
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(url); await p.waitForSelector('body[data-ready]', {timeout: 240000});
fs.mkdirSync(path.dirname(out), {recursive: true});
await p.screenshot({path: out, fullPage: true});
console.log(JSON.stringify(await p.evaluate(() => window.__CMP), null, 1)); if (errs.length) console.log('오류', errs);
await br.close(); console.log('찍음', out);
