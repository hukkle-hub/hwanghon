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
    return clip;
  });
  const result={...asset,animations};prepared.set(asset,result);return result;
}

/* 연계 비트의 모션은 데이터가 고른다: chain[].icon 이 arena.atk 의 다른 항목을 가리키면
   그 비트만 전용 클립으로 돈다 (모르버스 boltB / dropB / dropC, 그 밖의 보스 hammerB 등).
   icon 이 없는 비트는 1타 클립을 그대로 쓴다 — beat 는 남겨 둔다, 호출부가 이미 넘긴다. */
export function bossAttackSpec(arena,icon,beat=1) {
  const attacks=arena.atk||{};
  return attacks[icon]||Object.values(attacks)[0];
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
