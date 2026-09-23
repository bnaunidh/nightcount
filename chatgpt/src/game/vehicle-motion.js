import * as THREE from 'three';

const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
// Parts are exported with real hinge/axle origins. Put their pivots into vehicle
// coordinates once; rolling and steering then work on every model's axes.
export class VehicleMotion {
  constructor(vehicle){
    this.v=vehicle;this.time=0;this.lastSpeed=0;this.steer=0;this.wheels=[];this.doors=[];
    const host=vehicle.group;this.mount=new THREE.Group();this.mount.name='suspension_body';
    const fixed=[...host.children];host.add(this.mount);for(const o of fixed)this.mount.attach(o);
    host.updateMatrixWorld(true);
    const parts=[];vehicle.body.traverse(o=>{if(/^NC_(Wheel|Door)_/.test(o.name))parts.push(o)});
    for(const part of parts){
      const wheel=part.name.startsWith('NC_Wheel_'),parent=wheel?host:this.mount;
      const at=parent.worldToLocal(part.getWorldPosition(new THREE.Vector3()));
      const pivot=new THREE.Group();pivot.name='motion_'+part.name;pivot.position.copy(at);parent.add(pivot);pivot.updateMatrixWorld(true);
      if(wheel){const spin=new THREE.Group();pivot.add(spin);spin.updateMatrixWorld(true);spin.attach(part);this.wheels.push({pivot,spin,front:part.name.includes('front'),radius:Math.max(.2,at.y)});}
      else {pivot.attach(part);this.doors.push({pivot,side:Math.sign(at.x)||-1,amount:0,target:0});}
    }
    this.driver=this.doors.find(d=>d.side<0)||this.doors[0];
    this.signals=[];
    for(const side of [-1,1])for(const end of [-1,1]){
      const material=new THREE.MeshBasicMaterial({color:0x3e2a0b});
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.14,.10,.05),material);
      lamp.name='animated_indicator';lamp.position.set(side*vehicle.width*.35,.7,end*(vehicle.length/2-.07));host.add(lamp);this.signals.push({lamp,side});
    }
  }
  door(open){if(this.driver)this.driver.target=open?1:0;}
  doorPoint(seated=false){
    const d=this.driver,point=d?d.pivot.position.clone():new THREE.Vector3(-this.v.width/2,.7,this.v.length*.17);
    point.x+=((d?.side)||-1)*(seated?-.35:.63);point.y=0;point.z-=.46;
    return this.v.group.localToWorld(point);
  }
  update(dt){
    const v=this.v;this.time+=dt;
    const moving=v.speed>.02&&['APPROACH_FAR','APPROACH_NEAR','TURN_IN','CROSS_FORECOURT','PARKING','DEPARTING','LEAVING'].includes(v.state);
    this.steer=THREE.MathUtils.damp(this.steer,moving?THREE.MathUtils.clamp(v.turnDemand||0,-.46,.46):0,8,dt);
    for(const w of this.wheels){w.pivot.rotation.y=w.front?this.steer:0;if(moving)w.spin.rotation.x=(w.spin.rotation.x+v.speed*dt/w.radius)%(Math.PI*2);}
    const accel=dt>0?(v.speed-this.lastSpeed)/dt:0;this.lastSpeed=v.speed;
    const pitch=moving?THREE.MathUtils.clamp(accel*.004,-.02,.016):0;
    this.mount.rotation.x=THREE.MathUtils.damp(this.mount.rotation.x,pitch,7,dt);
    this.mount.rotation.z=THREE.MathUtils.damp(this.mount.rotation.z,moving?-this.steer*Math.min(.045,v.speed*.008):0,5,dt);
    this.mount.position.y=THREE.MathUtils.damp(this.mount.position.y,moving?Math.sin(this.time*6.5)*Math.min(.003,v.speed*.0003):0,9,dt);
    for(const d of this.doors){d.amount=THREE.MathUtils.damp(d.amount,d.target,7,dt);d.pivot.rotation.y=-d.side*smooth(d.amount)*1.12;}
    const signaling=['TURN_IN','CROSS_FORECOURT','PARKING','DEPARTING'].includes(v.state),side=Math.sign(v.turnDemand)||-1;
    for(const s of this.signals)s.lamp.material.color.setHex(signaling&&s.side===side&&this.time%1<.48?0xffa027:0x3e2a0b);
  }
}
