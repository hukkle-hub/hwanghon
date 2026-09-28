"""Style frames (시안) for the animation look — EP01 SC004 옥상 (docs/design/139).

Canon (docs/story/source/황혼_1부_소설판_제01화_마감본.txt L51-L70):
  하늘: 나노 입자로 이 년째 파랗지 않다, 보라와 핏빛이 뒤엉킨 황혼
  강남 폐빌딩 옥상, 무릎 높이까지 차오른 붉은 안개, 그 위에 여자 하나(아인)
  잿빛으로 바랜 단발(원래 검은 머리), 등의 스파인 코어(주황 명멸), 172 cm 파이프 커터 낫
Not in the text (TBD_CANON design): roof layout, tank/stair housing, the city around.

Same set, same shot, five painterly post-process looks (direction C, the director's choice 2026-09-28):
  STYLE_1_Oil        유화 필치 (Arcane 계열)       — Kuwahara brush + stroke grain
  STYLE_2_Webtoon    웹툰 셀 페인트                — banded light, clean lines
  STYLE_3_InkWash    먹선 수채                     — ink lines, washed colour, paper
  STYLE_4_Halftone   하프톤 코믹 (스파이더버스 계열) — dots, misregistration, bold lines
  STYLE_5_DarkMatte  다크 판타지 매트 페인팅         — brush + ember/violet grade, vignette

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_style_frames_sc004.py" -unattended -nullrhi
then: UnrealEditor <uproject> /Game/Hwanghon/Story/EP01/Style/EP01_SC004_StyleFrames -game -HWQA=styleshow -HWQAShots=<dir>
"""
import math
import random

import unreal

ROOT = "/Game/Hwanghon/Story/EP01/Style"
MAP = f"{ROOT}/EP01_SC004_StyleFrames"
MAT = f"{ROOT}/Materials"
AIN_MESH = "/Game/Characters/Ain/ain_anim/SkeletalMeshes/ain_anim"
AIN_IDLE = "/Game/Characters/Ain/ain_anim/SkeletalMeshes/ain_animidle"
CUBE = "/Engine/BasicShapes/Cube.Cube"
CYL = "/Engine/BasicShapes/Cylinder.Cylinder"
PLANE = "/Engine/BasicShapes/Plane.Plane"
SKY = "/Engine/EngineSky/SM_SkySphere.SM_SkySphere"

tools = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def log(msg):
    unreal.log(f"[HWStyle] {msg}")


def fresh_material(name):
    # Reuse and clear: deleting a material the map still references fails silently.
    path = f"{MAT}/{name}"
    if lib.does_asset_exist(path):
        m = unreal.load_asset(path)
        mel.delete_all_material_expressions(m)
        return m
    return tools.create_asset(name, MAT, unreal.Material, unreal.MaterialFactoryNew())


def custom(m, code, out_type, inputs, x=-400, y=0):
    cu = mel.create_material_expression(m, unreal.MaterialExpressionCustom, x, y)
    cu.set_editor_property("code", code)
    cu.set_editor_property("output_type", out_type)
    ins = []
    for n in inputs:
        ci = unreal.CustomInput()
        ci.set_editor_property("input_name", n)
        ins.append(ci)
    cu.set_editor_property("inputs", ins)
    return cu


# ---------------------------------------------------------------- HLSL helpers shared by the looks
HELP = r"""
struct HW {
  float h(float2 p) { return frac(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
  float n(float2 p) { float2 i = floor(p); float2 f = frac(p); f = f * f * (3 - 2 * f);
    return lerp(lerp(h(i), h(i + float2(1, 0)), f.x), lerp(h(i + float2(0, 1)), h(i + float2(1, 1)), f.x), f.y); }
  float lum(float3 c) { return dot(c, float3(0.299, 0.587, 0.114)); }
  float3 col(float2 uv) { return SceneTextureLookup(uv, 14, false).rgb; }
  float dep(float2 uv) { return SceneTextureLookup(uv, 1, false).r; }
  float3 kuw(float2 uv, float2 px, int R) {
    float3 m0 = 0, m1 = 0, m2 = 0, m3 = 0, s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    [loop] for (int j = -R; j <= R; j++) { [loop] for (int i = -R; i <= R; i++) {
      float3 c = col(uv + float2(i, j) * px); float3 cc = c * c;
      if (i <= 0 && j <= 0) { m0 += c; s0 += cc; }
      if (i >= 0 && j <= 0) { m1 += c; s1 += cc; }
      if (i <= 0 && j >= 0) { m2 += c; s2 += cc; }
      if (i >= 0 && j >= 0) { m3 += c; s3 += cc; } } }
    float k = (R + 1) * (R + 1);
    m0 /= k; m1 /= k; m2 /= k; m3 /= k;
    float v0 = dot(s0 / k - m0 * m0, 1), v1 = dot(s1 / k - m1 * m1, 1), v2 = dot(s2 / k - m2 * m2, 1), v3 = dot(s3 / k - m3 * m3, 1);
    float3 r = m0; float v = v0;
    if (v1 < v) { v = v1; r = m1; } if (v2 < v) { v = v2; r = m2; } if (v3 < v) { v = v3; r = m3; }
    return r; }
  float edge(float2 uv, float2 px, float w) {
    float d = max(dep(uv), 1);
    float dz = abs(dep(uv - float2(px.x, 0) * w) - dep(uv + float2(px.x, 0) * w)) + abs(dep(uv - float2(0, px.y) * w) - dep(uv + float2(0, px.y) * w));
    float l = abs(lum(col(uv - float2(px.x, 0) * w)) - lum(col(uv + float2(px.x, 0) * w))) + abs(lum(col(uv - float2(0, px.y) * w)) - lum(col(uv + float2(0, px.y) * w)));
    return saturate(smoothstep(0.02, 0.08, dz / d) + smoothstep(0.10, 0.30, l)); }
  float lumEdge(float2 uv, float2 px, float w) {
    return smoothstep(0.08, 0.25, abs(lum(col(uv - float2(px.x, 0) * w)) - lum(col(uv + float2(px.x, 0) * w))) + abs(lum(col(uv - float2(0, px.y) * w)) - lum(col(uv + float2(0, px.y) * w)))); }
  // brush strokes: streaks aligned to a slowly turning direction field
  float stroke(float2 uv, float len, float wid) {
    float a = n(uv * float2(7, 4)) * 6.2832 + (n(uv * float2(33, 19)) - 0.5) * 1.4;
    float2 d = float2(cos(a), sin(a)); float2 q = float2(dot(uv, d), dot(uv, float2(-d.y, d.x)));
    return n(q * float2(len, wid)) * 0.6 + n(q * float2(len * 2.3, wid * 2.1) + 13) * 0.4; }
};
HW f;
float2 uv = GetDefaultSceneTextureUV(Parameters, 14);
float2 px = View.BufferSizeAndInvSize.zw;
"""

LOOKS = {
    "STYLE_1_Oil": r"""
float3 k = f.kuw(uv, px * 1.8, 5);
float st = f.stroke(uv, 90, 900);
k *= 0.86 + 0.28 * st;
k = lerp(k, floor(k * 16 + 0.5) / 16, 0.25);
k *= 1 - 0.2 * f.lumEdge(uv, px, 1.5);
return k;""",
    "STYLE_2_Webtoon": r"""
float3 c = f.kuw(uv, px, 2);
float l = f.lum(c);
float b = 0.06 + 0.2 * smoothstep(0.10, 0.14, l) + 0.28 * smoothstep(0.32, 0.36, l) + 0.3 * smoothstep(0.62, 0.66, l);
float3 o = saturate(c / max(l, 1e-3) * b);
o = lerp(o, c, 0.3);
o *= 1 - 0.85 * f.edge(uv, px, 1.2);
return o;""",
    "STYLE_3_InkWash": r"""
float3 c = f.kuw(uv, px * 2, 3);
float l = f.lum(c);
float3 wash = lerp(float3(l, l * 0.97, l * 0.93), c, 0.5);
float p = f.n(uv * float2(700, 400)) * 0.6 + f.n(uv * float2(2100, 1200)) * 0.4;
wash = (wash * 0.82 + 0.1) * (0.9 + 0.14 * p);
float2 j = (float2(f.n(uv * 90), f.n(uv * 90 + 17)) - 0.5) * px * 3;
float e = f.edge(uv + j, px, 1.8);
wash = lerp(wash, float3(0.05, 0.035, 0.03), e * 0.9);
return wash;""",
    "STYLE_4_Halftone": r"""
float3 c;
c.r = f.col(uv + float2(2.5, 0) * px).r; c.g = f.col(uv).g; c.b = f.col(uv - float2(2.5, 0) * px).b;
c = floor(c * 5 + 0.5) / 5;
float l = f.lum(c);
float2 pp = uv / px; float2 r = float2(pp.x + pp.y, pp.y - pp.x) * 0.7071;
float cell = 7; float2 g = frac(r / cell) - 0.5;
float dotr = saturate(1 - l * 1.6) * 0.62;
float inkdot = step(length(g), dotr);
c *= 1 - 0.6 * inkdot * step(l, 0.55);
c *= 1 - 0.95 * f.edge(uv, px, 1.6);
return c;""",
    "STYLE_5_DarkMatte": r"""
float3 c = f.kuw(uv, px * 1.4, 4);
float l = f.lum(c);
c = lerp(c * float3(0.78, 0.72, 1.05), c * float3(1.2, 0.88, 0.62), smoothstep(0.15, 0.75, l));
c = pow(max(c, 0), 1.12);
c *= 0.88 + 0.24 * f.stroke(uv, 60, 700);
float v = 1 - 0.6 * pow(saturate(length(uv - 0.5) * 1.35), 2.2);
c *= v;
c += (f.h(uv * 1731.0) - 0.5) * 0.035;
c *= 1 - 0.15 * f.lumEdge(uv, px, 1.4);
return c;""",
}


def after_tonemap():
    for n in ("SCENE_COLOR_AFTER_TONEMAPPING", "BL_SCENE_COLOR_AFTER_TONEMAPPING", "AFTER_TONEMAPPING"):
        if hasattr(unreal.BlendableLocation, n):
            return getattr(unreal.BlendableLocation, n)
    raise RuntimeError("no after-tonemapping blendable location: " + ", ".join(dir(unreal.BlendableLocation)))


def post_material(name, body):
    m = fresh_material("PP_" + name)
    m.set_editor_property("material_domain", unreal.MaterialDomain.MD_POST_PROCESS)
    m.set_editor_property("blendable_location", after_tonemap())
    st = mel.create_material_expression(m, unreal.MaterialExpressionSceneTexture, -800, 0)
    st.set_editor_property("scene_texture_id", unreal.SceneTextureId.PPI_POST_PROCESS_INPUT0)
    cu = custom(m, HELP + body, unreal.CustomMaterialOutputType.CMOT_FLOAT3, ["C"])
    mel.connect_material_expressions(st, "Color", cu, "C")
    mel.connect_material_property(cu, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    return m


def unlit(name, code, inputs, blend=None, two_sided=True):
    """Unlit surface material whose emissive (and opacity for translucent) come from one Custom node."""
    m = fresh_material(name)
    m.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    m.set_editor_property("two_sided", two_sided)
    if blend:
        m.set_editor_property("blend_mode", blend)
    return m


def sky_material():
    m = unlit("M_Sky_Hwanghon", "", [])
    m.set_editor_property("is_sky", True)   # the height fog must not wash the sky out
    cv = mel.create_material_expression(m, unreal.MaterialExpressionCameraVectorWS, -800, 0)
    cu = custom(m, r"""
float3 d = -normalize(D);
float t = saturate(d.z * 2.2 + 0.06);
float3 horizon = float3(0.80, 0.11, 0.05);
float3 mid = float3(0.30, 0.05, 0.22);
float3 top = float3(0.045, 0.02, 0.10);
float3 c = lerp(horizon, mid, smoothstep(0.0, 0.3, t));
c = lerp(c, top, smoothstep(0.28, 1.0, t));
float3 sun = normalize(float3(1, -0.15, 0.06));
float g = pow(saturate(dot(d, sun)), 24);
c += float3(1.4, 0.45, 0.2) * g + float3(0.5, 0.1, 0.1) * pow(saturate(dot(d, sun)), 4);
float2 q = d.xy / max(d.z + 0.25, 0.05);
float band = sin(q.y * 6 + sin(q.x * 3) * 1.5) * 0.5 + 0.5;
c *= lerp(1.0, 0.62 + 0.55 * band, smoothstep(0.04, 0.35, t));
return c * 0.55;""", unreal.CustomMaterialOutputType.CMOT_FLOAT3, ["D"])
    mel.connect_material_expressions(cv, "", cu, "D")
    mel.connect_material_property(cu, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    return m


def fog_material():
    """Knee-high red fog (L55): stacked translucent sheets, soft where they cut the body and the roof."""
    m = unlit("M_RedFog_Sheet", "", [], blend=unreal.BlendMode.BLEND_TRANSLUCENT)
    wp = mel.create_material_expression(m, unreal.MaterialExpressionWorldPosition, -900, 200)
    cu = custom(m, r"""
float2 p = P.xy / 220 + P.z * 0.13;
float a = frac(sin(dot(floor(p), float2(12.9898, 78.233))) * 43758.5453);
float2 i = floor(p); float2 fr = frac(p); fr = fr * fr * (3 - 2 * fr);
float h00 = frac(sin(dot(i, float2(12.9898, 78.233))) * 43758.5453);
float h10 = frac(sin(dot(i + float2(1, 0), float2(12.9898, 78.233))) * 43758.5453);
float h01 = frac(sin(dot(i + float2(0, 1), float2(12.9898, 78.233))) * 43758.5453);
float h11 = frac(sin(dot(i + float2(1, 1), float2(12.9898, 78.233))) * 43758.5453);
float nz = lerp(lerp(h00, h10, fr.x), lerp(h01, h11, fr.x), fr.y);
return 0.02 + 0.30 * smoothstep(0.45, 0.95, nz);""", unreal.CustomMaterialOutputType.CMOT_FLOAT1, ["P"], -600, 200)
    mel.connect_material_expressions(wp, "", cu, "P")
    df = mel.create_material_expression(m, unreal.MaterialExpressionDepthFade, -400, 350)
    df.set_editor_property("fade_distance_default", 40.0)
    mul = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -200, 250)
    mel.connect_material_expressions(cu, "", mul, "A")
    mel.connect_material_expressions(df, "", mul, "B")
    mel.connect_material_property(mul, "", unreal.MaterialProperty.MP_OPACITY)
    c3 = mel.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -400, 0)
    c3.set_editor_property("constant", unreal.LinearColor(0.45, 0.04, 0.03, 1))
    mel.connect_material_property(c3, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    return m


def lit_material(name, rgb, var=0.35, scale=180.0):
    """Default-lit surface with world-space blotches, so a painterly filter has something to paint."""
    m = fresh_material(name)
    wp = mel.create_material_expression(m, unreal.MaterialExpressionWorldPosition, -900, 0)
    cu = custom(m, rf"""
float2 p = (P.xy + P.z * 0.7) / {scale};
float2 i = floor(p); float2 fr = frac(p); fr = fr * fr * (3 - 2 * fr);
float h00 = frac(sin(dot(i, float2(12.9898, 78.233))) * 43758.5453);
float h10 = frac(sin(dot(i + float2(1, 0), float2(12.9898, 78.233))) * 43758.5453);
float h01 = frac(sin(dot(i + float2(0, 1), float2(12.9898, 78.233))) * 43758.5453);
float h11 = frac(sin(dot(i + float2(1, 1), float2(12.9898, 78.233))) * 43758.5453);
float nz = lerp(lerp(h00, h10, fr.x), lerp(h01, h11, fr.x), fr.y);
return float3({rgb[0]}, {rgb[1]}, {rgb[2]}) * (1 - {var} + {var} * 2 * nz);""",
               unreal.CustomMaterialOutputType.CMOT_FLOAT3, ["P"], -600, 0)
    mel.connect_material_expressions(wp, "", cu, "P")
    mel.connect_material_property(cu, "", unreal.MaterialProperty.MP_BASE_COLOR)
    r = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -400, 200)
    r.set_editor_property("r", 0.85)
    mel.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    return m


def city_material():
    """Dead towers: concrete with a window grid (dark, some panes gone) — texture a painter can pick up."""
    m = fresh_material("M_City")
    wp = mel.create_material_expression(m, unreal.MaterialExpressionWorldPosition, -900, 0)
    cu = custom(m, r"""
float u = (P.x + P.y) / 260.0; float v = P.z / 340.0;
float2 cell = floor(float2(u, v)); float2 fr = frac(float2(u, v));
float win = step(0.18, fr.x) * step(fr.x, 0.82) * step(0.22, fr.y) * step(fr.y, 0.78);
float r = frac(sin(dot(cell, float2(12.9898, 78.233))) * 43758.5453);
float3 wall = float3(0.075, 0.062, 0.068) * (0.8 + 0.4 * frac(sin(dot(floor(float2(u, v) / 6), float2(4.1, 7.3))) * 921.7));
float3 glass = lerp(float3(0.02, 0.018, 0.028), float3(0.09, 0.05, 0.07), step(0.7, r));
return lerp(wall, glass, win * step(0.12, r));""", unreal.CustomMaterialOutputType.CMOT_FLOAT3, ["P"], -600, 0)
    mel.connect_material_expressions(wp, "", cu, "P")
    mel.connect_material_property(cu, "", unreal.MaterialProperty.MP_BASE_COLOR)
    r = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -400, 200)
    r.set_editor_property("r", 0.9)
    mel.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    return m


def emissive_material(name, rgb, strength):
    m = unlit(name, "", [])
    c3 = mel.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -400, 0)
    c3.set_editor_property("constant", unreal.LinearColor(rgb[0] * strength, rgb[1] * strength, rgb[2] * strength, 1))
    mel.connect_material_property(c3, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    return m


def box(label, mesh, loc, scale, material, rot=(0, 0, 0), cast=True):
    a = eas.spawn_actor_from_object(unreal.load_asset(mesh), unreal.Vector(*loc),
                                    unreal.Rotator(roll=rot[2], pitch=rot[0], yaw=rot[1]))
    a.set_actor_label(label)
    a.set_actor_scale3d(unreal.Vector(*scale))
    smc = a.static_mesh_component
    smc.set_material(0, material)
    smc.set_editor_property("cast_shadow", cast)
    return a


def build():
    random.seed(4)
    M = {
        "roof": lit_material("M_Roof", (0.07, 0.062, 0.062), 0.5, 120.0),
        "wall": lit_material("M_Parapet", (0.2, 0.19, 0.18), 0.35, 90.0),
        "metal": lit_material("M_Rust", (0.16, 0.07, 0.04), 0.5, 60.0),
        "city": city_material(),
        "core": emissive_material("M_SpineCore", (1.0, 0.42, 0.08), 3.0),
    }
    # Roof: 40 x 40 m, top at z = 0. Ain stands near the east parapet looking over the city (+X).
    box("Roof", CUBE, (0, 0, -50), (40, 40, 1), M["roof"])
    for label, loc, sc in (("Parapet_E", (2000, 0, 22), (0.4, 40, 0.45)), ("Parapet_N", (0, 2000, 55), (40, 0.3, 1.1)),
                           ("Parapet_S", (0, -2000, 55), (40, 0.3, 1.1)), ("Parapet_W", (-2000, 0, 55), (0.3, 40, 1.1))):
        box(label, CUBE, loc, sc, M["wall"])
    box("StairHouse", CUBE, (-900, 700, 160), (5, 4, 3.2), M["wall"])
    box("Tank", CYL, (-300, -900, 250), (3.2, 3.2, 3.6), M["metal"])
    for k, (x, y) in enumerate(((-300, -1060), (-300, -740), (-140, -900), (-460, -900))):
        box(f"TankLeg_{k}", CUBE, (x, y, 35), (0.15, 0.15, 0.7), M["metal"])
    for k, (x, y, h) in enumerate(((600, 1500, 9), (-1500, -300, 6), (1200, -1600, 11))):
        box(f"Antenna_{k}", CYL, (x, y, h * 50), (0.06, 0.06, h), M["metal"])
    box("Pipe_A", CYL, (600, -1200, 40), (0.35, 0.35, 14), M["metal"], rot=(90, 90, 0))
    for k in range(18):
        x, y = random.uniform(-1600, 1800), random.uniform(-1700, 1700)
        box(f"Rubble_{k}", CUBE, (x, y, 8), (random.uniform(0.2, 1.1), random.uniform(0.2, 0.9), random.uniform(0.1, 0.35)),
            M["wall"], rot=(0, random.uniform(0, 90), random.uniform(-8, 8)))
    # The city (TBD_CANON layout): we stand on a tall tower in Gangnam. The near city is far below the roof;
    # only the distant skyline rises into the haze. Broken crowns and masts break the box silhouettes.
    for k in range(260):
        ang = random.uniform(-75, 75) if k < 220 else random.uniform(0, 360)
        dist = random.uniform(9000, 90000)
        x, y = math.cos(math.radians(ang)) * dist, math.sin(math.radians(ang)) * dist
        w, d = random.uniform(15, 50), random.uniform(15, 45)
        if dist < 25000:
            top = random.uniform(-9000, -2500)
        elif dist < 50000:
            top = random.uniform(-6000, 800)
        else:
            top = random.uniform(-2000, 6000)
        base = -20000
        yaw = random.uniform(0, 90)
        box(f"City_{k:03d}", CUBE, (x, y, (base + top) / 2), (w, d, (top - base) / 100), M["city"], rot=(0, yaw, 0), cast=False)
        r = random.random()
        if r < 0.35:   # broken crown
            box(f"Crown_{k:03d}", CUBE, (x + random.uniform(-300, 300), y, top + 300), (w * 0.5, d * 0.6, 6), M["city"],
                rot=(random.uniform(-9, 9), yaw, random.uniform(-9, 9)), cast=False)
        elif r < 0.55:  # mast
            box(f"Mast_{k:03d}", CYL, (x, y, top + 1500), (0.6, 0.6, 30), M["city"], cast=False)
    # Sky
    sky = eas.spawn_actor_from_object(unreal.load_asset(SKY), unreal.Vector(0, 0, 0), unreal.Rotator())
    sky.set_actor_label("Sky")
    sky.set_actor_scale3d(unreal.Vector(400, 400, 400))
    sky.static_mesh_component.set_material(0, sky_material())
    sky.static_mesh_component.set_editor_property("cast_shadow", False)
    # Red fog to the knee (L55): sheets from 4 cm to 52 cm
    fog = fog_material()
    for k, z in enumerate((6, 18, 32, 48)):
        box(f"Fog_{k}", PLANE, (0, 0, z), (60, 60, 1), fog, cast=False)
    hf = eas.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, -6000), unreal.Rotator())
    hc = hf.component
    hc.set_editor_property("fog_density", 0.02)
    hc.set_editor_property("fog_height_falloff", 0.12)
    hc.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.32, 0.06, 0.13, 1))
    hc.set_editor_property("fog_max_opacity", 0.9)
    hc.set_editor_property("start_distance", 3000.0)
    # Light: the low twilight sun behind the city (she is a silhouette against it), purple ambient from the sky.
    sun = eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 500), unreal.Rotator(roll=0, pitch=-7, yaw=172))
    sc = sun.light_component
    sc.set_intensity(5.0)
    sc.set_light_color(unreal.LinearColor(1.0, 0.38, 0.22, 1))
    sl = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator())
    slc = sl.light_component
    slc.set_editor_property("real_time_capture", True)
    slc.set_intensity(0.45)
    slc.set_light_color(unreal.LinearColor(0.8, 0.55, 0.9, 1))
    return M


def place_ain(M):
    mesh = unreal.load_asset(AIN_MESH)
    idle = unreal.load_asset(AIN_IDLE)
    a = eas.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(1880, -40, 0), unreal.Rotator(roll=0, pitch=0, yaw=-104))
    a.set_actor_label("Ain")
    c = a.skeletal_mesh_component
    c.set_skeletal_mesh_asset(mesh)
    ext = mesh.get_bounds().box_extent
    s = 168.0 / max(1.0, ext.z * 2)
    a.set_actor_scale3d(unreal.Vector(s, s, s))
    c.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
    pd = unreal.SingleAnimationPlayData()
    pd.set_editor_property("anim_to_play", idle)
    pd.set_editor_property("saved_position", 0.6)
    pd.set_editor_property("saved_play_rate", 0.0)
    c.set_editor_property("animation_data", pd)
    log(f"Ain mesh extent z {ext.z:.1f} -> scale {s:.3f}")
    # Spine core (L57-L61): an orange line down the back that pulses with the heart. Glow only; the model has none.
    # the line itself: a thin emissive strip down the back (the light alone lit her whole body gold)
    strip = eas.spawn_actor_from_object(unreal.load_asset(CYL), unreal.Vector(1866, -37, 122), unreal.Rotator())
    strip.set_actor_label("SpineCoreLine")
    strip.set_actor_scale3d(unreal.Vector(0.012, 0.012, 0.40))
    strip.static_mesh_component.set_material(0, M["core"])
    strip.static_mesh_component.set_editor_property("cast_shadow", False)
    core = eas.spawn_actor_from_class(unreal.PointLight, unreal.Vector(1858, -37, 125), unreal.Rotator())
    core.set_actor_label("SpineCoreGlow")
    core.point_light_component.set_intensity(0.25)
    core.point_light_component.set_light_color(unreal.LinearColor(1.0, 0.42, 0.08, 1))
    core.point_light_component.set_attenuation_radius(45.0)
    return a


def camera():
    loc = unreal.Vector(1230, 300, 165)
    look = unreal.Vector(12000, -4200, 520)
    rot = unreal.MathLibrary.find_look_at_rotation(loc, look)
    cam = eas.spawn_actor_from_class(unreal.CineCameraActor, loc, rot)
    cam.set_actor_label("STYLE_CAM")
    cam.tags = ["STYLE_CAM"]
    cc = cam.get_cine_camera_component()
    cc.set_editor_property("current_focal_length", 32.0)
    fs = cc.get_editor_property("focus_settings")
    fs.set_editor_property("focus_method", unreal.CameraFocusMethod.DISABLE)
    cc.set_editor_property("focus_settings", fs)
    return cam


def post_volumes():
    base = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 200), unreal.Rotator())
    base.set_actor_label("STYLE_BASE")
    base.tags = ["STYLE_BASE"]
    base.set_editor_property("unbound", True)
    pp = base.get_editor_property("settings")
    for k, v in (("auto_exposure_min_brightness", 1.0), ("auto_exposure_max_brightness", 1.0), ("auto_exposure_bias", 0.5),
                 ("bloom_intensity", 0.6), ("vignette_intensity", 0.25)):
        pp.set_editor_property("override_" + k, True)
        pp.set_editor_property(k, v)
    base.set_editor_property("settings", pp)
    for k, (name, body) in enumerate(LOOKS.items()):
        m = post_material(name, body)
        v = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 220 + k * 10), unreal.Rotator())
        v.set_actor_label(name)
        v.tags = [name]
        v.set_editor_property("unbound", True)
        v.set_editor_property("enabled", False)
        v.set_editor_property("priority", 1.0 + k)
        s = v.get_editor_property("settings")
        wb = unreal.WeightedBlendable()
        wb.set_editor_property("weight", 1.0)
        wb.set_editor_property("object", m)
        blends = unreal.WeightedBlendables()
        blends.set_editor_property("array", [wb])
        s.set_editor_property("weighted_blendables", blends)
        v.set_editor_property("settings", s)
        log(f"look {name}")


def main():
    lib.make_directory(ROOT)
    lib.make_directory(MAT)
    # Rebuild in place: deleting a map asset and re-creating it at the same path fails ("already exists"),
    # and the actors then land in whatever level is open.
    if lib.does_asset_exist(MAP):
        les.load_level(MAP)
        for a in eas.get_all_level_actors():
            if not isinstance(a, unreal.WorldSettings):
                eas.destroy_actor(a)
    elif not les.new_level(MAP, False):
        raise RuntimeError("new_level failed: " + MAP)
    ws = unreal.EditorLevelLibrary.get_editor_world().get_world_settings()
    ws.set_editor_property("default_game_mode", unreal.GameModeBase.static_class())
    M = build()
    place_ain(M)
    camera()
    post_volumes()
    les.save_current_level()
    log(f"saved {MAP}")


main()
