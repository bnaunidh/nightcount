import * as THREE from 'three';
import { releaseLock } from '../core/input.js';
// This is the station copying the dead delivery driver, never a second delivery.
export class Doppelganger {
  constructor(g){this.g=g;this.entity=null;this.pending=false;this.generation=0;this.vanishIn=0;this.talking=false;
    g.interact.add({id:'doppelganger',pos:()=>this.entity?.group.position.clone().setY(1.3),radius:2.8,priority:3,label:'the delivery driver',verb:'Talk to',enabled:()=>!!this.entity&&!this.entity.dead&&!g.state.flag('delivery_doppelganger_seen'),onUse:()=>this.talk()});
  }
  async appear(){
    const g=this.g;if(this.entity||this.pending||g.state.night!==3||g.state.flag('delivery_doppelganger_seen'))return;
    this.pending=true;const token=this.generation;
    try{const c=await g.customers.spawn('DELIVERY',{name:'the delivery driver',height:1.80,build:1.1,coat:0x58634b,trousers:0x30363a,skin:0xb08c6e,detail:'vest',at:new THREE.Vector3(3.8,0,2.2),rot:Math.PI});
      if(token!==this.generation){g.customers.despawn(c);return;}this.entity=c;c.state='waiting';
      g.tasks.add({id:'doppelganger',text:'Talk to the familiar driver — inside, beside the front doors',optional:true});g.audio.play('int_doorchime',{vol:.4});
    }finally{if(token===this.generation)this.pending=false;}
  }
  record(){const g=this.g;if(g.state.flag('delivery_doppelganger_seen'))return;g.state.flag('delivery_doppelganger_seen',true);g.tasks.done('doppelganger');g.state.clue('driver_copy_n3','The delivery driver returned on Night 3, wearing the same vest. The original died on Night 1. This was a doppelganger.');g.state.note('Same face. Same clothes. No truck. It repeated the snack request exactly. Whatever came back was copying the dead driver.',g.minutes);g.saveNow();}
  async talk(){
    const g=this.g;if(!this.entity||this.talking||this.vanishIn>0||g.choices.open)return;this.talking=true;const token=this.generation,c=this.entity,frozen=g.player.frozen,enabled=g.interact.enabled;
    g.player.frozen=true;g.interact.enabled=false;releaseLock();g.ui.say('What the hell? I watched you die.',{secs:3});
    const answer=await g.choices.ask('delivery_doppelganger_n3',[
      {id:'identity',text:'Who are you? The driver is dead.'},
      {id:'truck',text:'Where is your truck?'},
      {id:'leave',text:'Get out. You are not him.'}
    ],{secs:0});
    if(token!==this.generation)return;g.player.frozen=frozen;g.interact.enabled=enabled;this.talking=false;if(answer===null||!c.group.parent||this.entity!==c)return;
    this.record();g.ui.say(answer==='truck'?"I'll wait right here.":"A bag of jerky would be great. I'll wait right here.",{who:'Delivery driver',secs:4});this.vanishIn=5;
  }
  update(dt){
    const g=this.g;
    if(g.state.night===3&&!g.skipDoppel&&g.mode==='play'&&!g.ui.focused&&g.minutes>=21*60+20&&!g.state.flag('delivery_doppelganger_seen'))void this.appear();
    if(this.entity?.dead){this.record();this.vanishIn=this.vanishIn||2.5;}
    if(this.vanishIn>0){this.vanishIn=Math.max(0,this.vanishIn-dt);if(this.vanishIn<=0&&this.entity){g.customers.despawn(this.entity);this.entity=null;g.audio.play('int_radio_static',{vol:.18});g.ui.say('No footsteps. No truck. That was not him.',{secs:3});}}
  }
  reset(){this.generation++;this.pending=false;this.vanishIn=0;this.talking=false;if(this.entity)this.g.customers.despawn(this.entity);this.entity=null;this.g.tasks.remove('doppelganger');}
}
