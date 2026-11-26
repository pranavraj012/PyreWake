// The page side of the staged moments (module A): the scenes the page plays while the simulation holds the hero, and the reward offer.
// Each grab's first throw must start its moment, and the moment's own shot, hero and cues must run to their end (not only the simulation).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Fight } from '../src/combat/fight.ts';
import { GRAB_DMG, NOOSE, King } from '../src/boss/king.ts';
import { DRAG, River } from '../src/boss/river/river.ts';
import { RiverBrain } from '../src/boss/river/brain.ts';
import { Motor } from '../src/player/motor.ts';
import { kingMoments } from '../src/game/scenes.ts';
import { riverMoments } from '../src/game/riverScenes.ts';
import { Moment, Offer, offerSpec, OFFER_SLOW } from '../src/game/moment.ts';

const DT = 1 / 60;
const finite = (v: THREE.Vector3) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const cam = () => new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 200);

/** Plays a moment the way the page does: the fight steps, the moment's rate slows it, the camera, hero and cues are read each frame. */
function playPage(f: Fight, spec: (f: Fight) => ReturnType<typeof kingMoments>[keyof ReturnType<typeof kingMoments>] | null, until: () => boolean, stageOf: () => number, max = 12) {
  const mo = new Moment(), c = cam(), out = new THREE.Vector3(); let frames = 0, cues: string[] = [], letter = false, badCam = 0, badHero = 0;
  const s = spec(f); if (!s) throw new Error('no moment');
  mo.start(s);
  for (let i = 0; i < max * 60 && !until(); i++) {
    f.step(DT * mo.rate(stageOf()), 0, 0, []);
    cues.push(...mo.due(stageOf())); letter ||= mo.letterbox;
    const tumble = mo.hero(stageOf(), out); if (!finite(out) || !Number.isFinite(tumble)) badHero++;
    mo.camera(c, DT, stageOf(), i * DT); if (!finite(c.position) || !Number.isFinite(c.fov)) badCam++;
    mo.kick(0); frames++;
  }
  mo.stop();
  return { frames, cues, letter, badCam, badHero, mo };
}

describe('the King: the first throw plays its scene on the page', () => {
  it('the noose starts its moment, runs its cues in order, with bars, and stays finite to the end', () => {
    const f = new Fight(new Motor()); f.passive = true; f.m.x = 0; f.m.z = -2; f.m.yaw = Math.PI; f.king.yaw = 0; const K = f.king as King;
    K.set('grab'); f.brain.seen.add('grab');
    for (let i = 0; i < 4 * 60 && K.held !== 'noose'; i++) f.step(DT, 0, 0, []);
    expect(K.held).toBe('noose');
    const specs = kingMoments(K, f.m); expect(K.staging).toBe('noose');
    const r = playPage(f, () => specs.noose, () => K.held === null, () => K.stage, 9);
    expect(r.letter).toBe(true);
    expect(r.cues).toEqual(['seize', 'lift', 'swing', 'throw', 'land', 'rise']);
    expect(r.badCam + r.badHero).toBe(0);
    expect(f.hp).toBeLessThanOrEqual(100 - GRAB_DMG.noose + 1);
    expect(K.stage).toBeGreaterThanOrEqual(NOOSE.end - 0.1);
  });
});

describe('the Ferryman: the first drag plays its scene on the page', () => {
  it('the drag starts its moment, lasts a cinematic length, and stays finite to the end', () => {
    const f = new Fight(new Motor(), new River(), new RiverBrain()); f.passive = true; f.m.x = 0; f.m.z = -1.5; f.m.yaw = Math.PI;
    const R = f.king as River; R.x = 0; R.z = -4; R.yaw = 0;
    R.set('dragDeep'); f.brain.seen.add('dragDeep');
    for (let i = 0; i < 4 * 60 && R.held !== 'drag'; i++) f.step(DT, 0, 0, []);
    expect(R.held).toBe('drag');
    const specs = riverMoments(R, f.m); expect(R.staging).toBe('drag');
    const r = playPage(f, () => specs.drag, () => R.held === null, () => R.stage, 16);
    expect(r.badCam + r.badHero).toBe(0);
    expect(DRAG.end).toBeGreaterThanOrEqual(4); expect(DRAG.end).toBeLessThanOrEqual(6);
    expect(R.stage).toBeGreaterThanOrEqual(DRAG.end - 0.1);
    expect(r.frames * DT).toBeGreaterThan(4);
  });
});

describe('a reward on offer (shared by both bosses)', () => {
  it('goes slow and low, shows its press once settled, and eases the camera back on a miss', () => {
    const mo = new Moment(), shown: { r: string; secs: number }[] = [];
    const hero = { x: 0, z: -1 }, boss = () => ({ x: 0, y: 2.6, z: -4 });
    const offer = new Offer(mo, offerSpec(hero, boss), (r, secs) => shown.push({ r, secs }), 0.9);
    const c = cam(); c.position.set(0.2, 1.6, 3);
    offer.step(DT, 'rope', 1.8, false);
    expect(mo.active).toBe(true); expect(mo.letterbox).toBe(true); expect(mo.rate(0)).toBe(OFFER_SLOW);
    for (let i = 0; i < 40; i++) { offer.step(DT, 'rope', 1.8 - i * DT, false); mo.camera(c, DT, i * DT); }
    expect(shown.length).toBe(0);
    for (let i = 40; i < 70; i++) { offer.step(DT, 'rope', 1.8 - i * DT, false); mo.camera(c, DT, i * DT); }
    expect(shown.length).toBe(1); expect(shown[0].r).toBe('rope'); expect(shown[0].secs).toBeGreaterThan(0);
    expect(finite(c.position)).toBe(true);
    // a miss: the moment ends, and the next frames ease from its shot toward the follow camera
    const shot = c.position.clone(); offer.step(DT, null, 0, false); expect(mo.active).toBe(false);
    const follow = new THREE.Vector3(3, 2, 6); c.position.copy(follow); mo.settle(c, DT); expect(c.position.distanceTo(shot)).toBeLessThan(follow.distanceTo(shot));
    for (let i = 0; i < 60; i++) { c.position.copy(follow); mo.settle(c, DT); } expect(c.position.distanceTo(follow)).toBeLessThan(0.01);
  });
  it('a press taken hands over to the moment it starts: the offer stays out of it', () => {
    const mo = new Moment(); const offer = new Offer(mo, offerSpec({ x: 0, z: 0 }, () => ({ x: 0, y: 2, z: -3 })), () => { }, 0.9);
    offer.step(DT, 'ride', 1.8, false); mo.start({ frame: () => 50, rate: () => 0.4 }); offer.step(DT, null, 0, true);
    expect(mo.active).toBe(true); expect(mo.rate(0)).toBe(0.4);
  });
});
