/* Preserve the source GLB. Combat owns translation and one damage beat per clip. */
const prepared = new WeakMap();
export function prepareMarshMotion(asset) {
  if (prepared.has(asset)) return prepared.get(asset);
  const animations = asset.animations.map(source => {
    const clip = source.clone();
    if (clip.name === 'atk_bolt') {
      for (const track of clip.tracks) {
        if (!/(^|[.:])Hips\.position$/.test(track.name)) continue;
        // Exported glTF is Y-up: keep vertical crouch, remove horizontal root motion.
        for (let i=0;i<track.values.length;i+=3) {
          track.values[i]=track.values[0];
          track.values[i+2]=track.values[2];
        }
      }
    }
    if (clip.name === 'atk_drop') return strikeSegment(source,'atk_drop',.05,.30);
    return clip;
  });
  const rage=asset.animations.find(c=>c.name==='atk_drop');
  if(rage) animations.push(strikeSegment(rage,'atk_drop_left',.30,.55),
    strikeSegment(rage,'atk_drop_finish',.55,.80));
  const result={...asset,animations};prepared.set(asset,result);return result;
}

function strikeSegment(source,name,from,to) {
  const clip=source.clone(),duration=.65;
  clip.name=name;
  clip.tracks=source.tracks.map(track=>{
    const times=[],values=[],sample=track.createInterpolant();
    for(let i=0;i<25;i++){
      const p=i/24;times.push(p*duration);
      values.push(...sample.evaluate(source.duration*(from+(to-from)*p)));
    }
    return new track.constructor(track.name,times,values,track.getInterpolation());
  });
  clip.duration=duration;return clip;
}

// Both renderers supply one-based beat numbers, regardless of their snapshot format.
export function bossAttackSpec(arena,icon,beat=1) {
  const attacks=arena.atk||{},spec=attacks[icon]||Object.values(attacks)[0];
  if(arena.id!=='marsh'||icon!=='drop'||!spec)return spec;
  const clips=['atk_drop','atk_drop_left','atk_drop_finish'];
  return {...spec,clip:clips[Math.max(0,Math.min(2,(beat||1)-1))]};
}

export function detachBossPiece(piece, scene) {
  // attach preserves world scale as well as position/rotation (Morbus uses 0.85).
  scene.updateMatrixWorld(true);
  scene.attach(piece);
}

export function bossPartPieces(model,id) {
  const name='piece_'+id,result=[];
  model.traverse(o=>{if(o.name===name||o.name.startsWith(name+'_'))result.push(o);});
  return result;
}
