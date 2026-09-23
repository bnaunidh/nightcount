import * as THREE from "three";
import { L } from "../world/station.js";
import { clockString } from "../core/util.js";

export class PhoneSystem {
  constructor(game) {
    this.g = game;
    this.ringing = null;
    this.inCall = false;
    this._ringT = 0;
    this._rings = 0;
    this.missed = 0;

    game.interact.add({
      id: "phone", pos: new THREE.Vector3(-7.0, L.CNT_H + 0.15, 4.1), radius: 1.9,
      label: () => "the phone", verb: "Answer",
      get verb() { return "Answer"; },
      enabled: () => !!this.ringing || this.canDial(),
      onUse: () => (this.ringing ? this.answer() : this.dial()),
    });
    game.interact.add({
      id: "radio", pos: new THREE.Vector3(-4.2, 0.9, 11.4), radius: 1.7,
      label: "the radio", verb: "Switch on",
      onUse: () => this.toggleRadio(),
    });
  }

  openCell(){
    const g=this.g;if(g.ui.focused||g.choices.open)return;
    const wrap=document.createElement('section');wrap.className='cellphone';
    wrap.innerHTML='<div class="phone-brand">MERIDIAN MOBILE · 1997</div><div class="phone-screen"><small>CONNECTED · '+clockString(g.minutes)+'</small><h2>CONTACTS</h2><p class="phone-response">Who do you need?</p></div><div class="phone-buttons"></div>';
    const log=wrap.querySelector('.phone-response'),buttons=wrap.querySelector('.phone-buttons');
    const entries=[['Call manager · Gil','manager'],['Call 911','911'],...(this.ringing?[['Answer incoming call','answer']]:[])];
    for(const [label,id] of entries){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{if(id==='answer'){g.ui.closeFocus();this.answer();return;}log.textContent=this.cellResponse(id);g.audio.play('int_phone_pickup',{vol:.22});};buttons.append(b);}
    const close=document.createElement('button');close.textContent='Put phone away';close.onclick=()=>g.ui.closeFocus();buttons.append(close);
    g.ui.openFocus(wrap,{escLabel:'ESC — close cellphone'});
  }
  cellResponse(contact){
    const g=this.g;let text;
    if(contact==='911'){
      const emergency=g.state.flag('delivery_driver_found')||['defend','run','watch'].includes(g.delivery?.scare.phase);
      const crash=g.tasks.has('investigate')||g.tasks.has('crash_site');
      text=emergency?'DISPATCH: Stay inside if you can. Keep away from the person outside. You said Meridian Station 41? Our map marks that site as closed. I have logged your location; keep this phone with you.':crash?'DISPATCH: Do not enter the roadway. Tell me what you can see from the forecourt. I am logging a possible collision near Meridian Station 41.':'DISPATCH: What is your emergency? If you are in immediate danger, stay somewhere safe and tell us your location. Meridian Station 41 is listed as closed; I am noting your call.';
      if(!g.state.flag('cell_911_logged'))g.state.note('I called 911. Dispatch took the location, but their map already lists Station 41 as closed.',g.minutes);
      g.state.flag('cell_911_logged',true);
    }else{
      const hint=g.delivery?.guidance();
      text=g.state.night===3&&g.state.flag('delivery_doppelganger_seen')?'GIL: No second delivery tonight. The route was cancelled. Do not let anyone take the keys.':g.state.flag('delivery_driver_found')?'GIL: Call 911. Keep the doors closed and stay by the phone. There was only one driver scheduled.':hint?'GIL: '+hint.action+' '+hint.route:g.tasks.has('clock_in')&&!g.tasks.isDone('clock_in')?'GIL: Clock in beside the OFFICE door. Then read the note I left on the register.':'GIL: Use the list for this shift. The cleaning things are through OFFICE; deliveries go through STOCK. Call 911 if someone is hurt. I will keep the line free.';
    }
    g.state.flag('cell_called_'+contact,true);g.saveNow();return text;
  }
  reset(){
    clearTimeout(this._callT);clearTimeout(this._radioT);this.ringing=null;this.inCall=false;this._rings=0;this._ringT=0;
  }

  canDial() { return this.g.state.flag("can_call_gil"); }

  /** @param call {lines:[{who,text,secs,sound}], onEnd, id, unmissable} */
  ring(call) {
    this.ringing = call;
    this._ringT = 0;
    this._rings = 0;
    this.g.bus.emit("phone:ringing", call.id);
  }

  answer() {
    const call = this.ringing;
    if (!call) return;
    this.ringing = null;
    this.inCall = true;
    this.g.audio.play("int_phone_pickup", { vol: 0.6 });
    this.g.audio.duck(0.55, 6);
    let i = 0;
    const next = () => {
      const line = call.lines[i++];
      if (!line) {
        this.inCall = false;
        this.g.audio.play("int_phone_pickup", { vol: 0.4, rate: 0.85 });
        this.g.ui.clearSubs();
        call.onEnd?.();
        this.g.bus.emit("phone:end", call.id);
        return;
      }
      if (line.sound) this.g.audio.voice(line.sound, "phone", { vol: line.vol ?? 0.75 });
      // `voice: "phone"` puts the line through the earpiece bandpass, so a
      // caller sounds like a telephone and not like somebody in the room.
      const t = line.text
        ? this.g.ui.say(line.text, { who: line.who || "GIL", secs: line.secs, voice: "phone" })
        : (line.secs || 1.2);
      this._callT = setTimeout(next, (line.secs || t || 2.5) * 1000);
    };
    next();
  }

  dial() {
    if (this.inCall) return;
    this.g.audio.play("int_phone_pickup", { vol: 0.55 });
    const script = this.g.script;
    const call = script?.gilCall?.();
    if (call) { this.ringing = call; this.answer(); return; }
    this.inCall = true;
    this.g.ui.say("It rings eleven times. Nobody picks up.", { who: "", secs: 3.5 });
    this._callT=setTimeout(() => { this.inCall = false; }, 3500);
  }

  toggleRadio() {
    const on = !this.g.state.flag("radio_on");
    this.g.state.flag("radio_on", on);
    if (on) {
      this.g.audio.play("int_radio_static", { vol: 0.35, pos: new THREE.Vector3(-4.2, 0.9, 11.4) });
      this.g.audio.voice("hum_radio_voice", "radio", { vol: 0.45 });
      this.broadcast();
    } else {
      this.g.ui.toast("You switch the radio off.");
    }
  }

  broadcast(lines) {
    const b = lines || this.g.script?.radio?.() || [
      "…KCBK Coldbrook, twenty-nine degrees at the airport, wind out of the northeast…",
      "…and the county's asking again for patience on the Route 41 closure, with the new alignment carrying all through traffic as of the first…",
    ];
    let i = 0;
    const next = () => {
      if (!this.g.state.flag("radio_on")) return;
      const t = b[i++];
      if (!t) return;
      this.g.ui.say(t, { who: "RADIO", secs: 5, voice: "radio" });
      setTimeout(next, 5600);
    };
    this._radioT=setTimeout(next, 900);
  }

  update(dt) {
    if (!this.ringing) return;
    this._ringT -= dt;
    if (this._ringT <= 0) {
      this._ringT = 3.4;
      this._rings++;
      this.g.audio.play("int_phone_ring", {
        vol: 0.65, pos: new THREE.Vector3(-7.0, 1.2, 4.1),
      });
      if (this._rings > (this.ringing.maxRings || 14)) {
        const c = this.ringing;
        this.ringing = null;
        this.missed++;
        this.g.bus.emit("phone:missed", c.id);
        c.onMissed?.();
      }
    }
  }
}
