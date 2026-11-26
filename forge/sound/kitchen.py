"""Cooks public/sfx/sfx.pak from CC0 recordings (assets_src/sfx, listed in LICENSES.md) plus synthesis.

    python forge/sound/kitchen.py [name,name]      needs numpy, scipy, ffmpeg

Built for feel, not realism. Every impact is layered: a snap you hear on a phone, a punch, a sub tuned to the score's D,
something wet or steel for character, and a tail. Nothing here is a short tuned click: that is what sticks sound like.
"""
import json, os, struct, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..'); SRC = os.path.join(ROOT, 'assets_src', 'sfx'); OUT = os.path.join(ROOT, 'public', 'sfx')
rng = np.random.default_rng(7); D1 = 36.71
_cache = {}

# ---------------------------------------------------------------- ingredients
def load(name, pitch=1.0, start=0.0, dur=None, rev=False):
    """A recording, trimmed to its first sound, played at `pitch`."""
    if name not in _cache:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(SRC, name), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True)
        x = np.frombuffer(r.stdout, np.float32).astype(float); assert len(x), name; x = x / np.abs(x).max(); on = int(np.argmax(np.abs(x) > 0.02)); _cache[name] = x[max(0, on - 60):]
    x = _cache[name][int(start * SR):]
    if dur: x = x[:int(dur * SR * pitch) + 1]
    if abs(pitch - 1) > 1e-3: x = np.interp(np.arange(0, len(x) - 1, pitch), np.arange(len(x)), x)
    if rev: x = x[::-1]
    x = x.copy(); n = min(200, len(x) // 4); x[-n:] *= np.linspace(1, 0, n); m = np.abs(x).max(); return x / m if m > 0 else x
def T(s): return np.arange(int(s * SR)) / SR
def noise(s): return rng.uniform(-1, 1, int(s * SR))
def _sos(kind, f, o): return butter(o, np.clip(np.array(f) / (SR / 2), 1e-4, 0.99), kind, output='sos')
def lp(x, f, o=2): return sosfilt(_sos('low', f, o), x)
def hp(x, f, o=2): return sosfilt(_sos('high', f, o), x)
def bp(x, a, b, o=2): return sosfilt(_sos('band', [a, b], o), x)
def ad(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def bell(s, mid, w): t = T(s); return np.exp(-((t - mid) / w) ** 2)
def sat(x, d): m = np.abs(x).max() + 1e-9; return np.tanh(x / m * d) / np.tanh(d)
def norm(x): return x / (np.abs(x).max() + 1e-9)
def sweep(s, f0, f1, k):
    """A sine falling from f0 to f1."""
    t = T(s); return np.sin(2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t / k)) / SR)
def sub(s, f1=D1 * 2, f0=170, d=0.16, k=0.03, drive=1.6): return sat(sweep(s, f0, f1, k) * ad(int(s * SR), 0.002, d), drive)
def moving(x, f, q=1.2):
    """Band-pass whose centre follows f(t): the body of a whoosh."""
    n = len(x); o = np.zeros(n); B = 512; win = np.hanning(B * 2)
    for i in range(0, n, B):
        seg = np.zeros(B * 2); a = x[max(0, i - B):i + B]; seg[-len(a):] = a if i >= B else a; c = float(f(i / SR)); lo, hi = c / (1 + 0.5 / q), c * (1 + 0.5 / q); y = bp(seg * win, max(30, lo), min(20000, hi), 2); j = i - B
        for k0, k1 in [(max(0, j), min(n, j + B * 2))]: o[k0:k1] += y[k0 - j:k1 - j]
    return o
def air(s, f0, f1, mid, w, q=1.0):
    """Rising then falling rush of air, loudest at `mid` (seconds)."""
    return norm(moving(noise(s), lambda t: f0 + (f1 - f0) * np.exp(-((t - mid) / (w * 1.15)) ** 2), q) * bell(s, mid, w))
def saws(s, f, n=7, det=14):
    t = T(s); o = np.zeros(len(t))
    for k in range(n): o += 2 * ((f * 2 ** ((k / max(1, n - 1) - .5) * det / 600) * t + rng.random()) % 1) - 1
    return o / n
def ir(t60, bright=5200, pre=0.012, seed=1):
    g = np.random.default_rng(seed); n = int(t60 * 1.2 * SR); t = np.arange(n) / SR; x = g.normal(size=n) * np.exp(-6.9 * t / t60); lo = lp(x, 900); hi = x - lo; y = lo + hi * np.exp(-t / (t60 * 0.22)); y = lp(hp(y, 130), bright); p = int(pre * SR); y = np.concatenate([np.zeros(p), y]); y[p:p + 400] *= np.linspace(0, 1, 400); return y / np.sqrt((y ** 2).sum())
_ir = {}
def verb(x, t60=1.4, wet=0.2, bright=5200, pre=0.012, width=True):
    """Stone court, or a cathedral when it matters. Returns stereo."""
    k = (t60, bright, pre)
    if k not in _ir: _ir[k] = (ir(t60, bright, pre, 1), ir(t60, bright, pre, 2))
    x2 = x if x.ndim == 2 else np.stack([x, x]); L, R = (fftconvolve(x2[c], _ir[k][c if width else 0]) for c in (0, 1)); dry = np.zeros((2, len(L))); dry[:, :x2.shape[1]] = x2; return dry + wet * np.stack([L, R])
def mono(x): return x.mean(0) if x.ndim == 2 else x

class Pot:
    """Layers in, one sound out."""
    def __init__(s, secs): s.x = np.zeros((2, int(secs * SR)))
    def add(s, y, g=1.0, at=0.0, pan=0.0):
        y = np.asarray(y); y = y if y.ndim == 2 else np.stack([y * min(1, 1 - pan), y * min(1, 1 + pan)]); k = int(at * SR)
        if k < 0: y = y[:, -k:]; k = 0
        n = min(y.shape[1], s.x.shape[1] - k)
        if n > 0: s.x[:, k:k + n] += y[:, :n] * g
        return s
    def verb(s, t60=1.2, wet=0.18, **k): n = s.x.shape[1]; s.x = verb(s.x, t60, wet, **k)[:, :n]; return s
    def glue(s, drive=1.3):
        """Gentle limiting across the whole thing: one sound instead of five."""
        m = np.abs(s.x).max() + 1e-9; s.x = np.tanh(s.x / m * drive) / np.tanh(drive); return s
    def out(s, peak, stereo=False):
        x = s.x; n = x.shape[1]; e = np.abs(x).max(0); live = np.nonzero(e > e.max() * 0.0016)[0]; x = x[:, :min(n, live[-1] + 900)]; f = min(x.shape[1], int(0.03 * SR)); x[:, -f:] *= np.linspace(1, 0, f); x[:, :24] *= np.linspace(0, 1, 24)
        x = x if stereo else x.mean(0, keepdims=True); return x / (np.abs(x).max() + 1e-9) * peak

BANG, RPG, CR1, CR2, SWISH, SW, CLASH, WET, BRK, WM, APP, S2, SC = '25_CC0_bang_sfx/', '80_CC0_RPG_SFX_0/', '80_CC0_creature_SFX_0/', '80_CC0_creature_sfx_2/', 'swishes/', 'sword___starninjas_1/', 'sword_clash___starninjas_0/', 'water_splash_slime_sfx/', 'sfx_breaking_and_falling/', '100_CC0_wood_metal_SFX/', 'weapons_apparel/', 'sfx_100_v2/', 'scrapes/'
S1, LOOSE, DARK, MON = '100_CC0_SFX_0/', '_loose/', 'dark_ambiences/', 'monster_sounds_volume_2/'

# ---------------------------------------------------------------- shared layers
def snap(b=1.0, i=0):
    """The first few milliseconds: what you feel."""
    x = load(BANG + ['shot_02.ogg', 'shot_01.ogg', 'shot_03.ogg'][i % 3], 1.0 + 0.08 * (i % 3), dur=0.12); return hp(x, 900) * ad(len(x), 0.0005, 0.02) * b
def punch(p=1.0, i=0, d=0.09):
    x = load(BANG + ['cannon_04.ogg', 'cannon_01.ogg', 'bang_02.ogg', 'bang_06.ogg'][i % 4], p, dur=0.5); return lp(hp(x, 70), 1500) * ad(len(x), 0.001, d)
def gore(i=0, p=1.0, d=0.14):
    f = [WET + 'slime_04.ogg', RPG + 'creature_slime_01.ogg', CR2 + 'slime_03.ogg', WET + 'slime_05.ogg', RPG + 'creature_slime_02.ogg', WET + 'slime_03.ogg', CR2 + 'slime_04.ogg'][i % 7]; x = load(f, p, dur=0.45); return bp(x, 260, 5200) * ad(len(x), 0.004, d)
def edge(i=0, p=1.0, d=0.07):
    """Steel going in: bright, instantly gone. High-passed so it never rings."""
    f = [SW + 'sword.6.ogg', SW + 'sword.8.ogg', CLASH + 'sword_clash.5.ogg', CLASH + 'sword_clash.9.ogg', CLASH + 'sword_clash.8.ogg'][i % 5]; x = load(f, p, dur=0.4); return hp(x, 2600) * ad(len(x), 0.001, d)
def shing(i=0, p=1.0, s=0.3):
    """The sound a fine blade makes in a film: all air, no note."""
    f = ['rpg_sound_pack/sword-unsheathe%s.wav' % q for q in ('3', '4', '5', '2')][i % 4]; x = load(f, p, dur=s); return hp(x, 3200) * np.exp(-((np.arange(len(x)) / SR - s * 0.3) / (s * 0.3)) ** 2)
def suck(s=0.4, f=300):
    """Backwards: the breath before a blow."""
    x = norm(mono(verb(np.concatenate([load(BANG + 'cannon_01.ogg', 0.8, dur=0.4), np.zeros(10)]), 1.2, 0.9)))[:int(s * 1.1 * SR)][::-1]; x = x[-int(s * SR):] if len(x) > int(s * SR) else x; t = np.arange(len(x)) / len(x); return hp(x, f) * t ** 2.2
def groan(p=0.4, i=0, s=1.4):
    """A huge thing taking weight: recorded scrapes slowed until they are a hull."""
    x = load(SC + ['scrape-1.wav', 'scrape-2.wav'][i % 2], p, dur=s); x = lp(hp(x, 45), 1300); return sat(x * np.minimum(1, np.arange(len(x)) / (0.12 * SR)) * np.linspace(1, 0.25, len(x)), 2.0)
def doom(s=2.2, f=D1, g=1.0):
    """The low hit under anything important."""
    o = Pot(s); o.add(sub(s, f, 130, 0.55, 0.06, 2.0), 1.0).add(sub(s * .6, f * 2, 260, 0.2, 0.03, 1.8), 0.55).add(lp(load(BANG + 'cannon_01.ogg', 0.55), 700), 0.8).add(lp(load(BANG + 'bang_06.ogg', 0.6), 1200), 0.45); return mono(o.x) * g
def braam(s=3.2, f=D1 * 2, bite=1.0):
    """Horns the size of buildings, in D."""
    t = T(s); o = np.zeros(len(t))
    for m, g in ((1, 1), (2, .55), (3, .3), (1.4983, .35), (.5, .8)): o += saws(s, f * m, 7, 16) * g
    env = np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - 0.5) / (s * 0.28)); y = np.zeros(len(t)); cut = 180 + 2600 * bite * np.exp(-((t - 0.16) / 0.5) ** 2); B = 1024
    for a, c in ((0, 350), (1, 900), (2, 2400)): y += lp(hp(o, [40, 250, 800][a]), c) * [1, .8, .5 * bite][a] * np.clip((cut - [0, 250, 900][a]) / 900, 0, 1)
    return sat(y * env, 2.6)

R = {}
def cook(name, n=1):
    def w(f): R[name] = (n, f); return f
    return w

# ---------------------------------------------------------------- the blade
@cook('whoosh', 6)
def _(i): p = 1 + 0.06 * (i - 2.5); s = 0.36; return Pot(s).add(air(s, 500 * p, 2900 * p, 0.11, 0.055), 1).add(load(SWISH + 'swish-%d.wav' % [10, 11, 12, 13, 10, 11][i], 0.75 * p), 0.8, 0.055).add(load(SWISH + 'swish-%d.wav' % [3, 4, 6, 7, 9, 8][i], 1.5 * p), 0.5, 0.06).add(shing(i, 1.1 * p, 0.24), 0.28, 0.04).glue(1.2).out(0.5)
@cook('whooshH', 4)
def _(i): p = 1 + 0.07 * (i - 1.5); s = 0.6; return Pot(s).add(air(s, 220 * p, 1900 * p, 0.17, 0.085), 1).add(air(s, 900, 5200 * p, 0.2, 0.05), 0.4).add(load(SWISH + 'swish-%d.wav' % [7, 9, 4, 3][i], 0.7 * p), 1.0, 0.09).add(shing(i, 0.85, 0.36), 0.42, 0.06).add(lp(sweep(s, 120, 60, 0.2) * bell(s, 0.17, 0.09), 300), 0.5).glue(1.4).out(0.66)
@cook('whooshB', 3)
def _(i): p = 1 - 0.08 * i; s = 0.95; return Pot(s).add(air(s, 90 * p, 760 * p, 0.3, 0.14), 1).add(air(s, 300, 1900 * p, 0.33, 0.09), 0.5).add(load(SWISH + 'swish-%d.wav' % [7, 9, 4][i], 0.34 * p), 1.0, 0.12).add(lp(load(LOOSE + '105016__julien-matthey__jm-fx-fireball-01.wav', 1.1 * p, dur=0.8), 1600) * bell(0.8, 0.3, 0.2)[:int(0.8 * SR)], 0.35).add(sweep(s, 90, 45, 0.3) * bell(s, 0.3, 0.14), 0.5).glue(1.5).out(0.82)
@cook('flesh', 6)
def _(i): p = 1 + 0.05 * (i - 2.5); return Pot(0.6).add(snap(1, i), 0.85).add(punch(1.15 * p, i, 0.075), 1.0).add(sub(0.3, D1 * 2, 260, 0.085, 0.018), 0.95).add(gore(i, 1.1 * p, 0.12), 0.62, 0.006).add(edge(i, 0.95 * p, 0.055), 0.34).verb(0.5, 0.07, bright=3600).glue(1.5).out(0.85)
@cook('fleshH', 4)
def _(i): p = 1 + 0.05 * (i - 1.5); return Pot(1.5).add(snap(1.1, i), 1).add(punch(0.86 * p, i, 0.16), 1.15).add(sub(0.8, D1, 210, 0.26, 0.04, 2.0), 1.15).add(sub(0.4, D1 * 2, 300, 0.11, 0.02), 0.6).add(gore(i, 0.82 * p, 0.2), 0.75, 0.008).add(gore(i + 3, 0.6, 0.26), 0.45, 0.03).add(edge(i + 1, 0.7, 0.1), 0.42).add(lp(load(WM + 'metal_sheet_06.ogg', 0.5), 1100) * ad(int(.62 / .5 * SR) + 9, 0.003, 0.12)[:len(load(WM + 'metal_sheet_06.ogg', 0.5))], 0.3).verb(1.1, 0.16, bright=3800).glue(1.8).out(0.97)
@cook('block', 4)
def _(i): p = 1 + 0.05 * (i - 1.5); return Pot(0.9).add(snap(0.8, i), 0.7).add(punch(1.0 * p, i, 0.08), 0.9).add(sub(0.35, D1 * 2, 220, 0.1), 0.9).add(hp(load(CLASH + 'sword_clash.%d.ogg' % [4, 5, 8, 9][i], 0.62 * p, dur=0.4), 900) * ad(int(.4 * SR) + 2, 0.001, 0.09)[:len(load(CLASH + 'sword_clash.%d.ogg' % [4, 5, 8, 9][i], 0.62 * p, dur=0.4))], 0.6).add(lp(load(WM + 'metal_sheet_0%d.ogg' % [2, 3, 5, 6][i], 0.6), 1800), 0.5).add(hp(load(SC + 'scrape-4.wav', 1.3, start=0.4, dur=0.3), 1500) * np.linspace(1, 0, int(.3 * SR * 1.3 / 1.3) + 2)[:len(load(SC + 'scrape-4.wav', 1.3, start=0.4, dur=0.3))], 0.16, 0.05).verb(0.8, 0.12).glue(1.6).out(0.88)
@cook('parry', 2)
def _(i): return Pot(2.6).add(snap(1.2, i), 1).add(punch(0.8, i, 0.14), 1).add(doom(1.8, D1), 0.9).add(hp(load(CLASH + 'sword_clash.%d.ogg' % [6, 7][i], 0.8, dur=0.7), 1400) * ad(int(.7 * SR) + 2, 0.001, 0.18)[:len(load(CLASH + 'sword_clash.%d.ogg' % [6, 7][i], 0.8, dur=0.7))], 0.75).add(hp(load(CLASH + 'sword_clash.5.ogg', 0.55, dur=0.5), 700), 0.35).add(air(0.9, 6000, 500, 0.05, 0.22), 0.4).verb(2.0, 0.3, bright=6000).glue(1.8).out(0.98, True)
@cook('perfect')
def _(i): s = 1.8; return Pot(s).add(air(s, 4800, 260, 0.06, 0.3), 0.8).add(sub(1.4, D1, 110, 0.6, 0.12, 1.4), 0.9).add(shing(1, 0.55, 0.6), 0.5).add(load(LOOSE + 'teleport.wav', 0.6, dur=1.2) * np.linspace(1, 0, int(1.2 * SR) + 2)[:len(load(LOOSE + 'teleport.wav', 0.6, dur=1.2))], 0.4).verb(2.0, 0.35).glue(1.2).out(0.72, True)
@cook('riteCut', 4)
def _(i): p = 2 ** ([0, 3, 5, 7][i] / 24); return Pot(1.3).add(snap(1, i), 1).add(air(0.34, 3000, 11000, 0.012, 0.05), 0.9).add(shing(i, 1.25 * p, 0.35), 0.8).add(edge(i, 0.9, 0.1), 0.45).add(sub(0.45, D1 * 2 * p, 300, 0.13, 0.02, 2), 1).add(punch(0.95, i, 0.09), 0.7).verb(1.6, 0.26, bright=7000).glue(1.7).out(0.86, True)
@cook('ritesCut')
def _(i): return Pot(4.5).add(doom(3.2, D1, 1), 1.1).add(snap(1.3), 1).add(punch(0.6, 1, 0.3), 1).add(braam(3.6, D1 * 2, 0.9), 0.5).add(load(RPG + 'spell_fire_03.ogg', 0.7), 0.5, 0.05).add(air(1.2, 9000, 260, 0.03, 0.32), 0.7).add(load(BRK + 'bfh1_falling_04.ogg', 0.6), 0.2, 0.25).verb(3.0, 0.4).glue(2.0).out(1.0, True)
@cook('finalCut')
def _(i):
    o = Pot(6.0).add(air(0.4, 2000, 12000, 0.02, 0.06), 1).add(shing(0, 0.8, 0.5), 0.9).add(snap(1.2), 1).add(sub(0.4, D1 * 2, 400, 0.1), 0.8); o.verb(2.4, 0.3, bright=8000)
    return o.add(doom(4.0, D1), 1.4, 0.42).add(braam(4.2, D1 * 2, 0.7), 0.55, 0.42).add(gore(1, 0.5, 0.4), 0.5, 0.42).verb(3.2, 0.22).glue(1.9).out(1.0, True)
@cook('sheathe')
def _(i): return Pot(1.8).add(shing(1, 0.62, 0.8), 1.0).add(shing(3, 0.8, 0.6), 0.5, 0.12).add(air(0.8, 900, 5200, 0.35, 0.2), 0.4).add(snap(0.5), 0.35, 0.6).add(punch(1.2, 0, 0.05), 0.5, 0.6).verb(1.8, 0.3, bright=7000).glue(1.1).out(0.6, True)
@cook('wipe')
def _(i): return Pot(1.8).add(shing(2, 0.5, 0.9), 0.7).add(load(RPG + 'spell_fire_02.ogg', 0.8) , 0.9, 0.1).add(air(1.1, 400, 3400, 0.6, 0.3), 0.5).verb(1.4, 0.2).glue(1.3).out(0.66, True)

# ---------------------------------------------------------------- weight and fire
@cook('slam', 3)
def _(i): p = 1 - 0.06 * i; return Pot(2.6).add(doom(2.0, D1, 1), 1.2).add(snap(0.8, i), 0.7).add(punch(0.62 * p, i, 0.24), 1).add(lp(load(BRK + 'bfh1_rock_breaking_01.ogg', 0.5 * p), 3200), 0.55, 0.01).add(lp(load(BRK + 'bfh1_rock_falling_0%d.ogg' % (1 + i), 0.55), 2600), 0.3, 0.2).add(lp(load(BRK + 'bfh1_falling_05.ogg', 0.6), 3000), 0.22, 0.12).verb(1.6, 0.18, bright=3000).glue(2.0).out(0.98, True)
@cook('thud', 3)
def _(i): p = 1 - 0.07 * i; return Pot(1.4).add(sub(0.9, D1, 150, 0.24, 0.04, 1.9), 1.1).add(punch(0.75 * p, i, 0.12), 0.9).add(lp(load(BRK + 'bfh1_hit_0%d.ogg' % [2, 5, 8][i], 0.6 * p), 1600), 0.6).add(lp(load(BRK + 'bfh1_rock_falling_01.ogg', 0.6), 1800), 0.18, 0.06).verb(1.0, 0.12, bright=2600).glue(1.6).out(0.85)
@cook('boom', 2)
def _(i): return Pot(4.0).add(doom(3.4, D1, 1), 1.3).add(snap(1.1, i), 0.9).add(punch(0.5, 1 + i, 0.4), 1.1).add(load(LOOSE + '105016__julien-matthey__jm-fx-fireball-01.wav', 0.75, start=0.3), 0.8, 0.02).add(load(RPG + 'spell_fire_0%d.ogg' % (3 + i), 0.7), 0.45, 0.08).add(lp(load(BRK + 'bfh1_falling_04.ogg', 0.55), 3600), 0.25, 0.25).verb(2.4, 0.28, bright=4200).glue(2.0).out(1.0, True)
@cook('erupt', 2)
def _(i): return Pot(3.0).add(doom(2.2, D1, 1), 1).add(punch(0.6, i, 0.22), 0.9).add(load(LOOSE + '105016__julien-matthey__jm-fx-fireball-01.wav', 0.95 + 0.1 * i, start=0.25), 0.95, 0.02).add(load(RPG + 'spell_fire_0%d.ogg' % (2 + i), 0.85), 0.6, 0.03).add(lp(load(BRK + 'bfh1_rock_breaking_01.ogg', 0.6), 3200), 0.4).verb(1.6, 0.2).glue(1.9).out(0.97, True)
@cook('fire', 3)
def _(i): return Pot(1.9).add(load(RPG + 'spell_fire_0%d.ogg' % [2, 4, 6][i], 0.82), 1).add(load(LOOSE + '105016__julien-matthey__jm-fx-fireball-01.wav', 1.15 + .1 * i, start=0.3, dur=1.0), 0.8).add(sub(0.5, D1 * 2, 120, 0.2), 0.5).verb(1.0, 0.14).glue(1.5).out(0.75)
@cook('flare', 2)
def _(i): return Pot(1.1).add(load(RPG + 'spell_fire_0%d.ogg' % [1, 6][i], 1.05), 0.9).add(air(0.6, 300, 1700, 0.12, 0.1), 0.6).add(sub(0.3, D1 * 2, 110, 0.12), 0.4).verb(0.8, 0.12).glue(1.2).out(0.48)
@cook('vanish')
def _(i): return Pot(1.6).add(air(0.8, 5200, 220, 0.06, 0.2), 1).add(load(RPG + 'spell_fire_06.ogg', 1.2), 0.7).add(load(LOOSE + 'sand-spell.flac', 0.9), 0.5).add(sub(0.6, D1 * 2, 200, 0.2), 0.7).verb(1.4, 0.25).glue(1.4).out(0.72, True)
@cook('reform')
def _(i): return Pot(1.2).add(suck(0.38, 500), 0.9).add(load(RPG + 'spell_fire_01.ogg', 1.1), 0.6, 0.2).add(shing(1, 0.9, 0.3), 0.6, 0.3).add(sub(0.4, D1 * 2, 160, 0.12), 0.7, 0.34).verb(1.0, 0.18).glue(1.3).out(0.66)
@cook('break')
def _(i): return Pot(3.0).add(snap(1.3), 1.1).add(doom(2.2, D1), 1.2).add(punch(0.7, 0, 0.2), 1).add(load(BRK + 'bfh1_glass_breaking_01.ogg', 0.45), 0.4).add(lp(load(BRK + 'bfh1_rock_breaking_01.ogg', 0.55), 5000), 0.55).add(hp(load(CLASH + 'sword_clash.6.ogg', 0.5, dur=0.5), 700), 0.45).add(air(1.0, 7000, 300, 0.04, 0.26), 0.5).verb(2.0, 0.26).glue(2.1).out(1.0, True)
@cook('snap')
def _(i):
    o = Pot(2.8)
    for k in range(4): o.add(lp(load(WM + 'wood_breaking_0%d.ogg' % (1 + k % 2), 0.34 + .04 * k), 2600), 0.6, k * 0.09).add(sub(0.3, D1 * 2, 140, 0.1), 0.4, k * 0.09)
    o.add(hp(load(USC + 'gallows1.wav', 0.9, start=.35, dur=1.2), 50), 1.0, 0.36).add(hp(load(USC + 'beam.wav', 0.7, start=1.0, dur=1.6), 60), 0.5, 0.5)
    return o.add(doom(1.8), 1.2, 0.46).add(groan(0.5, 0, 0.8), 0.5).verb(1.6, 0.2).glue(1.8).out(0.97, True)

# ---------------------------------------------------------------- the hero
@cook('dodge', 4)
def _(i): p = 1 + .06 * (i - 1.5); return Pot(0.7).add(air(0.5, 240 * p, 1500 * p, 0.13, 0.075), 1).add(load('rpg_sound_pack/cloth-heavy.wav', 0.9 * p), 0.8, 0.02).add(load(SWISH + 'swish-%d.wav' % [5, 6, 8, 2][i], 0.8 * p), 0.6, 0.06).add(load(RPG + 'spell_fire_01.ogg', 1.4, dur=0.4), 0.16, 0.05).verb(0.6, 0.08).glue(1.2).out(0.55)
@cook('jump', 2)
def _(i): return Pot(0.7).add(load(APP + 'boots-leather-jump-0%d.wav' % (1 + i * 2), 1), 0.9).add(air(0.5, 260, 1700, 0.17, 0.09), 0.7, 0.02).add(load('rpg_sound_pack/cloth.wav', 1.0), 0.5, 0.03).glue(1.2).out(0.5)
@cook('land', 2)
def _(i): return Pot(0.8).add(load(APP + 'boots-leather-jump-0%d.wav' % (3 - i), 0.85), 0.9).add(sub(0.35, D1 * 2, 150, 0.1), 0.9).add(lp(load(BRK + 'bfh1_rock_falling_01.ogg', 0.9), 2200), 0.14, 0.03).add(load('rpg_sound_pack/cloth-heavy.wav', 1.1), 0.4).verb(0.6, 0.08).glue(1.3).out(0.58)
@cook('leapt')
def _(i): return Pot(1.5).add(air(0.9, 300, 3600, 0.22, 0.14), 1).add(sub(0.9, D1 * 2, 90, 0.35, 0.1), 0.7).add(shing(0, 0.7, 0.5), 0.35, 0.1).add(load(RPG + 'spell_fire_01.ogg', 1), 0.35, 0.1).verb(1.4, 0.24).glue(1.3).out(0.66, True)
@cook('hurt', 3)
def _(i): p = 1 + 0.05 * (i - 1); return Pot(0.9).add(snap(0.7, i), 0.8).add(punch(0.85 * p, i, 0.11), 1.1).add(sub(0.5, D1, 180, 0.17, 0.03, 2), 1).add(gore(i + 2, 0.85, 0.16), 0.55).verb(0.7, 0.1).glue(1.7).out(0.9)
@cook('cloth', 3)
def _(i): return Pot(0.5).add(load('rpg_sound_pack/%s.wav' % ['cloth', 'cloth-heavy', 'cloth'][i], [1.0, 1.15, 1.25][i]), 1).out(0.18)
@cook('stepP', 4)
def _(i): return Pot(0.35).add(lp(load(APP + 'boots-leather-step-0%d.wav' % (1 + i), 1.0, dur=0.28), 4200), 1).add(sub(0.14, D1 * 2, 140, 0.03), 0.4).out(0.24)
@cook('stepK', 3)
def _(i): return Pot(0.9).add(sub(0.6, D1, 120, 0.15, 0.03, 1.8), 1).add(lp(load(APP + 'boots-leather-jump-0%d.wav' % (1 + i), 0.55), 1500), 0.8).add(lp(load(RPG + 'item_stone_01.ogg', 0.6), 1600), 0.35).verb(0.8, 0.1, bright=2400).glue(1.4).out(0.56)
@cook('stepC', 4)
def _(i): return Pot(0.5).add(lp(load(APP + 'boots-leather-step-0%d.wav' % (1 + i), 0.7), 1800), 1).add(gore(i, 0.9, 0.06), 0.35).add(sub(0.25, D1 * 2, 110, 0.07), 0.6).glue(1.2).out(0.4)
@cook('scrape', 4)
def _(i): x = load(SC + 'scrape-%d.wav' % [4, 5, 7, 8][i], 0.85, start=0.35, dur=0.5); return Pot(0.7).add(x * bell(len(x) / SR, 0.2, 0.13)[:len(x)], 1).add(lp(load(SC + 'scrape-1.wav', 0.8, start=.3, dur=0.5), 1400), 0.5).glue(1.3).out(0.5)
@cook('heal')
def _(i):
    s = 2.4; t = T(s); o = np.zeros(len(t))
    for f in (146.8, 220, 293.7): o += saws(s, f, 5, 10)
    return Pot(s).add(lp(o, 1400) * np.minimum(1, t / 0.5) * np.exp(-np.maximum(0, t - 0.7) / 0.5), 0.7).add(load(RPG + 'spell_fire_04.ogg', 0.8), 0.8).add(suck(0.5, 200), 0.4).add(sub(1.0, D1 * 2, 90, 0.4), 0.5, 0.4).verb(1.8, 0.3).glue(1.3).out(0.66, True)
@cook('ready')
def _(i): s = 1.2; t = T(s); return Pot(s).add(lp(saws(s, 146.8, 5, 12) + saws(s, 220, 5, 12) * .6, 1300) * np.minimum(1, t / 0.06) * np.exp(-t / 0.3), 0.6).add(load(RPG + 'spell_fire_01.ogg', 1), 0.7).verb(1.2, 0.2).out(0.42)
@cook('aura0')
def _(i): return _aura(0)
@cook('aura1')
def _(i): return _aura(1)
@cook('aura2')
def _(i): return _aura(2)
@cook('aura3')
def _(i): return _aura(3)
def _aura(k):
    s = 2.6 + .4 * k; t = T(s); o = np.zeros(len(t))
    for q in (0, 7, 12, 15)[:2 + k]: o += saws(s, 73.4 * 2 ** (q / 12), 7, 16)
    return Pot(s).add(sat(lp(o, 700 + 600 * k) * np.minimum(1, t / 0.08) * np.exp(-np.maximum(0, t - 0.35) / 0.6), 1.6), 0.8).add(doom(1.6, D1, 1), 0.5 + .2 * k).add(load(LOOSE + '105016__julien-matthey__jm-fx-fireball-01.wav', 1.1, start=.2), 0.6).add(load(RPG + 'spell_fire_03.ogg', 0.9), 0.35).verb(1.8, 0.25).glue(1.6).out(0.8, True)

# ---------------------------------------------------------------- warnings
@cook('cueWhite', 3)
def _(i): return Pot(0.7).add(shing(i, 0.95 + .05 * i, 0.34), 1.0).add(suck(0.2, 900), 0.5).add(air(0.3, 1400, 6200, 0.16, 0.06), 0.4).add(snap(0.5, i), 0.35, 0.2).verb(0.9, 0.16, bright=8000).glue(1.1).out(0.6)
@cook('cueRed', 2)
def _(i): return Pot(1.5).add(doom(1.1, D1 * 2 ** (1 / 12)), 0.9).add(doom(1.0, D1), 0.9, 0.15).add(lp(load(CR1 + 'roar_02.ogg', 0.7 - .06 * i), 2200), 0.8).add(groan(0.6, i, 0.7), 0.5).verb(1.2, 0.18).glue(1.9).out(0.88)
@cook('cueGround')
def _(i): s = 1.2; t = T(s); return Pot(s).add(lp(load(LOOSE + 'Earth_Element_Magic_Spell_0.flac', 1.1, start=0.1, dur=1.0), 2200), 0.9).add(sweep(s, 46, 78, 0.5) * np.minimum(1, t * 1.4) * np.exp(-np.maximum(0, t - .8) / .12), 0.7).add(groan(0.5, 1, 1.0), 0.5).glue(1.6).out(0.74)

# ---------------------------------------------------------------- the King
def creature(files, pitch, s=1.2, low=0.0, wet=0.2, drive=1.8, hpf=70, lpf=5200):
    o = Pot(s)
    for k, f in enumerate(files): o.add(lp(hp(load(f, pitch * (1 - .07 * k)), hpf), lpf), 1.0 / (1 + .4 * k), 0.012 * k, (-.3, .3, 0, 0)[k % 4])
    if low: o.add(sub(min(s, 1.0), D1, 90, 0.3, 0.1, 1.5), low)
    return o.verb(1.1, wet, bright=3800).glue(drive)
@cook('kBreath', 3)
def _(i): return creature([LOOSE + 'silent_beast_growl_%d.mp3' % (1 + i), CR1 + 'breath.ogg'], [1.5, 1.3, 1.4][i], 1.9, 0, .25, 1.3).out(0.5)
@cook('kGrunt', 3)
def _(i): return creature([[CR1 + 'roar_01.ogg', CR2 + 'monster_15.ogg', CR1 + 'roar_02.ogg'][i], LOOSE + 'silent_beast_growl_1.mp3'], [0.72, 0.62, 0.66][i], 1.2, 0.3).out(0.75)
@cook('kPain', 4)
def _(i): return creature([[CR1 + 'monster_03.ogg', CR2 + 'monster_09.ogg', CR1 + 'monster_06.ogg', CR2 + 'monster_12.ogg'][i], LOOSE + 'silent_beast_growl_3.mp3'], 0.6 + .03 * i, 1.4, 0.3, .25, 2.0).out(0.82)
@cook('kScreech', 2)
def _(i): return creature([CR1 + 'scream_0%d.ogg' % (1 + i), CR2 + 'monster_19.ogg', CR1 + 'roar_02.ogg'], 0.52 + .04 * i, 2.8, 0.7, .35, 2.4, 90, 6500).out(0.95, True)
@cook('kDeath')
def _(i): return creature([CR2 + 'monster_20.ogg', CR1 + 'scream_02.ogg', LOOSE + 'silent_beast_growl_2.mp3'], 0.5, 4.2, 0.8, .4, 2.2).out(0.97, True)

# ---------------------------------------------------------------- the One Beneath
@cook('bRoar', 2)
def _(i):
    o = Pot(5.0); o.add(load(LOOSE + 'monster_roar.wav', 1.15 - .1 * i, dur=3.6), 1.0).add(load(LOOSE + 'monster_roar.wav', 0.72, dur=3.8), 0.6, 0.03).add(lp(load(CR1 + 'scream_02.ogg', 0.36), 3800), 0.5, 0.05, -.4).add(lp(load(CR2 + 'roar_05.ogg', 0.5), 4200), 0.7, 0.02, .4).add(load(CR2 + 'roar_06.ogg', 0.62), 0.6, 0.25)
    o.add(sub(3.0, D1, 60, 1.2, 0.2, 1.6), 0.7).add(load(LOOSE + '105016__julien-matthey__jm-fx-fireball-01.wav', 0.5), 0.5); o.x = np.tanh(o.x / np.abs(o.x).max() * 2.6); return o.verb(2.6, 0.3, bright=4600).glue(1.8).out(1.0, True)
@cook('bBark', 3)
def _(i): return creature([CR2 + 'roar_0%d.ogg' % (4 + i), CR2 + 'attack_0%d.ogg' % (1 + i)], 0.78, 1.2, 0.4, .2, 2.3).out(0.88)
@cook('bPain', 3)
def _(i): return creature([CR2 + 'roar_0%d.ogg' % (4 + i), [CR2 + 'monster_15.ogg', CR2 + 'monster_12.ogg', CR1 + 'monster_06.ogg'][i]], 0.56, 1.5, 0.4, .25, 2.3).out(0.9)
@cook('bDeath')
def _(i):
    o = creature([LOOSE + 'monster_roar.wav', CR2 + 'die_01.ogg', CR1 + 'scream_01.ogg'], 0.62, 6.5, 0.9, .45, 2.4); return o.add(load(RPG + 'spell_fire_03.ogg', 0.5), 0.35, 0.6).out(1.0, True)

# ---------------------------------------------------------------- scenes
def _rise(k):
    """A joint goes into place: the breath in, then the weight of it. Three in a row, each bigger."""
    o = Pot(3.2); at = 0.42; o.add(suck(at, 180), 0.75).add(groan(0.5 - .06 * k, k, 1.0), 0.6, at - 0.28)
    o.add(doom(2.2, D1 * [1, 2 ** (1 / 12), 2 ** (-2 / 12)][k]), 1.1 + .15 * k, at).add(punch(0.6 - .05 * k, k, 0.2), 0.9, at).add(gore(k, 0.42, 0.4), 0.75, at + 0.01).add(gore(k + 3, 0.34, 0.5), 0.6, at + 0.06).add(lp(load(BRK + 'bfh1_wood_breaking_03.ogg', 0.22), 1300), 0.5, at).add(lp(load(WM + 'metal_sheet_06.ogg', 0.28), 900), 0.5, at)
    return o.verb(2.4, 0.3, bright=3200).glue(2.0).out(0.9 + .05 * k, True)
@cook('rise0')
def _(i): return _rise(0)
@cook('rise1')
def _(i): return _rise(1)
@cook('rise2')
def _(i): return _rise(2)
@cook('braam', 2)
def _(i): return Pot(5.0).add(braam(4.4, D1 * 2 * [1, 2 ** (-2 / 12)][i], 1), 1.0).add(doom(3.4, D1 * [1, 2 ** (-2 / 12)][i]), 1.0).add(snap(0.6), 0.4).verb(3.0, 0.35, bright=4200).glue(1.9).out(1.0, True)
@cook('doom', 2)
def _(i): return Pot(4.0).add(doom(3.4, D1 * [1, 2 ** (-2 / 12)][i]), 1.2).add(lp(load(DARK + 'ambience-%d.wav' % (3 + i), 0.8), 900), 0.5).verb(3.0, 0.35, bright=2600).glue(1.8).out(0.98, True)
@cook('riser')
def _(i):
    s = 2.2; t = T(s); u = t / s; o = np.zeros(len(t))
    for m in (1, 1.4983, 2, 3): o += saws(s, 73.4 * m, 5, 20)
    return Pot(s + 0.05).add(lp(o, 2600) * u ** 2.0, 0.6).add(moving(noise(s), lambda q: 200 + 6400 * (q / s) ** 2.2, 1.0) * u ** 1.8, 1.0).add(np.sin(2 * np.pi * np.cumsum(60 + 500 * u ** 3) / SR) * u ** 2, 0.4).glue(1.4).out(0.82, True)
@cook('riserL')
def _(i):
    s = 3.4; t = T(s); u = t / s; o = np.zeros(len(t))
    for m in (1, 2 ** (1 / 12), 1.4983, 2): o += saws(s, 73.4 * m, 7, 24)
    return Pot(s + 0.05).add(lp(o, 1800) * u ** 2.4, 0.7).add(moving(noise(s), lambda q: 120 + 5200 * (q / s) ** 2.4, 0.9) * u ** 2, 0.9).add(load(LOOSE + 'monster_roar.wav', 0.5, dur=3.2, rev=True) * np.linspace(0, 1, int(3.2 * SR) + 2)[:len(load(LOOSE + 'monster_roar.wav', 0.5, dur=3.2, rev=True))] ** 2, 0.6, 0.15).add(hp(sweep(s, 40, 40, 1) * (0.5 + .5 * np.sin(2 * np.pi * np.cumsum(3 + 15 * u ** 2) / SR)) * u, 30), 0.6).glue(1.5).out(0.9, True)
@cook('swell')
def _(i): return Pot(1.5).add(suck(1.4, 120), 1).add(suck(0.7, 700), 0.5, 0.7).glue(1.2).out(0.75, True)
@cook('drop')
def _(i): s = 3.6; return Pot(s).add(sat(sweep(s, 150, 22, 0.9) * ad(int(s * SR), 0.01, 1.1), 1.8), 1.0).add(lp(load(DARK + 'ambience-2.wav', 0.6), 500), 0.5).verb(2.0, 0.2, bright=1200).out(0.95, True)
@cook('groan', 2)
def _(i): return Pot(3.4).add(groan(0.36, i, 2.6), 1).add(lp(load(DARK + 'ambience-%d.wav' % [1, 5][i], 0.8, dur=2.8), 900), 0.5).verb(2.4, 0.4, bright=2200).glue(1.4).out(0.75, True)
@cook('creak', 2)
def _(i): return Pot(2.2).add(groan(0.8 + .1 * i, i, 1.2), 0.9).add(lp(hp(load(S1 + 'door_0%d.ogg' % (1 + i), 0.4), 80), 1600), 0.7, 0.1).verb(1.8, 0.3, bright=2600).out(0.6, True)
@cook('tear')
def _(i):
    o = Pot(4.0); g = np.random.default_rng(3)
    for k in range(16): o.add(gore(k, g.uniform(.3, .6), 0.3), 0.35 + .5 * k / 16, 0.1 + k * 0.17 + g.uniform(0, .06), g.uniform(-.5, .5))
    for k in range(5): o.add(lp(load('rpg_sound_pack/cloth-heavy.wav', 0.3), 1800), 0.5, 0.3 + k * .5, (-1) ** k * .3)
    return o.add(groan(0.34, 0, 2.6), 0.6, 0.2).add(sub(3.4, D1, 50, 1.6, .4, 1.4), 0.4).verb(1.8, 0.25, bright=3400).glue(1.8).out(0.95, True)
@cook('whisper')
def _(i):
    o = Pot(6.0); g = np.random.default_rng(5)
    for k in range(9): x = hp(lp(load(LOOSE + 'monster-snarls-2.ogg', g.uniform(.8, 1.3), start=g.uniform(0, 3.5), dur=1.6), 5200), 900); o.add(x * np.hanning(len(x)), g.uniform(.3, .8), g.uniform(0, 4.2), g.uniform(-.8, .8))
    return o.verb(3.0, 0.8, bright=5200).out(0.36, True)
@cook('heart')
def _(i): return Pot(1.3).add(sub(0.5, D1, 95, 0.13, 0.03, 1.6), 1).add(lp(load(BANG + 'cannon_01.ogg', 0.45, dur=.3), 260), 0.5).add(sub(0.5, D1, 80, 0.11, 0.03, 1.6), 0.75, 0.25).verb(0.9, 0.12, bright=900).out(0.62)
@cook('barFill')
def _(i):
    s = 3.6; o = Pot(s); u = T(1.3) / 1.3; o.add(lp(saws(1.3, D1 * 2, 7, 20), 1500) * u ** 1.8, 0.5).add(moving(noise(1.3), lambda q: 150 + 4200 * (q / 1.3) ** 2, 1) * u ** 2, 0.5)
    at, gap = 0.0, 0.26
    while at < 1.22: o.add(sub(0.3, D1 * 2, 130, 0.09), 0.35 + .5 * at, at).add(punch(0.8, 1, 0.05), 0.25 + .4 * at, at); at += gap; gap = max(0.07, gap * 0.82)
    return o.add(doom(2.2, D1), 1.4, 1.3).add(braam(2.2, D1 * 2, 0.7), 0.45, 1.3).verb(1.8, 0.2).glue(1.9).out(0.92, True)
@cook('die')
def _(i): return Pot(4.2).add(doom(3.0, D1 * 2 ** (-2 / 12)), 1).add(air(2.4, 2400, 120, 0.1, 0.8), 0.6).add(load(RPG + 'spell_fire_05.ogg', 0.6), 0.6).add(braam(3.4, D1 * 2 * 2 ** (-2 / 12), 0.35), 0.45).verb(2.8, 0.4, bright=2600).glue(1.5).out(0.9, True)
# ---------------------------------------------------------------- stone
def rock(i=0, p=1.0, top=5200, dur=None): return lp(hp(load(BRK + ['bfh1_rock_breaking_01.ogg', 'bfh1_rock_breaking_02.ogg', 'bfh1_rock_breaking_03.ogg', 'bfh1_rock_falling_05.ogg'][i % 4], p, dur=dur), 60), top)
def crumble(i=0, p=1.0, top=4200): return lp(hp(load([BRK + 'bfh1_rock_falling_0%d.ogg' % (1 + i % 9), 'sfx_100_v2/sfx100v2_stones_0%d.ogg' % (1 + i % 3)][i % 2], p), 90), top)
def wall(at, p=1.0, dur=3.0, top=7000): return lp(hp(load(USC + 'wall.wav', p, start=at, dur=dur), 55), top)
def heavy(i, p=1.0, dur=0.9): return hp(load(USC + 'heavy.wav', p, start=[0, 2.4, 4.4, 6.4, 8.5][i % 5], dur=dur), 45)
def rocks(at, p=1.0, dur=2.5): return hp(load(USC + 'rocks.wav', p, start=at, dur=dur), 90)
@cook('chip', 4)
def _(i): p = 1 + 0.07 * (i - 1.5); return Pot(1.2).add(snap(0.8, i), 0.8).add(punch(1.0 * p, i, 0.07), 0.9).add(rock(i, 0.95 * p, 6500, 0.5), 0.75).add(edge(i, 0.8, 0.05), 0.2).add(crumble(i, 0.9 * p), 0.4, 0.08).add(sub(0.3, D1 * 2, 190, 0.09), 0.8).add(heavy(i, 1.25 * p, 0.4), 0.45).verb(0.9, 0.12, bright=3800).glue(1.6).out(0.75)
@cook('stone', 4)
def _(i): p = 1 + 0.1 * (i - 1.5); return Pot(1.1).add(punch(0.75 * p, i, 0.1), 0.9).add(sub(0.35, D1 * 2, 140, 0.11), 0.9).add(rock(i + 1, 0.7 * p, 2600, 0.5), 0.6).add(crumble(i + 3, 0.75 * p, 3000), 0.4, 0.04).add(heavy(i, 0.9 * p, 0.8), 0.8).verb(0.8, 0.12, bright=2600).glue(1.5).out(0.5)
@cook('shatter', 3)
def _(i): p = 1 - 0.06 * i; return Pot(3.0).add(snap(1.1, i), 1).add(punch(0.7 * p, i, 0.2), 1).add(sub(0.8, D1, 190, 0.28, 0.04, 2), 1).add(rock(i, 0.62 * p, 5200), 0.95).add(rock(i + 1, 0.85 * p, 6000), 0.5, 0.07).add(crumble(i, 0.8), 0.6, 0.22).add(crumble(i + 4, 0.65), 0.5, 0.5).add(crumble(i + 7, 0.9), 0.3, 0.95).add(wall(10.6 + .4 * i, 1.0, 2.6), 0.8).add(heavy(i, 0.85), 0.6).add(rocks([4.5, 12.4, 19][i], 0.95), 0.5, 0.35).verb(1.4, 0.18, bright=3600).glue(1.8).out(0.92)
@cook('crackStone', 2)
def _(i):
    o = Pot(2.4)
    for k, at in enumerate((0, .13, .31, .4, .72)): o.add(rock(k + i, 1.1 - .1 * k, 6500, 0.4), 0.9 - .1 * k, at).add(snap(0.6, k), 0.5, at).add(sub(0.4, D1 * 2, 150, 0.1), 0.6, at)
    o.add(hp(load(USC + 'structure.wav', 0.8, start=.2 + i, dur=2.2), 60), 0.8, 0.05); return o.add(groan(0.5, i, 1.6), 0.8, 0.2).verb(1.6, 0.22, bright=3200).glue(1.7).out(0.85)
@cook('collapse', 2)
def _(i):
    o = Pot(5.0).add(doom(3.2, D1), 1.4).add(snap(1.0), 0.8).add(punch(0.5, 1 + i, 0.4), 1.2).add(rock(0, 0.45, 3400), 1.0).add(rock(2, 0.6, 4600), 0.7, 0.05).add(lp(load('sfx_100_v2/sfx100v2_thunder_01.ogg', 0.8), 900), 0.5)
    o.add(wall(10.4, 0.82, 3.2), 1.1).add(hp(load(USC + 'boulders.wav', 0.8, start=[9.8, 2.3][i], dur=3.6), 45), 0.9, 0.06).add(rocks(12.4 + 3 * i, 0.85, 3.2), 0.6, 0.9)
    for k in range(9): o.add(crumble(k + i, 0.55 + .06 * k, 3600), 0.65 - .05 * k, 0.12 + 0.2 * k + .05 * (k % 2))
    for k in range(4): o.add(punch(0.6 + .08 * k, k, 0.1), 0.5, 0.2 + .27 * k)
    return o.verb(2.2, 0.26, bright=2800).glue(2.0).out(1.0, True)
@cook('quake')
def _(i):
    s = 6.0; t = T(s); w = np.minimum(1, t / 0.25) * np.exp(-np.maximum(0, t - 1.6) / 1.5); r = lp(hp(noise(s), 28), 160) * (0.6 + 0.4 * np.sin(2 * np.pi * 7.3 * t + 2 * np.sin(2 * np.pi * 1.7 * t))) * w
    o = Pot(s).add(norm(r), 1.0).add(doom(3.4, D1), 1.2).add(braam(3.6, D1 * 2 * 2 ** (1 / 12), 0.6), 0.5, 0.1).add(groan(0.3, 0, 3.4), 0.7, 0.2).add(lp(load('sfx_100_v2/sfx100v2_thunder_01.ogg', 0.6), 1400), 0.6, 0.1)
    o.add(hp(load(USC + 'quake.wav', 0.75, start=9.5, dur=4.5), 40), 0.7, 0.1).add(load(USC + 'rumble.wav', 0.7, dur=5), 0.6)
    for k in range(8): o.add(crumble(k, 0.6 + .05 * k, 3200), 0.4, 0.4 + .42 * k).add(rock(k, 0.5, 2600, 1.2), 0.35, 0.3 + .5 * k)
    return o.verb(3.0, 0.3, bright=2600).glue(1.9).out(1.0, True)
#: Beds: whole seconds that meet their own beginning, with a quarter second spare at each end (sound.ts loops the middle).
LOOPS = {'storm', 'wind', 'fireBed', 'waterBed', 'windLow', 'lampsBed', 'clothBed'}
def ring(x, L, fade=1.5):
    """`L` seconds cut from a recording so that its end runs into its start."""
    n, f = int(L * SR), int(fade * SR); x = x[:n + f].copy(); assert len(x) == n + f, len(x) / SR; u = np.sin(np.linspace(0, np.pi / 2, f)); x[:f] = x[:f] * u + x[n:] * u[::-1]; return x[:n]
def bed(L, left, right, level, top=0.5):
    """Two different stretches, one for each ear, evened out to one loudness."""
    x = np.stack([left, right]); w = int(.8 * SR); e = np.sqrt(np.maximum(1e-9, np.stack([np.convolve(np.r_[c[-w:] ** 2, c ** 2, c[:w] ** 2], np.ones(w) / w, 'same')[w:-w] for c in x]).mean(0))); x = x / e ** .6
    x = x / np.sqrt((x ** 2).mean()) * 10 ** (level / 20); x = np.tanh(x / top) * top; o = Pot(L + .5); o.x[:] = np.concatenate([x[:, -(SR // 4):], x, x[:, :SR // 4]], 1)[:, :o.x.shape[1]]; return o.x
USC = 'usc/'
@cook('storm')
def _(i): L = 12; g = lambda a, b: ring(hp(load(USC + 'gust.wav', start=a), 60)[:int(14 * SR)] + .5 * hp(load(USC + 'spooky.wav', start=b), 400)[:int(14 * SR)], L); return bed(L, g(1, 4), g(7.5, 22), -22)
@cook('wind')
def _(i): L = 14; g = lambda a, b: ring(lp(load(USC + 'spooky.wav', start=a), 3800)[:int(16 * SR)] + .4 * lp(load(USC + 'spooky.wav', .6, start=b)[:int(16 * SR)], 900), L); return bed(L, g(2, 20), g(30, 8), -24)
@cook('fireBed')
def _(i): L = 12; g = lambda a, b: ring(hp(load(USC + 'fire.wav', start=a), 120)[:int(14 * SR)] + .55 * hp(load(USC + 'firelow.wav', start=b), 45)[:int(14 * SR)], L); return bed(L, g(6, 2), g(28, 20), -24)

@cook('uiMove')
def _(i): return Pot(0.16).add(lp(load('rpg_sound_pack/cloth.wav', 1.8, dur=0.1), 3000), 0.8).add(sub(0.1, D1 * 4, 190, 0.02), 0.6).out(0.16)
@cook('uiPick')
def _(i): return Pot(0.9).add(sub(0.5, D1 * 2, 150, 0.14), 0.9).add(load(RPG + 'spell_fire_01.ogg', 1.2), 0.6).add(snap(0.4), 0.25).verb(0.9, 0.16).out(0.4)
@cook('uiGo')
def _(i): return Pot(3.6).add(doom(2.6, D1), 1.1).add(shing(1, 0.6, 0.7), 0.5).add(load(RPG + 'spell_fire_03.ogg', 0.8), 0.6).verb(2.6, 0.35).glue(1.6).out(0.85, True)

# ---------------------------------------------------------------- the river: water, rope and chain, wood, lamps, the dead
SPL, WMS, BRKF, GHO, SCR = 'water_splash_slime_sfx/', '100_CC0_wood_metal_SFX/', 'sfx_breaking_and_falling/', 'qubodup_GhostMoans/', 'scrapes/'
def fit(x, s): n = int(s * SR); return x[:n] if len(x) >= n else np.pad(x, (0, n - len(x)))
def splash(i=0, p=1.0, s=1.0): x = load(SPL + 'splash_0%d.ogg' % (1 + i % 5), p, dur=s); return fit(hp(x, 110), s)
def water(i=0, p=1.0, s=2.0, top=2600): x = np.tile(load(SPL + 'loop_water_0%d.ogg' % (1 + i % 3), p), 4); return fit(lp(x, top), s)
def bubbles(s=2.0, n=8, p=1.0, top=2400): o = Pot(s); [o.add(lp(load(SPL + 'bubble_0%d.ogg' % (1 + k % 3), p * (0.8 + 0.5 * rng.random()), dur=0.5), top), 0.3 + 0.7 * rng.random(), rng.random() * (s - 0.5)) for k in range(n)]; return fit(o.x.mean(0), s)
def metal(i=0, p=1.0, d=0.3, low=500): x = load(WMS + 'metal_hit_0%d.ogg' % (1 + i % 5), p, dur=d); return hp(x, low)
def moan(i=0, p=0.8, s=3.0): x = load(GHO + 'qubodup-GhostMoan0%d.wav' % (1 + i % 5), p, dur=s); return fit(lp(hp(x, 90), 2200), s)
@cook('waterDive', 2)
def _(i): s = 1.7; return Pot(s).add(splash(i, 0.8, 1.2), 1).add(water(i, 0.7, s, 600) * ad(int(s * SR), 0.1, 0.7), 0.7, 0.1).add(sub(1.2, D1 * 2, 90, 0.3), 0.6).add(bubbles(s, 7, 0.9), 0.5, 0.2).verb(1.4, 0.2).out(0.7)
@cook('breach')
def _(i): s = 3.2; return Pot(s).add(splash(0, 0.55, 1.4), 1).add(splash(2, 0.7, 0.8), 0.8, 0.06).add(sub(2.0, D1, 120, 0.5, 0.06, 2.2), 1.2).add(groan(0.5, 0, 1.6), 0.6, 0.05).add(bubbles(s, 14, 0.7), 0.7, 0.3).add(lp(load(USC + 'rumble.wav', 0.7, dur=3), 500), 0.5).verb(2.4, 0.3, bright=3000).glue(1.6).out(1.0, True)
@cook('wave')
def _(i): s = 4.0; return Pot(s).add(air(s, 300, 2800, 1.8, 0.9), 1).add(air(s, 200, 1500, 1.9, 1.0), 0.6).add(sub(3.0, D1 * 1.5, 70, 0.9, 0.2), 0.8, 0.8).add(bubbles(s, 16, 0.8), 0.5, 0.4).verb(2.0, 0.25).glue(1.4).out(0.8, True)
@cook('waveOpen')
def _(i): s = 1.3; return Pot(s).add(splash(1, 0.9, 1.0), 1).add(air(s, 2500, 900, 0.35, 0.3), 0.7).verb(1.0, 0.15).out(0.7)
@cook('drain')
def _(i): s = 4.2; return Pot(s).add(air(s, 1700, 300, 1.7, 1.0), 1).add(bubbles(s, 24, 0.7), 1.0, 0.2).add(water(0, 0.6, s, 400), 0.7).add(sub(3, D1 * 1.2, 60, 0.9, 0.2), 0.7, 0.4).verb(1.6, 0.25).glue(1.3).out(0.8, True)
@cook('boil')
def _(i): s = 6.6; e = ad(int(s * SR), 0.5, 4.0); return Pot(s).add(fit(load(SPL + 'loop_bubbles_02.ogg', 1.0), s) * e, 1).add(fit(hp(load(USC + 'fire.wav', 0.9, start=5, dur=6.4), 300), s) * e, 0.7).add(air(s, 400, 1800, 3.0, 1.6), 0.5).add(sub(5, D1 * 2, 70, 1.5, 0.3), 0.6).verb(2.0, 0.25).glue(1.4).out(0.75, True)
@cook('boatBreak')
def _(i): s = 1.9; return Pot(s).add(load(WMS + 'wood_breaking_01.ogg', 0.9, dur=0.6), 1).add(load(WMS + 'wood_cracking_02.ogg', 0.8, dur=0.5), 0.8, 0.05).add(punch(0.8, 1, 0.12), 0.9).add(sub(0.8, D1 * 2, 110, 0.2), 1.0).add(splash(3, 0.8, 0.8), 0.7, 0.12).add(bubbles(1.2, 6, 0.9), 0.4, 0.2).verb(1.4, 0.2).glue(1.5).out(0.95)
@cook('boatRise')
def _(i): s = 3.6; return Pot(s).add(groan(0.45, 1, 2.2), 0.9, 0.2).add(splash(0, 0.6, 1.4), 0.8).add(water(2, 0.7, s, 800), 0.7).add(bubbles(s, 14, 0.8), 0.5).verb(1.8, 0.25).out(0.7, True)
@cook('chainBite')
def _(i): s = 2.2; o = Pot(s).add(metal(2, 0.55, 0.5, 120), 1).add(load(WMS + 'metal_falling_01.ogg', 0.8, dur=1.2), 0.7, 0.05).add(punch(0.7, 2, 0.1), 0.9).add(sub(0.9, D1 * 2, 120, 0.25), 1.1); [o.add(metal(k, 1.0 + 0.2 * k, 0.12, 1500), 0.25, 0.15 + 0.08 * k) for k in range(8)]; return o.verb(1.2, 0.2).glue(1.5).out(0.95)
@cook('chainCut', 3)
def _(i): return Pot(0.9).add(metal(i, 1.0 + 0.12 * i, 0.4, 500), 1).add(snap(0.7, i), 0.5).add(sub(0.4, D1 * 3, 170, 0.07), 0.9).verb(0.8, 0.14).glue(1.5).out(0.85)
@cook('chainSnap')
def _(i): s = 2.8; o = Pot(s).add(load(WMS + 'metal_slam_01.ogg', 0.8, dur=0.6), 1).add(metal(3, 0.7, 0.5, 300), 0.8, 0.02).add(air(0.8, 700, 3200, 0.2, 0.2), 0.8, 0.03).add(doom(2.0, D1 * 1.2), 0.9, 0.05); [o.add(metal(k, 0.9 + 0.1 * (k % 4), 0.12, 1200), 0.3, 0.2 + 0.09 * k) for k in range(14)]; return o.verb(1.8, 0.28).glue(1.8).out(1.0, True)
@cook('chainSlide')
def _(i): s = 1.5; return Pot(s).add(lp(load(SCR + 'scrape-3.wav', 1.1, dur=1.4), 3200), 0.8).add(load(WMS + 'metal_falling_02.ogg', 1.0, dur=1.0), 0.5, 0.1).out(0.6)
@cook('chainHaul')
def _(i): s = 1.5; return Pot(s).add(lp(load(SCR + 'scrape-3.wav', 0.9, dur=1.4), 2600), 0.9).add(load(WMS + 'metal_falling_01.ogg', 0.9, dur=1.0), 0.6, 0.15).add(air(s, 400, 1600, 0.6, 0.4), 0.6).add(sub(0.6, D1 * 2, 110, 0.12), 0.9, 0.85).verb(0.9, 0.15).out(0.85)
@cook('poleRun')
def _(i): s = 1.1; return Pot(s).add(lp(load(SCR + 'scrape-1.wav', 1.0, dur=0.9), 2800), 0.9).add(load(WMS + 'wood_hit_02.ogg', 0.9, dur=0.3), 0.8, 0.05).add(sub(0.4, D1 * 3, 140, 0.08), 0.8, 0.05).out(0.7)
@cook('lampOut')
def _(i): s = 2.6; return Pot(s).add(air(s, 3400, 500, 0.5, 0.8), 0.7).add(fit(hp(load(USC + 'fire.wav', 0.8, start=12, dur=2.4), 1800), 2.4) * ad(int(2.4 * SR), 0.03, 0.6), 0.7).add(sub(1.4, D1 * 2, 80, 0.4), 0.8, 0.05).verb(1.6, 0.25).out(0.7, True)
@cook('lampsRelight')
def _(i): s = 2.0; return Pot(s).add(load(USC + 'ignite.wav', 0.9, dur=1.8), 1).add(air(s, 500, 3000, 0.3, 0.4), 0.6).add(fit(hp(load(USC + 'fire.wav', 1.0, start=20, dur=1.8), 700), 1.8) * ad(int(1.8 * SR), 0.05, 0.8), 0.6).verb(1.4, 0.2).glue(1.3).out(0.7, True)
@cook('lanternRise')
def _(i): s = 2.2; return Pot(s).add(air(s, 500, 1400, 1.0, 0.7), 0.6).add(saws(s, D1 * 4, 5, 14) * np.hanning(int(s * SR)), 0.25).add(fit(hp(load(USC + 'fire.wav', 1.0, start=4, dur=2), 1500), 2) * np.hanning(int(2 * SR)), 0.3).verb(1.6, 0.3).out(0.4, True)
@cook('lanternReal')
def _(i): s = 2.0; return Pot(s).add(load(USC + 'ignite.wav', 0.8, dur=1.6), 0.9).add(sub(0.8, D1 * 2, 100, 0.2), 1.1).add(air(s, 600, 2400, 0.4, 0.5), 0.5).verb(1.5, 0.28).glue(1.4).out(0.8, True)
@cook('lanternFake')
def _(i): return Pot(0.6).add(lp(load(WMS + 'wood_hit_01.ogg', 0.7, dur=0.4), 900), 0.7).add(sub(0.3, D1 * 3, 120, 0.07), 0.8).out(0.35)
@cook('lanternFlare')
def _(i): return Pot(1.4).add(load(USC + 'ignite.wav', 1.1, dur=1.3), 1).add(air(1.4, 800, 3000, 0.3, 0.3), 0.5).verb(1.0, 0.18).out(0.7)
@cook('lampSet')
def _(i): return Pot(1.0).add(lp(load(WMS + 'wood_hit_03.ogg', 0.8, dur=0.3), 1400), 0.8).add(sub(0.3, D1 * 4, 160, 0.05), 0.6).add(splash(4, 1.2, 0.6), 0.5, 0.05).add(bubbles(0.9, 3, 1.1), 0.4).verb(1.0, 0.2).out(0.5)
@cook('fireRun')
def _(i): s = 7.2; e = np.sin(np.pi * np.linspace(0, 1, int(s * SR)) ** 0.7); return Pot(s).add(fit(hp(load(USC + 'fire.wav', 1.0, start=30, dur=s), 250), s) * e, 1).add(load(USC + 'ignite.wav', 0.9, dur=2.5), 0.7).add(air(s, 500, 3000, 3.4, 2.4), 0.5).add(sub(6, D1 * 2, 70, 1.8, 0.4), 0.5, 0.5).verb(2.4, 0.3).glue(1.4).out(0.75, True)
@cook('armsRise')
def _(i): s = 2.8; return Pot(s).add(bubbles(s, 22, 0.7), 1).add(water(1, 0.7, s, 500) * np.hanning(int(s * SR)), 0.8).add(moan(0, 0.7, 2.6), 0.35, 0.2).add(sub(2.2, D1 * 2, 70, 0.9, 0.2), 0.6, 0.1).verb(1.8, 0.28).out(0.8, True)
@cook('armCut')
def _(i): return Pot(0.7).add(gore(1, 1.1, 0.1), 0.9).add(splash(3, 1.2, 0.5), 0.5, 0.03).add(sub(0.3, D1 * 3, 150, 0.05), 0.7).out(0.5)
@cook('armsClench')
def _(i): return Pot(1.2).add(sub(0.9, D1 * 2, 120, 0.22), 1.2).add(gore(2, 0.8, 0.2), 0.8, 0.02).add(load(WMS + 'wood_cracking_03.ogg', 0.8, dur=0.5), 0.6).add(bubbles(1.0, 5, 0.8), 0.5).verb(1.0, 0.2).glue(1.5).out(0.9)
@cook('handsRise')
def _(i): s = 2.0; return Pot(s).add(bubbles(s, 14, 0.8), 1).add(water(0, 0.6, s, 450), 0.6).verb(1.4, 0.2).out(0.6)
@cook('moan')
def _(i): s = 6.0; o = Pot(s); [o.add(moan(k, [0.7, 0.85, 0.6][k], 3.6), 0.5, k * 1.2) for k in range(3)]; return o.verb(3.0, 0.6, bright=2400).out(0.4, True)
@cook('soulFree')
def _(i): s = 2.2; return Pot(s).add(moan(3, 1.15, 2.0) * np.hanning(int(2.0 * SR)), 0.6).add(air(s, 1800, 4800, 1.0, 0.7), 0.4).add(saws(s, D1 * 8, 4, 10) * np.hanning(int(s * SR)), 0.25).verb(2.2, 0.4).out(0.55, True)
@cook('coinTurn', 2)
def _(i): return Pot(0.3).add(metal(i, 2.0 + 0.4 * i, 0.15, 2400), 0.8).add(snap(0.3, i), 0.3).out(0.32)
@cook('coinHit')
def _(i): return Pot(0.25).add(lp(metal(0, 1.4, 0.15, 400), 2500), 0.8).add(sub(0.15, D1 * 5, 200, 0.03), 0.6).out(0.3)
@cook('coinBack')
def _(i): return Pot(0.35).add(metal(1, 1.5, 0.2, 800), 0.8).add(sub(0.2, D1 * 4, 180, 0.04), 0.7).add(snap(0.4, 1), 0.3).out(0.45)
@cook('waterBed')
def _(i): L = 5; g = lambda a: ring(lp(load(SPL + 'loop_water_02.ogg', start=a)[:int(7 * SR)], 2600), L); h = lambda: ring(np.tile(lp(load(SPL + 'loop_water_01.ogg'), 2200), 3)[:int(7 * SR)], L); return bed(L, g(0), h(), -24)
@cook('windLow')
def _(i): L = 14; g = lambda a, b: ring(lp(load(USC + 'spooky.wav', 0.6, start=a), 900)[:int(16 * SR)], L); return bed(L, g(4, 0), g(24, 0), -27)
@cook('lampsBed')
def _(i): L = 8; g = lambda a: ring(hp(load(USC + 'fire.wav', start=a), 2600)[:int(10 * SR)], L); return bed(L, g(3), g(40), -36)
@cook('oar', 3)
def _(i): s = 1.3; return Pot(s).add(lp(load(SCR + 'scrape-%d.wav' % (4 + i), 0.9, dur=0.7), 1500), 0.6).add(lp(load(WMS + 'wood_hit_0%d.ogg' % (1 + i), 0.7, dur=0.4), 700), 0.5, 0.05).add(splash(i, 0.9, 0.9), 0.7, 0.45).add(water(i, 0.6, 0.9, 700), 0.5, 0.45).verb(1.2, 0.2).out(0.35)
# the Ferryman: one low voice, taken from the dead's own throats slowed to an old man's range
@cook('fGrunt', 3)
def _(i): return Pot(0.8).add(moan(i, 0.5, 0.7) * ad(int(0.7 * SR), 0.02, 0.2), 0.9).add(sub(0.5, D1 * 2, 90, 0.15), 0.7).verb(0.8, 0.12).glue(1.4).out(0.55)
@cook('fPain', 3)
def _(i): return Pot(1.0).add(moan(i + 1, 0.6, 0.9) * ad(int(0.9 * SR), 0.02, 0.3), 0.9).add(sub(0.6, D1 * 2, 110, 0.2), 0.6).verb(0.9, 0.14).glue(1.4).out(0.65)
@cook('fCall')
def _(i): s = 2.8; return Pot(s).add(moan(0, 0.5, 2.6) * np.hanning(int(2.6 * SR)), 0.9).add(sub(2.4, D1 * 2, 80, 1.0, 0.2), 0.7).verb(2.0, 0.3).glue(1.3).out(0.85, True)
@cook('fDeath')
def _(i): s = 3.8; return Pot(s).add(moan(1, 0.4, 3.4) * np.hanning(int(3.4 * SR)), 1).add(sub(3.0, D1 * 2, 70, 1.4, 0.3), 0.7).verb(2.4, 0.35).out(0.85, True)
@cook('wRoar', 2)
def _(i): s = 3.2; o = Pot(s); [o.add(moan(k + i, 0.45 + 0.12 * k, 3.0) * np.hanning(int(3.0 * SR)), 0.7, 0.05 * k) for k in range(4)]; return o.add(sub(2.6, D1, 90, 1.2, 0.2, 2.2), 1.0).add(splash(i, 0.6, 1.2), 0.6, 0.05).add(groan(0.5, i, 1.6), 0.5).verb(2.2, 0.3).glue(1.5).out(1.0, True)
@cook('wGrunt', 3)
def _(i): return Pot(0.9).add(moan(i, 0.42, 0.8) * ad(int(0.8 * SR), 0.02, 0.25), 0.9).add(sub(0.6, D1 * 1.5, 100, 0.2), 0.9).add(groan(0.5, i, 0.6), 0.4).verb(1.0, 0.16).glue(1.5).out(0.8)
@cook('wPain', 3)
def _(i): return Pot(1.0).add(moan(i + 2, 0.5, 0.9) * ad(int(0.9 * SR), 0.02, 0.3), 1).add(sub(0.7, D1 * 2, 110, 0.2), 0.7).verb(1.0, 0.16).glue(1.5).out(0.85)
@cook('wDeath')
def _(i): s = 5.2; o = Pot(s); [o.add(moan(k, 0.4 + 0.1 * k, 4.0) * np.hanning(int(4.0 * SR)), 0.8, 0.1 * k) for k in range(4)]; return o.add(sub(4, D1, 70, 1.8, 0.3), 1.0).add(splash(1, 0.5, 1.4), 0.6, 0.2).add(bubbles(s, 24, 0.7), 0.6, 0.5).verb(3.0, 0.4).glue(1.5).out(1.0, True)

# ---------------------------------------------------------------- the Waiting House: breath, linen, ash, embers. No bells, no struck metal: the bowls only creak.
F_IN = [(520, 900, .9), (1150, 1600, .55), (2400, 3300, .35), (3600, 5200, .2)]
def breathy(s, rise, f=F_IN, gain=1.0, wob=0.0):
    """Air through a woman's throat: noise in formant bands, opening with `rise` (seconds to the loudest)."""
    n = noise(s); t = T(s); o = np.zeros(len(t))
    for lo_, hi_, g in f: o += bp(n, lo_, hi_) * g
    env = np.minimum(1, t / max(rise, 1e-3)) ** 1.4 * np.exp(-np.maximum(0, t - rise) / (s * 0.32)); env *= 1 + wob * np.sin(t * 2 * np.pi * 7)
    return norm(o * env) * gain
def voiced(s, f0, vib=0.012, att=0.12, rel=0.5):
    """A hum on one note: glottal pulses, a nasal murmur, no words."""
    t = T(s); f = f0 * (1 + vib * np.sin(2 * np.pi * 5.1 * t) * np.minimum(1, t / 0.6) + 0.003 * np.sin(2 * np.pi * 0.7 * t)); ph = np.cumsum(f) / SR % 1
    g = np.where(ph < .6, np.sin(np.pi * ph / .6), -.35 * (1 - (ph - .6) / .4)); x = lp(g, 1400) + bp(g, 220, 320) * 1.4 + bp(g, 2400, 2900) * .12 + 0.04 * bp(noise(s), 300, 2000)
    env = np.minimum(1, t / att) * np.minimum(1, (s - t) / rel); return norm(x * np.clip(env, 0, 1))
def choirOfBreath(s, n, rise, p=1.0):
    o = np.zeros(int(s * SR))
    for k in range(n):
        f = [(a * p * (0.85 + .3 * rng.random()), b * p * (0.85 + .3 * rng.random()), g) for a, b, g in F_IN]; y = breathy(s * (0.8 + .2 * rng.random()), rise * (0.7 + .6 * rng.random()), f); o[:len(y)] += y * (0.5 + .5 * rng.random())
    return norm(o)
def low(k): return [(a * k, b * k, g) for a, b, g in F_IN]
def fade(x): return x * np.linspace(1, 0, len(x))
CL = 'rpg_sound_pack/'
@cook('sBreath', 3)
def _(i): s = 3.0; return Pot(s).add(breathy(1.4, 1.1 + .1 * i, gain=0.8), 1).add(breathy(1.6, 0.25, low(.8)), 0.75, 1.35).verb(1.2, 0.2).out(0.45)
@cook('breathIn', 2)
def _(i): return Pot(1.8).add(breathy(1.7, 1.25 + .1 * i), 1).add(lp(noise(1.7), 400) * bell(1.7, 1.2, 0.4), 0.15).verb(1.6, 0.3).out(0.4)
@cook('breathOut', 2)
def _(i): return Pot(2.0).add(breathy(1.9, 0.22, low(.78)), 1).verb(1.6, 0.3).out(0.38)
@cook('hum')
def _(i): s = 2.8; return Pot(s).add(voiced(s, 293.66), 1).add(breathy(s, 0.3, gain=0.12), 1).verb(2.2, 0.35, bright=4000).out(0.45)
@cook('sCount', 2)
def _(i): s = 1.6; return Pot(s).add(breathy(1.2, 0.08, low(.8)), 0.8).add(voiced(1.5, 293.66 * (1 if i == 0 else 0.98), att=0.05, rel=0.9), 0.55, 0.04).verb(1.6, 0.3, bright=4500).out(0.55)
@cook('sCall')
def _(i): s = 3.4; return Pot(s).add(breathy(3.0, 0.4, low(.75)), 0.8).add(voiced(3.0, 220.0, att=0.3, rel=1.4), 0.7, 0.15).add(voiced(3.0, 146.83, att=0.4, rel=1.6), 0.4, 0.15).verb(2.4, 0.35).out(0.7, True)
@cook('sGrunt', 3)
def _(i): return Pot(0.8).add(breathy(0.6, 0.05, low(.7 + .05 * i)), 1).add(voiced(0.5, 196 - 10 * i, att=0.02, rel=0.3), 0.35).verb(0.9, 0.15).out(0.5)
@cook('sPain', 3)
def _(i): return Pot(1.0).add(breathy(0.5, 0.12, low(1.05 + .05 * i), wob=.3), 1).add(voiced(0.45, 262 + 15 * i, att=0.03, rel=0.25), 0.3, 0.05).verb(1.0, 0.18).out(0.58)
@cook('sDeath')
def _(i): s = 4.0; return Pot(s).add(breathy(3.6, 0.3, low(.7)), 1).add(voiced(3.4, 196, att=0.2, rel=2.6), 0.4).verb(2.6, 0.4).out(0.7, True)
@cook('miscount', 2)
def _(i): return Pot(0.7).add(breathy(0.35, 0.03, low(1.1)), 1).add(lp(load(CL + 'cloth.wav', 1.2 + .1 * i), 3000), 0.4).verb(0.9, 0.18).out(0.5)
@cook('countBegin')
def _(i): s = 2.4; return Pot(s).add(breathy(1.8, 1.4), 0.8).add(sat(sweep(s, 60, D1 * 2, 0.8) * bell(s, 1.4, 0.6), 1.3), 0.7).add(voiced(2.0, 293.66, att=0.8, rel=0.8), 0.25, 0.3).verb(2.4, 0.35).out(0.65, True)
@cook('lostCount')
def _(i): s = 2.2; return Pot(s).add(breathy(0.5, 0.06, low(1.15), wob=.4), 1).add(air(1.2, 400, 3200, 0.3, 0.18), 0.7, 0.05).add(lp(load(CL + 'cloth-heavy.wav', 0.8), 3500), 0.6, 0.05).add(lp(load(RPG + 'spell_fire_01.ogg', 1.3), 4000), 0.3, 0.1).add(sub(0.8, D1 * 2, 150, 0.2), 0.6).verb(1.8, 0.3).glue(1.3).out(0.85, True)
@cook('emberOut', 3)
def _(i): s = 0.6; return Pot(s).add(hp(noise(s), 2500) * ad(int(s * SR), 0.01, 0.12), 0.5).add(fade(lp(load(RPG + 'spell_fire_01.ogg', 1.6 + .1 * i, dur=0.3), 5000)), 0.5).verb(1.0, 0.2).out(0.3)
@cook('whorl')
def _(i): s = 1.8; t = T(s); return Pot(s).add(norm(moving(noise(s), lambda u: 500 + 900 * (0.5 + 0.5 * np.sin(u * 14))) * np.minimum(1, t / 1.2) * np.exp(-np.maximum(0, t - 1.3) / 0.2)), 1).add(sub(1.4, D1 * 2, 60, 0.5, 0.4), 0.4, 0.3).verb(1.6, 0.3).out(0.6, True)
@cook('smokeIn')
def _(i): return Pot(1.1).add(air(1.0, 3200, 300, 0.35, 0.2), 1).add(lp(load(CL + 'cloth-heavy.wav', 0.7), 2400), 0.5).verb(1.2, 0.25).out(0.6)
@cook('smokeOut')
def _(i): return Pot(1.2).add(air(1.0, 300, 3600, 0.12, 0.12), 1).add(lp(load(CL + 'cloth-heavy.wav', 0.85), 3000), 0.6).add(sub(0.5, D1 * 2, 140, 0.15), 0.6).verb(1.2, 0.2).glue(1.2).out(0.7)
@cook('sheetFall')
def _(i): s = 2.0; return Pot(s).add(lp(load(CL + 'cloth-heavy.wav', 0.5), 1500), 1).add(air(1.4, 1600, 120, 0.25, 0.25), 0.8).add(sub(1.2, D1, 110, 0.35, 0.05, 1.6), 1).add(lp(crumble(2, 0.6), 1200), 0.3, 0.2).verb(1.8, 0.25, bright=2600).glue(1.5).out(0.9, True)
@cook('clothB', 3)
def _(i): p = 1 - .08 * i; return Pot(1.2).add(lp(load(CL + 'cloth-heavy.wav', 0.75 * p), 4000), 1).add(air(0.9, 200 * p, 1400 * p, 0.25, 0.14), 0.7).verb(1.0, 0.15).glue(1.2).out(0.6)
@cook('cotBurst', 3)
def _(i): s = 1.4; return Pot(s).add(lp(load(WMS + 'wood_breaking_0%d.ogg' % (1 + i % 2), 0.9), 3000), 0.6).add(lp(crumble(i, 0.8), 2200), 0.6, 0.03).add(air(1.0, 2200, 300, 0.12, 0.18), 0.8).add(sub(0.4, D1 * 2, 130, 0.12), 0.5).verb(1.2, 0.2, bright=3000).glue(1.3).out(0.62)
@cook('cotHit', 2)
def _(i): return Pot(0.5).add(lp(load(WMS + 'wood_cracking_01.ogg', 1.1 + .1 * i, dur=0.4), 2600), 1).add(air(0.4, 1800, 400, 0.05, 0.08), 0.4).out(0.4)
@cook('inhale')
def _(i): s = 3.6; t = T(s); return Pot(s).add(breathy(3.4, 3.0, low(.75)), 1).add(norm(moving(noise(s), lambda u: 200 + 2400 * (u / s) ** 2) * np.minimum(1, t / 3.0) * np.exp(-np.maximum(0, t - 3.1) / 0.15)), 0.9).add(lp(hp(load(USC + 'gust.wav', 0.7, dur=3.5), 80), 1800), 0.6).verb(2.6, 0.35).glue(1.3).out(0.95, True)
@cook('embersUp')
def _(i):
    s = 4.5; o = Pot(s)
    for _k in range(26): o.add(lp(load(RPG + 'spell_fire_01.ogg', 1.8 + rng.random(), dur=0.3), 6000), 0.15 + 0.2 * rng.random(), rng.random() * 4.0)
    return o.add(air(s, 300, 1600, 2.0, 1.2), 0.5).add(choirOfBreath(4.0, 4, 1.8), 0.45, 0.3).verb(2.8, 0.4).out(0.7, True)
@cook('sunSink')
def _(i): s = 3.2; return Pot(s).add(sat(sweep(s, 80, D1, 1.2) * bell(s, 1.2, 0.9), 1.4), 1).add(choirOfBreath(2.6, 5, 1.6, 0.8), 0.5, 0.2).verb(2.6, 0.4, bright=2200).out(0.7, True)
@cook('pGrunt', 3)
def _(i): return Pot(1.0).add(choirOfBreath(0.8, 4, 0.08, 0.7 + .05 * i), 1).add(sub(0.6, D1 * 2, 90, 0.2), 0.7).add(lp(load(CL + 'cloth-heavy.wav', 0.6), 2000), 0.4).verb(1.4, 0.25).glue(1.3).out(0.7)
@cook('pPain', 3)
def _(i): return Pot(1.1).add(choirOfBreath(0.7, 5, 0.1, 0.95 + .05 * i), 1).add(sub(0.6, D1 * 2, 120, 0.2), 0.6).verb(1.4, 0.25).glue(1.3).out(0.75)
@cook('pRoar', 2)
def _(i): s = 3.4; return Pot(s).add(choirOfBreath(3.0, 8, 0.9, 0.7 + .1 * i), 1).add(air(s, 200, 2400, 1.0, 0.6), 0.7).add(sub(2.4, D1, 80, 0.9, 0.2, 2.0), 1).add(lp(load(CL + 'cloth-heavy.wav', 0.45), 1500), 0.6, 0.4).verb(2.6, 0.35).glue(1.6).out(1.0, True)
@cook('pDeath')
def _(i): s = 5.0; return Pot(s).add(choirOfBreath(4.6, 8, 0.4, 0.75), 1).add(sub(3.6, D1, 70, 1.6, 0.3), 0.8).add(air(s, 2400, 200, 1.2, 1.0), 0.5).verb(3.0, 0.4).glue(1.4).out(0.95, True)
@cook('hourFalls')
def _(i): s = 3.0; return Pot(s).add(doom(2.2, D1, 1), 0.9).add(choirOfBreath(2.4, 6, 0.05, 0.7), 0.9).add(air(1.6, 2600, 160, 0.08, 0.35), 0.8).add(lp(crumble(3, 0.7), 2600), 0.4, 0.05).add(punch(0.7, 0, 0.2), 0.6).verb(2.4, 0.35, bright=3000).glue(1.6).out(0.95, True)
@cook('clothBed')
def _(i): L = 12; g = lambda a: ring(fit(np.tile(hp(load(USC + 'gust.wav', start=a), 120), 3), 14) * .7 + .5 * fit(lp(np.tile(load(CL + 'cloth.wav', 0.55), 60), 1800), 14), L); return bed(L, g(2), g(6), -27)

# ---------------------------------------------------------------- serve
from scipy.signal import sosfiltfilt
#: Share of energy wanted above 250 Hz (a laptop or phone hears little else), and how far the loudest tenth of a second sits under the peak.
TONE = {'doom': .3, 'drop': .22, 'heart': .12, 'braam': .5, 'boom': .4, 'slam': .4, 'thud': .4, 'erupt': .45, 'break': .55, 'flesh': .6, 'fleshH': .52, 'block': .6, 'parry': .6, 'hurt': .5, 'riteCut': .65, 'ritesCut': .45, 'finalCut': .42, 'stepK': .42, 'stepC': .5, 'stepP': .6, 'land': .5, 'barFill': .38, 'uiGo': .42, 'uiPick': .5, 'rise0': .42, 'rise1': .42, 'rise2': .42, 'die': .4, 'aura0': .55, 'aura1': .55, 'aura2': .5, 'aura3': .5, 'whooshB': .5, 'whooshH': .6, 'bRoar': .5, 'bDeath': .5, 'kDeath': .5, 'kGrunt': .55, 'kPain': .6, 'bBark': .55, 'bPain': .6, 'kScreech': .6, 'cueRed': .5, 'cueGround': .5}
CREST = {'flesh': 12.5, 'fleshH': 11, 'block': 11.5, 'parry': 11, 'riteCut': 12, 'slam': 9.5, 'boom': 9, 'break': 10, 'hurt': 11, 'whoosh': 11, 'whooshH': 9.5, 'braam': 8, 'bRoar': 8, 'kScreech': 9.5, 'bBark': 10, 'kGrunt': 10, 'kPain': 10, 'bPain': 10, 'bDeath': 9, 'rise0': 10, 'rise1': 9.5, 'rise2': 9, 'finalCut': 9.5, 'ritesCut': 9.5, 'doom': 9, 'erupt': 9.5}
_x = butter(4, 250 / (SR / 2), 'low', output='sos')
def rms(x): w = int(0.1 * SR); e = np.convolve((x ** 2).mean(0), np.ones(w) / w, 'valid') if x.shape[1] > w else np.array([(x ** 2).mean()]); return 10 * np.log10(e.max() + 1e-9)
def share(x): P = (np.abs(np.fft.rfft(x, axis=1)) ** 2).sum(0); fr = np.fft.rfftfreq(x.shape[1], 1 / SR); return P[fr > 250].sum() / P.sum()
def plate(x, name):
    """Tone, then density. The low end also lends its harmonics upward, so its weight is felt on speakers that cannot play it."""
    peak = np.abs(x).max(); x = x / peak; want = TONE.get(name, .5 if share(x) < .5 else 0); lo = sosfiltfilt(_x, x, axis=1) if x.shape[1] > 60 else x * 0; hi = x - lo
    if want and share(x) < want:
        harm = np.tanh(lo * 3.2) - np.tanh(lo * 3.2).mean(1, keepdims=True); harm = harm - sosfiltfilt(_x, harm, axis=1); hi = hi + harm * .5
        for _ in range(3):
            el, eh = (lo ** 2).sum() + 1e-9, (hi ** 2).sum() + 1e-9; lo = lo * min(1, max(.2, np.sqrt(eh / el * (1 - want) / want)))
    x = lo + hi; x = x / np.abs(x).max(); target = -CREST.get(name, 10.5)
    if rms(x) < target:
        for d in np.linspace(1.05, 7, 40):
            y = np.tanh(x * d) / np.tanh(d)
            if rms(y) >= target: break
        x = y
    n = x.shape[1]; x[:, :20] *= np.linspace(0, 1, 20); return x / np.abs(x).max() * peak
def main():
    only = sys.argv[1].split(',') if len(sys.argv) > 1 else None; os.makedirs(OUT, exist_ok=True); items = []
    for name, (n, f) in R.items():
        if only and not any(name.startswith(o) for o in only): continue
        for i in range(n):
            x = f(i) if name in LOOPS else plate(f(i), name); assert np.isfinite(x).all(), name
            on = np.argmax(np.abs(x).max(0) > np.abs(x).max() * .5) / SR
            print('%-10s%d %s %.2fs peak %.2f loudest %.1f dB  above 250 Hz %.0f%%  first at %.0f ms' % (name, i, 'st' if x.shape[0] == 2 else 'mo', x.shape[1] / SR, np.abs(x).max(), rms(x), share(x) * 100, on * 1000))
            pcm = (np.clip(x.T, -1, 1) * 32767).astype('<i2').tobytes(); r = subprocess.run(['ffmpeg', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', str(x.shape[0]), '-i', '-', '-c:a', 'libmp3lame', '-b:a', '160k' if x.shape[0] == 2 else '112k', '-f', 'mp3', '-'], input=pcm, capture_output=True); assert r.stdout, r.stderr
            items.append((name + str(i) if n > 1 else name, r.stdout, x.shape[1]))
    if only: return
    head = json.dumps([[n, len(b), k] for n, b, k in items]).encode(); open(os.path.join(OUT, 'sfx.pak'), 'wb').write(struct.pack('<I', len(head)) + head + b''.join(b for _, b, _ in items)); print(len(items), 'sounds,', round((len(head) + sum(len(b) for _, b, _ in items)) / 1e6, 2), 'MB')
if __name__ == '__main__': main()
