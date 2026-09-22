// THE NIGHT COUNT — renderer + the "1997" composite pass.
//
// Art direction is enforced here, not in the assets: everything is rendered to
// a small internal buffer (640x360 by default), colour-quantised with an
// ordered dither, grained, vignetted, and blown up with nearest-neighbour.
// That single pipeline is what makes photographic props, low-poly vehicles and
// flat level geometry read as one 1997 game.
import * as THREE from "three";
import { settings, settingsBus, qualityPreset } from "./settings.js";
import { clamp } from "./util.js";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2  uRes;
uniform float uTime, uGrain, uVignette, uAberr, uBright, uFade, uDither;
uniform float uFeed;      // 0 = eyes, 1 = CRT security feed
uniform float uTape;      // tape damage amount (VHS playback)
uniform vec3  uFadeCol;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// 4x4 ordered bayer — the quantiser that gives the picture its era.
float bayer(vec2 p){
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
  float v = 0.0;
  for (int k = 0; k < 16; k++){ if (k == i) v = m[k]; }
  return v / 16.0 - 0.5;
}

void main(){
  vec2 uv = vUv;

  // tape wobble (only on VHS playback surfaces)
  if (uTape > 0.001){
    float line = floor(uv.y * uRes.y);
    float j = (hash(vec2(line, floor(uTime * 12.0))) - 0.5) * 0.004 * uTape;
    float roll = step(0.995, hash(vec2(floor(uTime * 3.0), 7.0))) * 0.02 * uTape;
    uv.x += j; uv.y = fract(uv.y + roll);
  }

  // chromatic aberration, strongest at the edges
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  float a = uAberr * (0.0016 + r2 * 0.004);
  vec3 col;
  col.r = texture2D(tDiffuse, uv + c * a).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - c * a).b;

  // security-feed treatment: desaturate, scanline, noise, slight bloom-less lift
  if (uFeed > 0.5){
    float l = dot(col, vec3(0.34, 0.5, 0.16));
    col = mix(col, vec3(l), 0.82) * vec3(0.92, 0.98, 1.0);
    float sl = 0.86 + 0.14 * sin(uv.y * uRes.y * 3.14159);
    col *= sl;
    col += (hash(uv * uRes + uTime * 60.0) - 0.5) * 0.11;
    col = clamp(col, 0.0, 1.0);
    col = pow(col, vec3(0.92));
  }

  col *= uBright;

  // vignette
  float vig = 1.0 - uVignette * smoothstep(0.28, 0.95, r2 * 1.9);
  col *= vig;

  // film grain (still, per-frame, monochrome — cheap and period-correct)
  float g = (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * uGrain * 0.085;
  col += g;

  // 5-bit-ish colour with ordered dither = the 1997 signature
  if (uDither > 0.5){
    float steps = 26.0;
    col += bayer(gl_FragCoord.xy) / steps;
    col = floor(col * steps + 0.5) / steps;
  }

  col = mix(col, uFadeCol, uFade);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: "high-performance",
      stencil: false, depth: true,
    });
    this.gl.setPixelRatio(1);
    this.gl.autoClear = true;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;

    this.rt = null;
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
        uniforms: {
          tDiffuse: { value: null },
          uRes: { value: new THREE.Vector2(640, 360) },
          uTime: { value: 0 }, uGrain: { value: 1 }, uVignette: { value: 1 },
          uAberr: { value: 0.55 }, uBright: { value: 1 }, uFade: { value: 0 },
          uDither: { value: 1 }, uFeed: { value: 0 }, uTape: { value: 0 },
          uFadeCol: { value: new THREE.Color(0, 0, 0) },
        },
      })
    );
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.time = 0;
    this.fade = 0;
    this.fadeColor = new THREE.Color(0, 0, 0);

    this._resize();
    addEventListener("resize", () => this._resize());
    settingsBus.on("change", () => this._applySettings());
    this._applySettings();
  }

  _applySettings() {
    const q = qualityPreset();
    this.gl.shadowMap.enabled = q.shadows;
    this.quality = q;
    this._resize();
  }

  _resize() {
    const w = Math.max(320, this.canvas.clientWidth || innerWidth);
    const h = Math.max(200, this.canvas.clientHeight || innerHeight);
    this.gl.setSize(w, h, false);
    const q = this.quality || qualityPreset();
    const iw = Math.round(q.internalW * clamp(settings.resScale, 0.5, 2));
    const ih = Math.max(180, Math.round(iw * h / w));
    if (!this.rt || this.rt.width !== iw || this.rt.height !== ih) {
      this.rt?.dispose();
      this.rt = new THREE.WebGLRenderTarget(iw, ih, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        depthBuffer: true, colorSpace: THREE.SRGBColorSpace,
      });
    }
    this.aspect = w / h;
    this.quad.material.uniforms.uRes.value.set(iw, ih);
  }

  makeFeedTarget(w = 256, h = 192) {
    return new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthBuffer: true, colorSpace: THREE.SRGBColorSpace,
    });
  }

  /** Render a scene through a camera straight into an offscreen target. */
  renderTo(scene, camera, target) {
    this.gl.setRenderTarget(target);
    this.gl.clear();
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
  }

  /**
   * Quad pass: up to four cameras into the four quadrants of the internal
   * buffer, then one composite. A dead feed simply leaves its quadrant black,
   * which is exactly what a multiplexer does with a cut cable.
   */
  renderQuad(scene, cams, dt, opts = {}) {
    this.time += dt;
    const gl = this.gl;
    gl.setRenderTarget(this.rt);
    gl.setScissorTest(false);
    gl.clear();
    const w = this.rt.width / 2, h = this.rt.height / 2;
    const at = [[0, h], [w, h], [0, 0], [w, 0]];
    gl.setScissorTest(true);
    for (let i = 0; i < 4; i++) {
      const cam = cams[i];
      const [x, y] = at[i];
      gl.setViewport(x, y, w, h);
      gl.setScissor(x, y, w, h);
      if (!cam) { gl.clear(); continue; }
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      gl.render(scene, cam);
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, this.rt.width, this.rt.height);
    gl.setRenderTarget(null);
    this._composite(dt, { feed: true, ...opts });
  }

  /** Main pass: scene -> internal buffer -> composite to the canvas. */
  render(scene, camera, dt, opts = {}) {
    this.time += dt;
    if (camera.isPerspectiveCamera && Math.abs(camera.aspect - this.aspect) > 1e-3) {
      camera.aspect = this.aspect;
      camera.updateProjectionMatrix();
    }
    this.renderTo(scene, camera, this.rt);
    this._composite(0, opts);
  }

  _composite(dt, opts = {}) {
    const u = this.quad.material.uniforms;
    u.tDiffuse.value = this.rt.texture;
    u.uTime.value = this.time;
    u.uGrain.value = settings.grain * (opts.grain ?? 1);
    u.uVignette.value = settings.vignette * (opts.vignette ?? 1);
    u.uAberr.value = settings.aberration * (opts.aberration ?? 1);
    u.uBright.value = settings.brightness * (opts.brightness ?? 1);
    u.uDither.value = settings.dither ? 1 : 0;
    u.uFeed.value = opts.feed ? 1 : 0;
    u.uTape.value = opts.tape ?? 0;
    u.uFade.value = this.fade;
    u.uFadeCol.value.copy(this.fadeColor);
    this.gl.render(this.postScene, this.postCam);
  }

  setFade(v, color) {
    this.fade = clamp(v, 0, 1);
    if (color) this.fadeColor.set(color);
  }
}
