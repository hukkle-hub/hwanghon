"""Separate the already-cut rigid shutter in a baked Clave GLB without rebaking clips.

Uses the existing LeftHand weight contract. Preserves all animations, materials,
skin bindings and texture bytes. Keeps the few hand boundary triangles on the body.
Usage: python tools/3d/split_clave_held_part.py art/3d/part1/clave.glb
"""
import copy
import json
import struct
import sys
from pathlib import Path

import numpy as np


def split(path):
    blob = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', blob)
    assert magic == 0x46546C67 and version == 2 and length == len(blob)
    size, kind = struct.unpack_from('<II', blob, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(blob[20:20 + size])
    if any(n.get('name') == 'Boss_HeldPart' for n in doc['nodes']):
        print('Boss_HeldPart already present'); return
    binary_size, kind = struct.unpack_from('<II', blob, 20 + size)
    assert kind == 0x004E4942
    binary = bytearray(blob[28 + size:28 + size + binary_size])
    types = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
    dims = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def read(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        assert 'sparse' not in a and 'byteStride' not in v
        return np.frombuffer(binary, dtype=types[a['componentType']],
                             count=a['count'] * dims[a['type']],
                             offset=v.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, dims[a['type']]).copy()

    def append(template, values, target):
        while len(binary) % 4: binary.append(0)
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes, 'target': target})
        binary.extend(values.tobytes())
        a = copy.deepcopy(template)
        a.update(bufferView=view, byteOffset=0, count=len(values))
        if 'min' in a: a['min'] = values.min(axis=0).tolist()
        if 'max' in a: a['max'] = values.max(axis=0).tolist()
        index = len(doc['accessors']); doc['accessors'].append(a)
        return index

    node_index = next(i for i, n in enumerate(doc['nodes']) if n.get('name') == 'Boss_Mesh')
    node = doc['nodes'][node_index]; mesh = doc['meshes'][node['mesh']]
    assert len(mesh['primitives']) == 1
    primitive = mesh['primitives'][0]
    attrs = {key: read(i) for key, i in primitive['attributes'].items()}
    triangles = read(primitive['indices']).reshape(-1, 3)
    skin = doc['skins'][node['skin']]
    hand = next(k for k, i in enumerate(skin['joints']) if doc['nodes'][i].get('name') == 'mixamorig:LeftHand')
    rigid = ((attrs['JOINTS_0'] == hand) & (attrs['WEIGHTS_0'] >= 1.0)).any(axis=1)
    held = rigid[triangles].all(axis=1)
    assert 0.05 < held.mean() < 0.5, 'unexpected shutter triangle fraction'
    assert ((rigid[triangles].sum(axis=1) > 0) & ~held).sum() < 20, 'unexpected rigid boundary; inspect before splitting'

    def partition(selected):
        used, remapped = np.unique(triangles[selected].reshape(-1), return_inverse=True)
        result = copy.deepcopy(primitive)
        result['attributes'] = {key: append(doc['accessors'][primitive['attributes'][key]], values[used], 34962) for key, values in attrs.items()}
        index_template = doc['accessors'][primitive['indices']]
        result['indices'] = append(index_template, remapped.astype(types[index_template['componentType']]).reshape(-1, 1), 34963)
        return result

    body_primitive, held_primitive = partition(~held), partition(held)
    mesh['primitives'] = [body_primitive]
    held_mesh = len(doc['meshes'])
    doc['meshes'].append({'name': 'Boss_HeldPart', 'primitives': [held_primitive]})
    held_node = copy.deepcopy(node); held_node.update(name='Boss_HeldPart', mesh=held_mesh)
    new_index = len(doc['nodes']); doc['nodes'].append(held_node)
    parent = next(n for n in doc['nodes'] if node_index in n.get('children', []))
    parent['children'].append(new_index)
    doc['buffers'][0]['byteLength'] = len(binary)
    raw = json.dumps(doc, separators=(',', ':')).encode()
    raw += b' ' * (-len(raw) % 4); binary.extend(b'\0' * (-len(binary) % 4))
    output = struct.pack('<III', magic, version, 12 + 8 + len(raw) + 8 + len(binary))
    output += struct.pack('<II', len(raw), 0x4E4F534A) + raw
    output += struct.pack('<II', len(binary), 0x004E4942) + binary
    path.write_bytes(output)
    print(f'Separated {held.sum()} shutter triangles; kept {len(doc.get("animations", []))} clips')


if __name__ == '__main__':
    split(Path(sys.argv[1]))
