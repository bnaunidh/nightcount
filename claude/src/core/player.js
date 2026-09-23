// THE NIGHT COUNT — first-person player: movement, collision, head bob, steps.
import * as THREE from "three";
import { settings } from "./settings.js";
import { actionDown, takeMouse, isLocked } from "./input.js";
import { clamp, lerp } from "./util.js";

const EYE = 1.62, RADIUS = 0.33;
const WALK = 1.45, SLOW = 0.85;

export class Player {
  constructor(camera, station) {
    this.cam = camera;
    this.station = station;
    this.pos = new THREE.Vector3(0, 0, -3);
    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.bob = 0; this.bobAmt = 0;
    this.frozen = false;          // cutscenes / focus surfaces
    this.canMove = true;
    this.stepDist = 0;
    this.onStep = () => {};
    this.speedScale = 1;
    this.surface = "lino";
    this.lookTarget = null;       // {yaw,pitch,lerp} for scripted looks
    this._shake = 0; this._shakeT = 0;
  }

  teleport(v, yaw = this.yaw) {
    this.pos.copy(v); this.pos.y = 0;
    this.yaw = yaw; this.pitch = 0;
    this.vel.set(0, 0, 0);
  }

  shake(amount = 0.4, time = 0.5) {
    this._shake = Math.max(this._shake, amount * settings.shake);
    this._shakeT = Math.max(this._shakeT, time);
  }

  lookAtPoint(p, speed = 2.5) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const yaw = Math.atan2(-dx, -dz);
    const dy = p.y - (this.pos.y + EYE);
    const dist = Math.hypot(dx, dz);
    this.lookTarget = { yaw, pitch: clamp(Math.atan2(dy, dist), -1.2, 1.2), speed };
  }

  /**
   * If you are standing inside geometry, get out.
   *
   * A player reported being **softlocked in the doorway**: once the body ends
   * up inside a collider — a door that closed on them, a prop that appeared,
   * a spawn nudged half a metre — every direction reads as blocked and there
   * is no input that helps. The fix is not to make the doorway wider, because
   * the next trap will be somewhere else; it is to make being stuck
   * impossible to stay in. Each frame, if the current position is solid, push
   * out along the shortest axis until it is not.
   */
  _unstick() {
    if (!this._blocked(this.pos.x, this.pos.z)) return false;
    const cols = this.station.colliders;
    for (const c of cols) {
      if (c.y1 !== undefined && c.y1 < 0.45) continue;
      const inX = this.pos.x > c.x0 - RADIUS && this.pos.x < c.x1 + RADIUS;
      const inZ = this.pos.z > c.z0 - RADIUS && this.pos.z < c.z1 + RADIUS;
      if (!inX || !inZ) continue;
      // shortest way out of THIS box
      const dxl = Math.abs(this.pos.x - (c.x0 - RADIUS));
      const dxr = Math.abs((c.x1 + RADIUS) - this.pos.x);
      const dzl = Math.abs(this.pos.z - (c.z0 - RADIUS));
      const dzr = Math.abs((c.z1 + RADIUS) - this.pos.z);
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) this.pos.x = c.x0 - RADIUS - 0.02;
      else if (m === dxr) this.pos.x = c.x1 + RADIUS + 0.02;
      else if (m === dzl) this.pos.z = c.z0 - RADIUS - 0.02;
      else this.pos.z = c.z1 + RADIUS + 0.02;
      if (!this._blocked(this.pos.x, this.pos.z)) return true;
    }
    return true;
  }

  _blocked(x, z) {
    const cols = this.station.colliders;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.y1 !== undefined && c.y1 < 0.45) continue;   // step over low kerbs
      if (x > c.x0 - RADIUS && x < c.x1 + RADIUS && z > c.z0 - RADIUS && z < c.z1 + RADIUS) return true;
    }
    return false;
  }

  update(dt) {
    const cam = this.cam;
    this._unstick();

    if (!this.frozen && isLocked()) {
      const m = takeMouse();
      this.yaw -= m.x;
      this.pitch = clamp(this.pitch - m.y, -1.35, 1.35);
      this.lookTarget = null;
    } else if (this.lookTarget) {
      const t = 1 - Math.exp(-this.lookTarget.speed * dt);
      let d = this.lookTarget.yaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * t;
      this.pitch = lerp(this.pitch, this.lookTarget.pitch, t);
    } else if (!isLocked()) {
      takeMouse();
    }

    let vx = 0, vz = 0;
    if (!this.frozen && this.canMove) {
      const f = (actionDown("forward") ? 1 : 0) - (actionDown("back") ? 1 : 0);
      const s = (actionDown("right") ? 1 : 0) - (actionDown("left") ? 1 : 0);
      if (f || s) {
        const len = Math.hypot(f, s);
        const sp = (actionDown("sprint") ? SLOW : WALK) * this.speedScale;
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        vx = (s * cos - f * sin) * sp / len;
        vz = (-s * sin - f * cos) * sp / len;
      }
    }

    this.vel.x = lerp(this.vel.x, vx, 1 - Math.exp(-14 * dt));
    this.vel.z = lerp(this.vel.z, vz, 1 - Math.exp(-14 * dt));

    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    if (!this._blocked(nx, this.pos.z)) this.pos.x = nx; else this.vel.x *= 0.2;
    if (!this._blocked(this.pos.x, nz)) this.pos.z = nz; else this.vel.z *= 0.2;

    // soft world bounds — the desert is not a playground
    this.pos.x = clamp(this.pos.x, -27, 27);
    this.pos.z = clamp(this.pos.z, -31, 25);

    // head bob + footsteps
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.bobAmt = lerp(this.bobAmt, speed > 0.15 ? 1 : 0, 1 - Math.exp(-8 * dt));
    this.bob += speed * dt * 5.6;
    this.stepDist += speed * dt;
    if (this.stepDist > 0.78) {
      this.stepDist = 0;
      this.onStep(this.surfaceAt());
    }

    if (this._shakeT > 0) {
      this._shakeT -= dt;
      this._shake = lerp(this._shake, 0, 1 - Math.exp(-6 * dt));
    } else this._shake = 0;

    const bobY = Math.sin(this.bob * 2) * 0.028 * this.bobAmt;
    const bobX = Math.cos(this.bob) * 0.022 * this.bobAmt;
    cam.position.set(
      this.pos.x + bobX + (Math.random() - 0.5) * this._shake,
      EYE + bobY + (Math.random() - 0.5) * this._shake,
      this.pos.z + (Math.random() - 0.5) * this._shake
    );
    cam.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.006 * this.bobAmt, "YXZ");
    cam.fov = settings.fov;
    cam.updateProjectionMatrix();
  }

  surfaceAt() {
    const { x, z } = this.pos;
    if (z > 8.2 && z < 12) return (x > 4.5) ? "tile" : "concrete";
    if (z > 0 && z < 12) return "lino";
    if (z > 12) return "gravel";
    return "concrete";
  }

  inside() { return this.pos.z > 0.1 && this.pos.z < 12 && Math.abs(this.pos.x) < 9; }
}
