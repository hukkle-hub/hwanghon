/* Measured on the shipped mesh, not its height/bounding-box centre.
   Points are in Boss_Mesh local metres, BEFORE game normalization and recoil.
   This is presentation only; it must not change an authoritative hit footprint. */
export function bindBossEmitter(model, spec) {
  if (!spec || !model) return null;
  const node = model.getObjectByName(spec.node);
  if (!node?.isMesh) return null; // Unknown/replaced asset: never attach to an arbitrary node.
  return {
    node,
    worldPosition(out) {
      // The effect update precedes renderer traversal. Refresh ancestors now so
      // translation, yaw, normalization, lift and this frame's recoil all apply.
      node.updateWorldMatrix(true, false);
      return out.fromArray(spec.point).applyMatrix4(node.matrixWorld);
    },
  };
}

// A deforming surface cannot use a fixed mesh-local point. Bind to an actual
// triangle and evaluate its morphed vertices each frame. Asset/LOD mismatches
// fail closed instead of silently attaching an effect to another body part.
export function bindBossSurfaceEmitter(model, spec) {
  const node = model?.getObjectByName(spec?.node), surface = spec?.surface;
  if (!node?.isMesh || !surface) return null;
  const g = node.geometry, p = g?.getAttribute('position'), index = g?.index;
  const { triangle, vertices, weights, rest } = surface;
  if (!p || !index || p.count !== surface.vertexCount || !Number.isInteger(triangle) || triangle < 0 || triangle * 3 + 2 >= index.count) return null;
  if (![vertices, weights, rest].every(a => Array.isArray(a) && a.length === 3)) return null;
  if (!weights.every(w => Number.isFinite(w) && w >= 0 && w <= 1) || Math.abs(weights.reduce((a, b) => a + b, 0) - 1) > 1e-7) return null;
  for (let i = 0; i < 3; i++) {
    const v = vertices[i], r = rest[i];
    if (!Number.isInteger(v) || v < 0 || v >= p.count || index.getX(triangle * 3 + i) !== v) return null;
    if (!Array.isArray(r) || r.length !== 3 || !r.every(Number.isFinite)) return null;
    if (Math.hypot(p.getX(v) - r[0], p.getY(v) - r[1], p.getZ(v) - r[2]) > 1e-5) return null;
  }
  // Copy the descriptor so caller mutation cannot bypass the validation.
  const ids = vertices.slice(), w = weights.slice();
  let points;
  function sample(out) {
    points ||= [out.clone(), out.clone(), out.clone()];
    node.updateWorldMatrix(true, false);
    if (node.isSkinnedMesh) node.skeleton.update();
    for (let i = 0; i < 3; i++) node.getVertexPosition(ids[i], points[i]).applyMatrix4(node.matrixWorld);
  }
  return {
    node,
    worldPosition(out) {
      sample(out);out.set(0, 0, 0);
      for (let i = 0; i < 3; i++) out.addScaledVector(points[i], w[i]);
      return out;
    },
    worldNormal(out) {
      sample(out);
      // Cross transformed edges: correct even under non-uniform parent scale.
      return out.subVectors(points[1], points[0]).cross(points[2].sub(points[0])).normalize();
    },
  };
}
