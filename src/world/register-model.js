import * as THREE from 'three';
import {surface} from '../core/assets.js';

export function makeRegister(){
  const g=new THREE.Group();g.name='prop_register';g.userData.propKey='register';
  const cream=surface('assets/tex/nc/MAP_metal.png',{color:0xaeb5a2});
  const dark=surface('assets/tex/nc/fabric_detail.png',{color:0x293b34});
  const metal=surface('assets/tex/nc/MAP_metal.png',{color:0x76867d});
  const keymat=surface('assets/tex/nc/fabric_detail.png',{color:0xc5bc9f});
  const box=(name,size,pos,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.name=name;m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
  box('cash_drawer_base',[.58,.105,.45],[0,.055,0],dark);
  box('cash_drawer_front',[.54,.075,.022],[0,.054,.235],cream);
  box('drawer_handle',[.18,.025,.027],[0,.057,.257],metal);
  box('register_housing',[.50,.16,.37],[0,.174,-.015],cream);
  const keys=box('sloping_key_deck',[.45,.025,.245],[0,.265,.057],dark);keys.rotation.x=.24;
  for(let r=0;r<4;r++)for(let c=0;c<6;c++){
    const k=box('key_'+r+'_'+c,[.048,.016,.043],[-.179+c*.071,.299-r*.012,-.037+r*.059],c===5?dark:keymat);k.rotation.x=.24;
  }
  box('display_housing',[.30,.115,.062],[.082,.359,-.158],dark);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#10231e';ctx.fillRect(0,0,512,192);ctx.fillStyle='#b8d2a0';ctx.font='bold 43px monospace';ctx.fillText('MERIDIAN 41',20,68);ctx.font='34px monospace';ctx.fillText('READY   $0.00',20,145);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
  const display=new THREE.Mesh(new THREE.PlaneGeometry(.273,.088),new THREE.MeshBasicMaterial({map:t}));display.name='register_display';display.position.set(.082,.359,-.125);g.add(display);
  box('receipt_printer',[.13,.09,.12],[-.177,.329,-.156],cream);
  box('receipt_slot',[.105,.008,.035],[-.177,.380,-.146],dark);
  const paper=box('printed_receipt',[.083,.002,.126],[-.177,.388,-.110],surface('assets/tex/nc/fabric_detail.png',{color:0xe2d8bb}));paper.rotation.x=.4;
  g.userData.interactionBounds=new THREE.Box3(new THREE.Vector3(-.31,0,-.24),new THREE.Vector3(.31,.43,.28));
  return g;
}
