/* Long authored deaths must finish before corpse dissolve/removal. */
export function bossDeathTiming(clipDuration) {
  const valid = Number.isFinite(clipDuration) && clipDuration > 0;
  const speed = valid && clipDuration > 3 ? 1 : .7;
  const motion = valid ? clipDuration / speed : 0;
  const sinkAt = Math.max(3.8, motion + .25);
  return { speed, motion, sinkAt, finishAt: sinkAt + 1.1,
    shotDuration: sinkAt + .8, cardAt: Math.max(2.3, motion * .85) };
}
