/* Pure surface-contact evaluator, shared by Node and loadCjs. No live boss uses
 * this yet. A baked review profile is NOT authority to enable its damage.
 * Supports one identity-rest mesh, relative morphs and one quaternion parent.
 * Range/angle are supplied by the existing skill, never invented here. */
const finite = Number.isFinite;
const vec = (a, n) => Array.isArray(a) && a.length === n && a.every(finite);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
function unit(a) { const n = Math.hypot(...a); return n > 1e-12 ? a.map(v => v/n) : null; }
function rotate(v, q) {
  const u = q.slice(0, 3), uv = cross(u, v), uuv = cross(u, uv);
  return v.map((x, i) => x + 2*(q[3]*uv[i] + uuv[i]));
}
function trackValid(tr, size, quaternion = false) {
  return tr && Array.isArray(tr.times) && tr.times.length > 1 && tr.times[0] === 0 &&
    tr.times.every((v, i) => finite(v) && (!i || v > tr.times[i-1])) &&
    Array.isArray(tr.values) && tr.values.length === size*tr.times.length && tr.values.every(finite) &&
    (!quaternion || tr.times.every((_, i) => Math.abs(Math.hypot(...tr.values.slice(i*4,i*4+4))-1) < 1e-5));
}
function sample(tr, size, t, quaternion = false) {
  let right = 1;
  while (right < tr.times.length-1 && t > tr.times[right]) right++;
  const left = right-1, alpha = Math.max(0, Math.min(1, (t-tr.times[left])/(tr.times[right]-tr.times[left])));
  const a = tr.values.slice(left*size, (left+1)*size), b = tr.values.slice(right*size, (right+1)*size);
  if (!quaternion) return a.map((v, i) => v+(b[i]-v)*alpha);
  let dot = a.reduce((s, v, i) => s+v*b[i], 0);
  if (dot < 0) { for (let i=0;i<4;i++) b[i] = -b[i]; dot = -dot; }
  if (dot > .999999) return unit(a.map((v, i) => v+(b[i]-v)*alpha));
  const angle = Math.acos(Math.min(1, dot)), denominator = Math.sin(angle);
  return a.map((v, i) => (v*Math.sin((1-alpha)*angle)+b[i]*Math.sin(alpha*angle))/denominator);
}
function bindSurfaceContactProfile(input) {
  // Fail closed on malformed profiles; copy before evaluation so a caller
  // cannot mutate a validated descriptor or track while a skill is running.
  if (!input || input.version !== 1 || input.reviewOnly !== true ||
      typeof input.clip !== 'string' || !finite(input.duration) || input.duration <= 0 ||
      !Number.isInteger(input.morphCount) || input.morphCount < 1 || input.morphCount > 8 ||
      !finite(input.scale) || input.scale <= 0 || !vec(input.offset,3) ||
      !trackValid(input.rotation,4,true) || !trackValid(input.weights,input.morphCount) ||
      !Array.isArray(input.surfaces) || !input.surfaces.length) return null;
  const last = tr => tr.times[tr.times.length-1];
  if (Math.abs(last(input.rotation)-input.duration) > .001 || Math.abs(last(input.weights)-input.duration) > .001) return null;
  const names = new Set();
  for (const s of input.surfaces) {
    if (!s || typeof s.name !== 'string' || names.has(s.name) || !vec(s.barycentric,3) ||
        s.barycentric.some(w => w < 0 || w > 1) || Math.abs(s.barycentric.reduce((a,b)=>a+b,0)-1)>1e-7 ||
        !Array.isArray(s.vertices) || s.vertices.length!==3 ||
        !s.vertices.every(v => v && vec(v.rest,3) && Array.isArray(v.deltas) && v.deltas.length===input.morphCount && v.deltas.every(d=>vec(d,3))) ||
        !unit(cross(sub(s.vertices[1].rest,s.vertices[0].rest),sub(s.vertices[2].rest,s.vertices[0].rest)))) return null;
    names.add(s.name);
  }
  const p = JSON.parse(JSON.stringify(input));
  function at(t, x=0, z=0) {
    if (![t,x,z].every(finite) || t<0 || t>p.duration) return [];
    const q=sample(p.rotation,4,t,true), weights=sample(p.weights,p.morphCount,t);
    return p.surfaces.map(s => {
      const vertices=s.vertices.map(v=> {
        const posed=v.rest.map((a,i)=>a+v.deltas.reduce((sum,d,j)=>sum+d[i]*weights[j],0));
        return rotate(posed,q).map((a,i)=>a*p.scale+p.offset[i]+(i===0?x:i===2?z:0));
      });
      const normal=unit(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0])));
      if (!normal) return null;
      const position=[0,0,0];vertices.forEach((v,j)=>v.forEach((a,i)=>position[i]+=a*s.barycentric[j]));
      return {name:s.name,position,normal};
    }).filter(Boolean);
  }
  function contacts(skill, hit, x=0, z=0) {
    if (skill?.clip!==p.clip || !finite(skill.duration) || Math.abs(skill.duration-p.duration)>.001 ||
        !Array.isArray(skill.hits) || !skill.hits.includes(hit) || hit?.shape!=='cone' || hit.atTarget ||
        !finite(hit.at) || hit.at<0 || hit.at>p.duration || !finite(hit.range) || hit.range<=0 ||
        !finite(hit.angle) || hit.angle<=0 || hit.angle>Math.PI) return [];
    return at(hit.at,x,z).flatMap(s=> {
      const flat=Math.hypot(s.normal[0],s.normal[2]);
      return flat<1e-8?[]:[{name:s.name,origin:{x:s.position[0],y:s.position[1],z:s.position[2]},
        yaw:Math.atan2(s.normal[0],s.normal[2]),range:hit.range,angle:hit.angle}];
    });
  }
  return {at,contacts};
}
function containsSurfaceContact(contacts, target) {
  if (!Array.isArray(contacts) || !target || !finite(target.x) || !finite(target.z)) return false;
  // Boolean union: the caller visits each player once, not once per nozzle.
  return contacts.some(c=> {
    if (!c?.origin || ![c.origin.x,c.origin.z,c.yaw,c.range,c.angle].every(finite) ||
        c.range<=0 || c.angle<=0 || c.angle>Math.PI) return false;
    const dx=target.x-c.origin.x,dz=target.z-c.origin.z,d=Math.hypot(dx,dz);
    if (d>c.range) return false;
    return d===0 || (dx*Math.sin(c.yaw)+dz*Math.cos(c.yaw))/d >= Math.cos(c.angle/2);
  });
}
module.exports={bindSurfaceContactProfile,containsSurfaceContact};
