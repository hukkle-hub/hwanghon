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
