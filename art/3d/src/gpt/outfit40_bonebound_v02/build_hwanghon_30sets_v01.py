import os, math, json, zipfile, shutil, random
from pathlib import Path
import numpy as np
import trimesh
from PIL import Image, ImageDraw
from shapely.geometry import Polygon
from shapely.ops import triangulate
from trimesh.transformations import rotation_matrix
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT=Path('/mnt/data/hwanghon_30sets_glb')
MODELS=ROOT/'models'; PREV=ROOT/'preview'; TEX=ROOT/'textures'
for p in [ROOT,MODELS,PREV,TEX]: p.mkdir(parents=True,exist_ok=True)

# ---------- Embedded texture + PBR materials ----------
def make_pattern(name, rgb, rough=0.6, metal=0.0, kind='fabric'):
    rng=np.random.default_rng(abs(hash(name))%(2**32))
    s=96
    arr=np.zeros((s,s,3),dtype=np.uint8); arr[:]=rgb
    noise=rng.normal(0,8,(s,s,1))
    arr=np.clip(arr.astype(float)+noise,0,255).astype(np.uint8)
    if kind=='fabric':
        for i in range(0,s,8): arr[:,i:i+1]=np.clip(arr[:,i:i+1].astype(int)+10,0,255)
        for i in range(0,s,11): arr[i:i+1,:]=np.clip(arr[i:i+1,:].astype(int)-8,0,255)
    elif kind=='metal':
        for i in range(0,s,6): arr[:,i:i+1]=np.clip(arr[:,i:i+1].astype(int)+12,0,255)
        # scratches
        for _ in range(22):
            x=rng.integers(0,s); y=rng.integers(0,s); l=rng.integers(6,22)
            arr[y:min(s,y+1),max(0,x-l):min(s,x+l)] = np.clip(arr[y:min(s,y+1),max(0,x-l):min(s,x+l)].astype(int)+22,0,255)
    elif kind=='rubber':
        for i in range(0,s,5): arr[i:i+1,:]=np.clip(arr[i:i+1,:].astype(int)+5,0,255)
    base=Image.fromarray(arr,'RGB')
    # glTF metallic-roughness texture: G=roughness, B=metallic
    mr=np.zeros((s,s,3),dtype=np.uint8); mr[:,:,1]=int(np.clip(rough,0,1)*255); mr[:,:,2]=int(np.clip(metal,0,1)*255)
    mr=Image.fromarray(mr,'RGB')
    normal=np.zeros((s,s,3),dtype=np.uint8); normal[:]=[128,128,255]
    normal=Image.fromarray(normal,'RGB')
    base.save(TEX/f'{name}_base.png'); mr.save(TEX/f'{name}_mr.png'); normal.save(TEX/f'{name}_normal.png')
    return PBRMaterial(name=name, baseColorTexture=base, metallicRoughnessTexture=mr, normalTexture=normal,
                       baseColorFactor=[1,1,1,1], metallicFactor=float(metal), roughnessFactor=float(rough))

MATS={
 'black_fabric':make_pattern('black_fabric',(25,26,29),0.82,0.02,'fabric'),
 'graphite_fabric':make_pattern('graphite_fabric',(48,50,54),0.78,0.02,'fabric'),
 'white_fabric':make_pattern('white_fabric',(188,190,187),0.78,0.01,'fabric'),
 'offwhite_fabric':make_pattern('offwhite_fabric',(145,147,145),0.80,0.01,'fabric'),
 'red_textile':make_pattern('red_textile',(93,22,24),0.72,0.01,'fabric'),
 'orange_textile':make_pattern('orange_textile',(138,57,22),0.70,0.01,'fabric'),
 'black_steel':make_pattern('black_steel',(40,43,47),0.30,0.82,'metal'),
 'brushed_steel':make_pattern('brushed_steel',(125,130,134),0.28,0.92,'metal'),
 'dark_steel':make_pattern('dark_steel',(66,69,72),0.35,0.80,'metal'),
 'copper':make_pattern('copper',(118,68,52),0.30,0.84,'metal'),
 'rubber':make_pattern('rubber',(20,21,22),0.90,0.0,'rubber'),
 'medical_red':make_pattern('medical_red',(142,30,33),0.68,0.02,'fabric'),
 'cyan':make_pattern('cyan',(34,180,190),0.22,0.15,'metal'),
}

BASECOL={
 'black_fabric':'#1c1d20','graphite_fabric':'#34373b','white_fabric':'#c4c5c1','offwhite_fabric':'#969894',
 'red_textile':'#64191c','orange_textile':'#8d401c','black_steel':'#34383d','brushed_steel':'#8b9195','dark_steel':'#555a5e',
 'copper':'#855246','rubber':'#171819','medical_red':'#9b252a','cyan':'#37a8b3'}

def uv_project(mesh):
    v=mesh.vertices
    if len(v)==0: return np.zeros((0,2))
    # simple cylindrical/planar hybrid based on bbox dominant extents
    e=np.maximum(mesh.extents,1e-6)
    ax=np.argsort(e)[-2:]
    uv=np.zeros((len(v),2),float)
    for j,a in enumerate(ax):
        mn=v[:,a].min(); mx=v[:,a].max(); uv[:,j]=(v[:,a]-mn)/(mx-mn+1e-9)
    return uv

def apply_mat(mesh, key):
    mesh.visual=TextureVisuals(uv=uv_project(mesh), material=MATS[key])
    mesh.metadata['mat_key']=key
    return mesh

def box(ext, ctr, mat='black_fabric', rot=None):
    m=trimesh.creation.box(extents=ext)
    if rot is not None: m.apply_transform(rot)
    m.apply_translation(ctr); return apply_mat(m,mat)

def cyl(radius,height,ctr,mat='black_fabric',sections=24,axis='y'):
    m=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
    if axis=='y': m.apply_transform(rotation_matrix(math.pi/2,[1,0,0]))
    elif axis=='x': m.apply_transform(rotation_matrix(math.pi/2,[0,1,0]))
    m.apply_translation(ctr); return apply_mat(m,mat)

def capsule(radius,height,ctr,mat='black_fabric',sections=16,axis='y'):
    m=trimesh.creation.capsule(height=max(0.01,height-2*radius),radius=radius,count=[sections,sections])
    if axis=='y': m.apply_transform(rotation_matrix(math.pi/2,[1,0,0]))
    elif axis=='x': m.apply_transform(rotation_matrix(math.pi/2,[0,1,0]))
    m.apply_translation(ctr); return apply_mat(m,mat)

def ring(rmin,rmax,height,ctr,mat='dark_steel',sections=32,axis='z'):
    m=trimesh.creation.annulus(r_min=rmin,r_max=rmax,height=height,sections=sections)
    if axis=='y': m.apply_transform(rotation_matrix(math.pi/2,[1,0,0]))
    elif axis=='x': m.apply_transform(rotation_matrix(math.pi/2,[0,1,0]))
    m.apply_translation(ctr); return apply_mat(m,mat)

def extruded_xy(poly_pts, thickness, ctr=(0,0,0), mat='brushed_steel'):
    p=Polygon(poly_pts)
    tris=[tr for tr in triangulate(p) if p.covers(tr.representative_point())]
    pts=[]; idx={}
    def vid(q,z):
        k=(round(float(q[0]),8),round(float(q[1]),8),round(float(z),8))
        if k not in idx: idx[k]=len(pts); pts.append([q[0],q[1],z])
        return idx[k]
    faces=[]
    for tr in tris:
        cc=list(tr.exterior.coords)[:3]
        a,b,c=[vid(q,-thickness/2) for q in cc]; faces.append([a,c,b])
        a,b,c=[vid(q, thickness/2) for q in cc]; faces.append([a,b,c])
    rr=list(p.exterior.coords)[:-1]
    for i,q0 in enumerate(rr):
        q1=rr[(i+1)%len(rr)]
        a0=vid(q0,-thickness/2); a1=vid(q1,-thickness/2); b0=vid(q0,thickness/2); b1=vid(q1,thickness/2)
        faces += [[a0,a1,b1],[a0,b1,b0]]
    m=trimesh.Trimesh(vertices=np.asarray(pts,float),faces=np.asarray(faces,int),process=True)
    m.apply_translation(ctr); return apply_mat(m,mat)

def scene(items, meta=None):
    s=trimesh.Scene()
    if meta: s.metadata.update(meta)
    for name,m in items: s.add_geometry(m,node_name=name,geom_name=name)
    return s

def add(items,name,mesh): items.append((name,mesh))

def add_tie(items,name,x,y,z,length=0.36,mat='red_textile',tilt=0.0):
    add(items,name,box([0.035,length,0.012],[x,y-length/2,z],mat,rotation_matrix(tilt,[0,0,1])))

def add_pouch(items,name,x,y,z,w=0.12,h=0.17,d=0.07,mat='black_fabric'):
    add(items,name,box([w,h,d],[x,y,z],mat))
    add(items,name+'_flap',box([w*0.92,h*0.22,d*1.08],[x,y+h*.25,z+d*.03],'dark_steel'))

def add_buckle(items,name,x,y,z,scale=1.0,mat='brushed_steel'):
    add(items,name,box([.07*scale,.055*scale,.024*scale],[x,y,z],mat))
    add(items,name+'_cut',box([.035*scale,.028*scale,.029*scale],[x,y,z+.002],'rubber'))

# ---------- weapons ----------
def greatsword(items, variant, x=-0.55, z=-0.03, height=1.72, width=0.23):
    # blade from y .35 to height
    poly=[(-width*.42,.35),(-width*.54,.48),(-width*.50,height*.78),(-width*.27,height*.93),(0,height),
          (width*.27,height*.93),(width*.50,height*.78),(width*.54,.48),(width*.42,.35)]
    add(items,'weapon_greatsword_blade',extruded_xy(poly,.045,[x,0,z],'brushed_steel'))
    # dark central spine
    add(items,'weapon_greatsword_spine',box([width*.36,height*.74,.055],[x,.95,z-.004],'black_steel'))
    add(items,'weapon_greatsword_guard',box([width*1.2,.055,.07],[x,.35,z],'dark_steel'))
    add(items,'weapon_greatsword_grip',cyl(.032,.28,[x,.19,z],'rubber',20,'y'))
    add(items,'weapon_greatsword_pommel',cyl(.047,.07,[x,.04,z],'copper',20,'y'))
    add(items,'weapon_greatsword_status',box([.018,.25,.008],[x+width*.2,.84,z+.031],'cyan'))
    if variant in (2,5,7):
        add(items,'weapon_greatsword_reinforce',box([width*.92,.08,.06],[x,.60,z+.005],'black_steel'))
    if variant in (9,10): add_tie(items,'weapon_red_tag',x+width*.47,.43,z+.06,.28,'red_textile')

def twin_daggers(items,variant):
    for side in (-1,1):
        x=.38*side; y=.86; z=.10
        h=.40; w=.055
        poly=[(-w,.0),(-w*.75,.25),(0,h),(w*.75,.25),(w,0)]
        m=extruded_xy(poly,.018,[x,y-h*.25,z],'brushed_steel')
        # slight outward tilt
        m.apply_transform(rotation_matrix(-side*.22,[0,0,1],point=[x,y,z]))
        add(items,f'weapon_dagger_{"L" if side<0 else "R"}_blade',m)
        add(items,f'weapon_dagger_{"L" if side<0 else "R"}_grip',cyl(.018,.18,[x,y-.22,z],'rubber',16,'y'))
        add(items,f'weapon_dagger_{"L" if side<0 else "R"}_status',box([.012,.07,.012],[x,y-.18,z+.02],'cyan'))
    if variant in (5,7):
        add(items,'weapon_cable_spool',cyl(.07,.045,[.34,.74,-.10],'black_steel',24,'z'))

def sera_rings(items,variant):
    for side in (-1,1):
        x=.43*side; y=1.00; z=.03
        add(items,f'weapon_purifier_ring_{"L" if side<0 else "R"}',ring(.085,.115,.025,[x,y,z],'brushed_steel',32,'z'))
        add(items,f'weapon_ring_core_{"L" if side<0 else "R"}',ring(.03,.052,.030,[x,y,z+.005],'cyan',24,'z'))
        # wire connection to belt
        add(items,f'weapon_wire_{"L" if side<0 else "R"}',cyl(.006,.44,[x*.72,.82,z-.05],'rubber',10,'y'))
    if variant in (2,6,8):
        add(items,'weapon_filter_canister',cyl(.055,.20,[.31,.88,-.11],'dark_steel',24,'y'))

# ---------- common wearable shells ----------
def base_outfit(items, char, H, cfg):
    # char proportions
    if char=='kain': shoulder=.56; torso_w=.48; depth=.24; armx=.32; legx=.14; leg_r=.085
    elif char=='sera': shoulder=.43; torso_w=.37; depth=.18; armx=.25; legx=.105; leg_r=.065
    else: shoulder=.46; torso_w=.40; depth=.19; armx=.27; legx=.115; leg_r=.070
    scale=H/1.72
    # feet / legs
    sole_y=.035; boot_h=.20*scale
    for side in (-1,1):
        sx=side*legx*scale
        add(items,f'boot_{side:+d}',box([.15*scale,boot_h,.28*scale],[sx,sole_y+boot_h/2,.055*scale],'rubber'))
        add(items,f'boot_sole_{side:+d}',box([.165*scale,.05*scale,.30*scale],[sx,.025*scale,.065*scale],'black_steel'))
        add(items,f'leg_{side:+d}',capsule(leg_r*scale,.54*scale,[sx,.55*scale,0],'black_fabric',14,'y'))
        if cfg.get('shin',True): add(items,f'shin_plate_{side:+d}',box([.13*scale,.32*scale,.085*scale],[sx,.51*scale,.055*scale],cfg.get('armor_mat','black_steel')))
        if cfg.get('knee',False): add(items,f'knee_{side:+d}',box([.15*scale,.12*scale,.12*scale],[sx,.73*scale,.06*scale],cfg.get('armor_mat','black_steel')))
    # torso
    torso_y=1.18*scale
    mat=cfg.get('body_mat','black_fabric')
    add(items,'torso_shell',box([torso_w*scale,.47*scale,depth*scale],[0,torso_y,0],mat))
    add(items,'shoulder_yoke',box([shoulder*scale,.11*scale,(depth+.02)*scale],[0,1.43*scale,-.01*scale],mat))
    # diagonal Korean-inspired wrap seam, not historic costume
    if cfg.get('wrap',True):
        seam=box([.045*scale,.55*scale,.018*scale],[-.055*scale,1.17*scale,depth*.55*scale],'red_textile',rotation_matrix(.22,[0,0,1]))
        add(items,'korean_wrap_seam',seam)
    # sleeves / arms
    sleeved=cfg.get('sleeved',True)
    for side in (-1,1):
        sx=side*armx*scale
        if sleeved: add(items,f'sleeve_{side:+d}',capsule(.066*scale,.42*scale,[sx,1.18*scale,0],mat,14,'y'))
        else: add(items,f'upper_arm_guard_{side:+d}',cyl(.073*scale,.17*scale,[sx,1.31*scale,0],cfg.get('armor_mat','black_steel'),18,'y'))
        if cfg.get('forearm',False): add(items,f'forearm_guard_{side:+d}',cyl(.077*scale,.28*scale,[sx,.99*scale,0],cfg.get('armor_mat','black_steel'),18,'y'))
    # belt
    add(items,'utility_belt',box([.48*scale,.075*scale,.11*scale],[0,.91*scale,0],'black_fabric'))
    add_buckle(items,'belt_buckle',0,.91*scale,.065*scale,scale,'brushed_steel')
    # coat/apron
    coat=cfg.get('coat',0.0)
    if coat>0:
        y=.88*scale; h=coat*scale
        add(items,'coat_back',box([.48*scale,h,.055*scale],[0,y-h*.25,-.10*scale],mat))
        add(items,'coat_front_L',box([.19*scale,h*.92,.042*scale],[-.13*scale,y-h*.22,.115*scale],mat))
        add(items,'coat_front_R',box([.19*scale,h*.85,.042*scale],[.13*scale,y-h*.18,.115*scale],mat))
    apron=cfg.get('apron',0.0)
    if apron>0:
        h=apron*scale
        add(items,'split_apron_L',box([.20*scale,h,.035*scale],[-.115*scale,.80*scale-h*.24,.10*scale],cfg.get('apron_mat',mat),rotation_matrix(.05,[0,0,1])))
        add(items,'split_apron_R',box([.20*scale,h*.93,.035*scale],[.115*scale,.80*scale-h*.21,.10*scale],cfg.get('apron_mat',mat),rotation_matrix(-.05,[0,0,1])))
    # pouches
    pc=cfg.get('pouches',2)
    xs=np.linspace(-.28,.28,max(pc,1)) if pc else []
    for i,x in enumerate(xs[:pc]): add_pouch(items,f'pouch_{i}',x*scale,.83*scale,-.01*scale,.105*scale,.16*scale,.07*scale)
    # collar/hood
    collar=cfg.get('collar',False)
    if collar:
        add(items,'high_collar',box([.34*scale,.17*scale,.22*scale],[0,1.57*scale,-.02*scale],mat))
    if cfg.get('hood',False):
        # a hollow-ish hood proxy using three panels
        add(items,'hood_top',box([.30*scale,.16*scale,.24*scale],[0,1.68*scale,-.03*scale],mat))
        add(items,'hood_left',box([.08*scale,.24*scale,.20*scale],[-.13*scale,1.60*scale,0],mat,rotation_matrix(-.15,[0,0,1])))
        add(items,'hood_right',box([.08*scale,.24*scale,.20*scale],[.13*scale,1.60*scale,0],mat,rotation_matrix(.15,[0,0,1])))
    # backpack/exo
    if cfg.get('backpack',False):
        add(items,'backpack',box([.32*scale,.42*scale,.16*scale],[0,1.20*scale,-.19*scale],cfg.get('pack_mat','black_fabric')))
        add(items,'pack_frame_L',box([.025*scale,.44*scale,.025*scale],[-.14*scale,1.20*scale,-.29*scale],'dark_steel'))
        add(items,'pack_frame_R',box([.025*scale,.44*scale,.025*scale],[.14*scale,1.20*scale,-.29*scale],'dark_steel'))
    if cfg.get('exo',False):
        add(items,'exo_spine',box([.045*scale,.62*scale,.045*scale],[0,1.13*scale,-.18*scale],'dark_steel'))
        add(items,'exo_hip_L',box([.18*scale,.045*scale,.05*scale],[-.17*scale,.90*scale,-.08*scale],'dark_steel'))
        add(items,'exo_hip_R',box([.18*scale,.045*scale,.05*scale],[.17*scale,.90*scale,-.08*scale],'dark_steel'))
    # character-specific shoulder treatment
    armor=cfg.get('armor',1)
    if armor:
        if char=='kain':
            for side in (-1,1):
                add(items,f'heavy_shoulder_{side:+d}',box([.22*scale,.17*scale,.22*scale],[side*.31*scale,1.43*scale,0],cfg.get('armor_mat','black_steel'),rotation_matrix(side*.10,[0,0,1])))
                if armor>1: add(items,f'heavy_shoulder_edge_{side:+d}',box([.18*scale,.055*scale,.235*scale],[side*.34*scale,1.35*scale,0],'brushed_steel'))
        elif char=='sera':
            # light protected shoulders only
            for side in (-1,1): add(items,f'light_shoulder_{side:+d}',box([.14*scale,.09*scale,.19*scale],[side*.26*scale,1.43*scale,0],cfg.get('armor_mat','dark_steel')))
        else:
            if cfg.get('shoulder_light',True):
                add(items,'light_shoulder_L',box([.14*scale,.09*scale,.18*scale],[-.28*scale,1.42*scale,0],cfg.get('armor_mat','dark_steel')))
    # red utility ties
    ties=cfg.get('ties',1)
    for i in range(ties): add_tie(items,f'red_tie_{i}',(-.20+.18*i)*scale,.93*scale,.13*scale,.28*scale,'red_textile',.05*(i-1))
    return scale

KAIN=[
 ('01_Steelworks',dict(body_mat='black_fabric',coat=.34,apron=.54,armor=2,forearm=True,pouches=2,wrap=True,collar=True,exo=False,ties=1)),
 ('02_Demolition',dict(body_mat='graphite_fabric',coat=.18,apron=.38,armor=2,forearm=True,pouches=3,wrap=False,collar=False,exo=True,ties=1)),
 ('03_Rescue',dict(body_mat='offwhite_fabric',coat=.40,apron=.44,armor=1,forearm=True,pouches=3,wrap=True,collar=True,backpack=True,pack_mat='medical_red',ties=2)),
 ('04_Tunnel',dict(body_mat='graphite_fabric',coat=.30,apron=.48,armor=2,forearm=True,pouches=2,wrap=False,collar=True,hood=True,backpack=True,ties=1)),
 ('05_Powerhouse',dict(body_mat='black_fabric',coat=.22,apron=.46,armor=2,forearm=True,pouches=4,wrap=True,collar=True,exo=True,ties=2)),
 ('06_HeavyCarry',dict(body_mat='graphite_fabric',coat=.12,apron=.35,armor=2,forearm=True,pouches=2,wrap=False,collar=False,backpack=True,exo=True,ties=1)),
 ('07_Fireproof',dict(body_mat='black_fabric',coat=.36,apron=.58,apron_mat='offwhite_fabric',armor=2,armor_mat='brushed_steel',forearm=True,pouches=2,wrap=True,collar=True,ties=2)),
 ('08_ColdForge',dict(body_mat='white_fabric',coat=.48,apron=.40,armor=1,forearm=True,pouches=3,wrap=False,collar=True,hood=True,backpack=True,ties=1)),
 ('09_FieldSmith',dict(body_mat='black_fabric',coat=.26,apron=.60,armor=2,forearm=True,pouches=4,wrap=True,collar=False,exo=False,ties=2)),
 ('10_CeremonialWork',dict(body_mat='black_fabric',coat=.54,apron=.58,armor=1,forearm=True,pouches=2,wrap=True,collar=True,ties=3)),
]
SERA=[
 ('01_FieldMedical',dict(body_mat='white_fabric',coat=.48,armor=1,forearm=False,pouches=3,wrap=True,collar=True,backpack=True,pack_mat='white_fabric',ties=1,shin=False)),
 ('02_PurificationSupport',dict(body_mat='black_fabric',coat=.34,armor=1,pouches=4,wrap=True,collar=True,backpack=True,ties=1,shin=False)),
 ('03_TacticalControl',dict(body_mat='white_fabric',coat=.36,armor=1,pouches=3,wrap=False,collar=True,backpack=True,ties=1,shin=True)),
 ('04_ReconSupport',dict(body_mat='graphite_fabric',coat=.28,armor=1,pouches=2,wrap=True,collar=True,hood=True,backpack=True,ties=1,shin=False)),
 ('05_RapidResponse',dict(body_mat='white_fabric',coat=.20,armor=1,pouches=4,wrap=False,collar=False,backpack=True,ties=2,shin=True)),
 ('06_Contamination',dict(body_mat='offwhite_fabric',coat=.48,armor=1,pouches=3,wrap=False,collar=True,hood=True,backpack=True,pack_mat='dark_steel',ties=0,shin=True)),
 ('07_EscortSupport',dict(body_mat='black_fabric',coat=.44,armor=1,forearm=True,pouches=2,wrap=True,collar=True,backpack=True,ties=1,shin=True)),
 ('08_UrbanRescue',dict(body_mat='white_fabric',coat=.40,armor=1,pouches=4,wrap=True,collar=True,backpack=True,pack_mat='medical_red',ties=2,shin=False)),
 ('09_ColdSupport',dict(body_mat='white_fabric',coat=.52,armor=1,pouches=3,wrap=False,collar=True,hood=True,backpack=True,ties=1,shin=True)),
 ('10_RitualOperation',dict(body_mat='white_fabric',coat=.58,armor=1,pouches=2,wrap=True,collar=True,backpack=False,ties=3,shin=False)),
]
RYU=[
 ('01_Infiltration',dict(body_mat='black_fabric',coat=.28,armor=1,forearm=False,pouches=2,wrap=True,collar=True,hood=True,ties=1,shin=False)),
 ('02_Blitz',dict(body_mat='graphite_fabric',coat=.12,armor=0,forearm=True,pouches=2,wrap=False,collar=False,sleeved=False,ties=2,shin=False)),
 ('03_UrbanScout',dict(body_mat='graphite_fabric',coat=.24,armor=1,pouches=3,wrap=True,collar=True,backpack=True,ties=1,shin=False)),
 ('04_CloseDisruption',dict(body_mat='black_fabric',coat=.10,armor=0,forearm=True,pouches=3,wrap=False,collar=False,sleeved=False,ties=2,shin=True,knee=True)),
 ('05_HighPursuit',dict(body_mat='black_fabric',coat=.16,armor=1,pouches=3,wrap=True,collar=False,backpack=True,exo=False,ties=2,shin=True)),
 ('06_AllWeather',dict(body_mat='offwhite_fabric',coat=.38,armor=1,pouches=3,wrap=False,collar=True,hood=True,backpack=True,ties=1,shin=False)),
 ('07_SignalDisruption',dict(body_mat='black_fabric',coat=.26,armor=1,pouches=4,wrap=True,collar=True,backpack=True,ties=1,shin=False)),
 ('08_Shadowless',dict(body_mat='black_fabric',coat=.42,armor=1,pouches=2,wrap=False,collar=True,hood=True,ties=0,shin=False)),
 ('09_CivilianDisguise',dict(body_mat='graphite_fabric',coat=.18,armor=0,pouches=1,wrap=False,collar=True,hood=True,backpack=True,ties=0,shin=False)),
 ('10_Ritual',dict(body_mat='black_fabric',coat=.50,armor=1,pouches=2,wrap=True,collar=True,ties=3,shin=False)),
]

CHARS={
 'kain':{'H':1.86,'sets':KAIN,'weapon':'greatsword','identity':['broad shoulder / heavy receiver','two-handed greatsword','Korean heavy-industry / forge workwear','split work-apron silhouette','no firearms']},
 'sera':{'H':1.72,'sets':SERA,'weapon':'rings','identity':['slender field support','dual purifier rings + wire','medical / analysis / decontamination gear','white-black-red technical textile','minimal armor']},
 'ryu': {'H':1.78,'sets':RYU,'weapon':'daggers','identity':['slim athletic mobility','twin daggers','urban stealth / courier / infiltration','lightweight technical fabric','no heavy plate armor']},
}

manifest=[]
for char,c in CHARS.items():
    for i,(setname,cfg) in enumerate(c['sets'],1):
        items=[]
        scale=base_outfit(items,char,c['H'],cfg)
        # character-specific modules
        if char=='kain':
            # impact plate & braced thighs
            add(items,'impact_chest_plate',box([.32*scale,.25*scale,.055*scale],[0,1.25*scale,.145*scale],cfg.get('armor_mat','black_steel')))
            add(items,'smith_apron_buckle',box([.16*scale,.08*scale,.03*scale],[0,.80*scale,.14*scale],'copper'))
            greatsword(items,i,height=1.72*scale,width=.24*scale)
        elif char=='sera':
            # diagnostic strips & medical/red indicator pack
            add(items,'purity_indicator',box([.024*scale,.18*scale,.012*scale],[.17*scale,1.22*scale,.11*scale],'cyan'))
            add(items,'sample_case',box([.13*scale,.17*scale,.06*scale],[-.25*scale,.78*scale,.02*scale],'white_fabric'))
            if i in (1,6,8,9): add(items,'medical_marker',box([.055*scale,.055*scale,.012*scale],[-.25*scale,.80*scale,.056*scale],'medical_red'))
            sera_rings(items,i)
        else:
            # light harness and electronics
            add(items,'mobility_harness_L',box([.035*scale,.52*scale,.025*scale],[-.12*scale,1.14*scale,.11*scale],'red_textile',rotation_matrix(.14,[0,0,1])))
            add(items,'mobility_harness_R',box([.035*scale,.46*scale,.025*scale],[.12*scale,1.12*scale,.11*scale],'black_fabric',rotation_matrix(-.14,[0,0,1])))
            if i in (3,5,7): add(items,'signal_module',box([.12*scale,.18*scale,.07*scale],[.26*scale,.84*scale,-.03*scale],'dark_steel'))
            twin_daggers(items,i)
        # metadata
        sc=scene(items,{'character':char,'set':i,'set_name':setname,'axis':'Y-up','units':'meters','reference_height_m':c['H'],'status':'static wearable blockout; unskinned'})
        outdir=MODELS/char; outdir.mkdir(exist_ok=True)
        fname=f'{char}_outfit_{i:02d}_{setname.split("_",1)[1]}_v01.glb'
        path=outdir/fname; sc.export(path)
        b=sc.bounds; size=(b[1]-b[0]).tolist()
        manifest.append({'character':char,'set':i,'name':setname,'file':str(path.relative_to(ROOT)),'bbox_m':[round(float(x),4) for x in size],
                         'reference_height_m':c['H'],'axis':'Y-up','units':'meters','weapon':c['weapon'],'identity':c['identity'],
                         'status':'static wearable blockout GLB; embedded PBR textures; unskinned'})

# ---------- preview rendering (front orthographic + slight isometric) ----------
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

def render_scene_front(path, ax, title):
    s=trimesh.load(path,force='scene')
    polys=[]; colors=[]; depths=[]
    for name,g in s.geometry.items():
        key=g.metadata.get('mat_key')
        # loader may drop metadata, use material name mapping
        mn=getattr(getattr(g.visual,'material',None),'name','') or ''
        if not key:
            for k in BASECOL:
                if k in mn: key=k; break
        color=BASECOL.get(key,'#50545a')
        tri=g.triangles
        if len(tri)==0: continue
        for t in tri:
            polys.append(t[:,[0,1]])
            depths.append(float(t[:,2].mean()))
            colors.append(color)
    order=np.argsort(depths)
    pc=PolyCollection([polys[j] for j in order],facecolors=[colors[j] for j in order],edgecolors='none',linewidths=0)
    ax.add_collection(pc)
    b=s.bounds; pad=.08
    ax.set_xlim(b[0,0]-pad,b[1,0]+pad); ax.set_ylim(max(-.02,b[0,1]-pad),b[1,1]+pad)
    ax.set_aspect('equal'); ax.axis('off'); ax.set_title(title,fontsize=9,pad=2)
    ax.plot([-.35,.35],[0,0],color='#999',lw=.4)

for char,c in CHARS.items():
    fig,axs=plt.subplots(2,5,figsize=(13,7),dpi=150)
    fig.patch.set_facecolor('#d0d0d0')
    for i,(setname,cfg) in enumerate(c['sets'],1):
        fname=f'{char}_outfit_{i:02d}_{setname.split("_",1)[1]}_v01.glb'
        render_scene_front(MODELS/char/fname,axs.flat[i-1],f'{i:02d} {setname.split("_",1)[1]}')
        axs.flat[i-1].set_facecolor('#bcbcbc')
    fig.suptitle(f'HWANGHON — {char.upper()} 10 SETS / static GLB blockout',fontsize=16)
    plt.tight_layout(rect=[0,0,1,.95])
    fig.savefig(PREV/f'{char}_10sets_front_preview.png',bbox_inches='tight')
    plt.close(fig)

# combined manifest/readme
with open(ROOT/'manifest.json','w',encoding='utf-8') as f: json.dump(manifest,f,ensure_ascii=False,indent=2)
with open(ROOT/'README_KR.md','w',encoding='utf-8') as f:
    f.write('''# 황혼 — 카인·세라·류 10세트씩 3D GLB v01\n\n총 30개 세트. 모든 파일은 **직접 파라메트릭 모델링한 정적 착장 블록아웃 GLB**입니다.\n\n## 공통 규격\n- 좌표: Y-up\n- 단위: meter\n- 원점: 캐릭터 발 중앙(의상 배치 기준)\n- GLB 내부에 Base Color / Metallic-Roughness / Normal 텍스처가 임베드됨\n- 몸체는 포함하지 않음(착장용 의상·장비만)\n- 무기/도구는 노드명이 `weapon_`으로 시작하므로 분리 가능\n\n## 기준 신장\n- 카인: 1.86 m\n- 세라: 1.72 m\n- 류: 1.78 m\n\n## 카인\n중세 기사/총기 특수부대가 아니라 **2030 한국 중공업·제철·용접·구조 장비를 전투 장비로 발전시킨 대장장이** 방향.\n넓은 어깨, 중량 받아내기, 대검, 분할 작업 앞치마, 충격 흡수 장비, 외골격/공구 파츠. 총기 없음.\n\n## 세라\n정제/분석/구조 지원. 흰색·검정 기술직물과 의료/환경 대응 장비, 쌍 정제환+와이어. 중장갑 최소.\n\n## 류\n도심 잠행/기동/교란. 가벼운 재킷·하네스·러닝/등반 계열 파츠, 쌍단검. 무거운 판금 갑옷 없음.\n\n## 현재 상태 / 다음 공정\n- 현재: 착장 크기·실루엣·파트 분리·무기 위치 검수용 정적 GLB\n- 미적용: 기존 Mixamo 24본 스키닝, 천 물리, 몸 관통 보정, LOD, 실제 전투 클립 변형 검사\n- 따라서 `*_body.glb` / `*_anim.glb`를 덮어쓰지 말고 별도 후보로 피팅 후 승격해야 함.\n\n`preview/`에는 10세트 전면 직교 투영 검수 이미지가 있습니다.\n''')

# copy source concept boards used this turn if present
src=ROOT/'reference'; src.mkdir(exist_ok=True)
for p in ['/mnt/data/a_wide_clean_high_detail_concept_art_character.png','/mnt/data/세라의_사이버펑크_전술_지원_콘셉트_보드.png','/mnt/data/황혼_류_전술_의상_아카이브.png','/mnt/data/황혼_서울_2030_전투복_콘셉트_시트.png']:
    if os.path.exists(p): shutil.copy2(p,src/Path(p).name)
# copy builder for reproducibility
shutil.copy2(__file__,ROOT/'build_30sets.py')

# zip
zip_path=Path('/mnt/data/황혼_카인_세라_류_10세트씩_GLB_v01.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in ROOT.rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(ROOT.parent))
print('built',len(manifest),'GLBs')
print('zip',zip_path,zip_path.stat().st_size)
for char in CHARS:
    print(char, len(list((MODELS/char).glob('*.glb'))), PREV/f'{char}_10sets_front_preview.png')
