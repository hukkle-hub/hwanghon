const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const files=['server/field.cjs','server/index.cjs','server/field-mob-combat.cjs','server/field-ecology-patrols.json',
 'tests/field-mob-integration.test.cjs','tests/field-mob-socket.test.cjs',
 'tools/monsters/build-field-patrols.mjs','tools/monsters/measure-field-mobs.cjs','tools/monsters/verify-field-mobs.cjs','tools/monsters/package-field-mobs.cjs',
 'docs/gpt/2026-10-09-monster-server-handoff.txt',
 'docs/design/ref/g5-hookhand-approval/g5_hookhand_approval_draft_v1.png','docs/design/ref/g5-hookhand-approval/g5_hookhand_prompt_v1.txt',
 'docs/design/ref/monster-server-v10-qa/full-tests.log','docs/design/ref/monster-server-v10-qa/verification.json','docs/design/ref/monster-server-v10-qa/server-timing.json'];
const qa=JSON.parse(fs.readFileSync(path.join(root,'docs/design/ref/monster-server-v10-qa/verification.json')));
if(qa.suiteExit!==0||qa.fail!==0)throw Error('QA not passed');
const manifest={kind:'local_server_integration_not_live_game',createdUTC:new Date().toISOString(),
 baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 tests:qa,files:files.map(file=>{const bytes=fs.readFileSync(path.join(root,file));
  return {file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};})};
const target=path.join(root,'docs/design/ref/monster-server-v10-qa/delivery-manifest.json');
fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({files:files.length,manifest:target}));
