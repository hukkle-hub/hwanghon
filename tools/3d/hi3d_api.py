#!/usr/bin/env python3
"""Hi3D Open API 클라이언트 (docs.hi3d.ai). 자격은 환경변수 HI3D_CLIENT_ID / HI3D_CLIENT_SECRET (절대 커밋하지 말 것).
  python3 hi3d_api.py balance
  python3 hi3d_api.py texture --mesh art/3d/ain_hi3d_v1.glb --image ref_front.png --out art/3d/incoming/ain_tex.glb   # 기존 메시에 PBR 텍스처 (v3.0, ~15크레딧)
  python3 hi3d_api.py gen --images front.png back.png left.png --bits 1110 --out out.glb [--model hi3dv3.0 --res 2048quality --face 1500000]
  python3 hi3d_api.py poll TASK_ID --out out.glb
"""
import os, sys, base64, json, time, argparse, urllib.request, urllib.parse, mimetypes, uuid
BASE='https://api.hitem3d.ai/open-api/v1'
def _req(url, method='GET', headers=None, data=None):
    r=urllib.request.Request(url, data=data, method=method, headers=headers or {})
    with urllib.request.urlopen(r, timeout=120) as resp: return json.loads(resp.read().decode())
def token():
    cid, sec=os.environ.get('HI3D_CLIENT_ID'), os.environ.get('HI3D_CLIENT_SECRET')
    if not cid or not sec: sys.exit('HI3D_CLIENT_ID / HI3D_CLIENT_SECRET 환경변수가 필요합니다')
    auth=base64.b64encode((cid+':'+sec).encode()).decode()
    j=_req(BASE+'/auth/token','POST',{'Authorization':'Basic '+auth,'Content-Type':'application/json'}, b'{}')
    if str(j.get('code'))!='200' and 'accessToken' not in json.dumps(j): sys.exit('토큰 실패: '+json.dumps(j, ensure_ascii=False))
    return j['data']['accessToken']
def balance(tk):
    return _req(BASE+'/balance','GET',{'Authorization':'Bearer '+tk,'Content-Type':'application/json'})
def multipart(fields, files):
    b='----hi3d'+uuid.uuid4().hex; out=[]
    for k,v in fields.items(): out.append(('--'+b+'\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n'%(k,v)).encode())
    for k,path in files:
        ct=mimetypes.guess_type(path)[0] or 'application/octet-stream'
        out.append(('--'+b+'\r\nContent-Disposition: form-data; name="%s"; filename="%s"\r\nContent-Type: %s\r\n\r\n'%(k,os.path.basename(path),ct)).encode()); out.append(open(path,'rb').read()); out.append(b'\r\n')
    out.append(('--'+b+'--\r\n').encode()); return b''.join(out), 'multipart/form-data; boundary='+b
def submit(tk, fields, files):
    body, ct=multipart(fields, files)
    j=_req(BASE+'/submit-task','POST',{'Authorization':'Bearer '+tk,'Content-Type':ct}, body)
    print('submit →', json.dumps(j, ensure_ascii=False)); 
    if str(j.get('code'))!='200': sys.exit(1)
    return j['data']['task_id']
def query(tk, tid):
    return _req(BASE+'/query-task?task_id='+urllib.parse.quote(tid),'GET',{'Authorization':'Bearer '+tk,'Content-Type':'application/json'})
def poll(tk, tid, out, every=15, limit=3600):
    t0=time.time(); last=None
    while time.time()-t0<limit:
        j=query(tk, tid); d=j.get('data',{}); st=d.get('state')
        if st!=last: print(time.strftime('%H:%M:%S'), 'state', st); last=st
        if st=='success':
            url=d.get('url'); print('url', url); os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
            urllib.request.urlretrieve(url, out); print('saved', out, os.path.getsize(out)); 
            if d.get('cover_url'): urllib.request.urlretrieve(d['cover_url'], out+'.cover.png')
            return out
        if st=='failed': sys.exit('실패: '+json.dumps(j, ensure_ascii=False))
        time.sleep(every)
    sys.exit('시간 초과')
if __name__=='__main__':
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest='cmd')
    sub.add_parser('balance')
    t=sub.add_parser('texture'); t.add_argument('--mesh', required=True); t.add_argument('--image', nargs='+', required=True); t.add_argument('--out', required=True); t.add_argument('--model', default='hi3dv3.0'); t.add_argument('--pbr', default='1'); t.add_argument('--mesh-url')
    g=sub.add_parser('gen'); g.add_argument('--images', nargs='+', required=True); g.add_argument('--bits'); g.add_argument('--out', required=True); g.add_argument('--model', default='hi3dv3.0'); g.add_argument('--res', default='2048quality'); g.add_argument('--face', default='1500000'); g.add_argument('--pbr', default='1'); g.add_argument('--type', default='3')
    p=sub.add_parser('poll'); p.add_argument('task_id'); p.add_argument('--out', required=True)
    a=ap.parse_args(); tk=token()
    if a.cmd=='balance': print(json.dumps(balance(tk), ensure_ascii=False))
    elif a.cmd=='texture':
        fields={'request_type':'2','model':a.model,'pbr':a.pbr,'format':'2'}; files=[]
        if a.mesh_url: fields['mesh_url']=a.mesh_url
        else: files.append(('mesh', a.mesh))
        key='images' if len(a.image)==1 else 'multi_images'
        for im in a.image: files.append((key, im))
        if len(a.image)>1: fields['multi_images_bit']={1:'1000',2:'1100',3:'1110',4:'1111'}[len(a.image)]
        tid=submit(tk, fields, files); poll(tk, tid, a.out)
    elif a.cmd=='gen':
        fields={'request_type':a.type,'model':a.model,'resolution':a.res,'face':a.face,'pbr':a.pbr,'format':'2'}
        key='images' if len(a.images)==1 else 'multi_images'; files=[(key, im) for im in a.images]
        if len(a.images)>1: fields['multi_images_bit']=a.bits or {2:'1100',3:'1110',4:'1111'}[len(a.images)]
        tid=submit(tk, fields, files); poll(tk, tid, a.out)
    elif a.cmd=='poll': poll(tk, a.task_id, a.out)
