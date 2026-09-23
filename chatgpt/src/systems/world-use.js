import * as THREE from 'three';
import { PRODUCTS } from '../world/products.js';
import { money } from '../core/util.js';
import { ADDITIONS } from '../world/addition-shapes.js';
import { makeAddition } from '../world/additions.js';

const INFO={
  register:['cash register','Cash is counted here. Keep the drawer shut between customers.'],
  notepads:['receipt pads','Spare receipt pads. Carbon paper stains the fingers.'],binder:['shift binder','Old shift sheets, supply orders and pencilled meter totals.'],
  wallclock:['wall clock','The second hand ticks louder when the shop is empty.'],cigpack:['cigarettes','Sealed packs, faced neatly behind the till.',210],
  flashlight:['spare flashlight','Your flashlight is in inventory slot 1. Press F to bring it out.'],
  coffeemachine:['coffee machine','The glass is heat-stained. The warmer smells of old coffee.'],trashcan:['waste bin','A liner, discarded receipts and empty cups.'],
  extinguisher:['fire extinguisher','The gauge is in the green. The inspection tag is up to date.'],firealarm:['fire alarm','Emergency alarm. The test seal is intact.'],
  chips:['potato chips','Salted chips. The sealed bag crackles when handled.',99],snack:['snack packet','A sealed snack packet from the latest delivery.',79],
  cardbox:['stock box','Full cases of coffee, drinks and cup noodles. Take the marked case when restocking.'],crate1:['delivery crate','Delivery stock, packed tightly for the next shift.'],crate2:['delivery crate','Sealed products are visible between the crate slats.'],
  pallet:['wooden pallet','A heavy pallet with splintered corners.'],handtruck:['hand truck','The wheels squeak. Ready for the next delivery.'],ladder:['ladder','Folded and parked out of the walking route.'],
  toolbox:['toolbox','A socket set, spare fuses and two rolls of electrical tape.'],wrench:['wrench','A heavy adjustable wrench.'],broom:['broom','Worn bristles, still good for the shop floor.'],
  bucket:['mop bucket','Dirty water and a metal wringer.'],mop:['mop','The mop belongs beside its bucket.'],wetfloor:['wet-floor sign','CAUTION — WET FLOOR.'],
  powerbox:['breaker cabinet','The circuits are labelled inside the panel.'],utilbox:['junction box','The wiring cover is fastened shut.'],shelf:['storage shelf','Delivery stock and station supplies.'],cleaner:['cleaning solution','Disinfectant. The label is worn where someone grips it.'],
  ceilingfan:['ceiling fan','The blades turn slowly above the shop.'],pump:['fuel pump','The nozzle is seated. The meter can be read during the pump check.'],
  payphone:['payphone','A heavy receiver and scratched coin slot.'],cone:['traffic cone','A scuffed orange cone marking the edge of the apron.'],
  desk:['office desk','Shift paperwork and the security screens.'],officechair:['office chair','A worn swivel chair with one squeaking wheel.'],chair:['chair','Worn upholstery and a solid frame.'],stool:['stool','A low stool for the long quiet hours.'],
  alarmclock:['desk clock','An old alarm clock. The alarm is switched off.'],cabinet:['filing cabinet','Shift records and service invoices.'],computer:['office computer','A dusty workstation. The fan hums steadily.'],
  camera1:['security camera','Its lens faces the station approach.'],camera2:['security camera','Its feed runs to the office monitors.'],
  trashbag:['bin bag','Tie the liner before taking it to the outside dumpster.'],dumpster:['dumpster','Heavy metal lid. Bags go here at the end of the shift.'],
  radio:['radio','A low hiss between distant stations.'],boombox:['radio','A low hiss between distant stations.'],cooler:['drinks cooler','Cold bottles behind glass.'],
};
export class WorldUse {
  constructor(game){
    this.g=game;this.tapUntil=0;this.flushUntil=0;
    const I=game.interact,S=game.station;
    for(const [i,p] of S.inspectables.entries()){
      const product=PRODUCTS.find(x=>x.key===p.key);
      const info=INFO[p.key]||[p.key.replace(/_/g,' '),'Station equipment. Worn from years of night shifts, but still in place.'];
      const label=product?`${product.brand} ${product.name}`:info[0];
      const priceCents=product?.priceCents??info[2];
      const description=product?'Sealed stock, ready for sale.':info[1];
      const inspection=Number.isInteger(priceCents)?`${label} · Price: ${money(priceCents)} each. ${description}`:description;
      I.add({id:'inspect_'+i,pos:p.position,bounds:p.bounds,radius:2.25,priority:-2,
        label,verb:'Inspect',enabled:()=>p.merged||p.object.visible,
        onUse:()=>{
          game.audio.play(product?'int_paper_handle':'int_keys',{vol:.16});
          game.ui.toast(inspection);
        }});
    }
    for(const poster of S.posters||[])I.add({id:'read_'+poster.name,pos:poster.position,targets:[poster],radius:2.3,label:poster.userData.posterText.split(' · ')[0],verb:'Read poster',onUse:()=>{const panel=document.createElement('div');panel.className='paper';panel.style.cssText='max-width:480px;max-height:80vh;overflow:auto;background:#ddceb0;padding:25px;color:#202820';const img=document.createElement('img');img.src=poster.material.map.image.toDataURL();img.alt=poster.userData.posterText;img.style.width='100%';panel.append(img);game.ui.openFocus(panel);}});
    const fixture=(id,name,verb,onUse)=>{
      const o=S.usableProps[id];
      I.add({id:'use_'+id,pos:()=>new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()),targets:[o],radius:2.3,label:name,verb,onUse,enabled:()=>o.visible});
    };
    fixture('bathroom_sink','the sink','Wash hands',()=>{this.tapUntil=performance.now()+4200;S.tapWater.visible=true;game.audio.play('int_sink',{vol:.45});game.ui.toast('Cold water. The tap rattles, then runs clear.');});
    fixture('bathroom_toilet','the toilet','Flush',()=>{if(this.flushUntil>performance.now())return;this.flushUntil=performance.now()+3500;game.audio.play('int_toilet',{vol:.45});game.ui.toast('The cistern drains and refills.');});
    fixture('bathroom_mirror','the mirror','Look',()=>game.ui.toast('A tired face in clouded, scratched glass.'));
    fixture('bathroom_paper','the toilet paper','Check',()=>game.ui.toast('There is enough on the roll for tonight.'));
    fixture('bathroom_towels','the paper towels','Take a towel',()=>{game.audio.play('int_paper_handle',{vol:.4});game.ui.toast('You dry your hands and put the towel in the bin.');});
    fixture('bathroom_soap','the soap dispenser','Use',()=>{game.audio.play('int_lightswitch',{vol:.15});game.ui.toast('A little soap. Wash it off at the sink.');});
    fixture('cashier_shotgun','the cashier shotgun','Take',()=>game.inventory.takeTool('shotgun',null,.18,{source:S.usableProps.cashier_shotgun,make:()=>makeAddition(ADDITIONS.find(d=>d.name==='cashier_shotgun'))}));
    const broom=game.scene.getObjectByName('prop_broom');
    if(broom){const bounds=new THREE.Box3().setFromObject(broom);I.add({id:'take_broom',pos:bounds.getCenter(new THREE.Vector3()),bounds,radius:2.2,label:'the broom',verb:'Take',enabled:()=>broom.visible,onUse:()=>game.chores.take('broom','broom',1.2)});}
    // The existing job shares the actual fixtures, so checking the bathroom is visible.
    const check=I.get('bathcheck');if(check){check.targets=[S.usableProps.bathroom_toilet,S.usableProps.bathroom_sink];check.priority=1;check.radius=2.4;}
    this.guide=document.createElement('div');this.guide.id='clockGuide';game.ui.hud.append(this.guide);
  }
  update(){
    const g=this.g,now=performance.now();g.station.tapWater.visible=now<this.tapUntil;
    const water=g.station.usableProps.bathroom_toilet.getObjectByName('bowl_water');
    water.scale.y=now<this.flushUntil?.008:.018;
    const crashId=['crash_site','investigate'].find(id=>g.tasks.has(id)&&!g.tasks.isDone(id));
    if(crashId){const spot=g.interact.get(crashId),point=spot&&g.interact.posOf(spot);if(point){const d=point.clone().sub(g.player.pos);d.y=0;const f=g.camera.getWorldDirection(new THREE.Vector3());f.y=0;f.normalize();const angle=Math.atan2(d.x*-f.z+d.z*f.x,d.dot(f));const side=Math.abs(angle)<.6?'ahead':Math.abs(angle)>2.4?'behind you':angle>0?'to your right':'to your left';this.guide.hidden=false;this.guide.textContent=`${crashId==='crash_site'?'CRASH SITE · OPTIONAL':'CHECK CRASH SOUND'} · ${Math.round(d.length())} m · ${side}\nLeave through the glass front doors. Go past the pumps toward the road, then LEFT along the forecourt. Follow the orange ! and press E at the roadside ditch.`;return;}}
    const needsIn=g.tasks.has('clock_in')&&!g.tasks.isDone('clock_in');
    const needsOut=g.chores.lockedUp&&g.tasks.has('lockup')&&!g.tasks.isDone('lockup');
    const spill=g.chores.spill,cleaning=!!spill&&g.tasks.has('clean')&&!g.tasks.isDone('clean');
    const delivery=g.delivery?.guidance();
    const showDelivery=!!delivery&&!(cleaning&&g.inventory.equipped('mop'));
    this.guide.hidden=!(needsIn||needsOut||cleaning||showDelivery);
    if(needsIn||needsOut){
      const distance=g.player.pos.distanceTo(new THREE.Vector3(1.72,0,7.4));
      this.guide.textContent=`CLOCK ${needsIn?'IN':'OUT'} · ${Math.round(distance)} m\n${g.player.pos.z<0?'Enter through the glass front doors. ':''}Find the green CLOCK IN / OUT sign on the shop’s back wall, beside OFFICE. Aim at the machine and press E.`;
    } else if(showDelivery){
      const spot=delivery.target&&g.interact.get(delivery.target),point=spot&&g.interact.posOf(spot);
      let bearing='';
      if(point){
        const delta=point.clone().sub(g.player.pos);delta.y=0;
        const forward=g.camera.getWorldDirection(new THREE.Vector3());forward.y=0;forward.normalize();
        const angle=Math.atan2(delta.x*(-forward.z)+delta.z*forward.x,delta.dot(forward));
        const direction=Math.abs(angle)<.60?'ahead':Math.abs(angle)>2.40?'behind you':angle>0?'to your right':'to your left';
        bearing=`\nTARGET · ${delta.length()<1?'right here':Math.round(delta.length())+' m · '+direction}`;
      }
      this.guide.textContent=`${delivery.title}\nNEXT: ${delivery.action}\n${delivery.route}\n${delivery.control}${bearing}`;
    } else if(cleaning){
      const delta=spill.pos.clone().sub(g.player.pos);delta.y=0;
      const forward=g.camera.getWorldDirection(new THREE.Vector3());forward.y=0;forward.normalize();
      const angle=Math.atan2(delta.x*(-forward.z)+delta.z*forward.x,delta.dot(forward));
      const direction=Math.abs(angle)<.60?'ahead':Math.abs(angle)>2.40?'behind you':angle>0?'to your right':'to your left';
      const distance=Math.hypot(delta.x,delta.z);
      this.guide.textContent=`SPILL ${(g.chores.cleanDone||0)+1}/${g.chores.cleanTotal} · ${distance<1?'right here':Math.round(distance)+' m · '+direction}
${spill.place}.
${g.chores.mopInstructions()}`;
    }
  }
}
