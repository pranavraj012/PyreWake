// A cheap stand-in that only casts a shadow: drawn in full in the shadow pass, as nothing in the main pass.
import * as THREE from 'three';

const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
export function shadowOnly<T extends THREE.Mesh>(make: (g: THREE.BufferGeometry, m: THREE.Material) => T, src: THREE.BufferGeometry, depth: THREE.Material): T {
  // own draw range, shared buffers
  const g = new THREE.BufferGeometry(); for (const k in src.attributes) g.setAttribute(k, src.attributes[k]); g.setIndex(src.index); g.boundingSphere = src.boundingSphere;
  const o = make(g, ghost); o.castShadow = true; o.receiveShadow = false; o.customDepthMaterial = depth; o.frustumCulled = false;
  o.onBeforeShadow = () => g.setDrawRange(0, Infinity); o.onBeforeRender = () => g.setDrawRange(0, 0);
  return o;
}
/** Replace a skinned body's own shadow with a low-detail one on the same skeleton. */
export function skinnedShadow(body: THREE.SkinnedMesh, lo: THREE.BufferGeometry, depth: THREE.Material) {
  const o = shadowOnly((g, m) => { const s = new THREE.SkinnedMesh(g, m); s.bind(body.skeleton, new THREE.Matrix4()); return s; }, lo, depth);
  body.castShadow = false; body.parent!.add(o); return o;
}
