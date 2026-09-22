import * as THREE from 'three';
import { tex } from '../core/assets.js';

export async function buildSignage(station) {
  const records = await (await fetch('assets/tex/nc/signs.json')).json();
  const group = new THREE.Group(); group.name = 'station_signage';
  station.litSigns = [];
  for (const r of records) {
    const material = r.power
      ? new THREE.MeshBasicMaterial({map:tex(`assets/tex/nc/sign_${r.art}.png`,{repeat:[1,1]})})
      : new THREE.MeshLambertMaterial({map:tex(`assets/tex/nc/sign_${r.art}.png`,{repeat:[1,1]})});
    const face = new THREE.Mesh(new THREE.PlaneGeometry(r.w,r.h), material);
    face.name = 'sign_'+r.id; face.position.fromArray(r.pos);face.rotation.y=r.rot;
    group.add(face);
    if(r.power)station.litSigns.push({face,circuit:r.power});
    if(r.id==='road-front')station.signFace=face;
  }
  station.group.add(group); station.signage=group;
}
