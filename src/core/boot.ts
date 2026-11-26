// What main.ts hands a fight's boot: the renderer, the lights, the camera, input and the page. Each boss's own page (river.ts, hours.ts) takes this.
import type * as THREE from 'three';
import type { DynamicScale, Tier } from './quality.ts';
import type { Input } from '../input/input.ts';
import type { Post } from '../render/post.ts';

export interface Ctx {
  Q: URLSearchParams; tier: Tier; renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; moon: THREE.DirectionalLight; moonDir: THREE.Vector3; hemi: THREE.HemisphereLight; kick: THREE.DirectionalLight; sky: THREE.Object3D;
  post: Post; dyn: DynamicScale; resize: () => void; input: Input; app: HTMLElement; baseFov: () => number; focus: THREE.Vector3; status: (s: string) => void; SHOT: string | null; BENCH: string | null;
}
