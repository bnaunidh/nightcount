import * as THREE from 'three';
import { inputBus } from '../core/input.js';
import { fillStockBox } from '../world/additions.js';
import { model, fitHeight } from '../core/assets.js';

const LABELS = {torch:'Flashlight',box:'Stock box',mop:'Mop',broom:'Broom',trash:'Bin bag',shotgun:'Shotgun'};
const SOURCES = {box:'prop_restockbox',mop:'prop_mop',broom:'prop_broom',trash:'prop_trashbag',shotgun:'cashier_shotgun'};
const RETURN_SPOTS = {box:'restockbox',mop:'bucket',broom:'take_broom',trash:'trashbag',shotgun:'use_cashier_shotgun'};
const RETURN_NAMES = {box:'the stock-box stack through STOCK',mop:'the cleaning corner through OFFICE',broom:'the cleaning corner through OFFICE',trash:'the shop bin',shotgun:'the cashier shotgun rack',delivery_snack:'the labelled snack spot beside the coffee machine'};
const RETURN_REACH = 2.25;
export class Inventory {
  constructor(game) {
    this.g=game; this.slots=[null,null,null,null]; this.selected=-1;
    this.node=document.createElement('div');this.node.id='inventory';
    this.node.setAttribute('aria-label','Four inventory slots');
    game.ui.hud.append(this.node);
    inputBus.on('press',code=>{
      if(game.mode!=='play'||game.ui.focused||game.choices?.open||game.paused||game.player.frozen) return;
      if(/^Digit[1234]$/.test(code)){this.equip(Number(code.slice(-1))-1);if(code==='Digit2')game.phone.openCell();}
      if(code==='Digit0') this.equip(-1);
      if(code==='KeyG') this.putBack();
    });
    this.render();
  }
  get(kind){return this.slots.find(i=>i?.kind===kind);}
  has(kind){return !!this.get(kind);}
  equipped(kind){return this.slots[this.selected]?.kind===kind;}
  addTorch(){
    if(!this.has('phone'))this.slots[1]={kind:'phone',label:'Cellphone',persistent:true,ready:true};
    if(this.has('torch')){this.render();return true;}
    const slot=0;if(this.slots[slot])return false;
    this.slots[slot]={kind:'torch',label:'Flashlight',persistent:true};this.render();return true;
  }
  async takeTool(kind,key,height=.35,options={}) {
    const existing=this.get(kind);
    if(existing){this.equip(this.slots.indexOf(existing));return existing.ready?existing:existing.promise;}
    const slot=this.slots.indexOf(null);
    if(slot<0){this.g.ui.toast(this.spaceHint());return null;}
    const source=options.source || this.g.scene.getObjectByName(SOURCES[kind]||'');
    const item={kind,label:options.label||LABELS[kind]||kind,source,returnSpot:RETURN_SPOTS[kind]||kind,onCarry:options.onCarry,onReturn:options.onReturn,object:null,ready:false};
    this.slots[slot]=item;this.equip(slot);
    item.promise=(async()=>{
      const o= options.make ? options.make() : await model(key,{shadows:false});
      fitHeight(o,height);
      if(kind==='box'||options.filled)await fillStockBox(o);
      o.name='held_'+kind;
      o.position.set(.20,-.28,-.50);o.rotation.set(.15,.5,0);
      if(kind==='broom'||kind==='mop')o.position.set(.32,-.85,-.65);
      if(kind==='shotgun'){o.rotation.set(.08,-.10,0);o.position.set(.19,-.23,-.48);o.traverse(m=>{if(!m.isMesh)return;const held=mat=>new THREE.MeshBasicMaterial({map:mat.map,color:mat.color.clone().multiplyScalar(.65),side:mat.side});m.material=Array.isArray(m.material)?m.material.map(held):held(m.material);});}
      if(!this.slots.includes(item))return null;
      item.object=o;item.ready=true;this.g.camera.add(o);
      if(source){
        source.visible=false;
        item.colliders=this.g.station.colliders.filter(c=>c.label==='prop:'+source.name);
        this.g.station.colliders=this.g.station.colliders.filter(c=>!item.colliders.includes(c));
      }
      item.onCarry?.();
      this.sync();
      this.g.audio.play(({box:'int_box_cardboard',mop:'int_mop_bucket',trash:'int_trashbag',broom:'int_broom'})[kind]||'int_keys',{vol:.35});
      this.g.ui.toast(options.pickupText||`${item.label} · 1 / 2 / 3 / 4 to switch · G to put back when nearby`);
      return item;
    })();
    try{return await item.promise;}catch(error){this.remove(kind);console.error('[inventory]',error);return null;}
  }
  equip(slot){
    if(slot>=0&&!this.slots[slot]){this.g.ui.toast('Empty inventory slot.');return;}
    this.selected=slot;
    if(this.g.torch&&!this.equipped('torch')){this.g.torch.on=false;this.g.torch._killGeneration++;}
    this.sync();
  }
  sync(){
    for(let i=0;i<this.slots.length;i++){const item=this.slots[i];if(item?.object)item.object.visible=i===this.selected;}
    const active=this.slots[this.selected];
    if(this.g.chores)this.g.chores.held=active?.ready?active:null;
    this.g.player.speedScale=(active?.kind==='box'||active?.kind.startsWith('delivery_case_'))?.78:active&&active.kind!=='torch'?.92:1;
    this.g.torch?.update(0);this.render();
  }
  remove(kind){
    const slot=this.slots.findIndex(i=>i?.kind===kind);if(slot<0)return;
    const item=this.slots[slot];item.object?.removeFromParent();
    if(item.source){item.source.visible=true;for(const c of item.colliders||[])if(!this.g.station.colliders.includes(c))this.g.station.colliders.push(c);}
    this.slots[slot]=null;if(this.selected===slot)this.selected=-1;this.sync();
    item.onReturn?.();
  }
  returnName(item){
    if(item.kind.startsWith('delivery_case_'))return 'the truck’s rear platform';
    if(item.kind.startsWith('delivery_empty_'))return 'the empty-crate spot through STOCK';
    return RETURN_NAMES[item.kind]||'its original pickup spot';
  }
  returnPoint(item){
    if(item.source){
      // A moving truck's cargo returns to the truck's current position. A
      // departed vehicle is no longer a usable destination.
      let root=item.source;while(root.parent)root=root.parent;
      if(root!==this.g.scene)return null;
      item.source.updateWorldMatrix(true,true);
      const bounds=new THREE.Box3().setFromObject(item.source);
      return bounds.isEmpty()?item.source.getWorldPosition(new THREE.Vector3()):bounds.getCenter(new THREE.Vector3());
    }
    // Some task items, such as the bin liner, are pickups without a separate
    // world mesh. Their registered interaction still defines a physical home.
    const spot=this.g.interact.get(item.returnSpot);
    return spot?this.g.interact.posOf(spot)?.clone():null;
  }
  spaceHint(){
    let slot=this.selected;
    if(!this.slots[slot]||this.slots[slot].persistent)slot=this.slots.findIndex(i=>i&&!i.persistent);
    const item=this.slots[slot];
    return item?`All 4 slots are full. Take ${item.label} back to ${this.returnName(item)}. Press ${slot+1} to select it, then G when nearby.`:'All 4 slots are full. Return an item to its pickup spot first.';
  }
  putBack(){
    const item=this.slots[this.selected];if(!item){this.g.ui.toast('Select an item with 1, 2, 3 or 4 first.');return false;}
    if(item.persistent){this.equip(-1);this.g.ui.toast(item.kind==='phone'?'Cellphone stowed. Press 2 to call.':'Flashlight stowed. F brings it out.');return true;}
    if(!item.ready){this.g.ui.toast('Wait for the item to finish being picked up.');return false;}
    let point=this.returnPoint(item);
    if(!point){this.g.ui.toast('That pickup spot is no longer available. The item stays in your inventory.');return false;}
    // Reach the exposed surface of the original object, not a centre hidden
    // underneath another crate in a stack.
    if(item.source){const bounds=new THREE.Box3().setFromObject(item.source);if(!bounds.isEmpty())point=bounds.clampPoint(this.g.camera.position,new THREE.Vector3());}
    const distance=this.g.camera.position.distanceTo(point);
    if(distance>RETURN_REACH){this.g.ui.toast(`Move closer to ${this.returnName(item)} (${Math.round(distance)} m away), then press G.`);return false;}
    const spot={id:'return:'+item.kind,pos:point};
    this.g.interact._sightCache?.delete(spot.id);
    if(!this.g.interact._clearSight(spot,point)){this.g.ui.toast('The return spot is blocked. Move around the obstacle or open the door first.');return false;}
    this.remove(item.kind);this.g.ui.toast(`${item.label} returned to its original spot.`);return true;
  }
  clearChores(){for(const item of [...this.slots])if(item&&!item.persistent)this.remove(item.kind);this.equip(-1);}
  render(){
    this.node.replaceChildren();
    const row=document.createElement('div');row.className='inventory-slots';
    this.slots.forEach((item,i)=>{const slot=document.createElement('div');slot.className='inventory-slot'+(this.selected===i?' selected':'');slot.setAttribute('aria-label',`Slot ${i+1}: ${item?.label||'empty'}${this.selected===i?', equipped':''}`);const key=document.createElement('b');key.textContent=i+1;const label=document.createElement('span');label.textContent=item?.label||'Empty';slot.append(key,label);row.append(slot);});
    const help=document.createElement('div');help.className='inventory-help';help.textContent='1–4 equip · 2 phone · G return nearby · F light · SHIFT sprint';this.node.append(row,help);
  }
}
