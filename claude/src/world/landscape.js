// THE NIGHT COUNT — everything past the forecourt.
//
// The station used to sit in a black void: where its lights ended, the world
// did. A desert at night is not black. The sky over it is lighter at the
// horizon than overhead, and the mesas stand against that glow as shapes; the
// road carries on without you, with posts along it that catch headlights; and
// down it, a billboard that has said the same thing for twenty years.
//
// The dome is a shader; the land is Blender (props_land.py). Silhouettes are
// drawn flat and unfogged, because fog would turn them into sky — they only
// read if they stay darker than it at any distance.
import * as THREE from "three";
import { model } from "../core/assets.js";
import { L } from "./station.js";
import { rng } from "../core/util.js";

// sRGB, as a painter would pick them; THREE.Color stores them linear
const SKY = {
  zenith: new THREE.Color(0x04060b),
  horizon: new THREE.Color(0x19202e),
  haze: new THREE.Color(0x2b2626),       // the warm smear right on the horizon
  moonDir: new THREE.Vector3(-30, 40, -20).normalize(),   // where station.js hangs the moonlight
};

const DOME_VERT = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;            // pinned to the far plane: always behind everything
}`;

const DOME_FRAG = /* glsl */`
precision highp float;
uniform vec3 uZenith, uHorizon, uHaze, uMoonDir;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
  col += uHaze * exp(-abs(h) * 26.0) * 0.7;           // the band right on the horizon
  if (h < 0.0) col = mix(col, uHorizon * 0.6, clamp(-h * 8.0, 0.0, 1.0));
  // stars: one in a few hundred direction cells, only well above the haze
  vec3 cell = floor(d * 180.0);
  float s = hash(cell);
  float star = step(0.9971, s) * smoothstep(0.06, 0.32, h);
  col += vec3(0.62, 0.66, 0.78) * star * (0.35 + 0.65 * hash(cell + 11.0));
  // the moon, and the ring of light around it
  float md = dot(d, uMoonDir);
  col += vec3(0.70, 0.72, 0.76) * smoothstep(0.99955, 0.99975, md);
  col += vec3(0.05, 0.06, 0.09) * pow(max(md, 0.0), 90.0);
  gl_FragColor = vec4(col, 1.0);
}`;

/** The sky, and the fog set to match its horizon so distant ground melts into it. */
export function makeSky(scene) {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
      uniforms: {
        uZenith: { value: SKY.zenith }, uHorizon: { value: SKY.horizon },
        uHaze: { value: SKY.haze }, uMoonDir: { value: SKY.moonDir },
      },
      side: THREE.BackSide, depthWrite: false, fog: false,
    }));
  dome.name = "sky";
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);
  scene.background = null;
  if (scene.fog) scene.fog.color.copy(SKY.horizon);
  return dome;
}

async function put(scene, key, pos, rot, name, { merge = false, shadows = false } = {}) {
  const o = await model(key, { shadows });
  const g = new THREE.Group();
  g.add(o);
  g.position.copy(pos);
  g.rotation.y = rot;
  g.name = name;
  g.userData.merge = merge;
  scene.add(g);
  return g;
}

/**
 * Dress the land. Returns once everything is in the scene, so settleProps and
 * mergeStatics see it with the rest of the dressing.
 */
export async function dressLandscape(scene, station) {
  const P = [];
  const R = rng(58);

  // ——— the horizon: two rings of silhouettes, sunk so there is no gap ———
  P.push(put(scene, "ridges", new THREE.Vector3(0, -4, 0), 0, "land_ridges").then((g) => {
    g.traverse((m) => {
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      m.material = mats.map((mm) => new THREE.MeshBasicMaterial({
        // flat and unfogged: a silhouette is a shape, not a surface
        color: /far/.test(mm.name) ? 0x0e1119 : 0x0a0c12, fog: false,
      }))[0];
      m.castShadow = m.receiveShadow = false;
    });
  }));

  // ——— the pole line along the far side of the road, and its wires ———
  const poleZ = L.ROAD_Z - 8, span = 45;
  const poleXs = [];
  for (let x = -135; x <= 135; x += span) poleXs.push(x);
  for (const x of poleXs) {
    // turned so the crossarm runs across the line, not along it
    P.push(put(scene, "utilpole", new THREE.Vector3(x, 0, poleZ), Math.PI / 2, "land_pole"));
  }
  const wireMat = new THREE.LineBasicMaterial({ color: 0x14161a });
  for (let i = 0; i < poleXs.length - 1; i++) {
    for (const dz of [-0.98, -0.44, 0.44, 0.98]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const sag = 1.1 * 4 * t * (1 - t);           // a parabola is a catenary, at this span
        pts.push(new THREE.Vector3(poleXs[i] + t * span, 8.48 - sag, poleZ + dz));
      }
      const w = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat);
      w.name = "land_wire";
      scene.add(w);
    }
  }

  // ——— posts along both edges of the road, reflectors toward the traffic ———
  for (let x = -150; x <= 150; x += 30) {
    if (Math.abs(x) > 16) {
      P.push(put(scene, "delineator", new THREE.Vector3(x, 0, L.ROAD_Z + 5.2), -Math.PI / 2, "land_post", { merge: true }));
    }
    P.push(put(scene, "delineator", new THREE.Vector3(x + 15, 0, L.ROAD_Z - 5.2), Math.PI / 2, "land_post", { merge: true }));
  }

  // ——— the billboard down the road, lit, turned to the station ———
  const bbPos = new THREE.Vector3(-46, 0, -34);
  P.push(put(scene, "billboard", bbPos, 0.95, "land_billboard").then((g) => {
    // three lamps over the face, one light standing in for them
    const lamp = new THREE.SpotLight(0xffe2b0, 60, 16, Math.PI / 4.2, 0.6, 1.3);
    const f = new THREE.Vector3(Math.sin(0.95), 0, Math.cos(0.95));
    lamp.position.copy(bbPos).addScaledVector(f, 1.6).setY(7.1);
    lamp.target.position.copy(bbPos).addScaledVector(f, -0.1).setY(5.2);
    lamp.castShadow = false;
    scene.add(lamp, lamp.target);
    station.lights.billboard = lamp;
  }));

  // ——— junipers, kept off the road, the lot and the forecourt ———
  let placed = 0, tries = 0;
  while (placed < 18 && tries++ < 400) {
    const a = R() * Math.PI * 2, r = 34 + R() * 110;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(z - L.ROAD_Z) < 9) continue;
    if (x > -24 && x < 24 && z > -20 && z < L.LOT_Z1 + 6) continue;
    P.push(put(scene, "juniper", new THREE.Vector3(x, 0, z), R() * 6, "land_juniper", { merge: true }));
    placed++;
  }

  await Promise.all(P);
}
