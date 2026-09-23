// THE NIGHT COUNT — paper, the notebook, Form 41-C, and the VHS deck.
import * as THREE from "three";
import { LETTERS } from "../world/letters.js";
import { el, escapeHTML } from "../core/ui.js";
import { money, clockString } from "../core/util.js";
import { DOCS, NOTE_FOR } from "../game/documents.js";
import { L } from "../world/station.js";

export class DocSystem {
  constructor(game) {
    this.g = game;
    this.tapes = [];              // {id,label,found}
    this._surface = null;
    this.playing = null;
    this._registerHotspots();
  }

  _registerHotspots() {
    const g = this.g, I = g.interact, A = g.station.anchors;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const letter of LETTERS) I.add({id:letter.key,pos:new THREE.Vector3(...letter.pos),radius:1.65,label:letter.title,verb:"Read",onUse:()=>this.show(letter.key,{clue:letter.key})});

    I.add({
      id: "note", pos: V(-2.6, L.CNT_H + 0.1, 2.45), radius: 1.6,
      label: "the manager's note", verb: "Read",
      onUse: () => this.show(NOTE_FOR[g.state.night] || "note_n1", { clue: "note" + g.state.night }),
    });
    I.add({
      id: "binder", pos: V(-6.6, L.CNT_H + 0.1, 2.5), radius: 1.6,
      label: "the binder", verb: "Read",
      onUse: () => this.show("binder", { clue: "binder" }),
    });
    I.add({
      id: "pumplog", pos: V(-7.0, L.CNT_H + 0.1, 3.3), radius: 1.6,
      label: "the pump log", verb: "Read",
      onUse: () => this.show("pumplog", { clue: "pumplog" }),
    });
    I.add({
      id: "countsheet", pos: V(-3.4, L.CNT_H + 0.1, 2.6), radius: 1.5,
      label: "the count sheet", verb: "Read",
      onUse: () => this.show("countsheet", { clue: "countsheet" }),
    });
    I.add({
      id: "floorplan", pos: V(-7.55, 1.6, 8.05), radius: 1.6,
      label: "the floor plan", verb: "Look at",
      onUse: () => this.show("floorplan", { clue: "floorplan" }),
    });
    I.add({
      id: "cabinet", pos: V(-8.0, 1.0, 9.2), radius: 1.8,
      label: "the filing cabinet", verb: "Open",
      enabled: () => g.state.night >= 3,
      onUse: () => this.openCabinet(),
    });
    I.add({
      id: "desk", pos: V(A.office_desk.x + 0.6, 0.8, A.office_desk.z - 0.6), radius: 1.6,
      label: "the manager's desk", verb: "Search",
      // Retired with the old fiction. The desk held the three 1989 tapes and
      // the Form 41-C paperwork, which belong to a story this game no longer
      // tells — a player who found them on Night 4 would be reading a
      // different game's documents. Left in the code rather than deleted,
      // because the author may want the drawer for something.
      enabled: () => false,
      onUse: () => this.openDesk(),
    });
    I.add({
      id: "vhs", pos: V(A.camera_bank.x + 1.1, 0.9, A.camera_bank.z + 0.4), radius: 1.7,
      label: "the tape deck", verb: "Use",
      enabled: () => this.tapes.length > 0,   // never, now the desk is closed
      onUse: () => this.showDeck(),
    });
    I.add({
      id: "poster", pos: V(8.86, 1.7, 3.4), radius: 1.7,
      label: "the poster by the door", verb: "Read",
      enabled: () => g.state.night >= 2,
      onUse: () => this.show("missing_1989", { clue: "missing" }),
    });
  }

  // ——— reading ——————————————————————————————————————————————————
  show(id, { clue = null, after = null } = {}) {
    const d = DOCS[id];
    if (!d) return;
    if (this.g.ui.focused) return;
    const surface = el(`<div class="doc">
      <h1>${d.title}</h1>
      <div class="meta">${d.meta || ""}</div>
      <div class="bodyc">${d.body || ""}</div>
    </div>`);
    this.g.audio.play("int_paper_handle", { vol: 0.45 });
    this.g.ui.openFocus(surface, { escLabel: "ESC — put it down", onClose: after });
    this.g.state.data.docsRead[id] = true;
    if (clue) this.g.state.clue(clue, d.title);
    this.g.bus.emit("doc:read", id);
  }

  showHTML(title, meta, html, opts = {}) {
    const surface = el(`<div class="doc"><h1>${escapeHTML(title)}</h1>
      <div class="meta">${escapeHTML(meta)}</div><div class="bodyc">${html}</div></div>`);
    this.g.ui.openFocus(surface, { escLabel: opts.esc || "ESC — put it down", onClose: opts.after });
    return surface;
  }

  openCabinet() {
    const g = this.g;
    g.state.data.cabinetOpened = true;
    g.state.clue("cabinet", "The filing cabinet");
    g.audio.play("int_lock", { vol: 0.4 });
    // The cabinet used to hold the retired fiction — a 1979 district memo, a
    // 1972 clipping, 1989 pump logs. None of that is this story any more, and
    // worse, it contradicted the Night 5 folder scene, which is where the
    // cabinet actually matters now.
    //
    // The one thing worth keeping is the employee file, because the new story
    // makes it land harder than the old one ever did: it has **his own name on
    // it**, with a hire date years before the six nights he thinks he has
    // worked. It is the Nova, in a drawer, and a player who opens this before
    // Night 6 gets the same cold feeling early.
    const items = [
      ["danny_file", "ALCOTT, DANIEL R. — employee file"],
      ["countsheet", "Count sheets, current bundle"],
    ];
    if (g.state.night >= 5) items.push(["jacob_file", "— no name on the tab —"]);
    const html = `<p class="faint">Four drawers. Three of them are already empty — district has
    been through this place. The bottom one is full.</p><div class="fl"></div>`;
    const s = this.showHTML("Filing cabinet", "STATION 41 · OFFICE", html);
    const list = s.querySelector(".fl");
    for (const [id, label] of items) {
      const b = el(`<button style="display:block;width:100%;text-align:left;margin:4px 0">${escapeHTML(label)}</button>`);
      b.onclick = () => { this.g.ui.closeFocus(false); setTimeout(() => this.show(id, { clue: id }), 60); };
      list.appendChild(b);
    }
  }

  openDesk() {
    const g = this.g;
    g.state.data.deskOpened = true;
    g.state.clue("desk", "The manager's desk");
    g.audio.play("int_paper_handle", { vol: 0.4 });
    if (!this.tapes.length) {
      this.tapes = [
        { id: "t88", label: "unlabelled — 1988" },
        { id: "t92", label: "3/92" },
        { id: "t89", label: "11/89" },
      ];
      g.ui.toast("Three tapes in the drawer, under a bottle.");
    }
    this.showHTML("Manager's desk", "STATION 41 · OFFICE",
      `<p class="typed">A bottle, most of the way down. A tin of aspirin. A payroll stub with
       your name spelled right.</p>
       <p class="typed">And three video tapes that should have gone to district years ago,
       labelled in the same hand as the notes on your register.</p>
       <p class="faint">The tape deck is on the shelf under the monitors.</p>`);
  }

  // ——— the notebook ————————————————————————————————————————————
  openNotebook() {
    if (this.g.ui.focused) return;
    const d = this.g.state.data;
    d.handled.notebook++;
    const entries = d.notes.slice(-40).map((n) =>
      `<div class="entry"><div class="when">${escapeHTML(clockString(n.when || d.clock))}</div>
       <div class="txt">${escapeHTML(n.text)}</div></div>`).join("");
    const clues = Object.keys(d.clues).length;
    const surface = el(`<div class="book">
      <h1>STATION 41 — NIGHT ${d.night}</h1>
      ${entries || `<div class="entry"><div class="txt">Nothing worth writing down yet.</div></div>`}
      <div class="when" style="margin-top:18px">${clues} thing${clues === 1 ? "" : "s"} noticed so far.</div>
    </div>`);
    this.g.audio.play("int_paper_handle", { vol: 0.35 });
    this.g.ui.openFocus(surface, { escLabel: "ESC — pocket the notebook" });
  }

  // ——— drawer count ————————————————————————————————————————————
  showDrawerCount(actualCents, overCents) {
    const d = this.g.state.data;
    const takings = d.takingsCents || 0;
    const expected = 12000 + takings;
    const over = actualCents - expected;
    const html = `
      <table>
        <tr><th>FLOAT</th><td>${money(12000)}</td></tr>
        <tr><th>TAKINGS (receipts)</th><td>${money(takings)}</td></tr>
        <tr><th>EXPECTED</th><td>${money(expected)}</td></tr>
        <tr><th>IN THE DRAWER</th><td>${money(actualCents)}</td></tr>
        <tr><th>${over < 0 ? "SHORT" : "OVER"}</th><td><b>${money(Math.abs(over))}</b></td></tr>
      </table>
      ${over > 0 ? `<p class="typed">The drawer is over by ${money(over)}. Nobody paid it.</p>` : ""}
      ${over < 0 ? `<p class="typed">The drawer is short by ${money(-over)}.
        That one is yours — change counted wrong, and they did not hand it back.</p>` : ""}
      ${d.deptErrors > 0 ? `<p class="typed">${d.deptErrors}
        ${d.deptErrors === 1 ? "item is" : "items are"} filed under the wrong key.
        The money is right. The count is not.</p>` : ""}`;
    this.showHTML("Drawer count", "STATION 41 · REGISTER 1", html);
    // Only the unexplained surplus is a clue. Being short because you cannot
    // count change is not a thing the building did to you.
    if (over > 0) this.g.state.clue("over", "The drawer runs over");
  }

  // ——— Form 41-C ————————————————————————————————————————————————
  showForm41C() {
    const g = this.g, d = g.state.data;
    d.formSeen = true;
    g.state.clue("form41c", "Form 41-C");
    const rows = [
      ["1974", "002", "M. POOLE"], ["1975", "004", "M. POOLE"],
      ["1979", "011", "M. POOLE"], ["1980", "019", "R. SANDS"],
      ["1984", "058", "R. SANDS"], ["1988", "119", "D. ALCOTT"],
      ["1989", "141", "G. VASQUEZ"], ["1993", "236", "G. VASQUEZ"],
      ["1996", "306", "G. VASQUEZ"],
    ].map(([y, n, w]) => `<tr><td>${y}</td><td><b>${n}</b></td><td>${w}</td></tr>`).join("");
    const html = `
      <p class="typed">To be completed by the closing attendant before the final shift ends.
      One copy to district. One copy remains at station.</p>
      <table>
        <tr><th>STATION</th><td>41 — OLD STATE RTE 41, HARNEY CO., OR</td></tr>
        <tr><th>DECOMMISSION DATE</th><td>10-31-1997</td></tr>
        <tr><th>MERCHANDISE COUNT</th><td><input id="f_merch" placeholder="units"></td></tr>
        <tr><th>FUEL RECONCILED (GAL)</th><td><input id="f_fuel" placeholder="gallons"></td></tr>
        <tr><th>FINAL HEADCOUNT</th><td><input id="f_head" placeholder="—"></td></tr>
        <tr><th>CLOSING ATTENDANT</th><td class="typed"><b>W. ALCOTT</b></td></tr>
      </table>
      <h2>Headcount, prior years</h2>
      <table><tr><th>YEAR</th><th>COUNT</th><th>FILED BY</th></tr>${rows}</table>
      <p class="faint">Form 41-C (Rev. 1972). The closing attendant's name is typed, not written.
      The typewriter that did it is behind you, under a dust sheet, and its ribbon is original.</p>
      <div class="sig"><button id="f_file">FILE THE FORM</button></div>`;
    const s = this.showHTML("Form 41-C — Final Count", "MERIDIAN FUEL & PROVISIONS · DISTRICT 4", html);
    s.querySelector("#f_file").onclick = () => {
      const head = s.querySelector("#f_head").value.trim();
      d.headcountFiled = head === "" ? null : head;
      d.merchFiled = s.querySelector("#f_merch").value.trim();
      d.fuelFiled = s.querySelector("#f_fuel").value.trim();
      g.ui.closeFocus();
      g.bus.emit("form:filed", d.headcountFiled);
      g.ui.toast(head ? "Filed." : "Filed, with the last field blank.");
    };
  }

  // ——— VHS ——————————————————————————————————————————————————————
  showDeck() {
    const g = this.g;
    const surface = el(`<div class="vhs">
      <div class="tv"><div class="tape">— NO TAPE —</div></div>
      <div class="ctl"></div>
    </div>`);
    const ctl = surface.querySelector(".ctl");
    for (const t of this.tapes) {
      const b = el(`<button>${escapeHTML(t.label)}</button>`);
      b.onclick = () => this.playTape(t.id, surface);
      ctl.appendChild(b);
    }
    const stop = el(`<button>STOP</button>`);
    stop.onclick = () => { this.playing = null; g.postFX = {}; surface.querySelector(".tape").textContent = "— STOP —"; };
    ctl.appendChild(stop);
    g.ui.openFocus(surface, {
      escLabel: "ESC — eject", clear: true,
      onClose: () => { this.playing = null; g.postFX = {}; },
    });
    g.audio.play("int_vhs", { vol: 0.5 });
  }

  playTape(id, surface) {
    const g = this.g;
    g.state.data.tapesWatched[id] = true;
    g.state.clue("tape_" + id, "Tape " + id);
    g.audio.play("int_vhs", { vol: 0.55 });
    const label = surface.querySelector(".tape");
    this.playing = id;
    g.bus.emit("tape:play", id);

    const seq = TAPES[id];
    if (!seq) return;
    let i = 0;
    const step = () => {
      if (this.playing !== id) return;
      const s = seq[i++];
      if (!s) { label.textContent = "— END OF TAPE —"; g.postFX = {}; return; }
      label.textContent = s.stamp || "";
      g.postFX = { tape: s.damage ?? 0.5, feed: true };
      if (s.cam !== undefined) g.cameras.selected = s.cam;
      if (s.say) g.ui.say(s.say, { who: s.who || "", secs: s.t || 3 });
      if (s.sound) g.audio.voice(s.sound, "tape", { vol: s.vol ?? 0.8 });
      if (s.fn) s.fn(g);
      setTimeout(step, (s.t || 3) * 1000);
    };
    step();
  }
}

/** Tape contents. Rendered live from the security cameras with tape damage. */
const TAPES = {
  t88: [
    { stamp: "12-04-88  01:14", cam: 3, t: 4, damage: 0.7 },
    { stamp: "12-04-88  01:14", cam: 3, t: 4, damage: 0.8, sound: "hor_tape_warble", vol: 0.5 },
    { stamp: "12-04-88  01:15", cam: 3, t: 3, damage: 1.0,
      say: "Forty seconds of an empty aisle. Then one frame that isn't.", secs: 3 },
    { stamp: "— END —", t: 2, damage: 0.3 },
  ],
  t92: [
    { stamp: "03-11-92  02:40", cam: 5, t: 4, damage: 0.6 },
    { stamp: "03-11-92  02:41", cam: 5, t: 4, damage: 0.7,
      say: "Somebody in a Meridian shirt is restocking the back shelf. The station was closed for stocktake that week.", secs: 4 },
    { stamp: "— END —", t: 2, damage: 0.3 },
  ],
  t89: [
    { stamp: "11-22-89  03:48", cam: 3, t: 4, damage: 0.5 },
    { stamp: "11-22-89  03:50", cam: 4, t: 4, damage: 0.6, sound: "hum_breath", vol: 0.7,
      say: "There's someone at the counter. He's been there a while.", secs: 4 },
    { stamp: "11-22-89  03:52", cam: 3, t: 5, damage: 0.7, sound: "int_phone_pickup", vol: 0.6,
      who: "DANNY", say: "Gil — there's a man out here. No car. He wants cigarettes and change for the phone.", secs: 5 },
    { stamp: "11-22-89  03:53", cam: 3, t: 5, damage: 0.7,
      who: "DANNY", say: "I'm not selling him anything. You didn't see him. I'm locking the door.", secs: 5 },
    { stamp: "11-22-89  03:58", cam: 4, t: 4, damage: 0.9, sound: "int_lock", vol: 0.6 },
    { stamp: "11-22-89  04:07", cam: 3, t: 5, damage: 1.2, sound: "hor_static_burst", vol: 0.5 },
    { stamp: "11-22-89  04:08", cam: 3, t: 6, damage: 0.4,
      say: "The store is empty. The door is still locked from the inside.", secs: 5 },
    { stamp: "— END —", t: 3, damage: 0.2 },
  ],
};
