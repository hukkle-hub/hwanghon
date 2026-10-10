/* 클립 자세를 «그 시각 그대로» 몸에 얹는다 (문서 226).
   AnimationMixer 는 값이 지난번과 같으면 뼈에 다시 쓰지 않는다(PropertyMixer 의 변경 검사) — 표본마다 쉬는 자세로 되돌리는 도구에서는
   클립이 멈춰 있는 구간(정 장관 칼 들어 자세 1.1~1.5 s 등)의 뼈가 쉬는 자세로 남아, 감사가 «79° 튐» 을 지어내고 고치는 도구가 쉬는 자세를 써 넣을 뻔했다.
   그래서 트랙마다 보간기를 직접 불러 값을 넣는다. */
export function makePoser(root, clip) {
  const byName = {}; root.traverse(o => { if (o.name) byName[o.name] = o; });
  const tracks = clip.tracks.map(tr => { const dot = tr.name.lastIndexOf('.'), node = byName[tr.name.slice(0, dot)], prop = tr.name.slice(dot + 1); return node && ['quaternion', 'position', 'scale'].includes(prop) ? { node, prop, it: tr.createInterpolant() } : null; }).filter(Boolean);
  return t => { for (const { node, prop, it } of tracks) { const v = it.evaluate(Math.max(0, Math.min(clip.duration, t))); node[prop].fromArray(v); } root.updateMatrixWorld(true); };
}
