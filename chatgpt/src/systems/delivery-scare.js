import * as THREE from 'three';
import { model, fitHeight } from '../core/assets.js';
import { settings } from '../core/settings.js';

// Original distant silhouette, built locally from editable low-poly shapes.
export class DeliveryScare {
  constructor(delivery){
    this.delivery=delivery;this.g=delivery.g;this.phase='off';this.t=0;this.hits=0;this.stagger=0;this.screamIn=5;this.path=[];this.pathIn=0;
    this.figure=new THREE.Group();this.figure.name='pale_roadside_figure';this.figure.position.set(18,0,-24);
    this.figure.rotation.y=-.50;this.figure.visible=false;this.g.scene.add(this.figure);
    this.light=new THREE.PointLight(0xd3e2dc,3.5,5,1.2);this.light.position.set(18,2.8,-22.9);this.light.visible=false;this.g.scene.add(this.light);
    this.collider={x0:17.7,x1:18.3,z0:-24.3,z1:-23.7,y1:2.5,label:'delivery:roadside_figure'};
    this.banner=document.createElement('div');this.banner.id='delivery-run';this.banner.hidden=true;this.g.ui.hud.append(this.banner);
    this.g.interact.add({id:'delivery_safety',pos:new THREE.Vector3(5.1,1.25,0),radius:3,label:'the station entrance',verb:'Open',enabled:()=>this.phase==='run',onUse:()=>this.g.station.setDoor('entry',true)});
  }
  async init(){
    this.visual=await model('roadside_creature',{shadows:true,variant:false});fitHeight(this.visual,2.6);this.visual.name='reference_creature_model';
    this.visual.traverse(o=>{if(!o.isMesh)return;for(const mat of (Array.isArray(o.material)?o.material:[o.material])){
      if(mat.name.includes('Clouded white eyes')){mat.emissive.setHex(0xb4c2b9);mat.emissiveIntensity=.45;}
      else if(mat.map){mat.emissive.setHex(0x111412);mat.emissiveIntensity=.55;}
    }});
    this.figure.add(this.visual);this.figure.userData.referenceMesh=true;this.syncCollider();
  }
  restore(phase='watch'){
    this.visual.rotation.set(0,0,0);this.t=0;this.screamIn=2;
    this.hits=Math.min(3,this.g.state.data.delivery?.scareHits||0);this.stagger=0;this.path=[];this.pathIn=0;
    this.phase=phase;this.figure.position.set(...(phase==='defend'?[5.1,0,-4.0]:[18,0,-24]));this.figure.rotation.set(0,-.50,0);this.figure.visible=['watch','run','defend'].includes(phase);this.light.position.copy(this.figure.position).add(new THREE.Vector3(0,2.8,1.1));this.syncCollider();this.light.visible=this.figure.visible;
    if(this.figure.visible&&!this.g.station.colliders.includes(this.collider))this.g.station.colliders.push(this.collider);
    if(['watch','run','defend'].includes(phase))this.g.tasks.add({id:'driver_escape',text:phase==='run'?'RUN — get inside the station':'Something is by the road, beyond the empty delivery bay'});
    if(phase==='run')this.activateRun(false);
    if(phase==='defend')void this.blackout(true);
    if(phase==='safe'){this.g.tasks.add({id:'driver_escape',text:'Get back inside the station'});this.g.tasks.done('driver_escape');}
  }
  arm(){if(this.phase!=='off')return;this.restore('watch');this.g.audio.play('hor_metal_far',{vol:.4,pos:this.figure.position,scare:true});}
  activateRun(sound=true){
    this.phase='run';this.g.player.emergencyRun=true;this.banner.hidden=false;
    this.g.tasks.setText('driver_escape','RUN — get inside the station');
    this.g.station.doors.get('entry').locked=false;this.g.station.setDoor('entry',true);
    if(sound){this.g.audio.play('hum_scream_far',{vol:.65,pos:this.figure.position,scare:true});this.g.ui.say('Run. Get inside. Now.',{secs:3});this.delivery.saveProgress();}
    this.renderBanner();
  }
  renderBanner(){
    const key=settings.keys.sprint==='ShiftLeft'?'SHIFT':settings.keys.sprint.replace('Key','').replace('Digit','');
    const metres=Math.ceil(Math.hypot(this.g.player.pos.x-5.1,this.g.player.pos.z));
    this.banner.innerHTML='<strong>RUN — GET INSIDE</strong><span>Hold '+key+' + W · Front entrance · '+metres+' m</span>';
  }
  syncCollider(){const b=new THREE.Box3().setFromObject(this.figure);if(!b.isEmpty())Object.assign(this.collider,{x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,y1:b.max.y});}
  async blackout(resume=false){
    if(this.phase==='defend'&&!resume)return;
    this.phase='defend';this.g.player.emergencyRun=false;
    this.powerBefore=this.g.state.data.delivery?.scarePower||{on:{...this.g.power.on},mainTripped:this.g.power.mainTripped,serviceOff:this.g.power.serviceOff};
    this.musicBefore=this.g.music.playing;this.g.power.serviceOff=true;this.g.power.flicker=0;this.g.power.apply();this.g.music.play('blackout');
    this.figure.visible=true;this.light.visible=true;this.figure.position.set(5.1,0,-4);
    const saved=this.g.state.data.delivery?.scarePosition;if(resume&&Array.isArray(saved)&&saved.length===3&&saved.every(Number.isFinite))this.figure.position.fromArray(saved);
    this.stagger=resume?1.5:7;this.path=[];this.pathIn=0;this.figure.rotation.y=0;this.light.position.set(5.1,2.8,-2.9);this.syncCollider();
    this.g.station.setDoor('entry',true);this.banner.hidden=false;
    this.g.tasks.setText('driver_escape','Get the cashier shotgun — repel the figure with THREE hits (R reload)');
    if(!resume){this.g.audio.play(this.g.audio.has('nc_power_cut')?'nc_power_cut':'int_breaker',{vol:.6,scare:true});this.g.ui.say('The lights. All of them. Get the shotgun behind the counter.',{secs:5});}
    this.g.inventory.remove('delivery_snack');const token=this.delivery.generation;
    await this.g.torch.take({quiet:true});if(token!==this.delivery.generation||this.phase!=='defend')return;
    if(!this.g.inventory.equipped('shotgun'))this.g.torch.toggle(true);
    this.renderDefend();this.delivery.saveProgress();
  }
  renderDefend(){this.banner.innerHTML=this.g.inventory.has('shotgun')?'<strong>SHOOT THE FIGURE</strong><span>Equip the shotgun · Left click fire · R reload · '+(3-this.hits)+' hits left · It can enter the shop</span>':'<strong>THE LIGHTS ARE OUT</strong><span>Shotgun behind cashier · F flashlight · G put back an item if full</span>';}
  screech(){this.g.audio.play('hum_scream_far',{vol:.45,pos:this.figure.position,rate:.78+Math.random()*.22,scare:true});this.screamIn=5+Math.random()*3;}
  hit(){
    if(this.phase==='run'){this.g.ui.toast('Too far away. Get inside!');return false;}
    if(this.phase!=='defend')return false;
    this.hits++;this.stagger=2.1;this.screech();this.pathIn=0;
    if(this.hits>=3){this.g.state.flag('delivery_figure_shot',true);this.finish();}
    else{this.g.ui.toast(`It is still coming — ${3-this.hits} more hits. R to reload.`);this.renderDefend();this.delivery.saveProgress();}
    return true;
  }
  blocked(x,z){
    return this.g.station.colliders.some(c=>{if(c===this.collider||(!c.blockLow&&c.y1<.45))return false;const dx=x-Math.max(c.x0,Math.min(x,c.x1)),dz=z-Math.max(c.z0,Math.min(z,c.z1));return dx*dx+dz*dz<.27*.27;});
  }
  routeToPlayer(){
    // A small breadth-first grid follows actual walls, shelving and door leaves.
    const step=.5,minX=-8.5,minZ=-5,W=35,H=35,key=(x,z)=>z*W+x;
    const node=v=>[Math.max(0,Math.min(W-1,Math.round((v.x-minX)/step))),Math.max(0,Math.min(H-1,Math.round((v.z-minZ)/step)))];
    const start=node(this.figure.position),goal=node(this.g.player.pos),parents=new Int32Array(W*H).fill(-1),queue=[start],skey=key(...start);parents[skey]=skey;
    let best=start,bestDist=Infinity;
    for(let i=0;i<queue.length;i++){const [x,z]=queue[i],dist=(x-goal[0])**2+(z-goal[1])**2;if(dist<bestDist){best=[x,z];bestDist=dist;}if(dist===0)break;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=W||nz>=H||parents[key(nx,nz)]!==-1||this.blocked(minX+nx*step,minZ+nz*step))continue;parents[key(nx,nz)]=key(x,z);queue.push([nx,nz]);}
    }
    let n=key(...best),path=[];while(n!==skey&&n>=0){path.push(new THREE.Vector3(minX+n%W*step,0,minZ+Math.floor(n/W)*step));n=parents[n];}
    this.path=path.reverse();
  }
  pursue(dt){
    this.screamIn-=dt;if(this.screamIn<=0)this.screech();
    if(this.stagger>0){this.stagger=Math.max(0,this.stagger-dt);this.visual.rotation.x=Math.sin(this.stagger*9)*.06;return;}
    this.visual.rotation.x=0;this.pathIn-=dt;if(this.pathIn<=0){this.routeToPlayer();this.pathIn=1;}
    const p=this.figure.position,player=this.g.player.pos;
    if(p.distanceTo(player)>1.4&&this.path.length){const next=this.path[0],delta=next.clone().sub(p);const distance=delta.length(),stride=Math.min(distance,dt*.82);if(distance>.01){delta.multiplyScalar(stride/distance);if(!this.blocked(p.x+delta.x,p.z+delta.z))p.add(delta);else this.pathIn=0;}if(distance<.12)this.path.shift();}
    this.figure.rotation.y=Math.atan2(player.x-p.x,player.z-p.z);this.visual.rotation.z=Math.sin(this.t*6)*.035;
    this.light.position.copy(p).add(new THREE.Vector3(0,2.8,.6));this.syncCollider();
  }
  restorePower(){if(this.powerBefore){this.g.power.on={...this.powerBefore.on};this.g.power.mainTripped=this.powerBefore.mainTripped;this.g.power.serviceOff=this.powerBefore.serviceOff;this.g.power.apply();this.powerBefore=null;}if(this.g.music.playing==='blackout'){if(this.musicBefore)this.g.music.play(this.musicBefore);else this.g.music.stop(1.2);}}
  finish(){
    this.phase='safe';this.figure.visible=false;this.light.visible=false;this.banner.hidden=true;this.g.player.emergencyRun=false;
    this.g.station.colliders=this.g.station.colliders.filter(c=>c!==this.collider);this.g.tasks.done('driver_escape');
    this.g.state.flag('delivery_escape_safe',true);this.g.state.note('The pale figure followed me through the station entrance. Three shotgun hits drove it away; the power returned.',this.g.minutes);this.restorePower();this.g.ui.say("It's gone. The lights are back.",{secs:3});this.delivery.saveProgress();
  }
  update(dt=0){
    if(!['watch','run','defend'].includes(this.phase)||this.g.mode!=='play'||this.g.ui.focused)return;
    const p=this.g.player.pos;
    if(this.phase==='defend'){this.t+=dt;this.pursue(Math.min(dt,.1));if(this.g.music.playing!=='blackout')this.g.music.play('blackout');this.renderDefend();return;}
    if(this.g.player.inside()&&p.z>.75){void this.blackout();return;}
    this.t+=dt;this.visual.rotation.z=Math.sin(this.t*.65)*.009;this.figure.rotation.y=Math.atan2(p.x-this.figure.position.x,p.z-this.figure.position.z);this.syncCollider();
    if(this.phase==='run'){this.renderBanner();return;}
    const target=this.figure.position.clone().setY(1.85),delta=target.clone().sub(this.g.camera.position);
    if(delta.length()<38&&delta.normalize().dot(this.g.camera.getWorldDirection(new THREE.Vector3()))>.93&&this.g.interact._clearSight({id:'delivery_figure_sight'},target))this.activateRun();
  }
  reset(){this.restorePower();this.visual?.rotation.set(0,0,0);this.figure.position.set(18,0,-24);this.figure.rotation.set(0,-.50,0);this.t=0;this.pathIn=0;this.screamIn=2;this.syncCollider();this.phase='off';this.hits=0;this.path=[];this.stagger=0;this.figure.visible=false;this.light.visible=false;this.banner.hidden=true;this.g.player.emergencyRun=false;this.g.station.colliders=this.g.station.colliders.filter(c=>c!==this.collider);}
}
