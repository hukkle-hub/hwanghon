// Source inventory, not visual acceptance. Run from the repository root.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {ZONES} from '../../js/mmo/zones.js';
import {collectBosses} from './boss-close-review.mjs';
const require=createRequire(import.meta.url),{FIELD_MONSTERS}=require('../../server/field-monsters.cjs'),{KITS}=require('../../server/field-boss-kit.cjs'),{PARK}=require('../../server/field-boss-canon.cjs'),{SKILLS}=require('../../server/field-boss-combat.cjs');
const rows=collectBosses(ZONES,FIELD_MONSTERS);
function inspect(file,kit={}){
 const bytes=fs.readFileSync(file),j=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12))),clips=(j.animations||[]).map(a=>({name:a.name,channels:a.channels.length,targets:[...new Set(a.channels.map(c=>j.nodes[c.target.node].name))]})),names=clips.map(c=>c.name);
 return {file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),clips,missingSkillClips:Object.values(kit.skills||{}).filter(s=>!names.includes(s.clip)).map(s=>s.clip),reactionAvailability:Object.fromEntries(['cancel','hit','stagger','dodge','down','getup','death'].map(n=>[n,names.includes(n==='death'?kit.deathClip||'death':kit.reactionClips?.[n]||n)])),onlyWholeBodyPivot:clips.length>0&&clips.every(c=>c.targets.length===1&&c.targets[0]==='KitMechanicalMotion'),visualApproved:false};
}
for(const row of rows){const kit=KITS[row.id]||(/^clave/.test(row.id)?{skills:SKILLS}:{});row.live=row.model?inspect(row.model,kit):{missingBody:true,visualApproved:false};if(row.id==='park')row.candidate=inspect('art/review/part1/park-armed-recovery-study.glb',PARK);if(row.id==='leviathan')row.candidate=inspect('art/review/part1/leviathan-gill-candidate.glb',kit);if(row.id==='celestial2')row.candidate=inspect('art/review/part1/celestial-response-study.glb',kit);}
const result={method:'GLB source inventory, not rendering or visual approval',bossEntries:rows.length,allBossesApproved:false,caveats:['Reaction names only reflect the kit aliases, not a runtime behavior assertion','Dominator raw reused hero assets: runtime tint/gear/animation aliases must be reviewed in the actual field','Static machinery need characteristic collapse/shutdown, not human getup/dodge'],rows};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
