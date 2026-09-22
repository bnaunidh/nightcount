import * as THREE from 'three';
import { settings } from '../core/settings.js';
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function daylightAt(minutes){const h=((minutes%1440)+1440)%1440/60;return h<12?smooth(4.8,6.5,h):1-smooth(19.5,21,h);}

export class Weather {
  constructor(g){
    this.g=g;this.rain=0;this.flash=0;this.nextThunder=22;this.pendingThunder=-1;
    this.sun=new THREE.DirectionalLight(0xffd8aa,0);this.sun.name='daylight_sun';this.sun.position.set(40,30,-65);g.scene.add(this.sun);
    this.lightning=new THREE.HemisphereLight(0xc6dcff,0x303a50,0);this.lightning.name='storm_lightning';g.scene.add(this.lightning);
    const count=1800,positions=new Float32Array(count*6);this.drops=[];
    for(let i=0;i<count;i++)this.drops.push({x:Math.random()*100-50,y:Math.random()*15,z:Math.random()*100-48,s:12+Math.random()*9});
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xadc5d1,transparent:true,opacity:.4,depthWrite:false}));this.lines.name='rain_outdoors';this.lines.frustumCulled=false;this.lines.userData.noOutline=true;g.scene.add(this.lines);
    this.resetForNight(1);
  }
  resetForNight(n){this.rain=[2,3,5].includes(n)?1:0;this.flash=0;this.nextThunder=18;this.pendingThunder=-1;this.rainLoop?.stop(0);this.rainLoop=null;this.lines.visible=!!this.rain;this.update(0);}
  thunder(immediate=false){
    if(!settings.reduceFlicker)this.flash=.8;
    if(immediate)this.g.audio.play('amb_thunder',{vol:.48,scare:true});else this.pendingThunder=.65;
  }
  update(dt){
    const g=this.g,day=daylightAt(g.minutes??1220),storm=this.rain;
    this.daylight=day;
    const sky=new THREE.Color(0x05070d).lerp(new THREE.Color(storm?0x596971:0x7eabc1),day);
    const twilight=(1-Math.abs(day-.5)*2)*(storm?.04:.22);sky.lerp(new THREE.Color(0x996e63),twilight);
    g.scene.background.copy(sky);if(g.scene.fog){g.scene.fog.color.copy(sky);g.scene.fog.near=storm?23:34;g.scene.fog.far=storm?95:170;}
    const hemi=g.station.lights.hemi;hemi.color.setHex(0x2b3444).lerp(new THREE.Color(0xc4dce8),day);hemi.intensity=.5+day*(storm?.9:1.25);
    this.sun.intensity=day*(storm?.3:1.5);g.station.lights.moon.intensity=.3*(1-day);
    const h=((g.minutes%1440)+1440)%1440/60,angle=(h-6)/12*Math.PI;this.sun.position.set(Math.cos(angle)*70,Math.max(8,Math.sin(angle)*70),-40);
    this.flash=Math.max(0,this.flash-dt*2.3);this.lightning.intensity=settings.reduceFlicker?0:this.flash*2.5;
    if(!storm)return;
    const a=this.lines.geometry.attributes.position.array;
    for(let i=0;i<this.drops.length;i++){const d=this.drops[i];d.y-=d.s*dt;if(d.y<0)d.y=15;const roof=(Math.abs(d.x)<9.6&&d.z>-.4&&d.z<12.5)||(Math.abs(d.x)<8.9&&d.z> -17&&d.z< -3);const y=roof&&d.y<4.5?100:d.y;const o=i*6;a[o]=d.x;a[o+1]=y;a[o+2]=d.z;a[o+3]=d.x+.06;a[o+4]=y-.42;a[o+5]=d.z+.05;}
    this.lines.geometry.attributes.position.needsUpdate=true;
    if(g.audio.ready&&!this.rainLoop)this.rainLoop=g.audio.loop('amb_rain_heavy',{vol:.25,pos:new THREE.Vector3(5,3,-2),ref:20,rolloff:.5});
    this.rainLoop?.gain(g.player.inside()?.13:.28);
    if(g.mode==='play'||g.mode==='cutscene'){
      this.nextThunder-=dt;if(this.nextThunder<=0){this.nextThunder=24+Math.random()*29;this.thunder();}
      if(this.pendingThunder>=0){this.pendingThunder-=dt;if(this.pendingThunder<0)g.audio.play('amb_thunder',{vol:g.player.inside()?.30:.45});}
    }
  }
}
