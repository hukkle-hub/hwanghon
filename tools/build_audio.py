"""Original deterministic DSP sketch pack; no third-party samples or API fees."""
from pathlib import Path
import json, wave
import numpy as np

RATE = 24000
OUT = Path(__file__).resolve().parents[1] / 'art/audio'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(190926)
manifest = {}
def save(name, signal, loop=False):
    signal = np.asarray(signal, dtype=float)
    if signal.ndim == 1: signal = np.column_stack((signal, signal))
    signal -= signal.mean(axis=0)
    peak = np.max(np.abs(signal))
    signal *= (0.55 if loop else 0.8) / max(peak, 1e-8)
    if not loop:
        fade = min(240, len(signal)//4)
        signal[:fade] *= np.linspace(0,1,fade)[:,None]
        signal[-fade:] *= np.linspace(1,0,fade)[:,None]
    assert np.isfinite(signal).all() and np.max(np.abs(signal)) < 1
    with wave.open(str(OUT/(name+'.wav')), 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(RATE)
        f.writeframes((signal*32767).astype('<i2').tobytes())
    manifest[name] = {'seconds':len(signal)/RATE,'loop':loop,'peak':float(np.max(np.abs(signal)))}

def effect(name, duration, low, metal=0, sweep=False):
    t=np.arange(int(duration*RATE))/RATE
    noise=rng.normal(0,1,len(t))
    noise=np.convolve(noise,np.ones(4)/4,mode='same')
    env=(1-np.exp(-t*350))*np.exp(-t/(duration*.18))
    if sweep: env=np.sin(np.pi*t/duration)**2
    s=noise*env*.32
    s+=np.sin(2*np.pi*(low*t+low*.06*(1-np.exp(-t*25))))*env*.5
    for i,r in enumerate([1,1.43,2.71,4.09]):
        s+=metal/(i+1)*np.sin(2*np.pi*(low*6*r)*t)*np.exp(-t/(duration*.35))*(1-np.exp(-t*600))
    if sweep: s*=np.sin(2*np.pi*(650*t-230*t*t/duration))
    save(name,s)

effect('swing',.32,180,sweep=True)
effect('hit',.42,82,.12)
effect('hit_heavy',.65,52,.2)
effect('counter',.9,135,.48)
effect('counter_perfect',1.2,180,.5)
effect('execute',1.35,42,.3)
effect('brk',.95,65,.38)
effect('roll',.3,110,sweep=True)
effect('tele',.65,220,.25)
effect('phase',1.7,46,.22)

# 16-second, 4-bar / 60 BPM D-minor beds. Integer-bin oscillators make
# continuous loop boundaries; periodic pulse envelopes have no cut tails.
for name, combat in [('explore',False),('boss',True)]:
    duration=16
    t=np.arange(duration*RATE)/RATE
    channels=[]
    for side in [0,1]:
        s=np.zeros_like(t)
        for i,f in enumerate([73.416,110,146.832,174.614,220]):
            frequency=round(f*duration)/duration
            phase=side*.18+i*.4
            mod=.65+.35*np.cos(2*np.pi*(i+1)*t/duration+phase)
            s+=np.sin(2*np.pi*frequency*t+phase)*mod*(.16/(i+1))
        # Repeating felt bell motif, deliberately restrained under combat cues.
        for i,f in enumerate([293.665,349.228,440,329.628]):
            p=(t-i*4)%16
            envelope=np.exp(-p*1.8)*(1-np.exp(-p*35))
            s+=np.sin(2*np.pi*round(f*16)/16*t)*envelope*.045
        if combat:
            p=t%1
            s+=np.sin(2*np.pi*55*t)*np.exp(-p*14)*(1-np.exp(-p*250))*.32
            p=(t-.5)%1
            s+=np.sin(2*np.pi*110*t)*np.exp(-p*20)*(1-np.exp(-p*180))*.11
        channels.append(s)
    save(name,np.column_stack(channels),True)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
