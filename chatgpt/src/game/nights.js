// THE NIGHT COUNT — the six shifts.
//
// Each night is an async script that waits on *tasks*, not timers, so the
// story never overtakes a careful player or strands a fast one. Every horror
// beat here is triggered by work: the log book, the monitors, the breaker
// panel, the manifest, the form.
import * as THREE from "three";
import { serveArrival } from "./arrivals.js";
import { CAST } from "./customers.js";
import { DOCS } from "./documents.js";
import { L, BAYS } from "../world/station.js";
import { clockString } from "../core/util.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Pacing waits run in real time. SPEED lets the automated playthrough
// (tools/playtest.js) compress a shift without changing its structure.
let SPEED = 1;
export const setSpeed = (v) => { SPEED = Math.max(0.05, Math.min(60, v || 1)); };
export const getSpeed = () => SPEED;
const wait = (s) => new Promise((r) => setTimeout(r, (s * 1000) / SPEED));

/** Small helper so scripts can bail cleanly when the player quits. */
function scriptShell(g, run, extra = {}) {
  const ctl = { aborted: false };
  const shell = {
    ctl,
    started: false,
    start: async () => {
      shell.started = true;
      try { await run(ctl); }
      catch (e) { if (!ctl.aborted) console.error("[night]", e); }
      finally { shell.finished = true; }
    },
    abort: () => { ctl.aborted = true; },
    ...extra,
  };
  return shell;
}

// ————————————————————————————————————————————————————————— NIGHT 1
const night1 = (g) => scriptShell(g, async (ctl) => {
  g.setDread(0);
  // a resumed shift drops you back at the counter, not back in the car
  if (!g.resuming && !g.skipIntro) await g.cutscene("cs01_arrival", async (cs) => {
    await cs.fade(1, 0);
    g.player.teleport(V(6.5, 0, -14.5), Math.PI);
    g.audio.play("veh_car_arrive", { vol: 0.5 });
    // The song on the radio, cut off mid-phrase when he kills the engine.
    // Nothing is made of it. It is here so that the humming on Night 4 has
    // something to be the same as — the payoff only exists if this plays.
    const song = g.audio.voice("hum_tune", "radio", { vol: 0.55 });
    await cs.wait(1.1);
    try { song?.stop(); } catch (e) { /* already done */ }
    g.audio.play("int_radio_static", { vol: 0.35 });
    await cs.wait(0.5);
    g.audio.play("veh_car_door", { vol: 0.5 });
    await cs.fade(0, 1.8);

    cs.say("So. This is the place.", { who: "", secs: 2.4 });
    cs.look(V(-16, 4.6, -19), 0.7);
    await cs.wait(2.6);
    cs.say("Closing for good in a few days. Nobody knows that yet.", { who: "", secs: 3.4 });
    await cs.wait(3.4);

    // the photograph. The one thing in the game that is his.
    g.docs.show("photo_jacob");
    await cs.wait(2.6);
    cs.say("…One of them was my friend.", { who: "", secs: 2.8 });
    await cs.wait(2.8);
    g.ui.closeFocus?.(false);
    await cs.wait(0.5);

    // The last line plays over the WALK, not over a held camera. It is the
    // instruction, so it is the moment the player most wants their hands back.
    g.player.teleport(V(5.6, 0, -3.2), Math.PI);
  });
  if (!g.resuming && !g.skipIntro) {
    g.ui.say("Clean it, stock it, open it. Before nine fifteen.", { who: "", secs: 3.4 });
  }

  if (ctl.aborted) return;

  // Twelve jobs, and eleven of them were "walk somewhere and press E".
  //
  // The first night of a game is where a player decides whether the work is
  // interesting, and this list answered no before they had done any of it: it
  // filled the whole left of the screen, it took forty minutes to grind
  // through, and two of the entries (fetch the crates, check over the pumps)
  // were pure errand — a trip to a spot to be told that everything was fine.
  //
  // Seven. Every one of them is something with more than one step in it, and
  // the shift stops being a list you clear and starts being a job you are
  // doing while other things happen.
  g.tasks.set([
    // 20:20 – 21:00 · PREP
    { id: "clock_in", text: "Clock in — labelled machine beside OFFICE, on the shop back wall" },
    { id: "note", text: "Read the manager's note — it's on the register" },
    { id: "clean", text: "Mop the spills — 0/3" },
    { id: "restock", text: "Fill the shelf gaps — 0/4 · cases are in the stock room" },
    { id: "readings", text: "Read all four pump meters, then write them up — 0/4" },
    { id: "open", text: "Open the station — 21:00" },
    // 21:00 – 06:00 · SHIFT
    { id: "serve", text: "Serve whoever comes to the counter" },
    { id: "lockup", text: "Lock the doors and punch out — 06:00" },
  ], "TONIGHT · PREP");
  g.state.flag("can_call_gil", true);

  g.bus.on("doc:read", (id) => {
    if (id === "note_n1") g.tasks.done("note");
    if (id === "binder") g.state.clue("rules", "The standing rules");
  });

  await g.tasks.wait("clock_in");
  if (!g.state.flag("delivery_complete_n1") || g.state.data.delivery?.phase) void g.delivery.start();
  g.ui.toast("Twenty past eight. Doors in forty minutes.");
  await wait(2);
  g.setDread(0);

  // ——— the phone, in the first minute ————————————————————————————
  //
  // This used to ring AFTER the first customer, seven or eight minutes in. By
  // then the player had worked the whole prep list alone in an empty building
  // and nobody had said a word to them. It is the only other voice on Night 1
  // and it carries every rule the night is about — doors at nine, serve
  // whoever comes in however they look, stay out of the back lot — so it
  // belongs at the front, where those rules still have a shift left to bind.
  //
  // It rings while they are walking to the mop. Answering it is optional; the
  // machine takes it if they do not, which is its own small characterisation.
  g.timers.after(9, () => {
    if (ctl.aborted || g.mode !== "play") return;
    g.phone.ring({
      id: "owner_n1", lines: [
        { sound: "hum_breath", secs: 2.0 },
        { text: "You're in, then.", secs: 2.4 },
        { text: "Doors at nine. Not ten past. If they're shut at ten past I hear about it, "
          + "and then you hear about it.", secs: 5.0 },
        { sound: "hum_sigh", secs: 1.8 },
        { text: "Somebody comes in, you serve them. However they look. However late.", secs: 4.4 },
        { text: "And stay out of the back lot after dark. Nothing out there but the bins.", secs: 4.6 },
        { text: "…Goodnight.", secs: 2.2 },
      ],
      onEnd: () => { g.state.clue("owner1", "The owner's first call"); g.setDread(1); },
      onMissed: () => g.state.note("Missed a call. Twenty-five past eight.", g.minutes),
    });
  });

  // ——— and one thing that is not the job, before any of it is done ————
  //
  // The first unsettling thing on Night 1 was the blood under the restroom
  // mess, which is gated on mopping all three — four or five minutes in, and
  // only if they mop in the order the queue happens to give them. Until then
  // the building was completely inert, and "nothing here does anything" is the
  // impression the opening was actually making.
  //
  // So: a pump resets its own nozzle out on the forecourt while he is still
  // finding the light switch. It is deniable, it costs nothing, it is never
  // mentioned again, and it is the first evidence that the station is not
  // simply a room with a list in it.
  g.timers.after(26, () => {
    if (ctl.aborted || g.mode !== "play" || g.ui.focused) return;
    g.unscheduled.force("pump");
  });

  // The watch: it buzzes when something is due. Teaching that here is what
  // makes a buzz with nothing attached mean anything later.
  g.watch.at(20 * 60 + 45, "open_soon", "Fifteen minutes. Doors at nine.");
  g.watch.at(21 * 60, "open_now", "Nine. Open the station.");
  g.watch.at(29 * 60 + 45, "close_soon", "Quarter to six. Start closing up.");

  // PREP: three messes and six gaps.
  //
  // This was five and ten, and it was the longest stretch of pure chores in
  // the game — a player had to mop five times and make four trips to the stock
  // room before the station even opened, which is the one place anyone was
  // likely to put the game down and not come back. The job still teaches
  // itself in three: mop, fetch, fill, and the rhythm is established by the
  // second one.
  //
  // The restroom stays LAST, because the blood under that mess has to land
  // after the player has settled into mopping and stopped paying attention —
  // it just lands eight minutes earlier now, which is the whole point.
  g.chores.restockLeft = 4;
  // — the restroom. The brown mess on the floor is the job. Nobody mentions
  //   what is under it, tonight or ever. It is simply there. —
  const offClean = g.bus.on("chore:clean", async (where) => {
    if (where !== "bath" || g.state.flag("saw_blood")) return;
    offClean();
    g.state.flag("saw_blood", true);
    g.audio.play("int_mop_bucket", { vol: 0.5 });
    await wait(1.6);
    g.ui.say("There we go. That's the worst of it.", { who: "", secs: 3.2 });
    await wait(3.6);
    g.station.showBathBlood?.(true);
    g.audio.play("hor_drone_tension", { vol: 0.3 });
    await wait(1.0);
    g.ui.say("…", { who: "", secs: 1.6 });
    await wait(1.8);
    g.ui.say("That was under it.", { who: "", secs: 2.8 });
    await wait(3.0);
    g.state.clue("blood_n1", "Blood under the mess in the restroom");
    g.state.note("There is blood under the floor mess in the restroom.", g.minutes);
    g.setDread(2);
  });

  // The rest of the author's opening, delivered over the work rather than at a
  // held camera. Same lines, but the player is moving, and "people went missing
  // out here" lands while he is mopping rather than while he is standing still.
  const barks = [
    [8, "Which makes you wonder what they're in such a hurry to close."],
    [26, "People went missing out here. More than a few."],
    [44, "Nobody ever put it in the paper."],
    [72, "I don't want to be here."],
    [86, "But the bills don't care."],
  ];
  for (const [at, line] of barks) {
    g.timers.after(at, () => { if (!ctl.aborted && g.mode === "play") g.ui.say(line, { who: "", secs: 3.6 }); });
  }

  // The fourth entry is what the objective panel says out loud, so the job
  // reads as "go here and do this" instead of a number you have to go and earn.
  g.chores.startPrepCleaning();

  // ——— the doors open, and from here two things are happening at once ————
  //
  // This used to be strictly sequential: finish the prep, serve a customer,
  // wait fifty seconds, serve another, then do the meters. Nothing ever
  // wanted the player in two places, so the shift was a queue of one thing at
  // a time and the station might as well have been empty between them.
  //
  // The arrivals now run on their own thread. The chores are still on the
  // list; the chime goes when it goes. Being in the stock room with a box in
  // your hands when somebody walks in IS the job — it is the only part of
  // working a counter that is actually a game, and it was being carefully
  // scheduled out of the way.
  // Long enough that a player who is deep in the prep list is not overtaken by
  // the first customer arriving at a shut station. The watch nags at 20:45 and
  // again at nine, which is the actual reminder.
  await Promise.race([g.tasks.wait("open"), wait(150)]);
  if (ctl.aborted) return;
  g.setClock(21, 20);

  const shift = (async () => {
    // Night 1 is generous on purpose: forty minutes of patience instead of
    // twenty-two, because the first customer of the game is teaching the
    // register and losing them for being halfway up an aisle teaches the
    // wrong thing. From Night 2 they wait the ordinary amount.
    await serveArrival(g, "A6", { bayIndex: 0, patience: 40 });
    if (ctl.aborted) return;
    g.tasks.done("serve");
    await wait(50 + Math.random() * 40);
    if (ctl.aborted) return;
    g.audio.play("hor_creak", { vol: 0.25 });
    await serveArrival(g, "A2", { bayIndex: 1, patience: 34 });
  })();


  // — the log page, whenever they get round to the meters —
  //
  // No longer gated behind both arrivals: the meters are a prep job on the
  // list from the top of the shift, and a player who does them at half past
  // nine should find the page dated tomorrow at half past nine.
  g.ui.toast("Meters, then the book.");
  const offLog = g.bus.on("chore:log", async () => {
    offLog();
    await wait(1.2);
    g.docs.showHTML("Pump Meter Log", "the page before yours",
      `<table>
        <tr><th>DATE</th><th>22:00</th><th>06:00</th><th>SOLD</th><th>INIT</th></tr>
        <tr><td>10-21-97</td><td>884,131</td><td>884,140</td><td>9</td><td>G.V.</td></tr>
        <tr><td><b>10-24-97</b></td><td>884,140</td><td>884,153</td><td>13</td><td><b>W.A.</b></td></tr>
        <tr><td>10-23-97</td><td>${(884140).toLocaleString()}</td><td>—</td><td>—</td><td>W.A.</td></tr>
      </table>
      <p class="typed">The page above tonight's is dated the twenty-fourth. Tomorrow.</p>
      <p class="typed">The initials are yours. The handwriting is yours. The figures are filled in
      for a shift you have not worked.</p>`);
    g.state.clue("tomorrow", "A log page dated tomorrow");
    g.state.note("The log page above mine is dated the 24th. In my handwriting.", g.minutes);
    g.setDread(1);
    g.audio.play("hor_creak", { vol: 0.35 });
  });

  // Both threads have to land before the night can turn: the prep list and the
  // people who came in while it was being worked through.
  await g.tasks.wait("readings");
  if (ctl.aborted) return;
  await shift;
  if (ctl.aborted) return;

  // — 02:36. The one thing tonight that is not the job. —
  g.setClock(2, 34);
  await wait(4);
  if (ctl.aborted) return;
  g.watch.buzz("");                       // it goes off, and nothing is due
  await wait(2.2);
  // Out on the road, and IN a direction.
  //
  // These played unpositioned, so the loudest event of Night 1 arrived from
  // everywhere at once and the player had no idea which way to look — while
  // the task told them to go and investigate. It comes off the highway now,
  // north-west of the forecourt, so there is somewhere to run to. The point of
  // the beat is that nothing is there when you arrive; that only lands if you
  // went to the right place.
  const CRASH = V(-14, 1.2, L.ROAD_Z + 2);
  g.audio.play("hor_tyre_screech", { vol: 0.9, scare: true, pos: CRASH });
  await wait(1.5);
  g.audio.play("hor_crash_bang", { vol: 0.95, scare: true, pos: CRASH });
  g.player.shake(0.5, 1.1);
  await wait(1.2);
  g.audio.subtract("amb_highway", true, 0.4);
  await wait(2.4);
  g.ui.say("…That was close. That was really close.", { who: "", secs: 3.6 });
  g.tasks.add({ id: "investigate", text: "CHECK CRASH SOUND — roadside ditch, LEFT past the pumps" });
  // Somewhere to actually go.
  //
  // The task said INVESTIGATE and there was no hotspot anywhere — it ticked
  // itself after 150 seconds whether the player moved or not. Now the verge
  // where the sound came from can be looked at, and looking is what completes
  // it. The 150-second race stays as a backstop so a player who ignores it is
  // not stranded.
  g.interact.add({
    id: "investigate", pos: V(-14, 1.0, L.ROAD_Z + 3.5), radius: 6.0,
    label: "the verge where it came off", verb: "Look",
    enabled: () => g.tasks.has("investigate") && !g.tasks.isDone("investigate"),
    onUse: () => { g.tasks.done("investigate"); },
  });
  g.setDread(4);
  g.state.clue("crash_n1", "Something came off the road at 02:36");
  g.state.note("02:36 — tyres, then an impact. Nothing out there when I looked.", g.minutes);
  await Promise.race([g.tasks.wait("investigate"), wait(150)]);
  if (ctl.aborted) return;
  g.tasks.done("investigate");
  g.audio.setState("normal", 3);
  await wait(2);
  g.ui.say("Nothing. No car, no glass, no skid. Nothing.", { who: "", secs: 4 });
  await wait(4.2);
  g.setDread(3);

  g.setClock(5, 40);
  g.ui.toast("Twenty past five. Close it up.");
  g.state.flag("closing", true);      // the shift may now be closed out
  await g.tasks.wait("lockup");
  if (ctl.aborted) return;
  if (!ctl.aborted) await g.endNight(2);
}, {
  radio: () => [
    "…KCBK Coldbrook. Twenty-nine at the airport, clear, wind northeast at eleven…",
    "…county commissioners meet Thursday on the disposal of the old Route 41 right-of-way…",
    "…and a reminder that the Meridian station at Mile 41 closes for good at the end of the month, after twenty-three years…",
  ],
  gilCall: () => ({
    id: "gil_dial", lines: [
      { sound: "hum_breath", secs: 1.6 },
      { text: "It's late. Is the store lit?", secs: 3 },
      { text: "Then it's fine. Anything else, it's on the sheet.", secs: 3.4 },
    ],
  }),
});

// ————————————————————————————————————————————————————————— NIGHT 2
const night2 = (g) => scriptShell(g, async (ctl) => {
  // The blood under the floor mess is still there — Night 2's whole "…Then why
  // is it still warm" beat stands on it, and Night 3 has not cleaned it either.
  // Visuals are reset per night now, so the nights that want it say so.
  g.station.showBathBlood?.(true);
  g.setDread(1);

  // Jacob is visible inside the sales floor, with rain beyond the glass.
  if (!g.resuming && !g.skipIntro) await g.cutscene("cs02_jacob_shop", async (cs) => {
    await cs.fade(1,0);
    g.player.teleport(V(5.1,0,1.4),Math.PI);
    g.station.setDoor('entry',true);
    cs.look(V(3.8,1.5,4.6),12);
    await cs.fade(0,1.1);
    cs.say("Rain all week. Great.",{secs:2.2});await cs.wait(2.2);
    await g.attendant.showAt(0,{stage:2,anim:'Idle_Loop',at:V(3.8,0,4.6),facing:Math.PI,silent:true});
    g.weather.thunder(true);cs.look(V(3.8,1.55,4.6),12);
    cs.say("Jacob? You're inside. How did you get in?",{secs:3.4});await cs.wait(3.6);
    g.weather.thunder(true);g.attendant.hide();
    g.station._jacobBlood=g.station._bloodDecal(.25,.34,3.8,.024,4.6,0,'blood_small_pool');
    cs.say("He was right there. Between the shelves.",{secs:3.2});await cs.wait(2.8);
    g.state.clue('jacob_shop_n2','Jacob appeared inside the shop during the storm. A flash of lightning, and he was gone.');
    g.state.note('Rain on the front windows. Thunder overhead. Jacob was standing in the shop, looking straight at me.',g.minutes);
    g.setDread(3);
  });
  if(ctl.aborted)return;

  g.tasks.set([
    { id: "clock_in", text: "Clock in — labelled machine beside OFFICE" },
    { id: "note", text: "Read the manager's note — it's on the register" },
    { id: "cams", text: "Look at the monitor bank — it's on the office desk" },
    { id: "bathroom", text: "Check the restroom at midnight — end of the hall" },
    { id: "serve", text: "Serve whoever comes in" },
    { id: "readings", text: "Read all four pump meters, then write them up — 0/4" },
    { id: "lockup", text: "Lock the doors and punch out — 06:00" },
  ]);
  g.bus.on("doc:read", (id) => { if (id === "note_n2") g.tasks.done("note"); });
  const offCam = g.bus.on("cameras:opened", () => { offCam(); g.tasks.done("cams"); });

  await g.tasks.wait("clock_in");
  await wait(4);
  g.ui.toast("Six feeds. Four monitors. It cycles.");

  // — A1: the first arrival that leaves the road —
  await Promise.race([g.tasks.wait("cams"), wait(60)]);
  if (ctl.aborted) return;
  g.setClock(23, 40);
  const r1 = await serveArrival(g, "A1", { bayIndex: 2 });
  if (ctl.aborted) return;
  g.tasks.done("serve");
  if (r1 === "served") {
    await wait(3);
    g.ui.toast("The drawer's over. Count it if you want.");
    g.state.clue("over_first", "The drawer ran over");
    g.state.note("Drawer over by exactly what he paid. Rule 12 has a box for it.", g.minutes);
  } else {
    g.state.flag("failed_A1", true);
    g.state.note("He didn't leave. His truck is still on two.", g.minutes);
  }

  // — the figure on camera 3 —
  await wait(24);
  if (ctl.aborted) return;
  g.setClock(1, 10);
  g.setDread(2);
  g.phone.ring({ id: "onering", maxRings: 1, lines: [], onEnd: () => {} });
  await wait(6);
  g.audio.play("hor_shelf_creak", { vol: 0.4, pos: V(2.2, 1.2, 5.4) });
  g.ui.toast("Something moved in aisle three.");
  await g.attendant.showAt(3, { stage: 1, anim: "NC_Restock_Loop" });
  g.state.clue("cam3", "A figure on camera 3");
  const offVanish = g.bus.on("attendant:vanish", async () => {
    offVanish();
    g.cameras.offset.set(3, -14);
    g.state.note("Nothing in aisle three. Camera 3's clock is fourteen minutes behind the others.", g.minutes);
    g.state.clue("cam3_offset", "Camera 3 runs behind");
    g.audio.play("hor_static_burst", { vol: 0.3 });
  });
  g.timers.after(90, () => { if (g.attendant.present) g.attendant.hide(); });

  // — the girl with the flat: a living person, for contrast —
  await wait(60);
  if (ctl.aborted) return;
  g.setClock(2, 50);
  await serveArrival(g, "A7", { bayIndex: 4, patience: 26 });
  if (ctl.aborted) return;

  await g.tasks.wait("bathroom");
  g.state.clue("mirror", "The mirror in the restroom");
  g.docs.showHTML("Restroom", "00:12",
    `<p class="typed">Clean, more or less. Someone has wiped the mirror in a circle, at a height
     that is not yours, and the circle has fogged again from the outside.</p>`);

  await g.tasks.wait("readings");
  if (ctl.aborted) return;
  // — 03:14 —
  g.setClock(3, 12);
  await wait(4);
  if (ctl.aborted) return;
  g.audio.subtract("amb_fridge", true, 0.5);
  await wait(2.2);
  g.watch.buzz("");
  await wait(1.6);
  g.ui.say("come here", { who: "Jacob", secs: 3.4 });
  g.audio.play("hum_murmur", { vol: 0.5, scare: true });
  g.player.shake(0.25, 0.8);
  await wait(4.0);
  g.state.clue("comehere_n2", "Jacob's voice, inside the building, 03:14");
  g.state.note("03:14 — his voice. Inside. Close. Two words.", g.minutes);
  g.setDread(5);
  await wait(3);
  g.audio.setState("normal", 4);

  g.setClock(5, 30);
  g.state.flag("closing", true);      // the shift may now be closed out
  await g.tasks.wait("lockup");
  if (ctl.aborted) return;
  if (!ctl.aborted) await g.endNight(3);
}, {
  radio: () => [
    "…twenty-six degrees and falling, a hard freeze warning for the high desert overnight…",
    "…the sheriff's office is asking again for information on a nineteen eighty-nine disappearance at the Mile 41 station. The file remains open…",
  ],
});

// ————————————————————————————————————————————————————————— NIGHT 3
const night3 = (g) => scriptShell(g, async (ctl) => {
  // The blood under the floor mess is still there — Night 2's whole "…Then why
  // is it still warm" beat stands on it, and Night 3 has not cleaned it either.
  // Visuals are reset per night now, so the nights that want it say so.
  g.station.showBathBlood?.(true);
  g.setDread(2);
  g.power.capacity = 4;

  // ——— Night 3: the rain is worse, and he has brought salt ————————
  if (!g.resuming && !g.skipIntro) await g.cutscene("cs03_salt", async (cs) => {
    await cs.fade(1, 0);
    g.player.teleport(V(6.5, 0, -14.5), Math.PI);
    g.audio.subtract("amb_rain_heavy", false, 0.8);
    g.audio.play("veh_car_arrive", { vol: 0.45 });
    await cs.fade(0, 1.8);
    cs.say("—third night of it now, and no sign of letting up. Police still asking anyone "
      + "travelling Route—", { who: "RADIO", secs: 4.4 });
    await cs.wait(4.4);
    g.audio.play("int_radio_static", { vol: 0.4 });
    cs.say("Raining??? Again…", { who: "", secs: 2.4 });
    await cs.wait(2.6);
    cs.say("I really was hoping the weather guy was wrong.", { who: "", secs: 3.0 });
    await cs.wait(3.2);
    g.audio.play("veh_car_door", { vol: 0.5 });
    cs.say("I hope this keeps that weird thing that looks like Jacob away.", { who: "", secs: 4.0 });
    await cs.wait(4.2);
    g.player.teleport(V(5.6, 0, -3.2), Math.PI);
  });
  if (ctl.aborted) return;

  // one bag, six pours, nine thresholds. He is never told the shortfall.
  g.salt.give();
  await g.torch.take();

  // 21:40 — the tally in the grout. He does not clean it off.
  g.watch.at(21 * 60 + 40, "", "");
  g.timers.after(0, () => {
    const off = g.bus.on("watch", async () => {
      if (Math.abs(g.minutes - (21 * 60 + 40)) > 3) return;
      off();
      g.station.showTally?.(true);
      g.state.clue("tally_n3", "A tally scratched in the grout — four and a fifth cut across");
      g.ui.say("…That wasn't there.", { who: "", secs: 3.0 });
      await wait(3.4);
      g.ui.say("That wasn't there.", { who: "", secs: 3.0 });
      g.state.note("Four marks and a fifth cut across them, chest height, in the grout.", g.minutes);
      g.setDread(3);
    });
  });

  g.tasks.set([
    { id: "clock_in", text: "Clock in — labelled machine beside OFFICE" },
    { id: "note", text: "Read the manager's note — it's on the register" },
    { id: "salt", text: "Lay salt — 0/6" },
    { id: "breaker", text: "Reset breaker C7 — the panel is in the stock room" },
    { id: "trash", text: "Take the bin bag out to the dumpster — round the back" },
    { id: "serve", text: "Serve whoever comes in" },
    { id: "readings", text: "Read all four pump meters, then write them up — 0/4" },
    { id: "lockup", text: "Lock the doors and punch out — 06:00" },
  ]);
  g.bus.on("doc:read", (id) => { if (id === "note_n3") g.tasks.done("note"); });
  g.state.flag("panel_unlocked", true);

  // start with the sign dark and C7 out
  g.power.on.canopy = false;
  g.power.on.cams = false;
  g.power.apply();
  const offPower = g.bus.on("power:change", (id, v) => {
    if (id === "cams" && v) { g.tasks.done("breaker"); offPower(); }
  });

  await g.tasks.wait("clock_in");
  g.ui.toast("The sign's out. So is the camera circuit.");
  await g.tasks.wait("breaker");
  if (ctl.aborted) return;
  g.state.clue("power", "Four circuits, five loads");
  g.state.note("Four circuits. Something has to stay dark.", g.minutes);

  await wait(20);
  g.setClock(0, 20);
  await serveArrival(g, "A5", { bayIndex: 3 });
  if (ctl.aborted) return;
  g.tasks.done("serve");

  // — the spill, which needs the mop, which is in the back —
  await wait(15);
  if (ctl.aborted) return;
  g.tasks.add({ id: "clean", text: "Something's spilled in aisle two" });
  await g.chores.makeSpill(3.8, 4.6, "shop", "between the middle and right-hand shelves");
  g.audio.play("hor_bottle_fall", { vol: 0.55, pos: V(3.8, 0.3, 4.6), scare: true });
  await g.tasks.wait("clean");
  if (ctl.aborted) return;

  await g.tasks.wait("trash");
  if (ctl.aborted) return;

  // — the pole walk —
  g.setClock(2, 50);
  g.setDread(3);
  g.power.serviceOff = true;
  g.power.apply();
  g.audio.setState("outage", 1.5);
  g.audio.play("int_breaker", { vol: 0.8, scare: true });
  g.ui.toast("Everything goes. The whole service.");
  g.state.flag("pole_task", true);
  g.tasks.add({ id: "pole", text: "The disconnect is on the pole behind the building" });
  g.phone.ring({
    id: "gil_n3", lines: [
      { sound: "hum_breath", secs: 1.8 },
      { text: "Did you get C7?", secs: 2.4 },
      { text: "Good. If the whole main's gone it's the pole out back. Torch is under the counter.", secs: 4.6 },
      { sound: "hum_sigh", secs: 2.0 },
      { text: "Don't let anybody wait outside.", secs: 3.2 },
      { text: "If they're waiting, they're not leaving.", secs: 3.6 },
    ],
    onEnd: () => g.state.clue("waiting", "\"If they're waiting, they're not leaving\""),
  });

  const offService = g.bus.on("power:service", async (off) => {
    if (off) return;
    offService();
    g.tasks.done("pole");
    g.audio.setState("normal", 2.0);
    // walking back: every window lit, and someone behind the counter
    await g.attendant.showAt(3, { stage: 1, anim: "Idle_Loop" });
    g.power.on = { store: true, cooler: true, canopy: false, cams: true, back: true };
    g.power.apply();
    // Was a cutscene. It is a discovery — every light on, and something at his
    // register — and discovery is the player's job, so the camera stays his.
    // He is walking back from the pole in the dark; he will look at the
    // building on his own, because there is nothing else out here to look at.
    g.ui.say("Every light in the building is on.", { who: "", secs: 3.4 });
    await wait(3.6);
    g.ui.say("There's someone at the register.", { who: "", secs: 3.2 });
    await wait(3.4);
    g.audio.play("hor_thump_wall", { vol: 0.45, scare: true });
    g.player.shake(0.22, 0.5);
    await wait(1.2);
    await g.attendant.hide();
    g.register.openDrawer(true);
    g.ui.toast("Nothing. The drawer's open.");
    g.state.clue("drawer_open", "The drawer was open when I got back");
    g.state.note("Came back from the pole. Every light on. Drawer open. Nobody.", g.minutes);
  });

  await g.tasks.wait("pole");
  if (ctl.aborted) return;

  // The author's Night 3 beats. These were sitting in `night2`'s function
  // body, so the five-dollar man and the 01:58 branch fired a night early —
  // before the salt exists and before the tally — and Night 3 itself had
  // neither. A single-night test of Night 3 showed none of its own content,
  // which is how it was found.
  // — 23:12. He buys nothing. He pays for it anyway. —
  g.setClock(23, 8);
  await wait(3);
  if (ctl.aborted) return;
  {
    g.audio.play("int_doorchime", { vol: 0.6 });
    const man = await g.customers.arrive("A3", { noVehicle: true, fromX: 12 });
    if (!ctl.aborted && man) {
      await wait(4);
      g.ui.say("You're the new one.", { who: "the man on foot", secs: 3.2 });
      await wait(3.2);
      const a1 = await g.choices.ask("n3_newone", [
        { id: "only",  text: "\"I'm the only one.\"" },
        { id: "who",   text: "\"Who told you that?\"" },
        { id: "quiet", text: "[Say nothing. Ring up the five.]", silent: true },
      ]);
      await wait(1.2);
      if (a1 === "who") {
        g.ui.say("…", { who: "the man on foot", secs: 2.0 });
        await wait(2.2);
      }
      g.ui.say("How many nights you done?", { who: "the man on foot", secs: 3.2 });
      await wait(3.2);
      const a2 = await g.choices.ask("n3_nights", [
        { id: "three", text: "\"Three.\"" },
        { id: "why",   text: "\"Why?\"" },
        { id: "lie",   text: "[Lie.] \"First one.\"" },
      ]);
      await wait(1.4);
      g.ui.say("Don't do five.", { who: "the man on foot", secs: 3.4 });
      g.state.clue("dont_do_five", "\"Don't do five.\"");
      g.state.note("He said don't do five. He left the money on the counter.", g.minutes);
      await wait(3.6);
      // he leaves the five. There is no car outside.
      g.state.data.overCents += 500;
      g.customers.leave(man, { permanent: false });
      await wait(4);
      g.watch.buzz("");                    // nothing is due
      g.setDread(4);
      await wait(2);
      g.ui.say("There's no car out there.", { who: "", secs: 3.2 });
      g.state.clue("no_car_n3", "He arrived and left on foot, in this rain");
    }
  }

  // — 01:58. A scream, then two shots. No task appears. Whether he goes out
  //   is the whole point: both branches cost him something, and neither tells
  //   him which one was worse. —
  g.setClock(1, 56);
  await wait(4);
  if (ctl.aborted) return;
  {
    g.audio.subtract("amb_highway", true, 0.5);
    await wait(1.2);
    g.audio.play("hum_scream_far", { vol: 0.7, scare: true });
    await wait(1.6);
    g.audio.play("hor_crash_bang", { vol: 0.75, scare: true });
    await wait(0.7);
    g.audio.play("hor_crash_bang", { vol: 0.72, scare: true });
    g.player.shake(0.3, 0.9);
    g.setDread(5);
    g.tasks.add({id:'crash_site',text:'OPTIONAL: inspect the crash — roadside ditch, left past the pumps',optional:true});
    g.interact.add({id:'crash_site',pos:V(-6,1,L.ROAD_Z+3),radius:4.5,label:'the roadside crash',verb:'Investigate',enabled:()=>g.tasks.has('crash_site')&&!g.tasks.isDone('crash_site'),onUse:()=>g.tasks.done('crash_site')});
    await g.station.showCrashScene(true);
    g.state.note("01:58 — a scream, then two bangs. Outside. Not far.", g.minutes);

    const wentOut = await Promise.race([
      new Promise((res) => {
        const stop = g.timers.every(0.4, () => {
          if (g.tasks.isDone('crash_site')) { stop(); res(true); }
        });
        g.timers.after(150, () => { stop(); res(false); });
      }),
      wait(155).then(() => false),
    ]);
    if (ctl.aborted) return;

    g.tasks.remove('crash_site');g.interact.remove('crash_site');
    if (wentOut) {
      // the ditch. Nobody in it, nobody near it.
      g.state.flag("n3_went_out", true);
      g.station.showCrashScene?.(true);
      await wait(3);
      g.ui.say("Driver's door open. Wipers still going.", { who: "", secs: 3.6 });
      await wait(3.8);
      g.ui.say("Nobody in it. Nobody near it.", { who: "", secs: 3.4 });
      await wait(3.6);
      g.state.clue("casings_n3", "Two shell casings on the asphalt, filling with rain");
      await wait(2);
      // the shopping bag. This station's logo. This station's receipt.
      g.docs.show("receipt_tomorrow");
      // the timestamp is the point: it is dated the night he has not worked yet
      {
        const el = document.getElementById("receiptStamp");
        if (el) {
          const d = 21 + g.state.night;          // tomorrow's shift
          el.textContent = `10-${String(d).padStart(2, "0")}   02:11`;
        }
      }
      g.state.clue("receipt_tomorrow", "A receipt from this station, timestamped tomorrow");
      g.state.note("The receipt in the bag is timestamped tomorrow. I put it in my pocket.", g.minutes);
      await wait(6);
      g.ui.closeFocus?.(false);
      await wait(1.4);
      g.ui.say("…", { who: "", secs: 1.6 });
      await wait(1.8);
      g.ui.say("No.", { who: "", secs: 2.2 });
      await wait(2.4);

      // and while he was out there, the front door was the one he did not salt
      if (!g.salt.isSalted("front")) {
        await wait(8);
        const post = g.salt.weakest();
        g.state.flag("n3_something_inside", true);
        g.audio.play("int_doorchime", { vol: 0.5 });
        await g.attendant.showAt?.(0, {
          stage: 2, anim: "Idle_Loop",
          at: new THREE.Vector3(2.2, 0, 5.4), facing: Math.PI,
        });
        g.state.clue("inside_n3", "Something was standing in an aisle when I got back");
        await wait(2.6);
        g.attendant.hide();
        g.state.note(`It was in the aisle. It did nothing. The ${post} was open.`, g.minutes);
      }
    } else {
      // he stayed in. The pumps do it themselves.
      g.state.flag("n3_stayed_in", true);
      await wait(4);
      g.ui.say("Not my job. Not my job. Not my job.", { who: "", secs: 4.2 });
      await wait(5);
      g.setClock(2, 5);
      await wait(3);
      g.audio.play("int_pump_click", { vol: 0.7 });
      g.audio.play("int_pump_nozzle", { vol: 0.5 });
      g.station.runPumpsAlone?.(true);
      g.ui.say("All four. Nozzles still in the cradles.", { who: "", secs: 4 });
      await wait(4.4);
      g.station.runPumpsAlone?.(false);
      g.state.clue("nineteen72", "The pumps ran themselves and stopped at $19.72");
      g.state.note("They stopped at exactly $19.72. I wrote it in the log anyway.", g.minutes);
      await wait(2.4);
      g.ui.say("Nineteen seventy-two.", { who: "", secs: 3.2 });
      await wait(3.4);
      g.setDread(5);
    }
  }

  // `restock` came off Night 3's list — salt, the breaker and the bins are a
  // full night's work and the shelves were the fourth trip to the stock room
  // in three shifts. The gate that waited on it went with it.
  await g.tasks.wait("readings");
  if (ctl.aborted) return;
  g.setClock(5, 30);
  g.state.flag("closing", true);      // the shift may now be closed out

  // ——— 05:30, before he locks up. The author's line. ————————————————
  //
  // He is standing at the door with the keys already in his hand, doing the
  // thing people do at the end of a bad shift: talking himself down, out loud,
  // to nobody. It lands on the author's line — and that line is a *plan*,
  // which is the first time in three nights he has had one.
  //
  // `said_salt` is set so a later night can read it back without a caption.
  // Nothing on screen tells him it mattered.
  //
  // Wait for the phone to be free first. `say()` replaces whatever line is on
  // screen, so a call still running would cut through the middle of this and
  // both would be unreadable — which is exactly what the first run of it did.
  // Capped, because a call that never ends must not hold the night shut.
  for (let i = 0; i < 200 && (g.phone.inCall || g.phone.ringing); i++) await wait(0.2);
  await wait(1.6);
  g.ui.say("Right. That's it. That's the night.", { who: "", secs: 3.0 });
  await wait(3.2);
  g.ui.say("Keys, lights, door. Same as always.", { who: "", secs: 3.0 });
  await wait(3.2);
  g.ui.say("…Except it isn't, is it.", { who: "", secs: 2.8 });
  await wait(3.0);
  g.ui.say("Three nights. Three.", { who: "", secs: 2.6 });
  await wait(2.8);
  g.ui.say("My gran used to put it down. Doors, windows. Whole line of it.", { who: "", secs: 4.4 });
  await wait(4.6);
  g.ui.say("We all thought she'd lost it.", { who: "", secs: 2.8 });
  await wait(3.0);
  g.ui.say("Maybe some salt will help next time.", { who: "", secs: 3.6 });
  g.state.flag("said_salt", true);
  g.state.note("Said it out loud on the way out: maybe some salt will help next time.", g.minutes);
  g.state.clue("salt_idea", "Salt. Gran used to put it down at the doors and windows.");
  await wait(3.8);

  await g.tasks.wait("lockup");
  if (ctl.aborted) return;
  // — 06:00. He locks it from the outside and looks back through the glass. —
  if (g.salt.isSalted("bath")) {
    g.salt.markCrossing("bath");
    await wait(2);
    g.ui.say("The line's still there. Not a grain out of place.", { who: "", secs: 4 });
    await wait(4.2);
    g.ui.say("There's prints on both sides of it.", { who: "", secs: 3.6 });
    g.state.note("The salt across the bathroom door was undisturbed. There were footprints on both sides.", g.minutes);
    await wait(3.8);
  }

  if (!ctl.aborted) await g.endNight(4);
}, {
  radio: () => [
    "…hard freeze through morning, twenty-two at the airport…",
    "…Meridian Fuel confirms the Mile 41 station closes the thirty-first. A company spokesman said the site will be cleared and the tanks pulled by spring…",
  ],
});

// ————————————————————————————————————————————————————————— NIGHT 4
//
// The author's night, built to the script as written.
//
// Two things about it are unlike anything else in the game and both are
// deliberate:
//
//   1. **The screen goes black and the game does not skip.** He puts his head
//      down for ten minutes and you sit through the next two hours with your
//      eyes shut, listening. Every line in that stretch is captioned, because
//      a scene made of sound is a scene deaf players are locked out of, and
//      the whole point is that you *heard everything and could not see it*.
//   2. **It ends at 02:24.** He clocks out three and a half hours early with
//      the shift unfinished, and the watch tells him so, and he lets it. The
//      remaining tasks are never completed. That is the ending of the night.
const night4 = (g) => scriptShell(g, async (ctl) => {
  g.setDread(3);

  // ——— Cold open: no rain. Which is worse. ————————————————————————
  if (!g.resuming && !g.skipIntro) await g.cutscene("cs04_dry", async (cs) => {
    await cs.fade(1, 0);
    g.player.teleport(V(6.5, 0, -14.5), Math.PI);
    // three nights of rain, and tonight the layer simply is not there
    g.audio.setState("exterior", 2.0);
    g.audio.subtract("amb_rain_heavy", true, 0.1);
    g.audio.play("veh_car_arrive", { vol: 0.45 });
    await cs.fade(0, 1.8);
    await cs.wait(0.8);

    cs.say("Hmmm… isn't raining.", { who: "", secs: 2.8 });
    await cs.wait(3.0);
    // he looks up for a second longer than he needs to
    cs.look(V(2, 30, -34), 0.45);
    await cs.wait(3.4);

    cs.say("Might as well take the umbrella anyway.", { who: "", secs: 3.2 });
    await cs.wait(3.4);

    g.audio.play("veh_car_door", { vol: 0.5 });           // the trunk
    await cs.wait(1.2);
    cs.say("Flashlight. Umbrella.", { who: "", secs: 2.4 });
    await cs.wait(2.6);

    // the bag. He shakes it, and it tells him how much of tonight he can cover.
    g.audio.play("int_salt_pour", { vol: 0.4, rate: 1.7 });
    await cs.wait(1.0);
    cs.say("…Yeah.", { who: "", secs: 2.4 });
    await cs.wait(2.6);
    g.player.teleport(V(5.6, 0, -3.2), Math.PI);
  });
  if (ctl.aborted) return;

  await g.torch.take();
  g.salt.give({ carry: true });          // the same bag. Lighter than it was.

  g.tasks.set([
    { id: "clock_in", text: "Clock in — labelled machine beside OFFICE" },
    { id: "note", text: "Read the manager's note — it's on the register" },
    { id: "salt", text: `Lay salt — 0/${g.salt.max}` },
    { id: "restock", text: "Fill the shelf gaps — cases are in the stock room" },
    // the two the author left to me. Both are ordinary, and one of them is the
    // room he will be standing outside of at 02:16 with a child behind him.
    { id: "bathroom", text: "Check the restroom — end of the hall" },
    { id: "readings", text: "Read all four pump meters, then write them up — 0/4" },
    { id: "open", text: "Open the station — 21:00" },
    { id: "serve", text: "Serve whoever comes in" },
    { id: "lockup", text: "Lock the doors and punch out — 06:00" },
  ], "TONIGHT · PREP");

  g.bus.on("doc:read", (id) => { if (id === "note_n4") g.tasks.done("note"); });
  g.watch.at(20 * 60 + 45, "open_soon", "Fifteen minutes. Doors at nine.");
  g.watch.at(21 * 60, "open_now", "Nine. Open the station.");

  // The restroom check, hours before it matters. He finds nothing, because
  // there is nothing to find yet.
  const offBath = g.bus.on("chore:bathroom", async () => {
    offBath();
    await wait(1.2);
    g.ui.say("Clean. Dry. Fine.", { who: "", secs: 2.8 });
    await wait(3.0);
    g.ui.say("It's always the bathroom, isn't it.", { who: "", secs: 3.2 });
    g.state.note("Checked the restroom at the start of the shift. Nothing in it.", g.minutes);
  });

  await g.tasks.wait("clock_in");
  if (ctl.aborted) return;
  await wait(2);
  g.ui.say("Dry night. First one.", { who: "", secs: 2.8 });

  await Promise.race([g.tasks.wait("open"), wait(90)]);
  if (ctl.aborted) return;
  g.setClock(21, 6);
  g.audio.setState("normal", 3.0);

  // ——— The shift. Quiet, on purpose. The lot is quiet in a way the last
  //     three nights weren't, and nothing happens for hours. ————————————
  await Promise.race([g.tasks.wait("readings"), wait(120)]);
  if (ctl.aborted) return;

  g.setClock(0, 14);
  g.setDread(2);                         // it drops. Nothing is wrong tonight.
  await wait(3);
  g.ui.say("Quarter past midnight. Nothing. Not one car.", { who: "", secs: 4.0 });
  await wait(4.4);
  g.ui.say("I could get used to a dry night.", { who: "", secs: 3.2 });
  await wait(4.0);

  // ——— 00:19 · he puts his head down ————————————————————————————————
  //
  // Scripted rather than offered. He is not choosing between two things; he is
  // a tired man at four hours in who tells himself it is ten minutes. The
  // player does not get to decline it, which is the point of it.
  g.setClock(0, 19);
  if (ctl.aborted) return;

  await g.cutscene("cs04_sleep", async (cs) => {
    cs.say("Ten minutes. Just ten.", { who: "", secs: 3.0 });
    await cs.wait(3.2);
    g.audio.setState("near", 2.0);
    await cs.fade(1, 2.2);               // black — and it stays black
    await cs.wait(2.4);
    g.ui.clearSubs();

    // Everything from here is heard, not seen. `who` is set on every line so
    // it renders in the dialogue box, which sits above the fade; the bracketed
    // lines are the sound captions.
    const beat = async (s) => { await cs.wait(s); };

    await beat(3.0);
    g.setClock(0, 20);
    g.audio.play("int_doorchime", { vol: 0.7 });
    cs.say("[the front door chimes]", { who: "", secs: 2.6 });
    await beat(3.0);

    // two sets of footsteps: one adult, one small and quick
    for (let i = 0; i < 5; i++) {
      g.audio.step("tile", { vol: 0.32, rate: 0.94 + i * 0.01 });
      g.audio.step("tile", { vol: 0.20, rate: 1.42, delay: 0.17 });
      await beat(0.52);
    }
    cs.say("[two sets of footsteps — one adult, one small and quick]", { who: "", secs: 3.2 });
    await beat(3.4);

    cs.say("…Hello?", { who: "WOMAN", secs: 2.6 });
    await beat(3.4);
    cs.say("Hello.", { who: "WOMAN", secs: 2.2 });        // flatter
    await beat(3.2);

    g.audio.play("int_bag_chips", { vol: 0.55 });
    cs.say("[a chip bag comes off the rack]", { who: "", secs: 2.8 });
    await beat(3.0);

    cs.say("Mom, is he asleep?", { who: "KID", secs: 2.6 });
    await beat(2.8);
    cs.say("Yes, sweetheart. He's asleep.", { who: "WOMAN", secs: 3.0 });
    await beat(3.4);

    for (let i = 0; i < 4; i++) {
      g.audio.step("tile", { vol: 0.34, rate: 0.95 });
      await beat(0.5);
    }
    g.audio.play("int_paper_handle", { vol: 0.5 });
    cs.say("[something soft lands on the laminate. Notes, not coins]", { who: "", secs: 3.4 });
    await beat(3.6);

    cs.say("Unbelievable.", { who: "WOMAN", secs: 2.4 });
    await beat(3.6);

    cs.say("I'm going to the bathroom. You better not steal my cash like the last dude did.",
      { who: "WOMAN", secs: 4.8 });
    await beat(5.0);

    // her footsteps go down the hall. A door. It closes.
    for (let i = 0; i < 6; i++) {
      g.audio.step("tile", { vol: 0.30 - i * 0.03, rate: 0.95 });
      await beat(0.5);
    }
    g.setClock(0, 21);
    g.audio.play("int_door_close", { vol: 0.45 });
    g.state.flag("n4_she_went_in", true);
    g.state.note("She went to the restroom at 00:21. I was asleep.", 21);
    cs.say("[a door, down the hall. It closes]", { who: "", secs: 3.0 });
    await beat(3.4);

    // the kid stays
    cs.say("[the kid stays where he is]", { who: "", secs: 2.8 });
    await beat(3.4);

    // Somewhere far away, a boy is humming to himself. Same recording as the
    // radio on Night 1, played a little faster so it is a child.
    g.audio.play("hum_tune", { vol: 0.30, rate: 1.22, filter: { type: "lowpass", freq: 1500 } });
    cs.say("[somewhere far away, a boy is humming to himself]", { who: "", secs: 3.6 });
    g.state.clue("humming_n4", "The kid was humming something. I knew it.");
    await beat(6.0);

    // ——— and then nothing, for a long time, in the dark ———
    g.audio.setState("danger", 6.0);
    for (let i = 0; i < 5; i++) {
      g.setClock(0, 21 + Math.round((i + 1) * 23));
      await beat(2.6);
    }

    // ——— 02:16 ———
    g.setClock(2, 16);
    g.audio.play("hum_scream_far", { vol: 0.9, scare: true });
    await beat(0.9);
    await cs.fade(0, 0.25);              // his head comes off the counter
    g.audio.setState("aftermath", 1.0);
    g.audio.play("amb_fluorescent", { vol: 0.5 });
    g.player.teleport(V(-5.2, 0, 3.4), Math.PI);
    cs.say("[02:16]", { who: "", secs: 2.2 });
    await beat(2.6);

    cs.look(V(-3.0, 1.0, 2.4), 1.0);     // the money on the counter
    cs.say("[there is money on the counter]", { who: "", secs: 2.6 });
    await beat(2.8);
    cs.look(V(6.0, 1.5, 8.0), 1.0);      // the hallway
    await beat(1.4);

    g.audio.play("hor_thump_wall", { vol: 0.7, scare: true, pos: V(7.0, 1.0, 8.0) });
    await beat(0.45);
    g.audio.play("hor_thump_wall", { vol: 0.7, pos: V(7.0, 1.0, 8.0) });
    await beat(0.45);
    g.audio.play("hor_thump_wall", { vol: 0.7, pos: V(7.0, 1.0, 8.0) });
    cs.say("[small fists on a door]", { who: "", secs: 2.4 });
    await beat(2.6);

    cs.say("MOM?! MOM!", { who: "KID", secs: 2.6 });
    await beat(2.8);
    cs.say("HELP! MY MOM! PLEASE —", { who: "KID", secs: 3.0 });
    await beat(2.0);
  });
  if (ctl.aborted) return;

  // ——— ⚠ UNLOCK THE BATHROOM — NOW ————————————————————————————————
  const bath = g.station.doors.get("bath");
  if (bath) { bath.locked = true; }
  g.station.setDoor("bath", false);
  g.setDread(5);
  g.audio.setState("danger", 1.0);
  g.tasks.add({ id: "bathunlock", text: "⚠ UNLOCK THE BATHROOM — NOW" });
  g.ui.toast("Locked. From the inside.");

  // Three wrong keys, because his hands are shaking. The fourth one turns.
  let tries = 0;
  const KID_AT_DOOR = [
    "She's been in there — she's been in there ages —",
    "Since before! Since when you were sleeping!",
  ];
  g.interact.add({
    id: "bathunlock",
    pos: V(7.0, 1.1, 7.5), radius: 2.4,
    label: "the bathroom door", verb: "Unlock",
    enabled: () => g.tasks.has("bathunlock") && !g.tasks.isDone("bathunlock"),
    onUse: async () => {
      tries++;
      if (tries < 4) {
        g.audio.play("int_keys", { vol: 0.7, rate: 1.05 });
        g.audio.play("int_lock", { vol: 0.4, rate: 0.8, delay: 0.35 });
        g.ui.toast(["Wrong key.", "Not that one.", "Not that one either."][tries - 1]);
        if (tries === 1) {
          g.ui.say(KID_AT_DOOR[0], { who: "KID", secs: 3.4 });
        } else if (tries === 2) {
          await wait(1.0);
          g.ui.say("…Ages?", { who: "", secs: 2.2 });
          await wait(2.4);
          g.ui.say(KID_AT_DOOR[1], { who: "KID", secs: 3.4 });
          await wait(3.6);
          // 02:16. She went in at 00:21. He does the sum and says nothing.
          g.ui.say("…", { who: "", secs: 2.6 });
          g.state.clue("two_hours", "She went in at 00:21. It is 02:16.");
          g.state.note("The kid says she went in before I fell asleep. That is two hours.", g.minutes);
        }
        return;
      }
      // the fourth key turns
      g.tasks.done("bathunlock");
      g.audio.play("int_lock", { vol: 0.8 });
      if (bath) bath.locked = false;
      g.bus.emit("n4:bathopen");
    },
  });

  // A player who stands there doing nothing does not get to stand there
  // forever — he opens it himself. The scene is not optional.
  const opened = new Promise((r) => {
    const off = g.bus.on("n4:bathopen", () => { off(); r("player"); });
  });
  await Promise.race([opened, wait(150)]);
  if (ctl.aborted) return;
  if (!g.tasks.isDone("bathunlock")) {
    g.tasks.done("bathunlock");
    if (bath) bath.locked = false;
    g.audio.play("int_lock", { vol: 0.8 });
  }

  // ——— THE BATHROOM ————————————————————————————————————————————————
  //
  // Not a cutscene. Per the author's cutscene-discipline note: the test is
  // "would this be scarier if I were the one standing there with the mouse in
  // my hand?", and here it plainly is. He walks down that hall himself, opens
  // that door himself, and **throws the salt himself** — the game does not do
  // any of it for him. He can also stand in the hall and not go in, and the
  // game will wait, which is its own kind of unbearable.
  g.station.setDoor("bath", true);
  g.audio.subtract("amb_hvac", true, 0.5);      // the only warm room in the building
  g.audio.play("int_sink", { vol: 0.22, pos: V(7.0, 1.0, 10.6) });
  g.audio.play("hor_drone_tension", { vol: 0.45 });

  // It is standing over her, and this time it is looking at him.
  await g.attendant.showAt(0, {
    stage: 2, anim: "Idle_Loop", at: V(7.0, 0, 10.9), facing: Math.PI, silent: true,
  });
  g.tasks.add({ id: "bathsalt", text: "⚠ IT IS STANDING OVER HER" });
  g.setDread(5);

  // The kid is behind him in the hall the whole time, and keeps talking whether
  // or not the player goes in. Positional, so it comes from where he is.
  const KID_POS = V(6.4, 1.2, 6.8);
  const kidLine = (t, secs) => g.ui.say(t, { who: "KID", secs });
  let kidStop = false;
  (async () => {
    await wait(3.0);
    if (!kidStop && !ctl.aborted) kidLine("Is she in there? IS SHE IN THERE?", 3.2);
    await wait(6.0);
    if (!kidStop && !ctl.aborted) {
      g.audio.play("hum_cry", { vol: 0.35, pos: KID_POS.clone(), ref: 4 });
      kidLine("Why aren't you going IN—", 3.0);
    }
  })();

  // The salt. His hand was already in the bag; the player still has to do it.
  let thrown = false;
  const throwSalt = new Promise((resolve) => {
    g.interact.add({
      id: "bathsalt",
      pos: V(7.0, 1.2, 10.4), radius: 3.4,
      label: "it", verb: "Throw the salt",
      enabled: () => !thrown && g.tasks.has("bathsalt") && !g.tasks.isDone("bathsalt"),
      onUse: () => { thrown = true; g.tasks.done("bathsalt"); resolve("player"); },
    });
  });
  // He is not made to do it on a timer — but he cannot stand in the hall
  // forever either. Two minutes and it turns its head, and that is enough.
  await Promise.race([throwSalt, wait(120)]);
  if (ctl.aborted) return;
  kidStop = true;
  if (!thrown) {
    thrown = true;
    g.tasks.done("bathsalt");
    g.ui.say("— his hand is already in the bag —", { who: "", secs: 2.6 });
    await wait(1.4);
  }

  g.ui.say("GET AWAY FROM HER —", { who: "", secs: 2.6 });
  await wait(0.9);
  g.audio.play("int_salt_pour", { vol: 0.9 });
  await wait(0.7);
  g.state.flag("n4_threw_salt", true);
  g.state.clue("salt_works", "Salt. It does something. It screamed.");

  // it screams — the Night 2 sound, wrong shape, wrong direction
  g.audio.play("hum_scream_far", { vol: 0.95, rate: 0.62, scare: true });
  g.audio.play("hor_static_burst", { vol: 0.6, rate: 0.7 });
  await wait(1.1);
  g.power.flickerNow?.(0.9, true);
  g.audio.play("hor_glass_stress", { vol: 0.7 });
  await g.attendant.hide();
  g.audio.setState("outage", 0.6);
  await wait(1.6);

  g.audio.play("hor_rumble_low", { vol: 0.5 });
  g.ui.say("[ringing. Then the tap, dripping]", { who: "", secs: 3.2 });
  g.audio.play("int_sink", { vol: 0.3, rate: 0.6, pos: V(7.0, 1.0, 10.6) });
  await wait(3.4);

  // The flashlight finds the floor — and it is his flashlight, pointed by him.
  // He does not look for long, and neither does the game: what is on that
  // floor is three lines of text, and it is worse for not being modelled.
  g.torch.toggle?.(true);
  g.station.showBathBlood?.(true);
  await wait(1.6);
  g.ui.say("[there is a coat he recognises. There is a shoe]", { who: "", secs: 3.6 });
  await wait(3.8);
  g.ui.say("[there is very little else that was a person two hours ago]", { who: "", secs: 3.8 });
  g.state.clue("bath_n4", "What was left in the restroom");
  g.state.note("I am not writing down what was in the restroom.", g.minutes);
  await wait(3.4);

  // He turns around fast and puts himself in the doorway so the kid can't past.
  g.station.setDoor("bath", false);
  g.audio.play("int_door_close", { vol: 0.6 });
  await wait(1.0);
  kidLine("Is she — let me — LET ME SEE HER—", 3.4);
  await wait(3.2);
  g.ui.say("Hey. Hey. Look at me. Look at me.", { who: "", secs: 3.4 });
  await wait(3.4);
  kidLine("I want my mom—", 2.6);
  await wait(2.8);
  g.ui.say("I know. I know you do.", { who: "", secs: 3.0 });
  await wait(3.4);
  g.ui.say("We're going outside now. You and me. We're going to go sit in my car "
    + "and I'm going to put the heater on, okay?", { who: "", secs: 5.6 });
  await wait(5.8);
  kidLine("…Okay.", 2.2);
  await wait(2.4);
  g.ui.say("Don't look down the hall. Just the door. Just the door, buddy.", { who: "", secs: 4.4 });
  await wait(4.6);

  // ——— THE CLOCK-OUT ——————————————————————————————————————————————
  //
  // Also not a cutscene. He walks back in and punches out himself, and the
  // hall is on his left the whole way, and the game does not turn his head.
  g.setClock(2, 22);
  g.state.flag("closing", true);
  // The one night the card takes a punch with the doors still open. Locking up
  // and punching out are otherwise one job; tonight he does half of it.
  g.state.flag("walkout", true);
  g.audio.setState("aftermath", 3.0);
  g.tasks.done("serve");        // nobody came to the counter tonight but her
  g.ui.toast("The kid is in the car with the heater on and your jacket over him.");
  await wait(2.4);
  g.ui.say("Eleven seconds. In and out.", { who: "", secs: 3.0 });
  await wait(3.4);
  g.ui.say("I'm not touching that money.", { who: "", secs: 3.0 });
  g.state.flag("n4_left_money", true);
  await wait(3.6);

  // On the way past, the door at the end of the hall is open again. He is not
  // made to look at it. It is simply there if he does.
  g.timers.after(6, () => {
    g.station.setDoor("bath", true);
    g.station.showBathBlood?.(false);
    g.audio.play("int_lightswitch", { vol: 0.5, pos: V(7.0, 2.0, 10.0) });
    g.state.clue("clean_floor_n4", "By the time I left, the floor was clean");
    g.ui.say("[the door at the end of the hall is open. The light is back on]",
      { who: "", secs: 4.0 });
  });

  // He punches out with the doors still open, which is exactly what the beat
  // is: the one night he does not close up properly. `lockup` is now both
  // halves of the job, so the card is allowed to take this punch on its own.
  await Promise.race([g.tasks.wait("lockup"), wait(150)]);
  if (ctl.aborted) return;

  // The watch tells him he has ended his shift incorrectly, and he lets it.
  // It is the same buzz that has told him something was due for four nights;
  // this is the first time it is telling him off.
  g.setClock(2, 24);
  g.audio.play("int_punchcard", { vol: 0.7 });
  await wait(1.0);
  g.ui.say("[02:24. Three and a half hours early]", { who: "", secs: 3.0 });
  for (let i = 0; i < 5; i++) {
    g.audio.play("int_watch_alarm", { vol: 0.55 });
    await wait(1.15);
  }
  g.tasks.done("lockup");
  // The rest of the list stays unticked, because he walked out. Say so, or it
  // reads as a bug instead of as the ending of the night.
  g.tasks.setHeader?.("SHIFT ABANDONED · 02:24");
  g.state.flag("n4_early_out", true);
  g.state.note("Clocked out at 02:24. Left the shift open. Let the watch buzz.", g.minutes);
  await wait(1.0);

  // The drive is the one jump the player cannot walk, so it is the one piece of
  // this that stays a cutscene.
  await g.cutscene("cs04_drive", async (cs) => {
    await cs.fade(1, 2.0);
    g.audio.play("veh_car_door", { vol: 0.5 });
    await cs.wait(1.0);
    g.audio.play("veh_car_leave", { vol: 0.5 });
    await cs.wait(1.6);
    cs.say("[he does not look in the mirror]", { who: "", secs: 2.8 });
    await cs.wait(3.0);

    // And beside him, quietly, the kid is humming. The same recording that was
    // on the radio on Night 1 — which is the whole reason it played there, and
    // it is not the last time it turns up.
    g.audio.play("hum_tune", { vol: 0.42, rate: 1.22 });
    cs.say("[beside him, quietly, the kid is humming]", { who: "", secs: 3.6 });
    await cs.wait(3.8);
    cs.say("[it's the tune he heard in the dark]", { who: "", secs: 3.2 });
    await cs.wait(3.4);
    cs.say("[it was on the radio on the first night]", { who: "", secs: 3.4 });
    g.state.clue("tune_n4", "The kid was humming the song off the radio on my first night");
    await cs.wait(3.6);
  });

  if (!ctl.aborted) await g.endNight(5);
}, {
  radio: () => [
    "…clear and dry through the weekend, first break in the weather all week…",
    "…county sheriff's office is asking anyone who travelled Route 41 last night to make contact. No further details were released…",
  ],
});

// ————————————————————————————————————————————————————————— NIGHT 5
//
// Built playable-first, per the author's cutscene-discipline note. There is
// exactly one cutscene in this night — the arrival — and one at the very end
// that is a jump in place the player cannot walk. Everything between them,
// including the lightning sequence, happens with the mouse in the player's
// hand. That sequence in particular is far worse this way: he cannot run, he
// cannot fight, he can only stand there and keep looking, or look away and
// hear it instead.

/** Four notes. Not the whole phrase — a player who hears eight on the radio
 *  and four in a corridor has not heard the same thing. */
const tune = (g, o = {}) => g.audio.play("hum_tune", { dur: 1.9, ...o });

const night5 = (g) => scriptShell(g, async (ctl) => {
  g.setDread(3);

  // ——— The arrival. The one cutscene at the top of the night. ————————
  if (!g.resuming && !g.skipIntro) await g.cutscene("cs05_arrive", async (cs) => {
    await cs.fade(1, 0);
    g.player.teleport(V(6.5, 0, -14.5), Math.PI);
    g.audio.setState("exterior", 1.5);
    g.audio.play("amb_wind_gust", { vol: 0.5 });
    g.audio.play("veh_car_arrive", { vol: 0.45 });
    await cs.fade(0, 1.8);

    cs.say("—severe thunderstorm warning in effect until six a.m. for—",
      { who: "RADIO", secs: 4.0 });
    await cs.wait(4.2);
    g.audio.play("int_radio_static", { vol: 0.4 });
    await cs.wait(0.8);

    // the passenger seat is empty and the jacket is gone off it
    cs.say("He's at his aunt's.", { who: "", secs: 2.6 });
    await cs.wait(2.8);
    cs.say("He's forty miles from here. He's asleep. He's fine.", { who: "", secs: 4.0 });
    await cs.wait(4.2);

    // one bar, and a text he sent at six with nothing under it
    g.audio.play("int_regkey", { vol: 0.5 });
    cs.say("[he settle ok? — 18:02. No reply]", { who: "", secs: 3.4 });
    g.state.clue("no_reply_n5", "he settle ok? — sent at six. Nothing under it.");
    await cs.wait(3.6);

    cs.say("\"Don't do five.\"", { who: "", secs: 2.8 });
    await cs.wait(3.4);
    cs.say("…That's what he said.", { who: "", secs: 2.8 });
    await cs.wait(3.0);

    g.audio.play("veh_car_door", { vol: 0.5 });
    await cs.wait(1.0);
    cs.say("Flashlight. Umbrella I'm finally going to need.", { who: "", secs: 3.4 });
    await cs.wait(3.6);

    // he turns the bag upside down and shakes it
    g.audio.play("int_salt_pour", { vol: 0.5, rate: 1.8 });
    await cs.wait(1.4);
    cs.say("One door.", { who: "", secs: 2.4 });
    await cs.wait(2.6);

    // thunder a long way off. He counts to eleven before it arrives.
    g.audio.play("amb_thunder_far", { vol: 0.5 });
    await cs.wait(2.0);
    g.player.teleport(V(5.6, 0, -3.2), Math.PI);
  });
  if (ctl.aborted) return;

  await g.torch.take();
  // Whatever is left, tonight he has one. The bag is turned upside down.
  g.state.data.saltLeft = 1;
  g.salt.give({ carry: true });

  g.tasks.set([
    { id: "note", text: "Read the manager's note — it's on the register" },
    { id: "salt", text: "Lay salt — 1/1 · CHOOSE" },
    { id: "restock", text: "Fill the shelf gaps — cases are in the stock room" },
    { id: "readings", text: "Read all four pump meters, then write them up — 0/4" },
    { id: "bathroom", text: "Check the restroom — end of the hall" },
    { id: "open", text: "Open the station — 21:00" },
    { id: "serve", text: "Serve whoever comes in" },
    { id: "lockup", text: "Lock the doors and punch out — 06:00" },
  ], "TONIGHT · PREP");
  g.tasks.highlight?.("salt");
  g.bus.on("doc:read", (id) => { if (id === "note_n5") g.tasks.done("note"); });

  // ——— The storm runs all night, and it closes in by the hour. ————————
  //
  // Eleven seconds at nine, four at midnight, and by three the flash and the
  // bang arrive together. Nobody tells the player this is happening. They will
  // work it out somewhere around one in the morning, which is the point.
  let storm = true;
  (async () => {
    while (storm && !ctl.aborted) {
      const h = g.minutes / 60;
      const gap = h < 21 ? 12 : h < 24 ? 11 - (h - 21) * 2.4
        : h < 27 ? 4 - (h - 24) * 1.1 : 0.05;
      g.audio.play("amb_thunder", { vol: gap > 6 ? 0.35 : gap > 2 ? 0.6 : 0.9, scare: gap < 3 });
      await wait(Math.max(0.05, gap));
      if (gap < 6) g.power.flickerNow?.(0.5, false);
      await wait(26 + Math.random() * 22);
    }
  })();

  await Promise.race([g.tasks.wait("open"), wait(120)]);
  if (ctl.aborted) return;
  g.setClock(21, 4);
  g.audio.setState("normal", 3.0);

  // ——— 21:04 · the note ————————————————————————————————————————————
  await wait(2);
  g.ui.toast("There's a note on the register.");
  await Promise.race([g.tasks.wait("note"), wait(60)]);
  if (ctl.aborted) return;
  await wait(1.6);
  g.ui.say("…I never told him what happened.", { who: "", secs: 3.6 });
  g.state.clue("t_knows_n5", "T. knows about Tuesday. I never told him.");
  await wait(4.0);
  // Sunday is two days away. He counts on his fingers, which he has never had
  // to do before, and gets six.
  g.ui.say("Sunday. That's… Friday, Saturday—", { who: "", secs: 3.2 });
  await wait(3.4);
  g.ui.say("…Six.", { who: "", secs: 2.4 });
  g.state.note("Counted the days to Sunday on my fingers and got six.", g.minutes);
  await wait(2.8);

  // ——— 21:40 and 22:05 · the shift ————————————————————————————————
  //
  // Nights 5 and 6 had a "serve whoever comes in" task and nobody came: nine
  // hours of an empty counter, with the register — the game's whole core loop —
  // simply absent from the back half. These are ordinary sales, deliberately
  // so. The storm is doing the work of the night; the job is what makes the
  // storm land.
  g.setClock(21, 40);
  await serveArrival(g, "A2", { bayIndex: 1 });
  if (ctl.aborted) return;
  await wait(6);
  g.ui.say("She didn't want to get out of the car in this.", { who: "", secs: 3.6 });
  await wait(4);
  g.setClock(22, 5);
  await serveArrival(g, "A7", { bayIndex: 4, patience: 30 });
  if (ctl.aborted) return;
  await wait(4);

  // An optional camera discovery during the storm. It works in the stock
  // room, turns its head if watched, and is gone when the player goes there.
  await g.attendant.showAt(5, { stage: 2, anim: "NC_Mop_Loop" });
  const stockWorker = g.attendant.entity;
  g.timers.after(75, () => {
    if (g.attendant.entity === stockWorker) g.attendant.hide();
  });

  // ——— 22:30 · the fourth aisle ————————————————————————————————————
  //
  // A discovery, so the player makes it. The aisle is simply there; nothing
  // points at it. The only nudge is the light above it, which is on.
  g.setClock(22, 30);
  g.station.showFourthAisle?.(true);
  g.state.flag("aisle4", true);
  // He does not get to miss this. The restock is not finished, and the gap
  // that is left is the one in the aisle that should not exist — so the job
  // itself walks him into it. Nothing points at it and nothing explains it;
  // he is just restocking, and then he is standing somewhere impossible.
  if (g.tasks.isDone("restock")) {
    g.tasks.reopen?.("restock");
    g.tasks.setText?.("restock", "Restock the shelves — one gap left");
    g.chores.restockLeft = 1;
    g.chores._filled = { 0: true, 1: true };
    g.ui.toast("There's a gap you haven't filled.");
  }
  g.interact.add({
    id: "aisle4", pos: V(2.6, 1.3, 6.4), radius: 3.0,
    label: "the aisle by the cooler", verb: "Look at",
    enabled: () => g.state.flag("aisle4") && !g.state.flag("aisle4_seen"),
    onUse: async () => {
      g.state.flag("aisle4_seen", true);
      g.audio.play("hor_drone_tension", { vol: 0.3 });
      g.ui.say("There are three aisles. There have always been three aisles.", { who: "", secs: 4.2 });
      await wait(4.4);
      g.ui.say("There are four.", { who: "", secs: 2.6 });
      await wait(3.0);
      g.ui.say("The tile under it is worn exactly as much as everywhere else.", { who: "", secs: 4.2 });
      g.state.clue("aisle4", "There is a fourth aisle. The floor under it is fifty years worn.");
      await wait(4.4);
      g.tasks.add({ id: "plan", text: "The fire plan is on the office wall" });
    },
  });
  // the laminated fire-safety plan that has been up since before he was born
  g.bus.on("doc:read", async (id) => {
    if (id !== "floorplan" || !g.state.flag("aisle4_seen") || g.state.flag("plan_seen")) return;
    g.state.flag("plan_seen", true);
    g.tasks.done("plan");
    await wait(1.2);
    g.ui.say("It shows four aisles.", { who: "", secs: 2.8 });
    await wait(3.0);
    g.ui.say("It has always shown four aisles.", { who: "", secs: 3.2 });
    await wait(3.6);
    g.ui.say("Every brand on those shelves is one nobody makes any more.", { who: "", secs: 4.0 });
    await wait(4.2);
    g.ui.say("Every expiry date is a year that hasn't happened.", { who: "", secs: 3.8 });
    await wait(4.0);
    g.ui.say("…Then which one was I wrong about.", { who: "", secs: 3.6 });
    g.state.clue("plan_n5", "The fire plan has always shown four aisles");
    g.state.note("The plan on the office wall shows four aisles. It is older than I am.", g.minutes);
  });

  // ——— 23:47 · the customer ————————————————————————————————————————
  //
  // At the counter, in first person, player in control the whole way. They can
  // look at his hands. They can look away and miss something.
  await Promise.race([g.tasks.wait("readings"), wait(150)]);
  if (ctl.aborted) return;
  g.setClock(23, 47);
  g.setDread(4);

  const man = await g.customers.arrive("A3", { noVehicle: true, fromX: 12 });
  if (ctl.aborted) return;
  await wait(2.2);
  g.station.showFiveOnCounter?.(true);
  g.audio.play("int_paper_handle", { vol: 0.5 });
  g.ui.say("He puts a five on the counter.", { who: "", secs: 3.0 });
  await wait(3.2);
  g.ui.say("It's the same five. It's still there from Tuesday. I can see both of them.",
    { who: "", secs: 5.0 });
  g.state.clue("two_fives", "There are two fives on the counter and they are the same five");
  await wait(5.2);

  g.ui.say("You did five.", { who: "the man on foot", secs: 3.0 });
  await wait(3.2);
  const a1 = await g.choices.ask("n5_five", [
    { id: "told", text: "\"You told me not to.\"" },
    { id: "what", text: "\"What happens on five?\"" },
    { id: "push", text: "[Push the money back across the counter.]", silent: true },
  ], { secs: 10 });
  await wait(0.8);
  if (a1 === "told") {
    g.ui.say("I did.", { who: "the man on foot", secs: 2.4 });
  } else if (a1 === "what") {
    g.ui.say("Five's when it knows your name, son.", { who: "the man on foot", secs: 3.6 });
  } else {
    g.ui.say("[he doesn't look at it]", { who: "", secs: 2.6 });
  }
  await wait(3.4);

  g.ui.say("The boy's not with you.", { who: "the man on foot", secs: 3.0 });
  await wait(3.2);
  g.ui.say("No. He's with family.", { who: "", secs: 3.0 });
  await wait(3.2);
  g.ui.say("That's good. That's the right thing.", { who: "the man on foot", secs: 3.4 });
  await wait(4.2);
  g.ui.say("Doesn't always help. But it's the right thing.", { who: "the man on foot", secs: 4.0 });
  await wait(4.2);

  const a2 = await g.choices.ask("n5_mean", [
    { id: "mean", text: "\"What does that mean?\"" },
    { id: "dont", text: "\"Don't talk about him.\"" },
    { id: "quiet", text: "[Say nothing.]", silent: true },
  ], { secs: 10 });
  await wait(1.0);
  if (a2 === "dont") { g.ui.say("…Fair.", { who: "the man on foot", secs: 2.2 }); await wait(2.6); }

  // at the door, not turning round
  g.customers.walk(man, [[5.1, 1.2], [5.1, -1.4]], () => {});
  await wait(3.0);
  g.ui.say("You're not the first one to be kind, son.", { who: "the man on foot", secs: 4.0 });
  await wait(4.2);
  g.ui.say("You're the sixth.", { who: "the man on foot", secs: 3.0 });
  g.state.clue("the_sixth", "\"You're not the first one to be kind. You're the sixth.\"");
  g.state.note("He said I was the sixth.", g.minutes);
  await wait(3.4);
  g.audio.play("int_doorchime", { vol: 0.6 });
  g.customers.despawn?.(man);
  g.tasks.done("serve");
  await wait(2.0);
  // no car. And out on the forecourt, in the rain, no footprints either way.
  g.ui.say("[no car. And no footprints on the forecourt, going either way]", { who: "", secs: 4.2 });
  await wait(4.4);

  // ——— 01:31 · the wall ————————————————————————————————————————————
  g.setClock(1, 31);
  g.station.showTally?.(true, 6);
  g.interact.add({
    id: "tally5", pos: V(6.6, 1.35, 9.4), radius: 2.6,
    label: "the marks in the grout", verb: "Touch",
    enabled: () => !g.state.flag("tally5_seen"),
    onUse: async () => {
      g.state.flag("tally5_seen", true);
      g.ui.say("Five marks. And a sixth, struck across them.", { who: "", secs: 3.8 });
      await wait(4.0);
      g.ui.say("There's grout dust on the floor under it.", { who: "", secs: 3.4 });
      await wait(3.6);
      g.audio.play("hum_breath", { vol: 0.4 });
      g.ui.say("…It's warm.", { who: "", secs: 2.6 });
      await wait(3.0);
      g.ui.say("…Who's counting.", { who: "", secs: 3.0 });
      g.state.clue("tally_n5", "Six marks now. The wall was warm.");
      g.state.note("Six marks in the grout tonight. It was warm, like the blood was.", g.minutes);
    },
  });
  g.ui.toast("There's fresh dust on the floor by the hall.");
  await wait(40);

  // ——— 02:16 · nothing ——————————————————————————————————————————————
  //
  // The clock hits it and nothing happens, for four minutes, which after Night
  // 4 is unbearable. Then the drawer opens on its own and closes again, and
  // that is the whole event.
  g.setClock(2, 16);
  g.audio.setState("near", 3.0);
  g.audio.subtract("hor_drone_tension", true, 2.0);
  await wait(24);
  g.audio.play("int_drawer", { vol: 0.6, pos: V(-4.6, 1.0, 2.4) });
  await wait(1.4);
  g.audio.play("int_drawer", { vol: 0.5, pos: V(-4.6, 1.0, 2.4), rate: 0.9 });
  g.state.clue("drawer_n5", "The drawer opened and closed by itself at 02:20");
  await wait(2.6);
  g.audio.play("hum_cough", { vol: 0.4 });
  g.ui.say("[he laughs once, and it doesn't sound like him]", { who: "", secs: 3.4 });
  await wait(3.6);
  g.audio.subtract("hor_drone_tension", false, 3.0);

  // ——— 03:14 · the storm ————————————————————————————————————————————
  //
  // NOT a cutscene. He keeps the mouse. He cannot run and he cannot fight, and
  // the only thing he can do is keep looking or stop looking, which is the
  // entire scene. It never makes a sound — not while it stares, not while it
  // runs. Only the footfalls at the end, in the dark, once he has lost sight
  // of it.
  g.setClock(3, 14);
  g.setDread(5);
  await wait(2);
  g.audio.play("amb_thunder", { vol: 1.0, scare: true });
  g.power.blackout?.(true);
  g.audio.setState("outage", 0.8);
  g.audio.subtract("amb_fridge", true, 0.2);
  g.audio.subtract("amb_freezer", true, 0.2);
  await wait(1.2);
  g.ui.say("[every light. Including the fridges]", { who: "", secs: 3.2 });
  await wait(3.4);
  g.ui.say("The fridges have never stopped.", { who: "", secs: 3.0 });
  await wait(3.2);

  // the flashlight isn't where he left it
  g.torch.have = false;
  g.ui.say("[the flashlight is not where he left it]", { who: "", secs: 3.4 });
  g.state.clue("torch_moved", "The flashlight was not where I left it");
  await wait(3.6);
  await g.torch.take();

  const FLASH = async (at, secs = 0.4) => {
    g.power.flickerNow?.(secs, true);
    g.audio.play("amb_thunder", { vol: 0.95, scare: true });
    await g.attendant.flashAt(at, secs);
  };

  await FLASH(V(2.6, 0, 9.6), 0.45);
  g.ui.say("[the boy is standing at the end of the aisle]", { who: "", secs: 3.2 });
  await wait(3.4);
  g.ui.say("…no. No, no, no — you're at your aunt's —", { who: "", secs: 4.0 });
  await wait(4.2);

  await FLASH(V(2.6, 0, 6.8), 0.42);
  g.ui.say("[half the aisle gone. He hasn't blinked]", { who: "", secs: 3.4 });
  await wait(3.6);
  g.ui.say("You're not him. You're not him —", { who: "", secs: 3.4 });
  await wait(3.6);

  await FLASH(V(2.6, 0, 5.0), 0.40);
  g.ui.say("[he is running]", { who: "", secs: 2.2 });
  await wait(2.4);

  // dark. Footfalls, small and fast, getting louder. It makes no other sound.
  for (let i = 0; i < 7; i++) {
    g.audio.step("tile", { vol: 0.18 + i * 0.09, rate: 1.5 });
    await wait(0.26);
  }
  // EVERY LIGHT IN THE BUILDING COMES ON.
  g.power.blackout?.(false);
  g.audio.setState("normal", 0.3);
  g.audio.subtract("amb_fridge", false, 0.2);
  g.audio.subtract("amb_freezer", false, 0.2);
  g.audio.play("int_lightswitch", { vol: 0.7 });
  g.audio.play("int_radio_static", { vol: 0.35, pos: V(-4.2, 0.9, 11.4) });
  await g.attendant.hide();
  await wait(2.0);
  g.ui.say("[the aisle is empty]", { who: "", secs: 2.6 });
  await wait(3.0);
  g.station.showAisleBlood?.(true);
  g.ui.say("[there is blood on the floor a metre and a half from his feet]", { who: "", secs: 4.0 });
  await wait(4.2);
  g.ui.say("[about the size of a seven-year-old, and it is spreading, and it is "
    + "not coming from anything]", { who: "", secs: 5.4 });
  g.state.clue("aisle_blood", "A patch of blood the size of a child, coming from nothing");
  await wait(5.6);

  // ——— THE CALL ——————————————————————————————————————————————————
  g.tasks.add({ id: "call", text: "⚠ CALL THE AUNT" });
  const called = new Promise((r) => {
    const off = g.bus.on("n5:called", () => { off(); r(true); });
  });
  g.interact.add({
    id: "callaunt", pos: V(-7.0, L.CNT_H + 0.15, 4.1), radius: 2.2,
    label: "the phone", verb: "Call the aunt",
    enabled: () => g.tasks.has("call") && !g.tasks.isDone("call"),
    onUse: () => { g.tasks.done("call"); g.bus.emit("n5:called"); },
  });
  await Promise.race([called, wait(90)]);
  if (ctl.aborted) return;
  g.tasks.done("call");

  g.audio.play("int_phone_pickup", { vol: 0.6 });
  await wait(1.2);
  for (let i = 0; i < 4; i++) { g.audio.play("int_phone_ring", { vol: 0.35 }); await wait(2.2); }
  g.audio.play("int_phone_pickup", { vol: 0.5, rate: 0.9 });
  await wait(1.0);
  g.audio.play("hum_breath", { vol: 0.5 });
  await wait(1.6);
  // ...and behind it, very quietly, four notes of a song being hummed.
  tune(g, { vol: 0.32, rate: 1.22, filter: { type: "bandpass", freq: 1500, q: 1.1 } });
  g.ui.say("[breathing. And behind it, very quietly, four notes]", { who: "", secs: 4.2 });
  g.state.clue("call_n5", "Somebody hummed four notes down the phone");
  await wait(4.4);
  g.ui.say("…Hello?", { who: "", secs: 2.4 });
  await wait(2.6);
  g.audio.play("int_phone_pickup", { vol: 0.4, rate: 0.7 });
  g.ui.say("[the line goes dead]", { who: "", secs: 2.4 });
  await wait(2.8);
  g.ui.say("[number not recognised]", { who: "", secs: 2.4 });
  await wait(2.6);
  g.ui.say("[number not recognised]", { who: "", secs: 2.4 });
  await wait(2.8);

  // ——— THE FOLDERS ————————————————————————————————————————————————
  g.tasks.add({ id: "folders", text: "⚠ THE EMERGENCY CONTACT SHEET — OFFICE" });
  const foundFolders = new Promise((r) => {
    const off = g.bus.on("n5:folders", () => { off(); r(true); });
  });
  g.interact.add({
    id: "n5cabinet", pos: V(-8.0, 1.0, 9.2), radius: 2.2,
    label: "the filing cabinet", verb: "Pull it open",
    enabled: () => g.tasks.has("folders") && !g.tasks.isDone("folders"),
    onUse: () => { g.tasks.done("folders"); g.bus.emit("n5:folders"); },
  });
  await Promise.race([foundFolders, wait(120)]);
  if (ctl.aborted) return;
  g.tasks.done("folders");

  g.audio.play("int_lock", { vol: 0.7 });
  g.audio.play("int_paper_handle", { vol: 0.8, delay: 0.4 });
  await wait(1.8);
  g.ui.say("[the folders go across the floor]", { who: "", secs: 2.8 });
  await wait(3.0);
  g.docs.show?.("jacob_file", { clue: "jacob_file" });
  await wait(2.6);
  g.ui.say("…He worked here.", { who: "", secs: 3.0 });
  g.state.clue("jacob_file", "Jacob. Night attendant. Start date four years ago. Termination blank.");
  g.state.note("Jacob worked here. Four years ago. No termination date.", g.minutes);
  await wait(3.4);
  g.ui.closeFocus?.(false);
  await wait(1.2);
  g.ui.say("[five folders with no name on the tab]", { who: "", secs: 3.4 });
  await wait(3.6);
  g.ui.say("[and his]", { who: "", secs: 2.2 });
  await wait(2.4);
  g.ui.say("…Six.", { who: "", secs: 2.6 });
  g.state.clue("six_folders", "Five nameless folders. And mine. Six.");
  await wait(3.0);

  // the phone on the desk rings. It has no cord.
  g.audio.play("int_phone_ring", { vol: 0.6, pos: V(-8.6, 0.9, 9.6) });
  await wait(1.6);
  g.ui.say("[the phone on the desk is ringing. It has no cord]", { who: "", secs: 4.0 });
  await wait(4.2);
  const ans = await g.choices.ask("n5_cordless", [
    { id: "answer", text: "[Answer it.]" },
    { id: "dont", text: "[Don't.]", silent: true },
  ], { secs: 12 });
  if (ans === "answer") {
    g.audio.play("int_phone_pickup", { vol: 0.6 });
    await wait(1.4);
    g.audio.play("hum_whisper", { vol: 0.4, rate: 1.3 });
    g.ui.say("come here", { who: "JACOB", secs: 3.0 });
    g.state.flag("n5_answered", true);
    g.state.clue("come_here_n5", "A child's voice, very far away: come here");
    await wait(3.4);
  } else {
    g.state.flag("n5_answered", false);
    // it rings until six
    (async () => {
      for (let i = 0; i < 40 && !ctl.aborted; i++) {
        g.audio.play("int_phone_ring", { vol: 0.3, pos: V(-8.6, 0.9, 9.6) });
        await wait(6);
      }
    })();
    g.ui.say("[it rings until six]", { who: "", secs: 3.0 });
    await wait(3.2);
  }

  // ——— 06:00 · close up ————————————————————————————————————————————
  storm = false;
  g.setClock(5, 40);
  g.audio.subtract("amb_rain_heavy", true, 6.0);
  g.state.flag("closing", true);
  await wait(3);
  g.ui.say("[the storm has stopped. Dead calm. The lot is steaming]", { who: "", secs: 4.2 });
  await wait(4.4);

  await Promise.race([g.tasks.wait("lockup"), wait(150)]);
  if (ctl.aborted) return;
  g.tasks.done("lockup");
  g.setClock(6, 0);

  // Through the glass: whichever door he salted, that line is undisturbed.
  const salted = [...g.salt.lines.keys()][0];
  if (salted) {
    g.salt.markCrossing(salted);
    await wait(2.0);
    g.ui.say("[the one line he laid is undisturbed]", { who: "", secs: 3.2 });
    await wait(3.4);
  }
  g.station.showAisleBlood?.(false);
  g.ui.say("[the blood in the fourth aisle is gone. The floor is dry]", { who: "", secs: 4.0 });
  await wait(4.2);
  g.ui.say("[the light above that aisle is the only one still on]", { who: "", secs: 3.8 });
  await wait(4.0);

  // ——— The drive. A jump in place the player cannot walk. ——————————
  await g.cutscene("cs05_drive", async (cs) => {
    g.audio.play("veh_car_door", { vol: 0.5 });
    await cs.wait(1.2);
    // On the passenger seat there's a bag of salt. Full. Unopened.
    cs.say("[there's a bag of salt on the passenger seat]", { who: "", secs: 3.4 });
    await cs.wait(3.6);
    cs.say("[full. Unopened. He did not put it there]", { who: "", secs: 3.8 });
    g.state.flag("salt_appeared", true);
    g.state.data.saltLeft = 6;              // Night 6 has exactly six
    await cs.wait(4.0);
    g.docs.show?.("receipt_tomorrow");
    await cs.wait(2.6);
    cs.say("[a receipt from this station. Timestamped tomorrow]", { who: "", secs: 3.8 });
    await cs.wait(4.0);
    g.ui.closeFocus?.(false);
    cs.say("[tomorrow is Sunday. Sunday is the last day]", { who: "", secs: 3.8 });
    g.state.clue("receipt_sunday", "A receipt timestamped Sunday. Sunday is the last day.");
    await cs.wait(4.0);

    await cs.fade(1, 2.0);
    g.audio.play("veh_car_leave", { vol: 0.5 });
    await cs.wait(2.2);
    cs.say("[06:52. He does not stop once]", { who: "", secs: 3.0 });
    await cs.wait(3.2);
    cs.say("[the kid is asleep on the couch with both arms]", { who: "", secs: 3.8 });
    await cs.wait(4.0);
    cs.say("[he doesn't wake up when the player sits down on the floor beside him]",
      { who: "", secs: 4.4 });
    await cs.wait(4.6);
  });

  if (!ctl.aborted) await g.endNight(6);
}, {
  radio: () => [
    "…severe thunderstorm warning in effect until six a.m…",
    "…and that's the last night for the Mile 41 station, closing Sunday after fifty-one years…",
  ],
});

// ————————————————————————————————————————————————————————— NIGHT 6
//
// Sunday. The last one, and the only night in the game where the player has
// enough salt — which is the tell.
const night6 = (g) => scriptShell(g, async (ctl) => {
  g.setDread(4);

  // ——— The arrival. Dead still. The radio is already off. ——————————
  if (!g.resuming && !g.skipIntro) await g.cutscene("cs06_arrive", async (cs) => {
    await cs.fade(1, 0);
    g.player.teleport(V(6.5, 0, -14.5), Math.PI);
    g.audio.setState("exterior", 1.5);
    g.audio.subtract("amb_wind_desert", true, 0.5);   // dead still
    g.audio.subtract("amb_insects", true, 0.5);
    g.audio.play("veh_car_arrive", { vol: 0.4 });
    await cs.fade(0, 1.8);
    await cs.wait(1.2);

    cs.say("Last day.", { who: "", secs: 2.6 });
    await cs.wait(3.0);
    // the receipt from the passenger seat. Timestamped today.
    g.docs.show?.("receipt_tomorrow");
    await cs.wait(2.4);
    cs.say("[timestamped today]", { who: "", secs: 2.4 });
    await cs.wait(2.6);
    g.ui.closeFocus?.(false);

    cs.say("Whatever you are — after tonight there's no station.", { who: "", secs: 4.0 });
    await cs.wait(4.2);
    cs.say("There's nothing here to come back to.", { who: "", secs: 3.4 });
    await cs.wait(4.4);
    cs.say("So it's tonight, isn't it.", { who: "", secs: 3.2 });
    await cs.wait(3.6);

    g.audio.play("veh_car_door", { vol: 0.5 });
    await cs.wait(1.0);
    cs.say("Flashlight. Salt.", { who: "", secs: 2.6 });
    await cs.wait(2.8);
    // he doesn't take the umbrella
    g.player.teleport(V(5.6, 0, -3.2), Math.PI);
  });
  if (ctl.aborted) return;

  await g.torch.take();
  // Six pours. And for the first time in the game, exactly six doors.
  // The player finally has enough. That should feel wrong.
  g.state.data.saltLeft = 6;
  g.salt.restrictTo?.(["front", "rear", "bath", "hall", "stock", "office"]);
  g.salt.give({ carry: true });

  g.tasks.set([
    { id: "note", text: "Read the manager's note — it's on the register" },
    { id: "salt", text: "Lay salt — 0/6" },
    { id: "serve", text: "Serve whoever comes in" },
    { id: "readings", text: "Read all four pump meters, then write them up — 0/4" },
    { id: "bathroom", text: "Check the restroom — end of the hall" },
    // The bins are the author's "other stuff", and they are load-bearing: the
    // dumpster is in the back lot, which is the only reason he walks past the
    // covered car at all. The biggest reveal in the game was sitting behind an
    // optional prop nobody had a reason to visit.
    { id: "trash", text: "Take the last bin bag out to the dumpster — round the back" },
    { id: "lockup", text: "Close the station — permanently — 06:00" },
  ], "TONIGHT · THE LAST ONE");
  g.bus.on("doc:read", (id) => { if (id === "note_n6") g.tasks.done("note"); });

  await wait(2);
  g.ui.say("Six doors. Six pours.", { who: "", secs: 3.0 });
  await wait(3.4);
  g.ui.say("…That's the first time it's been enough.", { who: "", secs: 3.6 });
  g.state.clue("enough_salt", "Six pours, six doors. It has never been enough before.");
  await wait(3.8);

  // ——— 21:04 · the note ————————————————————————————————————————————
  g.setClock(21, 4);
  g.ui.toast("There's a note on the register.");
  await Promise.race([g.tasks.wait("note"), wait(90)]);
  if (ctl.aborted) return;
  await wait(1.6);
  g.ui.say("[he reads it three times]", { who: "", secs: 3.0 });
  await wait(3.2);
  // The first time the game says his name out loud is on a note from his boss.
  g.ui.say("\"Were.\"", { who: "", secs: 2.6 });
  g.state.clue("were_n6", "\"You were a good one.\" Were.");
  g.state.note("T. wrote 'you were a good one'. Were.", g.minutes);
  await wait(3.0);

  // ——— 21:30 and 22:20 · the last people through the door ————————
  //
  // Nobody tells them it is the last night. They buy what they came in for and
  // they leave, and that is the only ordinary thing that happens in the whole
  // of Night 6 — which is exactly why it is here.
  g.setClock(21, 30);
  await serveArrival(g, "A1", { bayIndex: 2 });
  if (ctl.aborted) return;
  await wait(5);
  g.ui.say("He doesn't know it's the last one. Why would he.", { who: "", secs: 4.0 });
  await wait(4.4);

  g.setClock(22, 20);
  await serveArrival(g, "A6", { bayIndex: 0 });
  if (ctl.aborted) return;
  await wait(5);
  g.tasks.done("serve");
  g.ui.say("That's the last customer this place ever has.", { who: "", secs: 4.0 });
  g.state.clue("last_customer", "The last customer Station 41 ever had, and he never knew");
  await wait(4.4);

  // ——— 23:15 · the Nova ————————————————————————————————————————————
  //
  // A discovery, so it is the player's. The car has been under a cover in the
  // back lot the whole game. Tonight the cover is off, folded, on the ground.
  g.setClock(23, 15);
  g.station.showNova?.(true);
  g.interact.add({
    id: "nova", pos: V(-9.4, 1.0, 12.4), radius: 4.0,
    label: "the car under the cover", verb: "Look at",
    enabled: () => !g.state.flag("nova_seen"),
    onUse: async () => {
      g.state.flag("nova_seen", true);
      g.audio.play("hor_drone_tension", { vol: 0.4 });
      g.ui.say("[the cover is off. Folded. Neatly. On the ground beside it]", { who: "", secs: 4.2 });
      await wait(4.4);
      g.ui.say("[it's the wrong colour for how old it is. It has never been "
        + "outside for long]", { who: "", secs: 4.6 });
      await wait(4.8);
      g.ui.say("…That's mine.", { who: "", secs: 2.8 });
      await wait(3.4);
      g.ui.say("[registration his. The dent in the rear quarter he put there at nineteen]",
        { who: "", secs: 4.6 });
      await wait(4.8);
      g.ui.say("[the air freshener he bought at a gas station in another state]",
        { who: "", secs: 4.2 });
      await wait(4.4);
      g.audio.play("int_door_open", { vol: 0.5 });
      await wait(1.2);
      // On the passenger seat: the photograph. The same one in his pocket.
      g.docs.show?.("photo_jacob");
      await wait(3.0);
      g.ui.say("[the same photo that is in his jacket pocket right now]", { who: "", secs: 4.0 });
      await wait(4.2);
      g.ui.say("[he checks. It is]", { who: "", secs: 2.6 });
      await wait(2.8);
      g.ui.closeFocus?.(false);
      await wait(1.0);
      g.ui.say("…How long have I been here.", { who: "", secs: 4.0 });
      g.state.clue("nova", "The covered car in the back lot is mine. The photo was on the seat.");
      g.state.note("The car in the back lot is my car. How long have I been here.", g.minutes);
      g.setDread(5);
    },
  });
  g.ui.toast("The cover is off the car in the back lot.");

  // Jacob does not arrive until the back lot has happened. If the player is
  // slow about the bins the night waits for them; if they never go, it moves
  // on at three minutes rather than deadlocking.
  await Promise.race([g.tasks.wait("readings"), wait(180)]);
  await Promise.race([g.tasks.wait("trash"), wait(120)]);
  if (ctl.aborted) return;

  // ——— 01:30 · JACOB ————————————————————————————————————————————————
  //
  // The one place in this night where losing control is the content: he cannot
  // move, and the light is shaking so hard it is hard to keep on him. Fifteen
  // seconds at a time, and the player gets their hands back for the run.
  g.setClock(1, 30);
  await wait(2);
  await g.cutscene("cs06_jacob", async (cs) => {
    g.power.blackout?.(true);
    g.audio.setState("outage", 0.5);
    g.audio.subtract("amb_fridge", true, 0.2);
    await cs.wait(1.4);
    // Thunder. There is no storm. There has been no storm all night.
    g.audio.play("amb_thunder", { vol: 1.0, scare: true });
    g.power.flickerNow?.(0.35, true);
    await cs.wait(1.0);
    cs.say("[the window flashes white. There is no storm]", { who: "", secs: 3.4 });
    await cs.wait(3.6);

    g.torch.toggle?.(true);
    g.audio.play("int_lightswitch", { vol: 0.5 });
    await g.attendant.showAt(0, {
      stage: 3, anim: "Idle_Loop", at: V(1.2, 0, 4.2), facing: Math.PI, silent: true,
    });
    cs.look(V(1.2, 1.6, 4.2), 1.4);
    await cs.wait(2.0);
    cs.say("[he is covered in blood. All of it dry. None of it new]", { who: "", secs: 4.2 });
    await cs.wait(4.4);
    cs.say("[his face is doing nothing at all]", { who: "", secs: 3.0 });
    await cs.wait(3.2);

    cs.say("Da— Danny…", { who: "jacob", secs: 3.0 });
    await cs.wait(3.4);
    cs.say("How hav— have you been?", { who: "jacob", secs: 3.2 });
    await cs.wait(3.6);
    cs.say("…Jake?", { who: "", secs: 2.4 });
    await cs.wait(2.8);
    cs.say("I waited.", { who: "jacob", secs: 2.6 });
    await cs.wait(3.0);
    cs.say("Jake, I've been looking for you for four y—", { who: "", secs: 3.6 });
    await cs.wait(3.0);
    g.audio.play("hum_scream_far", { vol: 0.9, rate: 0.8, scare: true });
    cs.say("I WAITED.", { who: "jacob", secs: 2.8 });
    // the cooler lights blow out one after another down the length of the room
    for (let i = 0; i < 5; i++) {
      g.audio.play("hor_glass_stress", { vol: 0.65, pos: V(-2 + i * 2.2, 2.0, 6.6) });
      await cs.wait(0.32);
    }
    await cs.wait(1.6);

    cs.say("You said you'd come get me after your shift.", { who: "jacob", secs: 4.2 });
    await cs.wait(4.4);
    cs.say("…What shift.", { who: "", secs: 2.6 });
    await cs.wait(3.0);
    // the line that reaches back to Night 4
    cs.say("You said ten minutes.", { who: "jacob", secs: 3.0 });
    g.state.clue("ten_minutes", "\"You said ten minutes.\"");
    await cs.wait(4.2);
    cs.say("Danny.", { who: "jacob", secs: 2.2 });
    await cs.wait(2.6);
    cs.say("Danny, why didn't you wake up.", { who: "jacob", secs: 3.8 });
    await cs.wait(4.0);

    // THUNDER — WHITE — and he is three metres closer and he did not walk
    g.audio.play("amb_thunder", { vol: 1.0, scare: true });
    g.power.flickerNow?.(0.3, true);
    await g.attendant.hide();
    await g.attendant.showAt(0, {
      stage: 3, anim: "Idle_Loop", at: V(2.6, 0, 1.4), facing: Math.PI, silent: true,
    });
    await cs.wait(0.7);
    cs.say("NO —", { who: "", secs: 2.0 });
    await cs.wait(1.6);
  });
  if (ctl.aborted) return;

  // ——— 01:31 · RUN ————————————————————————————————————————————————
  //
  // Control returns. No combat, no hiding. The salt does nothing — the player
  // will try it, and every line they laid all week is behind them, and it
  // walks over all six.
  g.setClock(1, 31);
  g.tasks.set([{ id: "getout", text: "⚠ GET OUT — NOW" }], "RUN");
  g.audio.setState("danger", 0.5);
  g.station.showAisleCrowd?.(true);      // the fourth aisle, full of people
  g.salt.breakAll?.();
  g.ui.toast("It walks over every line you laid.");

  const gotOut = new Promise((r) => {
    const off = g.bus.on("n6:out", () => { off(); r(true); });
  });
  g.interact.add({
    id: "runcar", pos: V(6.5, 1.0, -13.6), radius: 5.0,
    label: "the car", verb: "Keys — GO",
    enabled: () => g.tasks.has("getout") && !g.tasks.isDone("getout"),
    onUse: () => { g.tasks.done("getout"); g.bus.emit("n6:out"); },
  });
  // it follows, and it is always the same distance behind
  (async () => {
    for (let i = 0; i < 60 && !g.tasks.isDone("getout") && !ctl.aborted; i++) {
      g.audio.step("tile", { vol: 0.3, rate: 0.8 });
      if (i === 2) g.ui.say("[the fourth aisle is full of people, facing the shelves]",
        { who: "", secs: 4.0 });
      if (i === 6) g.ui.say("[none of them turn round]", { who: "", secs: 2.8 });
      await wait(0.9);
    }
  })();
  await Promise.race([gotOut, wait(120)]);
  if (ctl.aborted) return;
  g.tasks.done("getout");

  // the chime goes off cheerfully as he shoulders through it
  g.audio.play("int_doorchime", { vol: 0.8 });
  await wait(1.2);
  g.station.runPumpsAlone?.(true);
  g.ui.say("[every pump is running. All four. Nozzles in the cradles]", { who: "", secs: 4.2 });
  await wait(4.4);
  g.audio.play("int_keys", { vol: 0.8 });
  g.ui.say("Keys. Keys. Keys—", { who: "", secs: 2.6 });
  await wait(2.8);

  // ——— 01:41 · THE ROAD, and the ending ——————————————————————————
  await g.cutscene("cs06_road", async (cs) => {
    await cs.fade(1, 0.8);
    g.audio.play("veh_car_arrive", { vol: 0.6, rate: 0.8 });
    g.station.runPumpsAlone?.(false);
    await g.attendant.hide();
    g.audio.setState("off", 1.0);
    g.audio.play("veh_car_idle", { vol: 0.5 });
    await cs.wait(2.0);

    cs.say("[ten minutes of headlights and centre line and his own breathing]",
      { who: "", secs: 4.6 });
    await cs.wait(4.8);
    cs.say("[he checks the mirror. Empty road]", { who: "", secs: 3.0 });
    await cs.wait(3.2);
    cs.say("[he checks it again. Empty road]", { who: "", secs: 3.0 });
    await cs.wait(3.4);
    g.audio.play("hum_sigh", { vol: 0.5 });
    cs.say("…I think I lost him.", { who: "", secs: 3.2 });
    await cs.wait(3.6);
    cs.say("[the first full breath in six nights]", { who: "", secs: 3.2 });
    await cs.wait(3.6);

    // The radio comes on by itself, mid-song. It's the song. Four notes.
    g.audio.play("int_radio_static", { vol: 0.3 });
    await cs.wait(0.6);
    tune(g, { vol: 0.6, filter: { type: "bandpass", freq: 1500, q: 1.1 } });
    cs.say("[the radio comes on by itself. Mid-song]", { who: "", secs: 3.0 });
    await cs.wait(3.2);
    cs.say("[four notes]", { who: "", secs: 2.2 });
    await cs.wait(2.4);

    // HEADLIGHTS. FULL BEAM. NO TIME.
    await cs.fade(0, 0.06);
    g.ui.flashWhite?.(0.5);
    g.audio.play("hor_tyre_screech", { vol: 1.0, scare: true });
    await cs.wait(1.1);
    g.audio.play("hor_crash_bang", { vol: 1.0, scare: true });
    await cs.fade(1, 0.12);
    await cs.wait(2.6);

    // Rain, suddenly, on metal. Wipers still going. A door hanging open.
    g.audio.play("amb_rain_heavy", { vol: 0.6 });
    await cs.wait(2.0);
    cs.say("[rain, suddenly, on metal. The wipers are still going]", { who: "", secs: 4.0 });
    await cs.wait(4.2);
    cs.say("[a door hanging open. A bag of shopping on the asphalt, with a "
      + "receipt in it]", { who: "", secs: 4.8 });
    await cs.wait(5.0);
    // ...and this is Night 1's 02:36, and Night 3's ditch, from the other side.
    cs.say("[somewhere behind, at the station, a man on his shift hears a scream "
      + "and two bangs]", { who: "", secs: 5.0 });
    await cs.wait(5.2);
    cs.say("[and stands very still, and doesn't come out]", { who: "", secs: 3.8 });
    g.state.clue("the_loop", "The crash I heard on my first night was mine");
    await cs.wait(4.0);
  }, { skippable: false });

  if (!ctl.aborted) await g.runEnding("tennineteen");
}, {
  radio: () => [
    "…clear and still tonight, no rain in the forecast at all…",
    "…and after fifty-one years the Mile 41 station closes for the last time tonight…",
  ],
});

export const NIGHTS = { 1: night1, 2: night2, 3: night3, 4: night4, 5: night5, 6: night6 };
