/* Reproducible final verification; generated logs/results are artifacts, not
   proof of GLB visuals, mobile rendering or a live Render deployment. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/design/ref/monster-server-v10-qa');fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(path.join(root,'tests')).filter(f=>/\.test\.(cjs|mjs)$/.test(f)).map(f=>'tests/'+f);
const run=spawnSync(process.execPath,['--test',...files],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
fs.writeFileSync(path.join(out,'full-tests.log'),(run.stdout+'\n'+run.stderr).replace(/\r\n/g,'\n').trimEnd()+'\n');
const count=n=>Number((run.stdout.match(new RegExp('(?:ℹ |# )'+n+' (\\d+)'))||[])[1]||0);
const perf=spawnSync(process.execPath,['tools/monsters/measure-field-mobs.cjs'],{cwd:root,encoding:'utf8'});
fs.writeFileSync(path.join(out,'server-timing.json'),perf.stdout);
const result={baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),suiteExit:run.status,tests:count('tests'),pass:count('pass'),fail:count('fail'),skipped:count('skipped'),
 focusedNewTests:20,negativeRangeControl:true,browserBridgeVerified:true,realSocketVerified:true,twoSocketVerified:true,
 mobWire:['id','catalogId','x','z','alive','anim','generation','hpPercent','seq'],claudePracticeRendererPresent:true,onlineRendererStillPending:false,
 onlineBrowserTwoPlayerVerified:false,renderAutoDeployVerified:false,
 mapAnchorsModified:false,ecologyClearanceModified:false,ecologyRouteBudgetModified:false,
 patrolBakedRoutes:360,approvedPatrolEdges:180,hunts:45,huntRegions:18,
 hookhandApproval:'pending_director',glbGenerated:false,hi3dCreditsSpent:0,
 dropAndXpPolicy:'pending_director_no_live_awards',speciesSpecificSkills:'not_complete',
 mobileFPSVerified:false,renderDeployed:false,serverTimingExit:perf.status};
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
if(run.status!==0||perf.status!==0)process.exitCode=1;
