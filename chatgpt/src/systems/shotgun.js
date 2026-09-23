import * as THREE from 'three';
import { inputBus } from '../core/input.js';
import { settings } from '../core/settings.js';
import { playShotgunBlast } from '../core/shotgun-sound.js';

export class Shotgun {
  constructor(game){
    this.g=game;this.ammo=2;this.cooldown=0;this.reloading=0;this.recoil=0;
    this.flash=new THREE.PointLight(0xffce81,0,9,1.5);this.flash.position.set(.17,-.10,-.9);game.camera.add(this.flash);
    this.node=document.createElement('div');this.node.id='shotgun-status';this.node.hidden=true;game.ui.hud.append(this.node);
    inputBus.on('mousedown',button=>{if(button===0)this.fire();});
    inputBus.on('press',code=>{if(code==='KeyR')this.reload();});
  }
  canUse(){return this.g.mode==='play'&&!this.g.paused&&!this.g.ui.focused&&!this.g.player.frozen&&this.g.inventory.equipped('shotgun');}
  sound(){
    return playShotgunBlast(this.g.audio);
  }
  fire(){
    if(!this.canUse()||this.cooldown>0||this.reloading>0)return false;
    if(this.ammo<=0){this.g.audio.play('int_keys',{vol:.2});this.g.ui.toast('Empty. Press R to reload.');this.cooldown=.25;return false;}
    this.ammo--;this.cooldown=.8;this.recoil=1;this.flash.intensity=settings.reduceFlicker?0:20;this.sound();this.g.player.shake(.045,.16);
    this.g.scene.updateMatrixWorld(true);
    for(const c of this.g.customers.active)c.group.traverse(o=>{if(o.isSkinnedMesh){o.computeBoundingSphere();o.computeBoundingBox();}});
    const ray=new THREE.Raycaster(this.g.camera.position,this.g.camera.getWorldDirection(new THREE.Vector3()),.05,45);
    let hit=null;
    for(const h of ray.intersectObjects(this.g.scene.children,true)){
      const o=h.object;if(!o.isMesh||o.userData.noOutline)continue;
      let hidden=false;for(let p=o;p;p=p.parent)if(!p.visible||p===this.g.camera)hidden=true;
      if(hidden)continue;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>!m.depthWrite))continue;
      hit=h;break;
    }
    let struck=false;
    if(hit)for(let o=hit.object;o;o=o.parent)if(o===this.g.delivery.scare.figure){struck=this.g.delivery.scare.hit();break;}
    let person=null;
    if(hit&&!struck){for(const c of this.g.customers.active){let o=hit.object;while(o&&o!==c.group)o=o.parent;if(o===c.group&&this.g.customers.shoot(c)){person=c.id;struck=true;break;}}}
    this.lastShot={hit:hit?.object.name||null,struck,person};this.render();return true;
  }
  reload(){if(!this.canUse()||this.reloading>0||this.ammo===2)return false;this.reloading=1.25;this.g.audio.play('int_panel_metal',{vol:.22,rate:1.45});this.render();return true;}
  update(dt){
    this.cooldown=Math.max(0,this.cooldown-dt);this.recoil=Math.max(0,this.recoil-dt*7);this.flash.intensity=this.recoil>.6&&!settings.reduceFlicker?20:0;
    if(this.reloading>0){this.reloading=Math.max(0,this.reloading-dt);if(this.reloading===0){this.ammo=2;this.g.audio.play('int_keys',{vol:.3,rate:.8});}}
    const item=this.g.inventory.get('shotgun');if(item?.object){item.object.position.z=-.48+this.recoil*.12;item.object.rotation.x=.08-this.recoil*.14+(this.reloading>0?.32:0);}
    this.render();
  }
  render(){const show=this.g.inventory.equipped('shotgun');this.node.hidden=!show;this.node.textContent=this.reloading>0?'SHOTGUN · RELOADING…':`SHOTGUN · ${this.ammo}/2 · Left click fire · R reload`;}
  reset(){this.ammo=2;this.cooldown=0;this.reloading=0;this.recoil=0;this.flash.intensity=0;this.node.hidden=true;}
}
