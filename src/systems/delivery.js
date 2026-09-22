import * as THREE from 'three';
import { DeliveryScare } from './delivery-scare.js';
import { Vehicle } from '../game/vehicles.js';
import { model, fitHeight, fitWidth, surface } from '../core/assets.js';
import { fillStockBox, sign } from '../world/additions.js';

// A delivery stays until both full cases are received and both empties are back aboard.
export class Delivery {
  constructor(game){
    this.g=game;this.generation=0;this.active=false;this.ready=false;this.vehicle=null;
    this.phase='cargo';this.driver=null;this.bodyCollider=null;
    this.received=[false,false];this.loaded=[false,false];this.cases=[];this.empties=[];this.emptyColliders=[];
  }
  async init(){
    const g=this.g;
    await this.initStory();this.scare=new DeliveryScare(this);await this.scare.init();
    this.bay=new THREE.Group();this.bay.name='delivery_receiving_bay';this.bay.position.set(-6.1,0,10.9);g.scene.add(this.bay);
    const pallet=await model('pallet',{shadows:true});fitWidth(pallet,1.15);this.bay.add(pallet);
    sign(g.scene,'STOCK RECEIVING\nFULL BOXES HERE',1.02,.36,[-6.1,1.35,11.84],Math.PI);
    g.station.colliders.push({x0:-6.72,x1:-5.48,z0:10.4,z1:11.4,y1:.5,label:'delivery:pallet',blockLow:true});
    this.stacks=[];
    for(let i=0;i<2;i++){
      const c=await model('cardbox',{shadows:true});fitHeight(c,.38);await fillStockBox(c);c.position.set(i? .25:-.25,.14,0);this.bay.add(c);c.visible=false;this.stacks.push(c);
      const visual=await model('crate1',{shadows:true});fitWidth(visual,.60);
      const e=new THREE.Group();e.name='return_crate_'+i;e.add(visual);e.position.set(i?-4.94:-5.68,.025,9.0);
      sign(e,'EMPTY '+(i+1),.45,.13,[0,.15,.228]);g.scene.add(e);e.visible=false;this.empties.push(e);
      this.emptyColliders.push({x0:e.position.x-.30,x1:e.position.x+.30,z0:8.775,z1:9.225,y1:.34,label:'delivery:empty_'+i,blockLow:true});
    }
    this.emptySign=sign(g.scene,'EMPTY RETURNS\nTAKE TO TRUCK',1.22,.45,[-5.32,1.45,8.14]);
    for(let i=0;i<2;i++){
      g.interact.add({id:'delivery_case_'+i,pos:()=>this.cases[i]?.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.22,0)),
        radius:2.6,aimCos:.86,label:'full delivery box '+(i+1),verb:'Take',
        enabled:()=>this.active&&this.ready&&!this.received[i]&&!g.inventory.has('delivery_case_'+i),
        onUse:()=>g.inventory.takeTool('delivery_case_'+i,'cardbox',.42,{label:'Full box '+(i+1),source:this.cases[i],filled:true,pickupText:'Full box taken. Go through STOCK to the receiving pallet and press E to place it. G puts it back only when beside the truck.'})});
      g.interact.add({id:'delivery_empty_'+i,pos:()=>this.empties[i].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.14,0)),
        targets:[this.empties[i]],radius:2.7,aimCos:.76,label:'empty return crate '+(i+1),verb:'Take',
        enabled:()=>this.active&&this.ready&&this.received.every(Boolean)&&!this.loaded[i]&&!g.inventory.has('delivery_empty_'+i),
        onUse:()=>g.inventory.takeTool('delivery_empty_'+i,'crate1',.28,{label:'Empty crate '+(i+1),source:this.empties[i],pickupText:'Empty crate taken. Return to the back of the truck and press E to load it. G puts it back only when beside its stockroom spot.',onCarry:()=>this.syncEmptyCollider(),onReturn:()=>this.syncEmptyCollider()})});
    }
    g.interact.add({id:'delivery_receive',pos:new THREE.Vector3(-6.1,.45,10.9),radius:2.5,aimCos:.84,label:'STOCK RECEIVING',verb:'Place a full box on',
      enabled:()=>this.active&&this.phase==='cargo'&&this.cargoIndex('delivery_case_',this.received)>=0,onUse:()=>this.receive()});
    g.interact.add({id:'delivery_load',pos:()=>this.loadingPoint(),radius:2.8,aimCos:.86,label:'the truck’s rear platform',verb:'Load an empty crate onto',
      enabled:()=>this.active&&this.ready&&this.phase==='cargo'&&this.cargoIndex('delivery_empty_',this.loaded)>=0,onUse:()=>this.load()});
  }
  async initStory(){
    const g=this.g;
    this.snack=await model('product_jerky_pouch',{shadows:true});fitHeight(this.snack,.18);this.snack.name='delivery_driver_snack';this.snack.position.set(8.25,.96,2.2);this.snack.visible=false;g.scene.add(this.snack);
    this.snackSign=sign(g.scene,"DRIVER'S SNACK",.46,.12,[7.13,1.15,2.2]);this.snackSign.rotation.y=-Math.PI/2;this.snackSign.visible=false;
    g.interact.add({id:'delivery_driver',pos:()=>this.driver?.group.position.clone().setY(1.30),radius:2.7,aimCos:.85,label:'the delivery driver',verb:()=>this.phase==='offer'?'Offer a snack to':'Talk to',priority:1,
      enabled:()=>this.ready&&!!this.driver&&['cargo','offer','snack'].includes(this.phase),onUse:()=>g.customers.talk(this.driver)});
    g.interact.add({id:'delivery_snack',pos:()=>this.snack.position.clone().add(new THREE.Vector3(0,.08,0)),radius:2.3,aimCos:.82,label:"the driver's snack",verb:'Take',priority:2,
      enabled:()=>this.active&&this.phase==='snack',onUse:()=>this.takeSnack()});
    g.interact.add({id:'delivery_body',pos:()=>this.bodyPoint?.clone(),radius:2.6,aimCos:.80,label:'the delivery driver',verb:'Check',priority:2,
      enabled:()=>['return','found','checked'].includes(this.phase)&&!!this.driver,onUse:()=>this.checkDriver()});
  }
  async createDriver(token){
    const c=await this.g.customers.spawn('DELIVERY',{name:'the delivery driver',height:1.80,build:1.1,coat:0x58634b,trousers:0x30363a,skin:0xb08c6e,detail:'vest',at:new THREE.Vector3(10,0,-8.4),rot:-.55});
    if(token!==this.generation){this.g.customers.despawn(c);return;}
    this.driver=c;c.group.visible=false;
    this.driverCollider=c.collider;this.g.station.colliders=this.g.station.colliders.filter(x=>x!==c.collider);c.collider=null;
  }
  showDriver(){if(!this.driver)return;this.driver.group.visible=true;if(this.phase==='cargo'||this.phase==='offer'||this.phase==='snack'){this.driver.collider=this.driverCollider;if(!this.g.station.colliders.includes(this.driverCollider))this.g.station.colliders.push(this.driverCollider);}}
  offerSnack(){
    if(this.phase==='cargo'){this.g.ui.say('Two cases in, two empties back. Then I can get out of your way.',{who:'Delivery driver',secs:4});return;}
    if(this.phase==='snack'){this.g.ui.say("The jerky by the coffee machine is fine. Thanks. I'll wait here.",{who:'Delivery driver',secs:4});return;}
    if(this.phase!=='offer')return;
    this.phase='snack';this.snack.visible=true;this.snackSign.visible=true;
    this.g.ui.say("Yeah, please. A bag of jerky would be great. I'll wait right here.",{who:'Delivery driver',secs:5});
    this.g.tasks.setText('driver_snack','Get the driver a snack — labelled bag beside the coffee machine');this.saveProgress();
  }
  async takeSnack(){
    if(this.phase!=='snack'||this.fetching)return;this.fetching=true;const token=this.generation;
    try{
      const item=await this.g.inventory.takeTool('delivery_snack','product_jerky_pouch',.18,{label:"Driver's snack",source:this.snack});
      if(!item||token!==this.generation)return;
      this.phase='return';this.snackSign.visible=false;this.makeBody();
      this.g.tasks.setText('driver_snack','Bring the snack outside — delivery bay beside the station');this.saveProgress();
    }finally{this.fetching=false;}
  }
  makeBody(){
    const g=this.g,c=this.driver;if(!c)return;
    this.vehicle?.dispose();this.g.audio.silenceTruckTraffic();this.ready=false;this.cases=[];
    g.station.colliders=g.station.colliders.filter(x=>x!==c.collider&&x!==this.bodyCollider);c.collider=null;c.path=[];c.state='dead';c.group.visible=true;
    // Bake a stable pose so this scripted discovery restores identically from a save.
    c.mixer?.stopAllAction();
    const idle=c.actions.Idle_Loop;if(idle){idle.reset().play();idle.time=.3;idle.paused=true;c.mixer.update(0);}
    c.group.updateMatrixWorld(true);
    const inverse=c.group.matrixWorld.clone().invert(),fallen=new THREE.Group();
    c.group.traverse(o=>{
      if(!o.isMesh)return;
      if(o.isSkinnedMesh)o.skeleton.update();
      const geo=o.geometry.clone(),positions=geo.attributes.position;
      for(let i=0;i<positions.count;i++){
        const v=new THREE.Vector3();o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld).applyMatrix4(inverse);positions.setXYZ(i,v.x,v.y,v.z);
      }
      positions.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
      const mesh=new THREE.Mesh(geo,o.material);mesh.castShadow=true;mesh.receiveShadow=true;fallen.add(mesh);
    });
    c.mixer=null;c.actions={};c.current='fallen';c.group.clear();c.group.scale.setScalar(1);fitHeight(fallen,1.80);c.group.add(fallen);fallen.rotation.x=Math.PI/2;fallen.rotation.z=.13;
    c.group.updateMatrixWorld(true);let b=new THREE.Box3().setFromObject(c.group);c.group.position.y+=.025-b.min.y;c.group.updateMatrixWorld(true);b.setFromObject(c.group);this.bodyPoint=b.getCenter(new THREE.Vector3());
    this.bodyCollider={x0:b.min.x-.04,x1:b.max.x+.04,z0:b.min.z-.04,z1:b.max.z+.04,y1:b.max.y,label:'delivery:driver_body',blockLow:true};g.station.colliders.push(this.bodyCollider);
    if(!this.blood)this.blood=g.station._bloodDecal(.55,.40,this.bodyPoint.x,.022,this.bodyPoint.z,0,'blood_small_pool');this.blood.visible=true;
  }
  driverShot(){
    this.vehicle?.dispose();this.g.audio.silenceTruckTraffic();this.ready=false;this.cases=[];
    this.phase='found';this.g.tasks.done('delivery');this.g.state.flag('delivery_complete_n1',true);
    this.snack.visible=false;this.snackSign.visible=false;
    this.bodyPoint=this.driver.group.position.clone().setY(.3);
    this.g.tasks.remove('driver_snack');this.g.tasks.add({id:'driver_snack',text:'Check the fallen driver — delivery bay'});
    this.saveProgress();
  }
  reveal(){
    if(this.phase!=='return')return;this.phase='found';
    this.g.ui.say("No... I was inside for a minute. Where's the truck?",{secs:4.5});this.g.audio.play('hum_breath',{vol:.5});
    this.g.tasks.setText('driver_snack','Check the driver on the ground — delivery bay');this.saveProgress();
  }
  checkDriver(){
    if(this.phase==='checked'){this.g.ui.say("Still no pulse. The truck's gone.",{secs:3});return;}
    this.reveal();this.phase='checked';this.active=false;this.g.tasks.done('driver_snack');this.g.state.flag('delivery_driver_found',true);
    this.g.state.note('The delivery driver accepted a snack. I went inside. When I came back, he was dead on the ground and his truck was gone.',this.g.minutes);
    this.g.ui.say("No pulse. He's dead. I only went to get him a snack.",{secs:5});this.scare.arm();this.saveProgress();
  }
  update(dt){
    this.scare.update(dt);
    if(this.phase!=='return'||!this.bodyPoint||this.g.mode!=='play'||this.g.ui.focused)return;
    const p=this.g.player.pos;if(p.z>0&&p.x<9)return;
    const delta=this.bodyPoint.clone().sub(this.g.camera.position),dist=delta.length();
    if(dist<6&&delta.normalize().dot(this.g.camera.getWorldDirection(new THREE.Vector3()))>.55)this.reveal();
  }
  loadingPoint(){
    if(!this.vehicle)return null;
    this.vehicle.group.updateWorldMatrix(true,false);
    return this.vehicle.group.localToWorld(new THREE.Vector3(0,.95,-3.55));
  }
  heldIndex(prefix){const kind=this.g.inventory.slots[this.g.inventory.selected]?.kind;return kind?.startsWith(prefix)?Number(kind.slice(prefix.length)):-1;}
  cargoIndex(prefix,done){
    // Delivery destinations accept carried stock even with the torch selected.
    const inv=this.g.inventory,selected=inv.slots[inv.selected];
    const valid=item=>item?.ready&&item.kind.startsWith(prefix)&&!done[Number(item.kind.slice(prefix.length))];
    const item=valid(selected)?selected:inv.slots.find(valid);
    return item?Number(item.kind.slice(prefix.length)):-1;
  }
  guidance(){
    if(!this.active||this.phase==='checked')return null;
    const g=this.g,inv=g.inventory;
    const stockRoute='Inside the shop, go through STOCK on the back-left wall. The receiving pallet is against the far wall.';
    const truckRoute='Outside: the truck is to the right when facing the shop. Walk around to its back platform, below the rear doors.';
    let next;
    if(this.phase==='cargo'){
      const received=this.received.filter(Boolean).length,loaded=this.loaded.filter(Boolean).length;
      const stock=this.cargoIndex('delivery_case_',this.received),empty=this.cargoIndex('delivery_empty_',this.loaded);
      if(!this.ready)return {title:'DELIVERY · TRUCK ARRIVING',action:'Wait for the truck to park.',route:'It is pulling into the bay to the right of the station.',control:'The driver will wait for you.',target:null};
      if(received<2){
        const title=`DELIVERY · 1/3 · FULL BOXES ${received}/2`;
        next=stock>=0?{title,action:'Place your full box on STOCK RECEIVING.',route:stockRoute,control:'Aim at the pallet and press E. G puts it back only when beside the truck.',target:'delivery_receive'}:
          {title,action:`Take full box ${this.received.findIndex(x=>!x)+1} from the truck.`,route:truckRoute,control:'Aim at a cardboard box on the platform and press E.',target:'delivery_case_'+this.received.findIndex(x=>!x),pickup:true};
      }else if(loaded<2){
        const title=`DELIVERY · 2/3 · EMPTY CRATES ${loaded}/2`;
        next=empty>=0?{title,action:'Load your empty crate onto the truck.',route:truckRoute,control:'Aim at the rear platform and press E. G puts it back only when beside its stockroom spot.',target:'delivery_load'}:
          {title,action:'Take an EMPTY return crate from the stockroom.',route:'Through STOCK: look for two labelled EMPTY crates side by side under the EMPTY RETURNS sign, just inside the doorway.',control:'Aim at an empty crate and press E.',target:'delivery_empty_'+this.loaded.findIndex(x=>!x),pickup:true};
      }
    }else if(this.phase==='offer')next={title:'DELIVERY · 3/3 · TALK TO DRIVER',action:'Offer the driver a snack.',route:'He is standing beside the parked truck.',control:'Press E to talk. Choose “Want a snack before you go?”',target:'delivery_driver'};
    else if(this.phase==='snack')next={title:'DRIVER’S SNACK · PICK UP',action:'Take the bag labelled DRIVER’S SNACK.',route:'Inside the shop, beside the coffee machine on the right-hand wall.',control:'Aim at the labelled bag of jerky and press E.',target:'delivery_snack',pickup:true};
    else if(this.phase==='return')next={title:'DRIVER’S SNACK · RETURN OUTSIDE',action:'Bring the snack back to the delivery bay.',route:'Go through the glass front doors and return to where the truck parked.',control:'Look for the driver beside the station.',target:'delivery_body'};
    else if(this.phase==='found')next={title:'DELIVERY BAY · CHECK DRIVER',action:'Check the driver on the ground.',route:'Go to the delivery bay outside, to the right of the shop.',control:'Look down at the driver and press E.',target:'delivery_body'};
    if(next?.pickup&&inv.slots.every(Boolean)){
      next={...next,action:'Make room: all four inventory slots are full.',route:'Put one item back at its original pickup spot first.',control:inv.spaceHint()};
    }
    return next||null;
  }
  async start(){
    if(this.active)return;
    if(this.g.state.flag('delivery_complete_n1')&&!this.g.state.data.delivery?.phase)return;
    const g=this.g,token=++this.generation;this.active=true;this.ready=false;
    const saved=g.state.data.delivery;this.phase=saved?.night===1?(saved.phase||'cargo'):'cargo';
    this.received=saved?.night===1?[...saved.received]:[false,false];this.loaded=saved?.night===1?[...saved.loaded]:[false,false];
    if(this.phase==='cargo')g.tasks.add({id:'delivery',text:'Stock truck arriving — unload 2 cases, then return 2 empty crates'});
    await this.createDriver(token);if(token!==this.generation)return;
    if(this.phase!=='cargo'){
      g.tasks.add({id:'driver_snack',text:this.phase==='offer'?'Offer the delivery driver a snack — beside the truck':this.phase==='snack'?'Get the driver a snack — labelled bag beside the coffee machine':this.phase==='return'?'Bring the snack outside — delivery bay beside the station':'Check the driver on the ground — delivery bay'});
      if(this.phase==='snack'){this.snack.visible=true;this.snackSign.visible=true;}
      if(['return','found','checked'].includes(this.phase)){
        this.stacks.forEach(o=>o.visible=true);this.makeBody();
        if(this.phase==='checked'){this.active=false;g.tasks.done('driver_snack');this.scare.restore(saved.scare||'watch');}
        else await g.inventory.takeTool('delivery_snack','product_jerky_pouch',.18,{label:"Driver's snack",source:this.snack});
        return;
      }
    }
    const bay={pos:new THREE.Vector3(12,0,-6),rot:0};
    const path=[[-40,0,-25],[16,0,-25],[14,0,-22],[12,0,-18],[12,0,-12],[12,0,-6]].map(p=>new THREE.Vector3(...p));
    const v=new Vehicle(g.vehicles,{vehicle:'vehicle_delivery'},bay,{path});
    this.vehicle=v;g.vehicles.list.push(v);
    await v.spawn();if(token!==this.generation||v.dead){v.dispose();return;}
    const lift=new THREE.Mesh(new THREE.BoxGeometry(1.7,.10,1.0),surface('assets/tex/nc/fabric_detail.png',{color:0x65716d}));
    lift.name='delivery_liftgate';lift.position.set(0,.70,-3.45);v.group.add(lift);
    v.workLight=new THREE.PointLight(0xffdfab,0,9,2);v.workLight.position.set(1.45,2.5,-3.0);v.group.add(v.workLight);
    const workLamp=new THREE.Mesh(new THREE.BoxGeometry(.20,.09,.08),new THREE.MeshBasicMaterial({color:0xffe0ae}));workLamp.position.set(.76,2.40,-2.96);v.group.add(workLamp);
    this.returned=[];
    for(let i=0;i<2;i++){
      const c=await model('cardbox',{shadows:true});fitHeight(c,.40);await fillStockBox(c);
      if(token!==this.generation||v.dead)return;
      c.name='delivery_cargo_'+i;c.position.set(i?.43:-.43,.75,-3.45);v.group.add(c);c.visible=!this.received[i];this.cases[i]=c;
      const e=await model('crate1',{shadows:true});fitWidth(e,.42);e.position.copy(c.position);e.visible=this.loaded[i];v.group.add(e);this.returned.push(e);
      this.stacks[i].visible=this.received[i];this.empties[i].visible=!this.loaded[i];
    }
    const parked=()=>{if(token!==this.generation||v.dead)return;this.ready=true;this.showDriver();v.workLight.intensity=6;g.audio.play('veh_truck_airbrake',{vol:.55,pos:bay.pos});g.ui.toast('Delivery truck is parked to the right of the station. Take its two stock cases to STOCK RECEIVING in the stockroom.');this.refresh();};
    v.onParked=parked;if(v.state==='WAITING')parked();
    this.syncEmptyCollider();
    g.ui.toast('A supply truck is pulling in. It will wait beside the station.');
    this.refresh();
  }
  receive(){
    const i=this.cargoIndex('delivery_case_',this.received);if(!this.active||this.phase!=='cargo'||i<0)return;
    this.g.inventory.remove('delivery_case_'+i);this.received[i]=true;this.cases[i].visible=false;this.stacks[i].visible=true;
    this.g.audio.play('int_box_cardboard',{vol:.55});this.refresh();
    this.g.ui.toast(this.received.every(Boolean)?'Both cases received. Take the two empty crates beside this pallet back to the truck.':'First case received. One more case is on the truck.');
    this.saveProgress();
  }
  load(){
    const i=this.cargoIndex('delivery_empty_',this.loaded);if(!this.active||!this.ready||this.phase!=='cargo'||i<0)return;
    this.g.inventory.remove('delivery_empty_'+i);this.loaded[i]=true;this.empties[i].visible=false;this.returned[i].visible=true;this.syncEmptyCollider();
    this.g.audio.play('int_box_cardboard',{vol:.55});this.refresh();this.saveProgress();
    if(this.loaded.every(Boolean)){
      this.g.state.flag('delivery_complete_n1',true);this.g.tasks.done('delivery');
      this.g.state.note('Received two stock cases and loaded two empty crates onto the delivery truck.',this.g.minutes);
      this.phase='offer';this.g.tasks.add({id:'driver_snack',text:'Offer the delivery driver a snack — beside the truck'});
      this.g.ui.toast('Delivery complete. The driver is waiting beside the truck. Press E to talk, then choose a reply.');this.saveProgress();
      this.removeEmptyCollider();
    }
  }
  refresh(){
    if(this.phase!=='cargo')return;
    const received=this.received.filter(Boolean).length,loaded=this.loaded.filter(Boolean).length;
    this.g.tasks.setText('delivery',!this.ready?'Delivery truck arriving — right side of the station':received<2?`Delivery 1/3: full boxes → STOCK RECEIVING — ${received}/2`:`Delivery 2/3: empty crates → truck’s rear platform — ${loaded}/2`);
  }
  saveProgress(){this.g.state.data.delivery={night:1,received:[...this.received],loaded:[...this.loaded],phase:this.phase,scare:this.scare.phase,scareHits:this.scare.hits,scarePosition:this.scare.figure.position.toArray(),scarePower:this.scare.powerBefore||null};this.g.saveNow();}
  syncEmptyCollider(){
    this.removeEmptyCollider();
    this.empties.forEach((e,i)=>{
      e.visible=this.active&&this.phase==='cargo'&&!this.loaded[i]&&!this.g.inventory.has('delivery_empty_'+i);
      if(e.visible)this.g.station.colliders.push(this.emptyColliders[i]);
    });
  }
  removeEmptyCollider(){this.g.station.colliders=this.g.station.colliders.filter(c=>!this.emptyColliders.includes(c));}
  reset(){
    this.scare?.reset();this.generation++;this.active=false;this.ready=false;this.g.audio.truckSilenced=false;this.vehicle?.dispose();this.vehicle=null;this.cases=[];
    this.removeEmptyCollider();
    if(this.driver)this.g.customers.despawn(this.driver);this.driver=null;
    this.g.station.colliders=this.g.station.colliders.filter(c=>c!==this.bodyCollider);this.bodyCollider=null;this.bodyPoint=null;
    this.blood?.removeFromParent();this.blood=null;this.phase='cargo';
    for(const item of [...this.g.inventory.slots])if(item?.kind.startsWith('delivery_'))this.g.inventory.remove(item.kind);
    for(const o of [...this.stacks,...this.empties,this.snack,this.snackSign])o.visible=false;
  }
}
