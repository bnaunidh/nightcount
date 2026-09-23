// THE NIGHT COUNT — endings.
//
// Three. They are decided by what the player did across the whole run, not by
// a choice at the end: whether they served the road, whether they got Jacob
// out, and whether they ever opened the cabinet.
import * as THREE from "three";
import { el } from "../core/ui.js";
import { CREDITS } from "../ui/credits.js";
import { money } from "../core/util.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

export const ENDINGS = {
  decide(state) {
    const d = state.data;
    if (d.flags.rang_attendant) return "count";
    if (d.failCount >= 3) return "count";
    const knows = d.cabinetOpened || Object.keys(d.tapesWatched).length > 0 || d.formSeen;
    if (d.flags.refused_attendant && d.flags.danny_free && knows) return "closedout";
    if (d.flags.refused_attendant && knows) return "closedout";
    return "bypassed";
  },

  async play(game, id) {
    const g = game;
    g.ui.showHUD(false);
    g.player.frozen = true;
    // The scripted ending runs its credits in silence, so it must not have a
    // music cue started underneath it.
    if (id !== "tennineteen") g.music.play(id === "count" ? "count" : "closed");
    if (id === "tennineteen") return tenNineteen(g);
    if (id === "count") return countEnding(g);
    if (id === "closedout") return closedOut(g);
    return bypassed(g);
  },
};

// ————————————————————————————————————————————————————— CLOSED OUT
async function closedOut(g) {
  g.audio.setState("aftermath", 3);
  await g.ui.fade(1, 2.0);
  await g.ui.titleCard("06:02", "31 OCTOBER 1997", 2.6);

  g.player.teleport(new THREE.Vector3(4.0, 0, -3.0), Math.PI + 0.4);
  g.power.on = { store: false, cooler: false, canopy: false, cams: false, back: false };
  g.state.flag("sign_off", true);
  g.power.apply();
  g.audio.subtract("amb_fluorescent", true, 0.5);
  g.scene.background = new THREE.Color(0x1b2230);
  g.scene.fog = new THREE.Fog(0x1b2230, 20, 90);
  g.station.lights.hemi.intensity = 0.55;
  g.station.lights.hemi.color.setHex(0x4a5a72);
  g.station.lights.moon.intensity = 0.45;
  await g.ui.fade(0, 3.0);

  await g.cutscene("cs08_closed", async (cs) => {
    cs.say("The sign is dark. The doors are locked. The count is filed, and it is the true one.", { who: "", secs: 5.5 });
    await cs.wait(5.6);
    cs.look(new THREE.Vector3(0, 0.4, -26), 0.5);
    cs.say("There's light coming up behind the rim.", { who: "", secs: 3.6 });
    await cs.wait(3.8);
    // walk her out to the road
    const from = g.player.pos.clone();
    const to = new THREE.Vector3(0, 0, -21);
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        const t = Math.min(1, (performance.now() - t0) / 9000);
        g.player.pos.lerpVectors(from, to, t * t * (3 - 2 * t));
        if (t >= 1) res(); else requestAnimationFrame(tick);
      };
      tick();
    });
    cs.say("The asphalt stops forty feet past the pumps.", { who: "", secs: 4 });
    await cs.wait(4.2);
    // the road ends
    g.station.road.visible = false;
    g.scene.getObjectByName?.("roadline") && (g.scene.getObjectByName("roadline").visible = false);
    g.audio.subtract("amb_highway", true, 1.0);
    cs.say("Not blocked. Not overgrown. It stops, and after that there's just ground.", { who: "", secs: 5 });
    await cs.wait(5.2);
    cs.say("She walks anyway.", { who: "", secs: 3 });
    await cs.wait(3.4);
    if (g.state.flag("danny_free")) {
      cs.say("Somewhere behind her a car she used to know starts up, and goes the other way.", { who: "", secs: 5 });
      await cs.wait(5.2);
    }
    g.audio.play("veh_truck_pass", { vol: 0.4 });
    cs.say("Headlights come up a road that isn't there any more.", { who: "", secs: 4 });
    await cs.wait(4.2);
    cs.say("They don't slow down.", { who: "", secs: 3.4 });
    await cs.wait(3.6);
    await cs.fade(1, 4);
  });

  await creditsRoll(g, "CLOSED OUT", summary(g));
}

// ————————————————————————————————————————————————————— THE COUNT
async function countEnding(g) {
  g.audio.setState("danger", 1.5);
  g.player.shake(0.3, 1.4);
  g.audio.play("hor_static_burst", { vol: 0.7, scare: true });
  await g.ui.fade(1, 1.6);
  await wait(1.4);
  await g.ui.titleCard("22:00", "AN EVENING IN NOVEMBER", 3.0);

  // the same first shift, from the other side of the counter
  g.player.teleport(g.station.anchors.behind_counter.clone(), Math.PI);
  g.power.on = { store: true, cooler: true, canopy: true, cams: true, back: true };
  g.state.flag("sign_off", false);
  g.power.apply();
  g.audio.setState("normal", 2);
  await g.ui.fade(0, 2.4);

  await g.cutscene("cs09_count", async (cs) => {
    cs.say("The urn is on. The floor is clean. The drawer is counted.", { who: "", secs: 4.4 });
    await cs.wait(4.6);
    g.audio.play("int_doorchime", { vol: 0.6 });
    cs.look(new THREE.Vector3(5.1, 1.5, 0.4), 1.0);
    cs.say("Somebody new lets themselves in with a key from an envelope.", { who: "", secs: 4.4 });
    await cs.wait(4.6);
    cs.say("They read the note. They read the binder. They look at rule three for a long time.", { who: "", secs: 5 });
    await cs.wait(5.2);
    cs.look(new THREE.Vector3(2.0, 1.4, 6.0), 0.8);
    await g.attendant.showAt(3, { stage: 1, anim: "Idle_Loop" });
    cs.say("And on camera three, in the rear aisle, there is somebody holding a mop, facing the wall.", { who: "", secs: 5.4 });
    await cs.wait(5.6);
    cs.say("They have been on that camera the whole time.", { who: "", secs: 4 });
    await cs.wait(4.2);
    await cs.fade(1, 3.5);
  });

  await creditsRoll(g, "THE COUNT", summary(g));
}

// ————————————————————————————————————————————————————— BYPASSED
async function bypassed(g) {
  g.audio.setState("normal", 2);
  await g.ui.fade(1, 2.0);
  await g.ui.titleCard("06:14", "31 OCTOBER 1997", 2.6);
  g.player.teleport(new THREE.Vector3(8.0, 0, -6.0), -1.4);
  g.state.flag("sign_off", true);
  g.power.on = { store: false, cooler: false, canopy: false, cams: false, back: false };
  g.power.apply();
  g.scene.background = new THREE.Color(0x1b2230);
  g.station.lights.hemi.intensity = 0.5;
  await g.ui.fade(0, 2.6);

  await g.cutscene("cs10_bypassed", async (cs) => {
    cs.say("Keys through the letter slot. Wages in the post. That's the job done.", { who: "", secs: 4.6 });
    await cs.wait(4.8);
    cs.look(new THREE.Vector3(-13.6, 1.0, 5.0), 0.7);
    cs.say("The car in the corner of the lot stays where it is.", { who: "", secs: 4 });
    await cs.wait(4.2);
    g.phone.broadcast([
      "…demolition at the Mile 41 station begins Monday, closing a twenty-three year chapter for the community…",
      "…the company says the site will be cleared, the tanks pulled, and the land returned to the county…",
    ]);
    await cs.wait(9);
    g.audio.play("int_doorchime", { vol: 0.5, scare: true });
    cs.say("The radio drops out for a second, and what comes through instead is a door chime.", { who: "", secs: 5 });
    await cs.wait(5.2);
    cs.say("She turns the radio off and drives south, and never learns what she was for.", { who: "", secs: 5 });
    await cs.wait(5.2);
    await cs.fade(1, 3.5);
  });

  await creditsRoll(g, "BYPASSED", summary(g));
}

// ————————————————————————————————————————————————————— shared
function summary(g) {
  const d = g.state.data;
  const rows = [
    ["Arrivals served", d.servedCount],
    ["Arrivals not served", d.failCount],
    ["Unexplained surplus in the drawer", money(d.overCents)],
    ["Things noticed", Object.keys(d.clues).length],
    ["Tapes watched", Object.keys(d.tapesWatched).length],
    ["Jacob", d.flags.danny_free ? "left the road" : "still on it"],
    ["Final headcount filed", d.headcountFiled ?? "left blank"],
  ];
  return rows.map(([a, b]) => `<div class="mrow"><label>${a}</label><span>${b}</span></div>`).join("");
}

async function creditsRoll(g, endingName, summaryHTML) {
  g.music.play("credits");
  const wrap = el(`<div class="menuWrap">
    <div class="brandmark">
      <div class="t" style="font-size:clamp(20px,4vw,36px)">${endingName}</div>
      <div class="s">THE NIGHT COUNT · STATION 41 · 1974–1997</div>
    </div>
    <div style="margin:18px 0 26px">${summaryHTML}</div>
    <div class="credits">${CREDITS}</div>
    <div style="text-align:center;margin-top:24px">
      <button class="mbtn" style="display:inline-block;width:auto">RETURN TO THE MENU</button>
    </div>
  </div>`);
  const menu = document.getElementById("menu");
  menu.classList.remove("hidden");
  menu.classList.remove("pause");
  menu.innerHTML = "";
  menu.appendChild(wrap);
  g.ui.fade(0, 1.2);
  await new Promise((res) => { wrap.querySelector("button").onclick = res; });
  menu.innerHTML = "";
  menu.classList.add("hidden");
  g.player.frozen = false;
}

// ————————————————————————————————————————————— TEN NINETEEN
//
// The author's ending, and the only one now reachable by playing to Night 6.
//
// Three rules from the script, all of which are load-bearing:
//
//   1. **The credits roll in silence.** No music cue for the first ninety
//      seconds — just a heart monitor, mixed so quiet that most players will
//      not consciously notice when it starts. It is the answer to the whole
//      game and it is playing underneath the names.
//   2. **Do not hint that there is more.** The credits are not skippable and
//      nothing on screen suggests anything follows them.
//   3. **The first input after the crash is his hand, and it is mapped to
//      nothing.** The player presses something and a hand moves, and that is
//      all it does. That is the point of it.
async function tenNineteen(g) {
  await g.ui.fade(1, 1.6);
  g.audio.setState("off", 1.0);

  // ——— the credits, in silence, with the monitor under them ————————
  const monitor = g.audio.play("med_monitor", { vol: 0.055, loop: true, bus: "amb" });
  await creditsSilent(g);
  try { monitor?.stop(); } catch (e) { /* already gone */ }

  // ——— AFTER THE CREDITS ————————————————————————————————————————
  //
  // White. Too bright. It resolves slowly, the way waking up actually does.
  const room = el(`<div class="wake"><div class="wakeInner"></div></div>`);
  const menu = document.getElementById("menu");
  menu.classList.remove("hidden", "pause");
  menu.innerHTML = "";
  menu.appendChild(room);
  const line = room.querySelector(".wakeInner");
  g.ui.fade(0, 0.1);

  g.audio.play("amb_hospital", { vol: 0.30, loop: true, bus: "amb" });
  g.audio.play("med_monitor", { vol: 0.16, loop: true, bus: "amb" });

  const say = async (text, secs, cls = "") => {
    const p = document.createElement("p");
    p.className = "wakeLine " + cls;
    p.textContent = text;
    line.appendChild(p);
    // The reveal is a class added on the next frame. If the player tabs away
    // during the ending — which is exactly when a browser stops serving
    // requestAnimationFrame — that frame never comes and the line stays at
    // opacity 0 forever. The timer is the belt to rAF's braces; whichever
    // arrives first wins and the second is a no-op.
    requestAnimationFrame(() => p.classList.add("in"));
    setTimeout(() => p.classList.add("in"), 60);
    line.scrollTop = line.scrollHeight;
    await sleep(secs * 1000);
  };

  await sleep(4200);                       // it takes a while to resolve
  await say("A ceiling tile. A window with real daylight in it.", 3.4, "stage");
  await say("A machine beeping in time with the sound that was under the credits.", 4.2, "stage");
  await say("A man in his fifties leans into frame, and takes his glasses off, "
    + "and sits down very slowly on the edge of the bed like his legs have gone.", 5.4, "stage");

  await say("…Danny.", 3.0, "noah");
  await say("Danny, it's been ten years.", 4.0, "noah");

  // The first input the player has had since the crash, and it is mapped to
  // nothing. It moves his hand. That is all it does.
  await handMoves(g, room);

  await say("You're out of your coma.", 3.6, "noah");
  await say("[he wipes his face with the back of his wrist, and laughs, and it's "
    + "an awful sound, because it's relief]", 4.6, "stage");
  await say("I'm Noah. I've been your doctor since the beginning. Since— since the "
    + "accident, on the highway, outside the old station.", 6.0, "noah");
  await say("You don't have to talk. Don't try yet.", 3.6, "noah");
  await say("[a long pause. Danny's eyes move to the window]", 4.4, "stage");
  await say("…You've been saying a name. For ten years. On and off. Jacob.", 5.2, "noah");
  await say("We looked him up, years ago. Danny — I'm sorry. He was in the car with you.", 6.0, "noah");

  // the monitor picks up
  const fast = g.audio.play("med_monitor", { vol: 0.22, rate: 1.5, loop: true, bus: "amb" });
  await say("[the monitor picks up. Noah puts a hand flat on Danny's shoulder]", 4.0, "stage");
  await say("Hey. Hey. You're alright. You're alright.", 4.2, "noah");
  try { fast?.stop(); } catch (e) {}
  await sleep(2200);

  await say("There's — okay. There's something I should tell you, and I've wanted "
    + "to tell you for about six years.", 5.6, "noah");
  await say("There's a young man who comes in. Every Tuesday, since he was small. "
    + "Sits where I'm sitting. Talks to you the whole hour.", 6.4, "noah");
  await say("He said you got him out of somewhere once.", 4.0, "noah");
  await say("He was never able to explain it in a way any of us understood, and "
    + "honestly we stopped asking, because he kept coming.", 6.0, "noah");
  await say("He's seventeen now.", 3.8, "noah");

  await say("[Noah stands, and goes to the door, and stops with his hand on it]", 4.4, "stage");
  await say("He's in the corridor. He's been out there since six this morning.", 5.0, "noah");
  await say("[he looks back]", 2.6, "stage");
  await say("Welcome back, Danny.", 4.0, "noah");

  // He opens the door. Somewhere out in the corridor, someone is humming.
  g.audio.play("int_door_open", { vol: 0.4 });
  await sleep(1600);
  g.audio.play("hum_tune", { vol: 0.34, rate: 1.05, dur: 1.9 });
  await say("[somewhere out in the corridor, someone is humming]", 3.6, "stage");
  await say("[four notes]", 3.4, "stage");
  await sleep(2600);

  await g.ui.fade(1, 3.0);
  await sleep(1200);
  menu.innerHTML = "";
  await thanksForPlaying(g);
}

/** The credits. Ninety seconds with nothing under them but a heart monitor. */
async function creditsSilent(g) {
  const menu = document.getElementById("menu");
  const wrap = el(`<div class="menuWrap creditsQuiet">
    <div class="brandmark">
      <div class="t" style="font-size:clamp(20px,4vw,36px)">THE NIGHT COUNT</div>
      <div class="s">STATION 41</div>
    </div>
    <div class="credits">${CREDITS}</div>
  </div>`);
  menu.classList.remove("hidden", "pause");
  menu.innerHTML = "";
  menu.appendChild(wrap);
  g.ui.fade(0, 2.4);
  // Let them roll all the way. There is no skip and no prompt, because a
  // "press any key" here would tell the player something is coming.
  //
  // The first ninety seconds are the scripted silence — nothing under the
  // names but a heart monitor nobody has recognised yet. The music comes in
  // only after that, on a very long fade, so it arrives underneath the
  // realisation rather than instead of it.
  await sleep(90000);
  g.music.play("credits");
  await sleep(30000);
  await g.ui.fade(1, 2.4);
  menu.innerHTML = "";
}

/**
 * His hand moves. That is all it does.
 *
 * The first input the player has had since the crash — and it is deliberately
 * bound to nothing at all. Any key, any click. The game takes it, moves a hand
 * a few centimetres, and goes back to not listening.
 */
function handMoves(g, room) {
  return new Promise((resolve) => {
    const hint = document.createElement("p");
    hint.className = "wakeLine hand";
    hint.textContent = "…";
    room.querySelector(".wakeInner").appendChild(hint);
    requestAnimationFrame(() => hint.classList.add("in"));
    setTimeout(() => hint.classList.add("in"), 60);
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      removeEventListener("keydown", go, true);
      removeEventListener("pointerdown", go, true);
      hint.textContent = "[Danny's hand moves. That's all it does.]";
      setTimeout(resolve, 2600);
    };
    addEventListener("keydown", go, true);
    addEventListener("pointerdown", go, true);
    setTimeout(go, 20000);          // he moves it himself eventually
  });
}

/** The last screen. */
async function thanksForPlaying(g) {
  const menu = document.getElementById("menu");
  const wrap = el(`<div class="menuWrap thanks">
    <div class="brandmark">
      <div class="t" style="font-size:clamp(22px,5vw,42px)">THANKS FOR PLAYING</div>
    </div>
    <p>If you enjoyed it, share it with your friends —<br>
       that's genuinely how people find small games like this.</p>
    <p>And if you'd like to support what I make next,<br>
       donations help me out more than you'd think.</p>
    <p class="sig">— thank you for spending six nights here.</p>
    <div style="text-align:center;margin-top:30px">
      <button class="mbtn" style="display:inline-block;width:auto">RETURN TO THE MENU</button>
    </div>
  </div>`);
  menu.classList.remove("hidden", "pause");
  menu.innerHTML = "";
  menu.appendChild(wrap);
  g.music.play("credits");            // carries through to the last screen
  await g.ui.fade(0, 2.0);
  await new Promise((res) => { wrap.querySelector("button").onclick = res; });
  g.music.stop(2.0);
  menu.innerHTML = "";
  menu.classList.add("hidden");
  g.player.frozen = false;
}
