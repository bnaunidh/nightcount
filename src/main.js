// THE NIGHT COUNT — entry point.
import * as THREE from "three";
import { Renderer } from "./core/renderer.js";
import { initInput, inputBus, requestLock, isLocked } from "./core/input.js";
import { loadSettings, settings } from "./core/settings.js";
import { UI } from "./core/ui.js";
import { Player } from "./core/player.js";
import { Interactor } from "./core/interact.js";
import { Station } from "./world/station.js";
import { buildAdditions, captureProps } from "./world/additions.js";
import { dressStation, mergeStatics, settleProps, fitPropColliders } from "./world/props.js";
import { setLoadProgress, preload, MODEL, loadGenerated, generated, ART } from "./core/assets.js";
import { Audio } from "./core/audio.js";
import { Bus, makeTimers } from "./core/util.js";
import { Game } from "./game/game.js";

const canvas = document.getElementById("view");

/**
 * The title card, before anything else.
 *
 * Black, a pump, the name, and then it goes. No menu, no prompt, nothing to
 * press — the point of it is that the game says its own name once, in silence,
 * while nothing is being asked of the player. The pump is drawn rather than
 * loaded: this runs before the asset archive is opened, so it cannot depend on
 * a single byte of it.
 */
function titleSplash() {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "splash";
    el.innerHTML =
      `<div class="spInner">` +
        `<svg class="spPump" viewBox="0 0 64 100" aria-hidden="true">` +
          `<rect class="spGlow" x="16" y="6" width="32" height="6" rx="1.5"/>` +
          `<rect x="16" y="12" width="32" height="74" rx="2"/>` +
          `<rect x="12" y="86" width="40" height="7" rx="1"/>` +
          `<path d="M7 93h50"/>` +
          `<rect class="spScreen" x="21" y="20" width="22" height="15"/>` +
          `<path d="M24.5 26h15M24.5 31h9.5"/>` +
          `<path d="M22 44h9M22 50h9M22 56h9"/>` +
          `<path class="spHose" d="M48 38c11 4 13 18 7 27-3 5-4 7-4 11"/>` +
          `<path d="M47 76h8v6h-8z"/><path d="M51 82v6"/>` +
        `</svg>` +
        `<div class="spTitle">THE NIGHT COUNT</div>` +
      `</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => el.classList.add("in"), 60);

    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      clearTimeout(hold);
      removeEventListener("pointerdown", go, true);
      removeEventListener("keydown", go, true);
      el.classList.remove("in");
      el.classList.add("out");
      // resolve on the way out, so the warning is already fading up underneath
      setTimeout(() => el.remove(), 1300);
      setTimeout(resolve, 850);
    };
    // it can be skipped, but only once it has actually said the name
    const hold = setTimeout(go, 3600);
    setTimeout(() => {
      addEventListener("pointerdown", go, true);
      addEventListener("keydown", go, true);
    }, 1400);
  });
}

/**
 * The content warning.
 *
 * Shown before anything else, and it is also the click that unlocks the audio
 * context — browsers require a gesture, and asking for one in a horror game's
 * first second is better spent on this than on a "click to start" nobody
 * reads. The dread bed comes up underneath it as soon as the gesture lands.
 */
function contentWarning(audio) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "cwarn";
    // Framed as the station's own terminal, because the game's first screen
    // should already be inside the fiction — this is the machine behind the
    // counter telling you what it is about to show you.
    el.innerHTML =
      `<div class="crt">` +
        `<div class="cwHead">MERIDIAN FUEL &amp; PROVISIONS · STATION 41<br>TERMINAL 1 · ADVISORY</div>` +
        `<div class="cwRule"></div>` +
        `<div class="cwTitle">WARNING</div>` +
        `<p>THIS GAME MAY INCLUDE BLOOD, GORE<br>AND FLASHING LIGHTS.</p>` +
        `<p class="cwStrong">VIEWER DISCRETION IS ADVISED.</p>` +
        `<div class="cwRule"></div>` +
        `<div class="cwGo">&gt; PRESS ANY KEY<span class="cwCur">_</span></div>` +
      `</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => el.classList.add("in"), 60);

    let done = false;
    const go = async () => {
      if (done) return;
      done = true;
      removeEventListener("pointerdown", go, true);
      removeEventListener("keydown", go, true);
      el.classList.remove("in");
      setTimeout(() => el.remove(), 900);
      resolve();
    };
    // the gesture that dismisses it is the gesture that starts the sound
    const arm = () => { try { audio?.init?.(); } catch (e) {} };
    addEventListener("pointerdown", arm, { once: true });
    addEventListener("keydown", arm, { once: true });
    // ...but it cannot be skipped instantly — it is a warning, not a splash
    setTimeout(() => {
      addEventListener("pointerdown", go, true);
      addEventListener("keydown", go, true);
      el.classList.add("ready");
    }, 2600);
  });
}

async function boot() {
  loadSettings();
  // The warning goes FIRST — before the loaders, before the game object.
  //
  // It was originally shown after `game.init()`, which put a multi-second
  // await between the game being initialised and the render loop starting.
  // That wedged the Night 1 → Night 2 handover: the first shift was already
  // live while nothing was stepping it. Here it is just a screen in front of
  // a loading bar, which is what it always should have been.
  await titleSplash();
  await contentWarning(null);
  const bar = document.querySelector("#bootBar i");
  const msg = document.getElementById("bootMsg");
  setLoadProgress((p, label) => {
    bar.style.width = Math.round(p * 100) + "%";
    if (label) msg.textContent = label;
  });

  // generated art, if a texture pass has been run
  await loadGenerated();
  const plate = generated(ART.bootPlate);
  if (plate) {
    const b = document.getElementById("boot");
    b.style.backgroundImage =
      `linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,.86)), url("${plate}")`;
    b.style.backgroundSize = "cover";
    b.style.backgroundPosition = "center";
  }

  const renderer = new Renderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.Fog(0x05070a, 26, 130);
  const camera = new THREE.PerspectiveCamera(settings.fov, renderer.aspect, 0.06, 320);
  // The camera has to be IN the scene graph.
  //
  // three.js gathers lights by walking the scene, and renders what it finds
  // there. A camera does not need to be added for the view to work, so this
  // was never noticed — but the torch is a SpotLight parented to the camera,
  // which meant it was never collected and never lit anything: measured, it
  // changed the picture by 0.02 out of 255 while reporting intensity 44.
  //
  // Everything else held in shot hangs off the camera too — the mop, the stock
  // box, the bin bag, the torch body — so none of those were being drawn
  // either. One line, and the torch works and your hands come back.
  scene.add(camera);

  initInput(canvas);
  const ui = new UI();

  msg.textContent = "station geometry";
  const station = new Station();
  scene.add(station.group);

  msg.textContent = "fixtures and stock";
  await preload(Object.keys(MODEL), "loading fixtures");
  await dressStation(scene, station);
  // The floor has to EXIST before anything is settled onto it.
  //
  // settleProps casts a ray down from each prop and closes the gap to whatever
  // it lands on. With the shell now arriving as a glTF, running this first
  // meant 31 props raycast into an empty world, found nothing, and were left
  // hovering at whatever height they were typed at.
  msg.textContent = "facing up the shelves";
  await station.mapReady;
  settleProps(scene, station);
  fitPropColliders(scene, station);
  await buildAdditions(scene, station);
  captureProps(scene, station);
  mergeStatics(scene);

  const player = new Player(camera, station);
  player.teleport(station.anchors.spawn_outside, Math.PI);
  const interact = new Interactor(camera, player, ui);
  interact.scene = scene;          // the usable-object outline raycasts against it
  const audio = new Audio();
  ui.audio = audio;              // ui.say speaks the line as well as showing it

  const game = new Game({ renderer, scene, camera, station, player, interact, ui, audio, canvas });
  await game.init();

  document.getElementById("boot").classList.add("hidden");
  game.music?.play?.("menu");

  // pointer lock on click, but never while a focus surface is open
  canvas.addEventListener("click", () => {
    if (!ui.focused && game.acceptsLock()) requestLock(canvas);
  });
  ui.onFocusChange = (open) => { player.frozen = open || player.cutscene; };

  // A dead feed still renders — as black through the CRT path, which is
  // noticeably worse than an empty room.
  const deadScene = new THREE.Scene();
  deadScene.background = new THREE.Color(0x000000);

  let last = performance.now();
  let feedAccum = 0;
  const timers = makeTimers();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    timers.update(dt);
    game.update(dt);

    // the menu plays over the station itself
    if (game.mode === "menu" && game.menuCam) {
      renderer.render(scene, game.menuCam, dt,
        { grain: 1.15, vignette: 1.35, aberration: 0.9, brightness: 0.94 });
      requestAnimationFrame(frame);
      return;
    }

    const feed = game.feedView();
    if (feed) {
      // Security feeds run at a fixed low frame rate: cheap, and it judders
      // exactly the way a 1997 multiplexer does.
      feedAccum += dt;
      const interval = 1 / (renderer.quality?.camFps || 12);
      if (feedAccum >= interval) {
        const step = feedAccum;
        feedAccum = 0;
        const opts = { feed: true, ...game.postOpts(), grain: 1.1, vignette: 1.25 };
        if (feed.quad) renderer.renderQuad(scene, feed.quad, step, opts);
        else renderer.render(feed.cam ? scene : deadScene, feed.cam || camera, step, opts);
      }
    } else {
      feedAccum = 0;
      renderer.render(scene, camera, dt, game.postOpts());
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug surface used by tools/selftest.js
  const { BUILD } = await import("./core/build.js");
  const ctx = { game, station, player, ui, audio, scene, camera, renderer, interact, THREE, BUILD, settings };
  const { makeDev } = await import("./core/dev.js");
  // Developer surface.
  //
  // `__nc` is how every tool in tools/ drives the game, so it cannot simply be
  // deleted — but it should not be sitting on the page for a player either. It
  // is exposed when the build is opened with `?dev`, on localhost, or when a
  // previous session opted in. A shipped double-clicked file gets nothing.
  const DEV = /[?&]dev\b/.test(location.search)
    || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
    || localStorage.getItem("nightcount.dev") === "1";
  if (DEV) {
    window.__nc = Object.assign(ctx, { dev: makeDev(ctx) });
  } else {
    // one deliberate door, so a tester can be talked through opening it
    window.__ncEnableDev = () => {
      localStorage.setItem("nightcount.dev", "1");
      location.reload();
    };
  }
}

boot().catch((e) => {
  console.error(e);
  const msg = document.getElementById("bootMsg");
  if (msg) { msg.textContent = "failed to start — see console"; msg.style.color = "#c0392b"; }
});
