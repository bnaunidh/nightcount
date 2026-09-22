import * as THREE from 'three';
import { surface, model, fitHeight } from '../core/assets.js';
import { ADDITIONS } from './addition-shapes.js';

export function makeAddition(def) {
  const group=new THREE.Group();group.name=def.name;
  for(const p of def.parts){
    let geo;
    if(p.shape==='box')geo=new THREE.BoxGeometry(...p.size);
    if(p.shape==='cylinder')geo=new THREE.CylinderGeometry(...p.size);
    if(p.shape==='sphere')geo=new THREE.SphereGeometry(1,20,12);
    if(p.shape==='torus')geo=new THREE.TorusGeometry(...p.size);
    const mesh=new THREE.Mesh(geo,surface('assets/tex/nc/fabric_detail.png',{color:p.color}));
    mesh.name=p.name;mesh.position.set(...p.pos);mesh.rotation.set(...p.rot);
    if(p.shape==='sphere')mesh.scale.set(...p.size);
    if(p.scale)mesh.scale.set(...p.scale);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.interactionBounds=new THREE.Box3().setFromObject(group);
  return group;
}
export function sign(parent,text,width,height,pos,rot=0){
  const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*height/width);
  const x=c.getContext('2d');x.fillStyle='#17352f';x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='#c8b88f';x.lineWidth=8;x.strokeRect(12,12,c.width-24,c.height-24);
  x.fillStyle='#e8dfc6';x.textAlign='center';x.textBaseline='middle';
  const lines=text.split('\n'),lh=c.height/(lines.length+1);x.font=`bold ${Math.min(92,lh*.66)}px monospace`;
  lines.forEach((line,i)=>x.fillText(line,c.width/2,lh*(i+1),c.width-55));
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex}));
  mesh.position.set(...pos);mesh.rotation.y=rot;parent.add(mesh);return mesh;
}
export async function fillStockBox(root){
  root.updateWorldMatrix(true,true);
  const b=new THREE.Box3();root.traverse(m=>{if(m.isMesh){m.geometry.computeBoundingBox();b.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));}});
  const worldTop=b.max.y,center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
  const fill=new THREE.Group();fill.name='visible_stock_contents';root.add(fill);
  const productKeys=['product_noodle_cup','product_coffee_tin','product_water_bottle'];
  for(let i=0;i<6;i++){
    const o=await model(productKeys[i%3],{shadows:false});fitHeight(o,.14);
    const at=new THREE.Vector3(center.x+(i%3-1)*Math.min(.11,size.x/4),worldTop-.10,center.z+(Math.floor(i/3)-.5)*Math.min(.16,size.z/3));
    root.worldToLocal(at);o.position.add(at);fill.add(o);
  }
  return fill;
}
export async function buildAdditions(scene,station){
  station.usableProps={};
  for(const def of ADDITIONS){
    const o=makeAddition(def);o.position.set(...def.pos);o.rotation.y=def.rot;scene.add(o);station.usableProps[def.name]=o;
    if(def.collider){const b=new THREE.Box3().setFromObject(o);station.colliders.push({x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,y1:b.max.y,label:'fixture:'+def.name});}
  }
  sign(scene,'STAFF\nCLOCK IN / OUT',.80,.36,[1.72,2.28,7.77],Math.PI);
  sign(station.usableProps.timeclock,'MERIDIAN\nINSERT CARD',.27,.12,[0,.072,-.102],Math.PI);
  sign(scene,'EMPLOYEES\nWASH YOUR HANDS',.60,.23,[6.20,1.6,11.84],Math.PI);
  sign(scene,'SHOTGUN',.30,.07,[-5.70,.81,3.015],0);
  const water=new THREE.Mesh(new THREE.CylinderGeometry(.009,.014,.16,8),new THREE.MeshBasicMaterial({color:0xaecbd0,transparent:true,opacity:.55}));
  water.position.set(5.08,.925,11.65);water.visible=false;water.name='tap_water';scene.add(water);station.tapWater=water;
  const boxes=scene.children.filter(o=>['cardbox','crate1','crate2'].includes(o.userData.propKey));
  for(const box of boxes) await fillStockBox(box);
  station.filledBoxes=boxes;
  await finishWorkAreas(scene,station);
}
export function captureProps(scene,station){
  scene.updateMatrixWorld(true);station.inspectables=[];
  for(const o of scene.children){
    const key=o.userData.propKey;if(!key||['bush','rock','streetlight','fluoro'].includes(key))continue;
    const bounds=new THREE.Box3().setFromObject(o);
    if(bounds.isEmpty())continue;
    station.inspectables.push({key,object:o,bounds,position:bounds.getCenter(new THREE.Vector3()),merged:!!o.userData.merge});
  }
}


async function finishWorkAreas(scene,station){
  const paint=surface('assets/tex/nc/fabric_detail.png',{color:0xbda657});
  const stripe=(x,z,w,d)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,.006,d),paint);m.position.set(x,.016,z);m.name='painted_loading_bay';scene.add(m);};
  for(const x of [10.5,13.5])stripe(x,-6, .06,8.2);
  for(const z of [-10.1,-1.9])stripe(12,z,3,.06);
  const label=sign(scene,'DELIVERIES\nKEEP CLEAR',2.3,.62,[12,.025,-11.3]);label.rotation.set(-Math.PI/2,0,Math.PI);
  const light=new THREE.SpotLight(0xffe0b4,9,15,.70,.65,1.2);light.position.set(9.14,2.7,.20);
  const target=new THREE.Object3D();target.position.set(12,0,-6);scene.add(light,target);light.target=target;
  light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.bias=-.001;
  const housing=new THREE.Mesh(new THREE.BoxGeometry(.20,.12,.14),surface('assets/tex/nc/fabric_detail.png',{color:0x5e655b}));housing.position.copy(light.position);scene.add(housing);
  station.deliveryBayLight=light;station.lights.delivery=light;
  sign(scene,'RESTOCK CASES',.64,.16,[-8.70,1.1,10.45],Math.PI/2);

  // Stock rests on measured board tops, never on assumed shelf elevations.
  const rack=scene.getObjectByName('prop_stockshelf');station.storeShelfProducts=[];
  if(rack){
    scene.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(-4.10,2.2,9.65),new THREE.Vector3(0,-1,0),0,2.3);
    const levels=[];
    for(const hit of ray.intersectObject(rack,true)){
      const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if(normal.y>.8&&hit.point.y<1.6&&!levels.some(y=>Math.abs(y-hit.point.y)<.04))levels.push(hit.point.y);
    }
    levels.sort((a,b)=>a-b);
    const keys=['product_trail_oats','product_water_bottle','product_coffee_tin','product_soap_pump'];
    const usableLevels=levels.filter((y,i)=>i===levels.length-1||levels[i+1]-y>.27);
    for(const y of usableLevels)for(let i=0;i<4;i++){
      const o=await model(keys[i],{shadows:false});fitHeight(o,i===0?.22:.17);
      const root=new THREE.Group();root.name='stockroom_supply_'+station.storeShelfProducts.length;root.userData.propKey=keys[i];root.add(o);root.position.set(-4.10,y,9.65+(i-1.5)*.39);root.rotation.y=-Math.PI/2;scene.add(root);station.storeShelfProducts.push(root);
    }
    station.storeShelfLevels=levels;
  }
}
