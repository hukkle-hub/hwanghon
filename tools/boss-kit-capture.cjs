/* Loopback-only sink for locally generated QA recordings; no game server mutation. */
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2]; if (!dir) throw Error('Output directory required');
fs.mkdirSync(dir, { recursive: true });
http.createServer((req, res) => {
  if (req.headers.origin !== 'http://127.0.0.1:8794') { res.writeHead(403).end(); return; }
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:8794');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const match = /^\/(leviathan|aegis|celestial2|arsenal|nova|park)$/.exec(req.url);
  if (!match || req.method !== 'POST') { res.writeHead(404).end(); return; }
  let n = 0; const chunks = [];
  req.on('data', b => { n += b.length; if (n > 32 * 1024 * 1024) req.destroy(); else chunks.push(b); });
  req.on('end', () => { const name = match[1] + '-' + Date.now() + '.webm'; fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks), { flag: 'wx' }); res.end(name); console.log(name, n); });
}).listen(8795, '127.0.0.1', () => console.log('Local QA capture 8795'));
