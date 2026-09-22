import * as THREE from 'three';
import {surface} from '../core/assets.js';

const paintColours={white:0xbac1b4,sage:0x597466,blue:0x435e75,card:0x9a876c,red:0x8f3f31,green:0x405e47,pale:0x92998a,orange:0xa77842,grey:0x646f73,steel:0x89938e};
let paintMap;
function paintedMetal(){
  if(paintMap)return paintMap;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#ccccca';c.fillRect(0,0,256,256);let seed=412;
  const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<2600;i++){const v=188+Math.floor(random()*24);c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(random()*256,random()*256,1,1);}
  c.strokeStyle='#9b9b96';c.lineWidth=1;for(let i=0;i<16;i++){const x=random()*256,y=random()*256;c.beginPath();c.moveTo(x,y);c.lineTo(x+2+random()*7,y+.7);c.stroke();}
  paintMap=new THREE.CanvasTexture(canvas);paintMap.colorSpace=THREE.SRGBColorSpace;paintMap.wrapS=paintMap.wrapT=THREE.RepeatWrapping;return paintMap;
}

// Readable material separation and physical trim at the game's low resolution.
export function finishVehicle(body,host,dims,key){
  body.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
    const name=m.name.toLowerCase();
    const paint=paintColours[name.replace('nc_p_','')];if(paint){m.map=paintedMetal();m.color.setHex(paint);}
    if(name.includes('glass')){m.transparent=false;m.opacity=1;m.color.setHex(0x24433f);m.depthWrite=true;}
    if(name.includes('rubber')||name.includes('dark'))m.color.setHex(0x626b63);
    m.needsUpdate=true;
  }});
  const [length,width,height]=dims;
  const metal=surface('assets/tex/nc/MAP_metal.png',{color:0x727d75});
  const dark=surface('assets/tex/nc/fabric_detail.png',{color:0x293b35});
  const cream=surface('assets/tex/nc/MAP_metal.png',{color:0xbeb697});
  const add=(name,size,pos,mat)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;host.add(o);return o;};
  for(const s of [-1,1]){
    add('side_rub_strip',[.025,.065,length*.65],[s*width*.493,height*.31,0],dark);
    add('door_handle',[.025,.035,.15],[s*width*.495,height*.48,length*.17],metal);
  }
  add('front_grille',[width*.39,.15,.027],[0,.54,length*.491],dark);
  for(let i=-3;i<=3;i++)add('grille_slats',[width*.36,.009,.015],[0,.49+i*.022,length*.497],metal);
  add('rear_plate',[.27,.085,.016],[0,.43,-length*.497],cream);
  if(key==='vehicle_delivery'){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d');
    c.fillStyle='#bfbca4';c.fillRect(0,0,1024,512);c.fillStyle='#28493f';c.fillRect(0,28,1024,356);c.fillStyle='#e1d8bc';c.font='bold 98px sans-serif';c.textAlign='center';c.fillText('MERIDIAN',512,178);c.font='46px sans-serif';c.fillText('STATION SUPPLIES',512,282);c.fillStyle='#34493f';c.font='27px monospace';c.fillText('STORE 041   •   DRY GOODS   •   OVERNIGHT',512,456);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshLambertMaterial({map:t});
    for(const s of [-1,1]){const panel=new THREE.Mesh(new THREE.PlaneGeometry(length*.44,height*.43),mat);panel.name='delivery_livery';panel.position.set(s*width*.501,height*.65,-length*.15);panel.rotation.y=s*Math.PI/2;host.add(panel);}
    add('rear_door_center_seal',[.025,height*.70,.04],[0,height*.61,-length*.459],dark);
    for(const s of [-1,1]){
      add('rear_door_lock_bar',[.022,height*.60,.034],[s*width*.23,height*.61,-length*.472],metal);
      for(const y of [.42,.62,.82])add('rear_door_hinge',[.14,.045,.046],[s*width*.43,height*y,-length*.470],metal);
    }
  }
}
