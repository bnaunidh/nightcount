// Persistent roadside scenery, outside the playable routes. Dawn reveals it
// gradually through the existing lighting/fog; nothing pops in at sunrise.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {surface,TEX} from '../core/assets.js';
import {rng} from '../core/util.js';
export function buildSurroundings(scene,station){
 const root=new THREE.Group();root.name='roadside_surroundings';const R=rng(419723),batches=new Map(),features=[];
 const materials={
  earth:surface(TEX.ground,{repeat:[8,5],color:0x716e61}),
  wood:surface(TEX.exwall,{repeat:[1,3],color:0x777060}),
  leaves:surface(TEX.ground,{repeat:[1,1],color:0x4e5c43}),
  grass:surface(TEX.ground,{repeat:[1,1],color:0x8b8467}),
  siding:surface(TEX.exwall,{repeat:[5,2],color:0x879186}),
  roof:new THREE.MeshLambertMaterial({color:0x3f4649}),
  metal:new THREE.MeshLambertMaterial({color:0x626863}),
  glass:new THREE.MeshLambertMaterial({color:0x26383c}),
 };
 materials.grass.side=THREE.DoubleSide;
 const add=(geo,mat,pos,scale=[1,1,1],rot=[0,0,0])=>{const m=new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(...scale));geo.applyMatrix4(m);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(geo);};
 const box=(mat,x,y,z,w,h,d,ry=0)=>add(new THREE.BoxGeometry(w,h,d),mat,[x,y+h/2,z],[1,1,1],[0,ry,0]);
 const feature=(name,x,z)=>features.push({name,x,z});
 // Undulating ridgelines instead of a flat horizon, far beyond the road.
 for(const [x,z,sx,sy,sz] of [[-115,-105,67,15,34],[-45,-119,58,21,42],[35,-130,70,18,45],[118,-108,66,24,40],[-125,72,53,18,46],[-60,98,61,15,39],[34,109,68,22,39],[118,65,60,16,42]]){
  add(new THREE.SphereGeometry(1,16,8), 'earth',[x,-2,z],[sx,sy,sz]);feature('ridge',x,z);
 }
 // Sparse junipers suit the high-desert station, with varied crowns and trunks.
 for(let i=0;i<48;i++){
  let x=(R()-.5)*185,z=R()<.6?-47-R()*44:34+R()*36;if(Math.abs(x)<23&&z>0)x+=x<0?-30:30;
  const h=3.5+R()*4.8;box('wood',x,0,z,.18,h*.78,.22);
  for(let j=0;j<3;j++)add(new THREE.SphereGeometry(1,7,5),'leaves',[x+(R()-.5)*1.4,h*(.52+j*.13),z+(R()-.5)*1.3],[h*(.2-j*.035),h*.23,h*(.19-j*.03)],[R()*.25,R()*6,R()*.2]);
  feature('juniper',x,z);
 }
 // Dry verge tufts stay outside the station's walkable bounds and road lanes.
 for(let i=0;i<145;i++){
  const x=(R()-.5)*170,z=R()<.55?-33-R()*13:28+R()*17;if(Math.abs(z+25)<7)continue;
  for(let j=0;j<5;j++){const h=.25+R()*.4;add(new THREE.PlaneGeometry(.055,h),'grass',[x+R()*.28,h/2,z+R()*.28],[1,1,1],[.12+R()*.25,R()*6,.15]);}
 }
 for(const z of [-38,31]){
  for(let x=-72;x<=72;x+=6){box('wood',x,0,z,.16,1.4,.18);for(const y of [.45,.95])box('wood',x+3,y,z,6,.075,.08);}
  feature('ranch fence',0,z);
 }
 // Power line sag, crossbars, and insulators along the far road shoulder.
 const wirePoints=[];
 for(let x=-96;x<=96;x+=32){
  box('wood',x,0,-34,.24,8.4,.25);box('wood',x,7.5,-34,.16,.18,2.1);
  for(const dz of [-.85,0,.85]){box('metal',x,7.65,-34+dz,.11,.27,.11);if(x<96)for(let j=0;j<12;j++){const a=j/12,b=(j+1)/12;wirePoints.push(x+32*a,7.9-Math.sin(a*Math.PI)*.6,-34+dz,x+32*b,7.9-Math.sin(b*Math.PI)*.6,-34+dz);}}
  feature('utility pole',x,-34);
 }
 const wires=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(wirePoints,3)),new THREE.LineBasicMaterial({color:0x353d3f}));wires.name='sagging_power_lines';root.add(wires);
 // Shuttered workshop across the road: windows, corrugated roof and timber porch.
 for(const [x,z,w,d]of [[-43,-53,12,7],[48,3,8,6]]){
  box('siding',x,0,z,w,3.6,d);box('roof',x,3.6,z,w+1,.2,d+1);
  box('wood',x-3,.1,z+d/2+.4,1.45,2.55,.2);
  for(const dx of [-w*.25,w*.25]){box('wood',x+dx,1.15,z+d/2+.04,2.3,1.6,.14);box('glass',x+dx,1.24,z+d/2+.13,2.06,1.38,.06);box('wood',x+dx,1.24,z+d/2+.2,.06,1.38,.04);}
  box('earth',x,-.04,z+d/2+1,w+1,.19,2.4);
  box('roof',x,2.9,z+d/2+.9,w+1,.1,2.2);
  for(const dx of [-w/2,w/2])box('wood',x+dx,0,z+d/2+1.6,.14,3,.14);
  for(let i=0;i<6;i++)box('roof',x-w/2+.8+i*(w-1.6)/5,3.76,z,.045,.06,d+.8);
  feature('closed roadside workshop',x,z);
 }
 const c=document.createElement('canvas');c.width=768;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#c1b69c';ctx.fillRect(0,0,768,256);ctx.strokeStyle='#3a5047';ctx.lineWidth=14;ctx.strokeRect(12,12,744,232);ctx.textAlign='center';ctx.fillStyle='#293d36';ctx.font='bold 60px Georgia';ctx.fillText('COLDBROOK',384,87);ctx.font='34px monospace';ctx.fillText('AUTO REPAIR  •  CLOSED',384,151);ctx.font='24px monospace';ctx.fillText('SERVICE ENTRANCE AT REAR',384,203);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.5,1.8),new THREE.MeshLambertMaterial({map:texture}));sign.name='coldbrook_workshop_sign';sign.position.set(-43,3.75,-49.45);root.add(sign);
 for(const [mat,geos]of batches){const merged=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g));const mesh=new THREE.Mesh(merged,materials[mat]);mesh.name='surroundings_'+mat;mesh.receiveShadow=true;root.add(mesh);for(const g of geos)g.dispose();}
 root.userData.features=features;root.userData.backgroundOnly=true;scene.add(root);station.surroundings=root;return root;
}
