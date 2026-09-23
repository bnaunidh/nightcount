// THE NIGHT COUNT — the cash register.
//
// This is the most important object in the game. A transaction has to be
// *completed* — scanned, totalled, tendered, change counted back, receipt
// printed, drawer closed — for an arrival to leave the road. Every step is a
// separate action the player takes, because on Night 6 one of those steps has
// to be refused instead.
import * as THREE from "three";
import { el, escapeHTML } from "../core/ui.js";
import { money, clockString } from "../core/util.js";
import { L } from "../world/station.js";

/**
 * Department keys, in the period idiom: a numbered "Key" per merchandise
 * class, because a 1997 register has no barcode database — the operator
 * classifies the item themselves. Ringing the wrong department is the game's
 * quietest failure state: the sale still completes, but the count is wrong.
 */
export const DEPTS = [
  { n: 1, label: "GROCERY" },
  { n: 2, label: "TOBACCO" },
  { n: 3, label: "AUTO" },
  { n: 4, label: "HOT BEV" },
  { n: 5, label: "SUNDRY" },
  { n: 6, label: "MEDICINE" },
];

export function deptOf(item) {
  const n = (item.name || "").toLowerCase();
  if (n.includes("cigarette")) return 2;
  if (n.includes("oil")) return 3;
  if (n.includes("coffee")) return 4;
  if (n.includes("aspirin")) return 6;
  if (n.includes("map") || n.includes("change") || n.includes("notebook") ||
      n.includes("keys") || n.includes("punch")) return 5;
  return 1;
}

export const DENOMS = [
  { c: 2000, label: "$20" }, { c: 1000, label: "$10" }, { c: 500, label: "$5" },
  { c: 100, label: "$1" }, { c: 25, label: "25¢" }, { c: 10, label: "10¢" },
  { c: 5, label: "5¢" }, { c: 1, label: "1¢" },
];

export class RegisterSystem {
  constructor(game) {
    this.g = game;
    this.sale = null;             // active transaction
    this.drawerOpen = false;
    this.printerDead = false;
    this.receiptNo = 4181;
    this.onComplete = null;
    this.onVoid = null;
    this._surface = null;
    this._counterItems = [];

    game.interact.add({
      id: "register", pos: new THREE.Vector3(L.REG.x, L.REG.y + 0.2, L.REG.z),
      radius: 1.9, label: "the register", verb: "Use",
      onUse: () => this.open(),
    });
  }

  resetForNight(n) {
    this.printerDead = false;
    this.sale = null;
    this.drawerOpen = false;
    this.clearCounter();
  }

  // ——— transactions ————————————————————————————————————————————
  /**
   * @param {object} order {who, items:[{name,price,barcode}], tenderCents,
   *   fuelPump, exact, id, isAttendant}
   */
  beginSale(order) {
    this.sale = {
      ...order,
      scanned: [],
      state: "scanning",           // scanning | tendered | change | printed
      given: [],
      mistakes: 0,
      voided: false,
      started: this.g.minutes,
    };
    this.placeItems(order.items || []);
    return this.sale;
  }

  clearSale() {
    this.sale = null;
    this.clearCounter();
    this.refresh();
  }

  get total() {
    if (!this.sale) return 0;
    return this.sale.scanned.reduce((a, b) => a + b.price, 0);
  }
  get changeDue() {
    return Math.max(0, (this.sale?.tenderCents || 0) - this.total);
  }
  get givenTotal() {
    return (this.sale?.given || []).reduce((a, b) => a + b, 0);
  }

  /** Physical items on the counter, so the player can see the order. */
  async placeItems(items) {
    this.clearCounter();
    const { model, fitHeight } = await import("../core/assets.js");
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const o = await model(it.model || "snack", { shadows: false });
      fitHeight(o, it.h || 0.16);
      o.position.set(L.REG.x + 0.55 + (i % 3) * 0.22, L.CNT_H, L.REG.z + 0.05 - Math.floor(i / 3) * 0.2);
      o.rotation.y = i * 1.1;
      this.g.scene.add(o);
      this._counterItems.push(o);
    }
  }

  clearCounter() {
    for (const o of this._counterItems) o.parent?.remove(o);
    this._counterItems.length = 0;
  }

  // ——— the terminal ————————————————————————————————————————————
  //
  // Modelled on the electronic registers a 1990s c-store actually ran: a 20x2
  // vacuum-fluorescent display, register/tender keys down the left, a 10-key
  // in the middle, and numbered DEPARTMENT keys on the right — the "Key"
  // buttons, in Data Terminal Systems' own vocabulary. Items are not "scanned
  // from a list"; you look at what is on the counter and press its department.
  open() {
    if (this.g.ui.focused) return;
    const surface = el(`<div class="dts">
      <div class="brandplate"><b>MERIDIAN 41</b><span>REG 1 · DTS SERIES 200 · S/N 4118-77</span></div>
      <div class="vfd"></div>
      <div class="fnkeys"></div>
      <div class="deptwrap">
        <div>
          <div class="depts"></div>
          <div class="keys" style="margin-top:8px"></div>
        </div>
        <div class="receipt"></div>
      </div>
    </div>`);
    this._surface = surface;
    this._entry = "";
    this.g.ui.openFocus(surface, { escLabel: "ESC — step back from the register" });
    this.refresh();
  }

  close() { if (this.g.ui.focused) this.g.ui.closeFocus(); }

  /** Two lines of twenty characters. Everything the operator gets. */
  _vfd() {
    const pad = (l, r, w = 20) => {
      l = String(l); r = String(r);
      const gap = Math.max(1, w - l.length - r.length);
      return (l + " ".repeat(gap) + r).slice(0, w);
    };
    const sale = this.sale;
    if (!sale) {
      return [pad("MERIDIAN 41", clockString(this.g.minutes, true)),
        this.drawerOpen ? pad("DRAWER", "OPEN") : pad("READY", this._entry || "")];
    }
    const n = sale.scanned.length;
    if (sale.state === "scanning") {
      const last = sale.scanned[n - 1];
      return [pad(last ? last.name.toUpperCase().slice(0, 12) : "ITEM " + (n + 1), last ? money(last.price) : ""),
        pad("SUBTL " + n, money(this.total))];
    }
    if (sale.state === "tendered" || sale.state === "change") {
      return [pad("TOTAL", money(this.total)),
        pad("CHG " + money(this.changeDue), money(this.givenTotal))];
    }
    if (sale.state === "printed") {
      return [pad("CHANGE", money(this.changeDue)),
        sale.handwritten ? pad("WRITE RECEIPT", "") : pad("RECEIPT", "#" + this.receiptNo)];
    }
    return [pad("", ""), pad("", "")];
  }

  /** The paper tail, printed as it goes — amounts right, no .00 for nothing. */
  _receiptText() {
    const sale = this.sale;
    const L = ["   MERIDIAN FUEL & PROV.", "      STATION NO. 41", "   OLD STATE RTE 41  OR", "",
      `10-${23 + (this.g.state.night - 1)}-97   ${clockString(this.g.minutes, true)}   REG 1`, ""];
    if (!sale) { L.push("      - NO SALE -"); return L.join("\n"); }
    const row = (a, b) => {
      a = a.slice(0, 15);
      return a + " ".repeat(Math.max(1, 24 - a.length - b.length)) + b;
    };
    for (const it of sale.scanned) L.push(row(it.name.toUpperCase(), money(it.price)));
    if (sale.fuelDone) L.push(row("PUMP " + sale.fuelPump, money(sale.fuelCents || 0)));
    if (!sale.scanned.length && !sale.fuelDone) L.push("   (nothing rung up)");
    L.push("------------------------");
    L.push(row("TOTAL", money(this.total)));
    if (sale.state !== "scanning") {
      L.push(row("CASH", money(sale.tenderCents)));
      if (this.changeDue > 0) L.push(row("CHANGE", money(this.changeDue)));
    }
    if (sale.state === "printed") {
      L.push("");
      L.push(sale.handwritten ? "  * HAND WRITTEN *" : `  RECEIPT ${this.receiptNo}`);
      L.push("     THANK YOU");
    }
    return L.join("\n");
  }

  refresh() {
    const s = this._surface;
    if (!s || !document.body.contains(s)) return;
    const sale = this.sale;

    // —— display ——
    const [l1, l2] = this._vfd();
    s.querySelector(".vfd").innerHTML =
      `${escapeHTML(l1)}\n${escapeHTML(l2)}`;
    s.querySelector(".receipt").textContent = this._receiptText();

    const fn = s.querySelector(".fnkeys");
    const depts = s.querySelector(".depts");
    const keys = s.querySelector(".keys");
    fn.innerHTML = ""; depts.innerHTML = ""; keys.innerHTML = "";

    const mk = (host, label, onClick, cls = "", dis = false) => {
      const b = el(`<button class="${cls}" ${dis ? "disabled" : ""}>${label}</button>`);
      if (!dis) b.onclick = () => { this.g.audio.play("int_register_beep", { vol: 0.28 }); onClick(); this.refresh(); };
      host.appendChild(b);
      return b;
    };

    // —— left column: register function + tender keys ——
    const scanning = sale && sale.state === "scanning";
    const tendering = sale && (sale.state === "tendered" || sale.state === "change");
    mk(fn, "CLEAR", () => { this._entry = ""; }, "fn");
    mk(fn, "SUBTL", () => { if (scanning) this.doTotal(); }, "fn", !scanning || this._nothingRung());
    mk(fn, "CASH<br>TEND", () => { if (scanning) this.doTotal(); }, "fn tender", !scanning || this._nothingRung());
    mk(fn, "CHANGE", () => { if (tendering) this.giveChange(); }, "fn tender", !tendering);
    mk(fn, "RECEIPT", () => { if (sale?.state === "printed") this.finish(); }, "fn tender", sale?.state !== "printed");
    mk(fn, "VOID", () => { if (sale) this.voidSale(); }, "fn void", !sale);
    mk(fn, "NO<br>SALE", () => (sale ? null : this.toggleDrawer()), "fn", !!sale);

    // —— right: department keys (this is how an item gets rung up) ——
    if (scanning) {
      const pending = sale.items.filter((it) => !sale.scanned.includes(it));
      for (const d of DEPTS) {
        const wants = pending.some((it) => (it.dept || deptOf(it)) === d.n);
        mk(depts, `${d.n}  ${d.label}`, () => this.ringDept(d.n), "dept", false)
          .style.outline = wants ? "1px solid #6b8f5f" : "";
      }
      if (sale.fuelPump) {
        mk(depts, `9  PUMP ${sale.fuelPump}`, () => this.ringFuel(), "dept", !!sale.fuelDone);
      }
    } else if (tendering) {
      for (const d of DENOMS) {
        mk(depts, d.label, () => {
          sale.given.push(d.c); sale.state = "change";
          this.g.audio.play(d.c >= 100 ? "int_paper_handle" : "int_coins", { vol: 0.5 });
        }, "dept");
      }
      mk(depts, "TAKE BACK", () => { sale.given.pop(); this.g.audio.play("int_coins", { vol: 0.3 }); }, "dept");
    } else if (!sale) {
      mk(depts, "COUNT DRAWER", () => this.countDrawer(), "dept");
      mk(depts, "CLOSE", () => this.close(), "dept");
    }

    // —— centre: the 10-key, which is real: it enters the fuel amount ——
    for (const k of ["7", "8", "9", "4", "5", "6", "1", "2", "3"]) {
      mk(keys, k, () => { this._entry = (this._entry + k).slice(0, 5); });
    }
    mk(keys, "0", () => { this._entry = (this._entry + "0").slice(0, 5); }, "num0");
    mk(keys, "00", () => { this._entry = (this._entry + "00").slice(0, 5); });
  }

  _nothingRung() {
    const s = this.sale;
    return !s || (!s.scanned.length && !s.fuelDone);
  }

  // ——— actions ——————————————————————————————————————————————————
  scanNext() {
    const sale = this.sale;
    if (!sale) return;
    const next = sale.items.find((it) => !sale.scanned.includes(it));
    if (!next) return;
    sale.scanned.push(next);
    this.g.audio.play("int_scanner", { vol: 0.6 });
    this.g.bus.emit("scan", next, sale);
  }

  /**
   * Ring the item on the counter that belongs to department `n`.
   *
   * A wrong key used to be *refused* — "Nothing on the counter belongs to that
   * key" — which meant the department buttons could not be got wrong, which
   * meant they were not a decision. You pressed keys until one of them worked.
   *
   * The register takes whatever you give it, the way a 1997 register does. The
   * price is right either way, so the customer never notices and the total on
   * the receipt is correct; what is wrong is the *classification*, and that
   * only shows up in the count at the end of the shift. This is the game's
   * quietest failure state, and it only exists if the machine lets you make it.
   */
  ringDept(n) {
    const sale = this.sale;
    if (!sale || sale.state !== "scanning") return;
    const pending = sale.items.filter((it) => !sale.scanned.includes(it));
    if (!pending.length) return;
    const match = pending.find((it) => (it.dept || deptOf(it)) === n);
    const item = match || pending[0];
    if (!match) {
      sale.mistakes++;
      sale.wrongDept = (sale.wrongDept || 0) + 1;
      this.g.state.data.deptErrors++;
      // It rings. It does not complain, and neither does anybody else — the
      // only tell is the beep sitting a shade low, which a player will notice
      // on about the fourth one and not before.
      this.g.audio.play("int_register_beep", { vol: 0.5, rate: 0.86 });
    } else {
      this.g.audio.play("int_scanner", { vol: 0.55 });
    }
    sale.scanned.push(item);
    this.g.bus.emit("scan", item, sale);
  }

  ringFuel() {
    const sale = this.sale;
    sale.fuelDone = true;
    sale.fuelCents = sale.fuelCents || 0;
    this.g.audio.play("int_register_beep", { vol: 0.5 });
  }

  doTotal() {
    const sale = this.sale;
    if (!sale) return;
    sale.state = "tendered";
    this.g.audio.play("int_register_beep", { vol: 0.6 });
    this.openDrawer(true);
    this.g.bus.emit("total", sale);
  }

  /**
   * Hand the change over.
   *
   * The two ways of getting this wrong are not symmetrical, and treating them
   * as one thing — "wrong, do it again" — threw away the only moment in the
   * shift where the player can quietly cost the station money.
   *
   *   SHORT   they are being cheated, so they count it and say so. Nothing is
   *           committed; the player counts again. This is a mistake you are
   *           allowed to fix, because in life you would be made to.
   *   OVER    they are being handed extra, so they take it and leave. It
   *           commits. The drawer is down by the difference and nobody in the
   *           building says a word about it until the count at six.
   */
  giveChange() {
    const sale = this.sale;
    const due = this.changeDue, got = this.givenTotal;
    if (got < due) {
      sale.mistakes++;
      this.g.audio.play("int_register_beep", { vol: 0.35, rate: 0.7 });
      this.g.ui.toast(`They count it in their hand. "This is short."`);
      sale.given.length = 0;
      this.refresh();
      return;
    }
    if (got > due) {
      const over = got - due;
      sale.mistakes++;
      sale.changeErr = over;
      this.g.state.data.changeErrCents -= over;    // out of the drawer, gone
      this.g.audio.play("int_coins", { vol: 0.6 });
      // no toast, no correction, no second chance — that is the whole point
    } else {
      this.g.audio.play("int_coins", { vol: 0.6 });
    }
    sale.state = "printed";
    if (this.printerDead) {
      // Night 6: the printer dies and the pad has to be used instead
      this.g.ui.toast("The printer just clicks. There's a receipt pad under the counter.");
      sale.handwritten = true;
    } else {
      this.g.audio.play("int_paper_receipt", { vol: 0.55 });
      this.receiptNo++;
    }
    this.g.bus.emit("change", sale);
  }

  finish() {
    const sale = this.sale;
    if (!sale) return;
    this.openDrawer(false);
    // What the drawer actually gained: what they put in, less what was
    // physically handed back — not less what *should* have been handed back.
    // Using changeDue here made over-payment free, which is the one thing it
    // must not be.
    const paid = sale.tenderCents - this.givenTotal;
    this.g.state.data.drawerCents += paid;
    if (sale.mistakes) this.g.state.data.saleErrors++;
    sale.state = "done";
    this.g.audio.play("int_drawer", { vol: 0.5 });
    this.close();
    const cb = this.onComplete;
    this.g.bus.emit("sale:complete", sale);
    this.sale = null;
    this.clearCounter();
    cb?.(sale);
  }

  voidSale() {
    const sale = this.sale;
    if (!sale) return;
    sale.voided = true;
    this.g.audio.play("int_register_beep", { vol: 0.4, rate: 0.6 });
    this.openDrawer(false);
    this.close();
    const cb = this.onVoid;
    this.g.bus.emit("sale:void", sale);
    this.sale = null;
    this.clearCounter();
    cb?.(sale);
  }

  openDrawer(v) {
    if (this.drawerOpen === v) return;
    this.drawerOpen = v;
    this.g.audio.play("int_drawer", { vol: 0.5 });
  }

  toggleDrawer() {
    this.openDrawer(!this.drawerOpen);
    if (this.drawerOpen) this.g.bus.emit("nosale");
  }

  countDrawer() {
    const d = this.g.state.data;
    const expected = 12000 + d.overCents * 0;   // the float, before tonight's takings
    const actual = d.drawerCents;
    const over = actual - expected - d.expectedTakings || 0;
    this.g.docs.showDrawerCount(actual, d.overCents);
  }

  update(dt) {
    if (this.sale && this.sale.state !== "done" && this.sale.watchdog) {
      this.sale.watchdog(dt);
    }
  }
}
