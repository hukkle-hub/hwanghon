# 무기 주도 자세 (낫·대검을 «든» 팔을 푸는 해석 IK) + 무기 궤도 표.
# rig_char.py (처음부터 굽기) 와 mocap_apply.py (이미 구운 GLB 에 모캡 클립만 갈아끼우기) 가
# 같은 코드를 쓴다 — 무기가 손에서 떨어지는 문제는 한 군데서만 고치면 되게.
#
# build() 가 닫힘(closure)으로 묶어 돌려주는 이유: 아래 함수들이 J·parent·RESTL 같은
# «이 캐릭터의 리그» 에 의존하는데, 캐릭터마다 다르기 때문이다.
import math
from mathutils import Vector, Matrix


def build(J, parent, RESTL, CHAR, PROF, LEFT_OFF=0.28):
    """J: 관절 랜드마크(Blender 좌표), parent/RESTL: 목표 리그, PROF: 캐릭터 프로필"""
    def ydir(M): return (M.to_3x3()@Vector((0,1,0))).normalized()
    def rot_to(a,b): return a.normalized().rotation_difference(b.normalized()).to_matrix()
    def child_pos(world,p,n): return world[p]@(RESTL[p].inverted()@RESTL[n]).to_translation()
    def setrot(world,n,R3,pos): M=R3.to_4x4(); M.translation=pos; world[n]=M
    def char_frame(world):
        """캐릭터 기준 축 (right, up, fwd) — Hips 의 yaw 만 사용"""
        hips=world['mixamorig:Hips']; fwd=hips.to_3x3()@Vector((0,-1,0)); fwd=Vector((fwd.x,fwd.y,0))
        fwd=fwd.normalized() if fwd.length>1e-4 else Vector((0,-1,0)); up=Vector((0,0,1)); right=fwd.cross(up).normalized()
        return right,up,fwd
    def solve_arm(world, side, T, pole):
        """2-본 해석 IK: side 의 Arm/ForeArm 을 손 머리가 T 에 오도록. Hand 는 로컬 회전 유지. 반환: 오차"""
        A='mixamorig:'+side+'Arm'; F='mixamorig:'+side+'ForeArm'; Hn='mixamorig:'+side+'Hand'
        L1=(J[side+'ForeArm']-J[side+'Arm']).length; L2=(J[side+'Hand']-J[side+'ForeArm']).length
        S=world[A].to_translation(); d=T-S; D=min(d.length,(L1+L2)*0.995); d.normalize()
        n=pole-d*pole.dot(d)
        if n.length<1e-4: n=Vector((0,0,-1))-d*(Vector((0,0,-1)).dot(d))
        n.normalize(); a=(L1**2-L2**2+D**2)/(2*D); h=math.sqrt(max(L1**2-a**2,0.0)); E=S+d*a+n*h; T2=S+d*D
        R1=world[A].to_3x3(); R2=world[F].to_3x3(); R3=world[Hn].to_3x3(); loc2=R1.inverted()@R2; loc3=R2.inverted()@R3
        R1n=rot_to(R1@Vector((0,1,0)),E-S)@R1; setrot(world,A,R1n,S)
        E2=child_pos(world,A,F); R2f=R1n@loc2; R2n=rot_to(R2f@Vector((0,1,0)),T2-E2)@R2f; setrot(world,F,R2n,E2)
        setrot(world,Hn,R2n@loc3,child_pos(world,F,Hn))
        return (world[Hn].to_translation()-T).length
    def ik_left(world, off=None):
        """왼손을 낫 자루 위 지점(오른손 슬롯에서 날 쪽 +off / 자루 끝 쪽 -off)에. 닿지 않으면 오른손 쪽으로 당김."""
        slot=world['mixamorig:RightHandSlot']; sp=slot.to_translation(); sd=ydir(slot)
        S=world['mixamorig:LeftArm'].to_translation(); L1=(J['LeftForeArm']-J['LeftArm']).length; L2=(J['LeftHand']-J['LeftForeArm']).length; reach=(L1+L2)*0.98
        off=LEFT_OFF if off is None else off; sg=1 if off>=0 else -1; off=abs(off); T=sp+sd*off*sg
        while (T-S).length>reach and off>0.10: off-=0.02; T=sp+sd*off*sg
        right,up,fwd=char_frame(world); pole=(-fwd*0.6-right*0.5-up*0.6).normalized()
        return solve_arm(world,'Left',T,pole)
    def relax_left(world, w, dirv=(0.20,-0.96,0.12)):
        """자유로운 왼팔을 자연스럽게 내린다: 위팔·아래팔·손 방향을 캐릭터 기준 '아래·약간 바깥' 쪽으로 w 만큼 당김 (소스 클립의 팔 스윙은 1-w 만큼 남는다)"""
        right,up,fwd=char_frame(world); T=(right*dirv[0]+up*dirv[1]+fwd*dirv[2]).normalized()
        chain=['mixamorig:LeftArm','mixamorig:LeftForeArm','mixamorig:LeftHand']
        for i,n in enumerate(chain):
            p=parent[n]; pos=child_pos(world,p,n) if i>0 else world[n].to_translation()
            cur=ydir(world[n]); tgt=cur.lerp(T,w).normalized(); R=rot_to(cur,tgt)@world[n].to_3x3(); setrot(world,n,R,pos)
    def relax_arm(world, side, w, dirv):
        """팔(위팔·아래팔·손)을 캐릭터 기준 방향 dirv 로 w 만큼 당김 — 소스 클립의 팔 벌림을 줄인다 (KayKit 휴식 자세가 T 포즈라 한손·비무장 클립은 팔이 옆으로 벌어져 나온다)"""
        right,up,fwd=char_frame(world); T=(right*dirv[0]+up*dirv[1]+fwd*dirv[2]).normalized()
        chain=['mixamorig:'+side+'Arm','mixamorig:'+side+'ForeArm','mixamorig:'+side+'Hand']
        for i,n in enumerate(chain):
            p=parent[n]; pos=child_pos(world,p,n) if i>0 else world[n].to_translation()
            cur=ydir(world[n]); tgt=cur.lerp(T,w).normalized(); R=rot_to(cur,tgt)@world[n].to_3x3(); setrot(world,n,R,pos)
        # 손 슬롯은 손을 따라간다
        for sl in ('mixamorig:'+side+'HandSlot',):
            if sl in world: world[sl]=world[chain[-1]]@(RESTL[chain[-1]].inverted()@RESTL[sl])
    RELAX_ATTACK={'attack1','attack2','attack3','smash','ult'}
    def relax_both(world, clip):
        w=0.35 if clip in RELAX_ATTACK else 0.72
        relax_arm(world,'Left',w,(0.20,-0.96,0.12)); relax_arm(world,'Right',w,(-0.20,-0.96,0.12))
    _RREL=[None]   # build() 의 닫힘 변수. 예전엔 모듈 전역이라 global 로 썼는데,
                   # build() 안으로 들어오며 지역이 돼 global 선언과 어긋났다 (호출되면 NameError).
    def carry(world, spec):
        """무기 주도 자세: 오른손 위치·자루 방향·날 방향을 캐릭터 기준으로 지정 → 오른팔 IK, 슬롯 회전, 왼손 자루 IK"""
        if _RREL[0] is None: _RREL[0]=(RESTL['mixamorig:RightHand'].inverted()@RESTL['mixamorig:RightHandSlot']).to_3x3()
        right,up,fwd=char_frame(world); hp=world['mixamorig:Hips'].to_translation()
        def v(t): return right*t[0]+up*t[1]+fwd*t[2]
        T=hp+v(spec['rh']); sd=v(spec['shaft']).normalized(); bd=v(spec['blade']); bd=(bd-sd*bd.dot(sd)).normalized()
        pole=(-fwd*0.5+right*0.7-up*0.5).normalized(); err=solve_arm(world,'Right',T,pole)
        # 슬롯 월드 회전: Y=자루, X=-날, Z=X×Y
        X=-bd; Y=sd; Z=X.cross(Y).normalized(); Rs=Matrix((X,Y,Z)).transposed()
        # 오른손 회전은 슬롯에서 역산 (손목이 무기를 따라감)
        Hn='mixamorig:RightHand'; hpos=world[Hn].to_translation(); Rh=Rs@_RREL[0].inverted(); setrot(world,Hn,Rh,hpos)
        setrot(world,'mixamorig:RightHandSlot',Rs,child_pos(world,Hn,'mixamorig:RightHandSlot'))
        if spec.get('left') is not None: ik_left(world, spec['left'])
        elif spec.get('relax'): relax_left(world, spec['relax'])
        return err
    # 캐릭터 기준 (right, up, fwd) 오프셋 — Hips 원점(≈0.98 m)
    CARRY={
      # 대기: 오른손은 오른쪽 허벅지 앞, 자루 위쪽은 왼쪽으로 기울어 왼손이 가슴 앞에서 자루를 잡는다 (왼손이 몸을 가로질러 오른손과 겹치던 문제 수정)
      # 디렉터 시트: 낫을 오른쪽 옆에 곧게 세워 자루 끝을 땅에 대고, 오른손이 허벅지 높이에서 자루를 감싼다. 왼팔은 자연스럽게 내린다
      'idle': dict(rh=(0.30,-0.18,0.06), shaft=(0.02,1.0,0.03), blade=(-0.3,0,1), left=None, relax=0.8),
      'idle2':dict(rh=(0.30,-0.18,0.06), shaft=(0.02,1.0,0.03), blade=(-0.3,0,1), left=None, relax=0.8),
      'walk': dict(rh=(0.30,-0.16,0.08), shaft=(0.03,0.99,-0.12), blade=(-0.3,0,1), left=None, relax=0.7),
      'run':  dict(rh=(0.30,-0.06,-0.08), shaft=(-0.12,0.42,-0.90), blade=(0,1,0.4), left=None),
      'guard':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
      'guardHit':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
      'guardUp':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
    }

    CARRY_SWORD={
      'idle': dict(rh=(0.26,-0.05,0.14), shaft=(0.10,0.72,-0.68), blade=(0,0.7,0.7), left=None, relax=0.8),
      'idle2':dict(rh=(0.26,-0.05,0.14), shaft=(0.10,0.72,-0.68), blade=(0,0.7,0.7), left=None, relax=0.8),
      'walk': dict(rh=(0.27,-0.04,0.14), shaft=(0.10,0.72,-0.68), blade=(0,0.7,0.7), left=None, relax=0.7),
      'run':  dict(rh=(0.30,-0.06,-0.08), shaft=(-0.12,0.42,-0.90), blade=(0,1,0.4), left=None),
      'guard':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
      'guardHit':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
      'guardUp':dict(rh=(0.22,0.28,0.36), shaft=(-0.97,0.25,0), blade=(0,0,1), left=0.40),
    }
    CARRY['brake']=dict(CARRY['run'])        # 제동은 달리기와 같은 무기 자세
    CARRY_SWORD['brake']=dict(CARRY_SWORD['run'])
    if PROF['carry']=='sword': CARRY=CARRY_SWORD
    elif PROF['carry'] is None: CARRY={}
    ARMS=['mixamorig:RightArm','mixamorig:RightForeArm','mixamorig:RightHand','mixamorig:RightHandSlot','mixamorig:LeftArm','mixamorig:LeftForeArm','mixamorig:LeftHand']
    def blend_carry(world, spec, w):
        """world(소스 리타겟) 와 carry 자세를 팔 뼈에 대해 w 로 섞음 (회전 slerp, 위치는 체인 재계산)"""
        if w<=0.001: return ik_left(world)
        W2={k:v.copy() for k,v in world.items()}; carry(W2,spec)
        if w>=0.999:
            for k in ARMS: world[k]=W2[k]
            return 0.0
        for k in ARMS:
            qa=world[k].to_quaternion(); qb=W2[k].to_quaternion(); q=qa.slerp(qb,w)
            p=parent[k]; pos=child_pos(world,p,k); setrot(world,k,q.to_matrix(),pos)
        if spec.get('left') is None:
            if w>0.5: relax_left(world, spec.get('relax',0.6)*w); return 0.0
            return ik_left(world, LEFT_OFF)   # 한 손 자세로 섞일 때는 왼손을 놓는다
        off=w*spec['left']+(1-w)*LEFT_OFF
        return ik_left(world, off if abs(off)>0.08 else (0.08 if off>=0 else -0.08))
    def ease(t): return t*t*(3-2*t)
    def carry_weight(i,n,frac=0.22):
        m=max(2,int(n*frac)); 
        if i<m: return ease(1-i/m)
        if i>n-1-m: return ease(1-(n-1-i)/m)
        return 0.0

    # ---------- 낫 전용 공격 궤적: 캐릭터 기준 (right, up, fwd) 키프레임. t 는 0..1 (클립 진행) ----------
    IDLE_K=dict(rh=(0.27,0.10,0.24), shaft=(-0.18,0.94,-0.28), blade=(0,0.25,1), left=-0.36)
    PATHS={
      # 베기: 오른쪽 뒤로 당겼다가 가슴 높이에서 왼쪽으로 크게 쓸어 벤다 (날이 앞장)
      'attack1':[(0.0,IDLE_K),
                 (0.20,dict(rh=(0.48,0.32,-0.18), shaft=(0.55,0.45,-0.70), blade=(-0.7,0.1,0.7), left=-0.40)),
                 (0.34,dict(rh=(0.18,0.28,0.42), shaft=(-0.15,0.12,0.98), blade=(-1,0,0), left=-0.40)),
                 (0.46,dict(rh=(-0.30,0.26,0.22), shaft=(-0.95,0.12,0.28), blade=(-0.3,0,-0.95), left=-0.40)),
                 (0.62,dict(rh=(-0.28,0.20,0.18), shaft=(-0.85,0.35,0.35), blade=(0,0.3,0.95), left=-0.38)),
                 (1.0,IDLE_K)],
      # 내려찍기: 머리 위 뒤로 들어 올렸다가 앞으로 내리꽂는다 (날끝이 땅을 찍는다)
      'attack2':[(0.0,IDLE_K),
                 (0.22,dict(rh=(0.32,0.58,-0.12), shaft=(0.12,0.72,-0.68), blade=(0,0.6,0.8), left=-0.40)),
                 (0.36,dict(rh=(0.18,0.55,0.25), shaft=(0.05,0.30,0.95), blade=(0,-0.5,0.85), left=-0.40)),
                 (0.44,dict(rh=(0.15,0.12,0.58), shaft=(0,-0.40,0.92), blade=(0,-0.92,0.35), left=-0.42)),
                 (0.62,dict(rh=(0.15,0.05,0.52), shaft=(0,-0.48,0.88), blade=(0,-0.92,0.35), left=-0.42)),
                 (0.82,dict(rh=(0.22,0.18,0.30), shaft=(-0.2,0.62,0.76), blade=(0,0.2,1), left=-0.38)),
                 (1.0,IDLE_K)],
      # 찌르기(갈고리 당기기): 자루를 수평으로 눕혀 앞으로 찌른 뒤 날로 걸어 당긴다
      'attack3':[(0.0,IDLE_K),
                 (0.18,dict(rh=(0.36,0.22,-0.22), shaft=(0.05,0.05,1), blade=(0,-1,0), left=-0.42)),
                 (0.34,dict(rh=(0.10,0.26,0.68), shaft=(0,0.02,1), blade=(0,-1,0), left=-0.42)),
                 (0.48,dict(rh=(0.28,0.24,0.12), shaft=(0.08,0.18,0.98), blade=(0,-1,0.1), left=-0.42)),
                 (0.70,dict(rh=(0.27,0.15,0.20), shaft=(-0.2,0.80,0.55), blade=(0,0.2,1), left=-0.38)),
                 (1.0,IDLE_K)],
      # 회전: 자루를 수평으로 뻗은 채 몸과 함께 돈 뒤 마무리 찍기
      'smash':  [(0.0,IDLE_K),
                 (0.15,dict(rh=(0.42,0.30,-0.10), shaft=(0.6,0.15,-0.78), blade=(-0.75,0.1,0.6), left=-0.40)),
                 (0.30,dict(rh=(0.22,0.32,0.42), shaft=(-0.3,0.05,0.95), blade=(-1,0,0), left=-0.42)),
                 (0.55,dict(rh=(0.22,0.32,0.42), shaft=(-0.3,0.05,0.95), blade=(-1,0,0), left=-0.42)),
                 (0.68,dict(rh=(0.25,0.55,0.05), shaft=(0.05,0.55,-0.83), blade=(0,0.6,0.8), left=-0.40)),
                 (0.78,dict(rh=(0.15,0.10,0.58), shaft=(0,-0.42,0.90), blade=(0,-0.92,0.35), left=-0.42)),
                 (0.90,dict(rh=(0.18,0.08,0.52), shaft=(0,-0.45,0.89), blade=(0,-0.92,0.35), left=-0.42)),
                 (1.0,IDLE_K)],
      # ---- 스킬·처형·카운터: 소스가 한손 클립이라 궤적을 직접 준다. 안 주면 낫이 손에서 떨어져 보인다 ----
      # 스킬1 강한 일격: 오른쪽 위로 크게 들었다가 왼쪽 아래로 대각선으로 베어 내린다
      'skill1':[(0.0,IDLE_K),
                (0.24,dict(rh=(0.55,0.70,-0.20), shaft=(0.45,0.80,-0.40), blade=(-0.5,0.5,0.7), left=-0.42)),
                (0.40,dict(rh=(0.25,0.45,0.55), shaft=(0.10,0.25,0.96), blade=(-0.9,-0.3,0.3), left=-0.42)),
                (0.52,dict(rh=(-0.45,0.05,0.35), shaft=(-0.80,-0.45,0.40), blade=(-0.2,-0.85,-0.5), left=-0.44)),
                (0.70,dict(rh=(-0.35,0.10,0.25), shaft=(-0.80,0.20,0.56), blade=(0,0.2,0.98), left=-0.40)),
                (1.0,IDLE_K)],
      # 스킬3 광역 회전: 자루를 넓게 뻗은 채 한 바퀴 다 돈다 (스매시보다 크게)
      'skill3':[(0.0,IDLE_K),
                (0.14,dict(rh=(0.50,0.28,-0.22), shaft=(0.72,0.10,-0.68), blade=(-0.7,0.1,0.7), left=-0.44)),
                (0.28,dict(rh=(0.30,0.30,0.50), shaft=(-0.10,0.02,0.99), blade=(-1,0,0), left=-0.46)),
                (0.44,dict(rh=(-0.45,0.30,0.20), shaft=(-0.99,0.02,0.10), blade=(-0.1,0,-0.99), left=-0.46)),
                (0.60,dict(rh=(-0.25,0.30,-0.45), shaft=(-0.10,0.02,-0.99), blade=(1,0,0), left=-0.46)),
                (0.76,dict(rh=(0.45,0.30,-0.15), shaft=(0.99,0.02,0.10), blade=(0.1,0,0.99), left=-0.46)),
                (0.88,dict(rh=(0.28,0.28,0.42), shaft=(-0.15,0.10,0.98), blade=(-1,0,0), left=-0.44)),
                (1.0,IDLE_K)],
      # 스킬4 결의: 자루를 앞에 곧게 세워 박고 버틴다
      'skill4':[(0.0,IDLE_K),
                (0.25,dict(rh=(0.24,0.02,0.32), shaft=(0,1,0), blade=(0,0,1), left=-0.30)),
                (0.65,dict(rh=(0.24,0.02,0.32), shaft=(0,1,0), blade=(0,0,1), left=-0.30)),
                (1.0,IDLE_K)],
      # 처형: 머리 위로 높이 들어 «버텼다가» 수직으로 내리꽂는다
      'exec':[(0.0,IDLE_K),
              (0.20,dict(rh=(0.15,0.80,-0.05), shaft=(0,0.98,-0.20), blade=(0,0.3,0.95), left=-0.36)),
              (0.45,dict(rh=(0.12,0.85,0.02), shaft=(0,0.99,-0.12), blade=(0,0.3,0.95), left=-0.36)),
              (0.58,dict(rh=(0.12,0.10,0.62), shaft=(0,-0.55,0.84), blade=(0,-0.95,0.30), left=-0.40)),
              (0.78,dict(rh=(0.14,0.02,0.58), shaft=(0,-0.62,0.79), blade=(0,-0.95,0.30), left=-0.40)),
              (1.0,IDLE_K)],
      # 카운터: 자루를 가로로 들어 받아 내고 «맞댄 채 버티다» 밀어내며 그대로 벤다
      'counter':[(0.0,IDLE_K),
                 (0.18,dict(rh=(0.26,0.42,0.34), shaft=(-0.96,0.28,0.02), blade=(0,0,1), left=-0.38)),
                 (0.36,dict(rh=(0.24,0.46,0.42), shaft=(-0.94,0.34,0.06), blade=(0,0,1), left=-0.38)),
                 (0.50,dict(rh=(0.30,0.40,0.52), shaft=(-0.90,0.20,0.38), blade=(0,0,1), left=-0.40)),
                 (0.66,dict(rh=(-0.38,0.22,0.24), shaft=(-0.86,0.10,0.50), blade=(-0.2,0,-0.97), left=-0.42)),
                 (1.0,IDLE_K)],
    }
    def _lerp3(a,b,k): return tuple(a[i]+(b[i]-a[i])*k for i in range(3))
    # 궤도 확대: 휘두르는 «가운데» 에서만 손을 몸에서 더 멀리 민다. 클립 끝(대기 자세)은 건드리지 않아
    # 앞뒤 동작과 이어 붙일 때 튀지 않는다. 팔 길이를 넘지 않도록 반경을 자른다.
    SWING=1.20; REACH=0.62
    def _wide(rh, w):
        if w<=0.001: return rh
        x,y,z=rh[0]*SWING, rh[1]*(1+(SWING-1)*0.6), rh[2]*SWING
        r=(x*x+y*y+z*z)**0.5
        if r>REACH: f=REACH/r; x,y,z=x*f,y*f,z*f
        return (rh[0]+(x-rh[0])*w, rh[1]+(y-rh[1])*w, rh[2]+(z-rh[2])*w)
    def path_spec(keys, t):
        w=max(0.0, min(1.0, 4*t*(1-t)))     # 끝에서 0, 가운데에서 1
        for i in range(len(keys)-1):
            t0,a=keys[i]; t1,b=keys[i+1]
            if t<=t1:
                k=0 if t1<=t0 else (t-t0)/(t1-t0); k=k*k*(3-2*k)
                return dict(rh=_wide(_lerp3(a['rh'],b['rh'],k), w), shaft=_lerp3(a['shaft'],b['shaft'],k), blade=_lerp3(a['blade'],b['blade'],k), left=a['left']+(b['left']-a['left'])*k)
        return dict(keys[-1][1])


    return dict(ydir=ydir, rot_to=rot_to, child_pos=child_pos, setrot=setrot,
                char_frame=char_frame, solve_arm=solve_arm, ik_left=ik_left,
                relax_left=relax_left, relax_arm=relax_arm, relax_both=relax_both,
                carry=carry, blend_carry=blend_carry, carry_weight=carry_weight,
                path_spec=path_spec, CARRY=CARRY, PATHS=PATHS)
