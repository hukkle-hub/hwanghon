import {spawn} from 'node:child_process';import {mkdir,writeFile,readdir} from 'node:fs/promises';import {resolve} from 'node:path';
const out=resolve(process.argv[2]||'../../output/ain-fullbody-skills-2026-10-10');await mkdir(out,{recursive:true});
const tests=(await readdir('tests')).filter(n=>/\.test\.(cjs|mjs)$/.test(n)).map(n=>'tests/'+n);
const child=spawn(process.execPath,['--test','--test-reporter=tap',...tests],{stdio:['ignore','pipe','pipe']});let log='';
child.stdout.on('data',b=>{log+=b;});child.stderr.on('data',b=>{log+=b;});
const code=await new Promise(r=>child.on('close',r));await writeFile(resolve(out,'tests.tap'),log);
const result={exitCode:code,at:new Date().toISOString(),summary:log.split('\n').filter(l=>/^# (tests|pass|fail|skipped|duration_ms)|^not ok|^  error:/.test(l))};
await writeFile(resolve(out,'test-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exitCode=code;
