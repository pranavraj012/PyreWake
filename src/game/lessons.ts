// Training. The King attacks on request and the world holds its breath until you press the button; nothing moves on until you have done the thing.
import { sound } from '../audio/sound.ts';
import { isAttack, type KingMode } from '../boss/king.ts';
import type { Fight, FightEvent } from '../combat/fight.ts';
import { D } from '../combat/difficulty.ts';
import type { Action } from '../input/input.ts';
import type { Press } from '../player/motor.ts';

export interface Card { id: string; n: number; of: number; title: string; text: string; action: Action | 'move'; /** The world is waiting for this press. */ held: boolean; /** Just done. */ ok: boolean; /** Hold, rather than tap. */ hold: boolean }
export const LESSONS = ['move', 'attack', 'heavy', 'dodge', 'guard', 'parry', 'jump', 'red', 'rush', 'sunder', 'heal', 'rites'] as const;
type Wait = () => boolean;

export class Lessons {
  active = false; card: Card | null = null; /** The press the world is waiting for. */ frozen: Action | null = null; /** Colour drained while it waits, 0-1. */ mono = 0; onDone: (skipped: boolean) => void = () => { };
  private f: Fight; private run: Generator<Wait, void, void> | null = null; private wait: Wait = () => true; private now = 0; private mark = 0; private got: FightEvent[] = []; private clips: string[] = [];
  constructor(f: Fight) { this.f = f; }
  start() {
    const { f } = this, { m, king: k } = f; this.active = true; this.card = null; this.frozen = null; this.now = this.mark = 0; f.passive = true; f.reset(true);
    k.x = 0; k.z = -4; k.yaw = 0; k.set('idle'); m.revive(0, 4.4, Math.PI); this.clear(); this.run = this.script(); this.wait = () => true;
  }
  /** Out at once: from the pause menu. */
  skip() { if (this.active) this.finish(true); }
  private finish(skipped: boolean) { this.active = false; this.run = null; this.card = null; this.frozen = null; this.mono = 0; this.onDone(skipped); }
  private clear() { this.got = []; this.clips = []; }

  /** Takes this step's presses. While the world waits only the right one gets through. */
  gate(ev: Press[]): Press[] {
    if (!this.active || !this.frozen) return ev; const m = this.f.m;
    for (const e of ev) if (e.up) m.drop(e.a); const hit = ev.find(e => !e.up && e.a === this.frozen); if (!hit) return [];
    this.frozen = null; if (this.card) this.card.held = false; sound.play('uiPick', { gain: 0.9, wet: 0.4 }); return [hit, ...ev.filter(e => e.up && e.a === hit.a)];
  }
  /** After the fight has stepped. `real` is wall time, `sim` what the fight saw of it. */
  step(real: number, sim: number) {
    if (!this.active) return; const { f } = this, k = f.king; this.now += real; this.mono += ((this.frozen ? 0.55 : 0) - this.mono) * Math.min(1, real * 10);
    // a staged moment (a grab that has seized the hero) plays out on its own: the lesson neither moves the King nor judges the press until it ends
    if (this.frozen || k.staging) return;
    this.got.push(...f.ev); this.clips.push(...f.m.events); void sim;
    // nobody is hurt in here
    f.bossHp = f.maxHp; if (this.card?.id !== 'heal') f.hp = Math.max(f.hp, 60); f.flame = true; if (k.hanging || k.crawling) k.set('idle');
    let guard = 0; while (this.active && this.run && this.wait() && guard++ < 20) { const r = this.run.next(); if (r.done) { this.finish(false); return; } this.wait = r.value; }
  }
  // --- vocabulary
  private has(k: FightEvent['k']) { return this.got.some(e => e.k === k); }
  private did(c: string | RegExp) { return this.clips.some(e => typeof c === 'string' ? e === 'clip:' + c : c.test(e)); }
  private say(id: typeof LESSONS[number], title: string, text: string, action: Action | 'move', hold = false) { this.card = { id, n: LESSONS.indexOf(id), of: LESSONS.length, title, text, action, held: false, ok: false, hold }; }
  private after(s: number): Wait { const t = this.now + s; return () => this.now >= t; }
  /** Until it happens, or it clearly won't. */
  private within(s: number, p: Wait): Wait { const t = this.now + s; return () => p() || this.now >= t; }
  private *done(title = '') { if (this.card) { this.card.ok = true; if (title) this.card.title = title; } sound.play('flare', { gain: 0.9 }); sound.play('ready', { gain: 0.7 }); this.f.hp = D.hp; yield this.after(1.15); }
  private freeze(a: Action, text?: string): Wait { if (this.card) { if (text) this.card.text = text; this.card.action = a; this.card.held = true; this.card.ok = false; } this.frozen = a; sound.duck(0.35, 0.6); return () => this.frozen === null; }
  /** The King walks up, squares off, and starts `mode`. */
  private *attack(mode: KingMode, gap = 3.0) {
    const { f } = this, { king: k, m } = f; yield () => !m.dead && m.y === 0 && m.state === 'free' || m.clip?.name === 'flick' || m.clip?.name === 'clench';
    const off = () => { const a = Math.atan2(m.x - k.x, m.z - k.z) - k.yaw; return Math.abs(a - Math.round(a / 6.2832) * 6.2832); };
    yield () => { if (isAttack(k.mode) || k.helpless) return false; if (m.targetDist > gap + 0.5) { if (k.mode !== 'stalk') k.set('stalk'); return false; } if (k.mode !== 'idle') k.set('idle'); if (off() > 0.12) { k.turn(0.07, Math.atan2(m.x - k.x, m.z - k.z)); return false; } return true; };
    f.brain.seen.add(mode); this.clear(); k.set(mode);
  }
  /** Until `lead` seconds before the blow, if it is going to land; otherwise the King tries again. Returns through `this.ready`. */
  private ready = false;
  private *until(lead: number, gap?: number, mode: KingMode = 'slam') {
    const { king: k, m } = this.f; this.ready = false;
    while (!this.ready) { yield* this.attack(mode, gap); const s = k.strikes[0], id = k.serial; yield () => k.serial !== id || k.mt >= s.t[0] - lead; if (k.serial === id) { if (k.covers(s, m.x, m.z, 0.9)) this.ready = true; else yield () => k.serial !== id; } }
  }
  private settle(): Wait { const { m, king: k } = this.f; return () => m.state === 'free' && m.y === 0 && !isAttack(k.mode) && !k.helpless || this.now - this.mark > 5; }

  private *script(): Generator<Wait, void, void> {
    const { f } = this, { m, king: k } = f;
    yield this.after(0.5);
    this.say('move', 'Walk', 'Go to the King. It will wait for you.', 'move'); yield () => m.targetDist < 3.2; yield* this.done();

    this.say('attack', 'Strike', 'Tap, and keep tapping, for a combo. Your blade always works on it.', 'attack'); this.clear(); yield () => this.got.filter(e => e.k === 'hit').length >= 5; yield* this.done();

    this.say('heavy', 'Strike hard', 'Hold, then let go. Held in the middle of a combo it becomes a finisher.', 'attack', true); this.clear(); yield () => this.did('heavy') && this.has('hit') || m.weapon.finishers.some(n => this.did(n)) && this.has('hit'); yield* this.done();

    // --- dodge
    for (; ;) {
      this.say('dodge', 'Dodge', 'A white star marks the blow. It lands when the ring closes.', 'dodge'); yield this.after(1.4); yield* this.until(0.15); yield this.freeze('dodge'); yield () => this.has('evade') || this.has('hurt') || !isAttack(k.mode);
      if (this.has('evade')) break;
    }
    if (m.reckoning > 0) { if (this.card) { this.card.ok = true; this.card.text = 'At the very last moment, time slows for you.'; } yield this.after(0.3); this.say('dodge', 'Answer', 'Attack right after a perfect dodge.', 'attack'); if (m.reckoning < 0.6) m.reckoning = 1; this.clear(); yield this.freeze('attack'); yield this.within(1, () => this.did(/^clip:(reckon|riposte)/)); yield () => m.state === 'free' || m.t > (m.clip?.chain ?? 1.2); }
    yield* this.done();
    for (let i = 0; i < 4; i++) { this.say('dodge', 'Once more, alone', i ? 'Watch the ring. Press as it closes.' : 'The world will not wait this time.', 'dodge'); yield* this.until(0.6); yield () => this.has('evade') || this.has('hurt') || !isAttack(k.mode); if (this.has('evade')) break; yield this.after(0.8); }
    yield* this.done();

    // --- guard, then parry
    for (; ;) { this.say('guard', 'Guard', 'White blows can be held off instead.', 'guard', true); yield this.after(1.2); yield* this.until(0.42); yield this.freeze('guard'); yield () => this.has('block') || this.has('parry') || this.has('hurt') || !isAttack(k.mode); if (this.has('block') || this.has('parry')) break; this.say('guard', 'Guard', 'Keep it held until the blow lands.', 'guard', true); yield this.after(1.4); }
    yield* this.done(); yield () => !m.guardHeld;
    for (; ;) { this.say('parry', 'Parry', 'Guard at the last instant and it breaks on you.', 'guard'); yield this.after(1.2); yield* this.until(0.1); yield this.freeze('guard'); yield () => this.has('parry') || this.has('block') || this.has('hurt') || !isAttack(k.mode); if (this.has('parry')) break; yield this.after(1.2); }
    if (this.card) { this.card.ok = true; this.card.text = 'It is on its knees.'; } yield () => m.can.execute && m.targetDist < 3.2 || k.mode !== 'kneel'; if (m.can.execute) { this.say('parry', 'End its stand', 'Attack while it is helpless.', 'attack'); this.clear(); yield this.freeze('attack'); yield this.within(1, () => this.did('execute')); yield () => m.state === 'free' || m.clip?.name !== 'execute' || m.t > 2.2; }
    yield* this.done();

    // --- jump
    for (; ;) { this.say('jump', 'Jump', 'Sweeps and ground fire pass under you.', 'jump'); yield this.after(1.2); yield* this.until(0.3, 3.0, 'sweep'); yield this.freeze('jump'); yield () => this.has('leap') || this.has('hurt') || !isAttack(k.mode); if (this.has('leap')) break; }
    f.invuln = 4; if (m.y > 0) { this.say('jump', 'In the air', 'Attack.', 'attack'); this.clear(); yield this.freeze('attack'); yield () => this.did('airCut') || this.did('plunge') || m.y === 0; yield () => m.clip?.name === 'airCut' ? m.t > 0.26 : true; if (m.y > 0 && m.clip?.name === 'airCut') { this.say('jump', 'And down', 'Attack again to dive. Hold it to dive at once.', 'attack'); yield this.freeze('attack'); } yield () => m.y === 0; yield this.after(0.15); if (isAttack(k.mode)) k.set('reel'); }
    yield* this.done();

    // --- red
    for (; ;) { this.say('red', 'Red', 'Red cannot be guarded or jumped.', 'dodge'); yield this.after(1.2); yield* this.until(0.15, 2.6, 'grab'); yield this.freeze('dodge'); yield () => this.has('evade') || this.has('hurt') || !isAttack(k.mode); if (this.has('evade')) break; }
    yield* this.done();

    // --- the three fires
    for (; ;) { f.fire = Math.max(f.fire, D.rush.cost); this.say('rush', 'Cinder Rush', 'Your blows fill your fire. Spend it: straight through, and it burns behind you.', 'skill1'); this.clear(); yield () => this.has('rush') || f.fire < D.rush.cost; yield this.within(2.5, () => this.has('detonate')); if (this.got.some(e => e.k === 'detonate' && e.hit)) break; yield this.after(0.6); }
    yield* this.done(); this.mark = this.now; yield this.settle();
    for (; ;) { this.say('sunder', 'Sunder Arc', 'A cut that flies. It breaks whatever the King is doing.', 'skill2'); yield this.after(1.4); yield* this.attack('slam', 4.4); yield () => k.mode !== 'slam' || k.mt > 0.3; f.fire = Math.max(f.fire, D.sunder.cost); m.can.skill2 = true; yield this.freeze('skill2'); yield () => this.has('break') || this.has('hurt') || !isAttack(k.mode); if (this.has('break')) break; }
    yield* this.done(); this.mark = this.now; yield this.settle();

    f.hp = 42; this.say('heal', 'Heal', 'Four of these a round.', 'heal'); this.clear(); yield () => this.has('heal'); f.heals = D.heals; yield* this.done();

    f.wake = 100; this.say('rites', 'Last Rites', 'Hurting it wakes this. When it burns, there is nothing else like it.', 'ultimate'); this.clear(); yield () => m.targetDist < 14; m.can.ultimate = true; yield this.freeze('ultimate'); yield () => this.has('rites'); yield () => m.clip?.name !== 'rites' || m.t > 4.5; yield* this.done(); yield this.after(0.6);
  }
}
