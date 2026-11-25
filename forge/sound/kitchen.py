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
def _(i): p = 1 + 0.05 * (i - 1); return Pot(0.9).add(snap(0.7, i), 0.8).add(punch(0.85 * p, i, 0.11), 1.1).add(sub(0.5, D1, 180, 0.17, 0.03, 2), 1).add(gore(i + 2, 0.85, 0.16), 0.55).add(lp(hp(load(CR2 + 'human_0%d.ogg' % [1, 3, 5][i], 0.86), 200), 3600), 0.34, 0.02).verb(0.7, 0.1).glue(1.7).out(0.9)
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
@cook('effort', 4)
def _(i): return Pot(0.4).add(bp(load(CR2 + 'human_0%d.ogg' % [2, 4, 6, 8][i], 0.9, dur=0.3), 250, 4200) * ad(int(.3 * SR) + 2, 0.01, 0.07)[:len(load(CR2 + 'human_0%d.ogg' % [2, 4, 6, 8][i], 0.9, dur=0.3))], 1).out(0.26)

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
def _(i): return creature([CR1 + 'troll_0%d.ogg' % (1 + i), CR1 + 'grunt_0%d.ogg' % (1 + i)], 0.72, 1.1, 0.3).out(0.8)
@cook('kPain', 4)
def _(i): return creature([CR1 + 'hurt_0%d.ogg' % (1 + i), MON + 'Monster-%d.wav' % (1 + i), CR1 + 'troll_02.ogg'], 0.66 + .04 * i, 1.4, 0.3, .25, 2.0).out(0.86)
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
def _(i): return creature([CR1 + 'hurt_0%d.ogg' % (3 + i), CR2 + 'monster_1%d.ogg' % (6 + i), CR2 + 'roar_04.ogg'], 0.58, 1.5, 0.4, .25, 2.3).out(0.9)
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
@cook('uiMove')
def _(i): return Pot(0.16).add(lp(load('rpg_sound_pack/cloth.wav', 1.8, dur=0.1), 3000), 0.8).add(sub(0.1, D1 * 4, 190, 0.02), 0.6).out(0.16)
@cook('uiPick')
def _(i): return Pot(0.9).add(sub(0.5, D1 * 2, 150, 0.14), 0.9).add(load(RPG + 'spell_fire_01.ogg', 1.2), 0.6).add(snap(0.4), 0.25).verb(0.9, 0.16).out(0.4)
@cook('uiGo')
def _(i): return Pot(3.6).add(doom(2.6, D1), 1.1).add(shing(1, 0.6, 0.7), 0.5).add(load(RPG + 'spell_fire_03.ogg', 0.8), 0.6).verb(2.6, 0.35).glue(1.6).out(0.85, True)

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
            x = plate(f(i), name); assert np.isfinite(x).all(), name
            on = np.argmax(np.abs(x).max(0) > np.abs(x).max() * .5) / SR
            print('%-10s%d %s %.2fs peak %.2f loudest %.1f dB  above 250 Hz %.0f%%  first at %.0f ms' % (name, i, 'st' if x.shape[0] == 2 else 'mo', x.shape[1] / SR, np.abs(x).max(), rms(x), share(x) * 100, on * 1000))
            pcm = (np.clip(x.T, -1, 1) * 32767).astype('<i2').tobytes(); r = subprocess.run(['ffmpeg', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', str(x.shape[0]), '-i', '-', '-c:a', 'libmp3lame', '-b:a', '160k' if x.shape[0] == 2 else '112k', '-f', 'mp3', '-'], input=pcm, capture_output=True); assert r.stdout, r.stderr
            items.append((name + str(i) if n > 1 else name, r.stdout, x.shape[1]))
    if only: return
    head = json.dumps([[n, len(b), k] for n, b, k in items]).encode(); open(os.path.join(OUT, 'sfx.pak'), 'wb').write(struct.pack('<I', len(head)) + head + b''.join(b for _, b, _ in items)); print(len(items), 'sounds,', round((len(head) + sum(len(b) for _, b, _ in items)) / 1e6, 2), 'MB')
if __name__ == '__main__': main()
