// Root hover height and skill lift are one physical height. Recover them together
// or a death during a dive leaves the corpse below the ground by the dive offset.
export function bossDeathFlight({fly,rootY,modelY,baseModelY,elapsed,landingAt=1.1}) {
  if (!(fly>0)) return {rootY,modelY};
  const u=Math.max(0,Math.min(1,elapsed/Math.max(.001,landingAt))),k=u*u*(3-2*u);
  return {rootY:rootY*(1-k),modelY:modelY+(baseModelY-modelY)*k};
}
