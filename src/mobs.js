import * as THREE from 'three';
import {B,I,isSolid} from './blocks.js';
import {moveBody} from './physics.js';
export class Mobs {
  constructor(game,saved=[]) {
    this.game=game;this.list=[];this.timer=0;this.geo=new THREE.BoxGeometry(1,1,1);this.materials=new Map();this.serial=0;
    for(const s of saved.slice(0,16))if(['sheep','hollow'].includes(s.type)&&s.pos&&Object.values(s.pos).every(Number.isFinite)&&s.health>0)this.spawn(s.type,s.pos,s.health);
  }
  material(color,glow=false){const key=`${color},${glow}`;if(!this.materials.has(key))this.materials.set(key,glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshLambertMaterial({color}));return this.materials.get(key);}
  spawn(type,pos,health) {
    const group=new THREE.Group(),parts=[],hostile=type==='hollow';
    const box=(sx,sy,sz,x,y,z,color,glow=false)=>{const mesh=new THREE.Mesh(this.geo,this.material(color,glow));mesh.scale.set(sx,sy,sz);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
    if(!hostile){
      box(.87,.62,1.02,0,.78,0,0xe7ddc4);box(.72,.17,.86,0,1.12,.02,0xf5ead3);box(.41,.43,.44,0,.91,-.6,0xb69c79);box(.38,.22,.1,0,.79,-.86,0x796b57);
      for(const s of [-1,1]){box(.12,.2,.18,s*.27,1,-.6,0xa48b6b);box(.065,.072,.03,s*.12,.98,-.835,0x293a33);}
      for(const x of [-.27,.27])for(const z of [-.3,.3]){parts.push(box(.15,.4,.16,x,.3,z,0x746957));box(.18,.12,.19,x,.07,z,0x514e42);}
      box(.17,.2,.23,0,.91,.58,0xf0e4cd);
    }else{
      box(.56,.62,.32,0,.95,0,0x3e5350);box(.58,.48,.51,0,1.52,0,0x4d6458);box(.61,.1,.55,0,1.8,0x0,0x667453);
      for(const s of [-1,1]){box(.14,.07,.03,s*.14,1.55,-.262,0xe7c37a,true);parts.push(box(.19,.6,.22,s*.15,.31,0,0x344747));parts.push(box(.18,.66,.21,s*.39,1,-.06,0x50634f));}
      box(.18,.09,.03,0,1.36,-.264,0x293e3d);
    }
    group.position.set(pos.x,pos.y,pos.z);this.game.scene.add(group);
    const mob={id:++this.serial,type,group,parts,pos:{...pos},vel:{x:0,y:0,z:0},radius:hostile?.31:.43,height:hostile?1.82:1.3,health:health??(hostile?14:8),grounded:false,blocked:false,heading:Math.random()*Math.PI*2,decision:0,attack:0,hurt:0,flee:0,walk:0};this.list.push(mob);return mob;
  }
  spawnAround(type,min=14,max=35) {
    const p=this.game.player.pos,world=this.game.world;
    for(let i=0;i<24;i++){const a=Math.random()*Math.PI*2,r=min+Math.random()*(max-min),x=Math.floor(p.x+Math.cos(a)*r),z=Math.floor(p.z+Math.sin(a)*r),y=world.getSurface(x,z,false);
      if(y>19&&world.getBlock(x,y-1,z,false)!==B.AIR&&!isSolid(world.getBlock(x,y,z,false))&&!isSolid(world.getBlock(x,y+1,z,false))&&world.getBlock(x,y,z,false)!==B.WATER)return this.spawn(type,{x:x+.5,y:y+.04,z:z+.5});}
    return null;
  }
  update(dt) {
    const game=this.game,p=game.player.pos,night=game.atmosphere.night;this.timer-=dt;
    if(this.timer<=0){this.timer=8;if(this.list.filter(m=>m.type==='sheep').length<5)this.spawnAround('sheep');if(night&&game.mode==='survival'&&this.list.filter(m=>m.type==='hollow').length<4)this.spawnAround('hollow',20,35);}
    for(const m of [...this.list]) {
      const distance=Math.hypot(m.pos.x-p.x,m.pos.z-p.z);if(distance>85||m.pos.y<-3){this.remove(m);continue;}
      m.attack-=dt;m.decision-=dt;m.hurt=Math.max(0,m.hurt-dt);m.flee=Math.max(0,m.flee-dt);
      const hostile=m.type==='hollow',chasing=hostile&&distance<27&&game.mode==='survival';
      if(hostile&&!night&&game.atmosphere.daylight>.8){m.health-=dt*1.3;if(m.health<=0){this.remove(m);continue;}}
      if(chasing)m.heading=Math.atan2(p.x-m.pos.x,p.z-m.pos.z);
      else if(m.flee>0)m.heading=Math.atan2(m.pos.x-p.x,m.pos.z-p.z);
      else if(m.decision<=0){m.heading+=Math.random()*2.5-1.25;m.decision=2+Math.random()*4;m.rest=Math.random()<.3;}
      let speed=chasing?2.15:m.flee?3:m.rest?0:.75;if(distance<1.1&&chasing)speed=0;
      const inWater=game.world.getBlock(m.pos.x,m.pos.y+.5,m.pos.z,false)===B.WATER;
      m.vel.x=Math.sin(m.heading)*speed;m.vel.z=Math.cos(m.heading)*speed;m.vel.y=Math.max(-24,m.vel.y-(inWater?5:22)*dt);
      if(inWater)m.vel.y=3;
      moveBody(game.world,m,dt);if(m.blocked&&m.grounded)m.vel.y=8;
      if(chasing&&distance<1.5&&Math.abs(m.pos.y-p.y)<1.5&&m.attack<=0){m.attack=1.3;game.player.damage(3,game,'A Hollow found you in the dark. Craft a sword or build a shelter.');}
      m.walk+=speed*dt;m.group.position.set(m.pos.x,m.pos.y,m.pos.z);m.group.rotation.y=m.heading+Math.PI;m.group.scale.setScalar(m.hurt>0?1+Math.sin(m.hurt*30)*.035:1);
      m.parts.forEach((part,i)=>{part.rotation.x=Math.sin(m.walk*7+(i%2)*Math.PI)*Math.min(.5,speed*.2);});
    }
  }
  pick(origin,dir,max=4) {
    let best=null;
    for(const m of this.list){let tmin=0,tmax=max;for(const axis of ['x','y','z']){const low=m.pos[axis]-(axis==='y'?0:m.radius),high=m.pos[axis]+(axis==='y'?m.height:m.radius);if(Math.abs(dir[axis])<1e-9){if(origin[axis]<low||origin[axis]>high){tmax=-1;break;}}else{let a=(low-origin[axis])/dir[axis],b=(high-origin[axis])/dir[axis];if(a>b)[a,b]=[b,a];tmin=Math.max(tmin,a);tmax=Math.min(tmax,b);}}
      if(tmax>=tmin&&(!best||tmin<best.distance))best={mob:m,distance:tmin};}
    return best;
  }
  hit(m,damage) {
    if(m.hurt>0)return false;m.health-=damage;m.hurt=.35;m.flee=6;this.game.sound.play('hit');this.game.particles.burst(m.pos.x-.5,m.pos.y+.3,m.pos.z-.5,m.type==='sheep'?'#e7ddc4':'#78917a',8);
    if(m.health<=0){const inv=this.game.inventory;if(m.type==='sheep'){inv.add(B.WOOL,2);inv.add(I.RATION,1);}else{inv.add(I.COAL,2);this.game.ui.toast('Hollow defeated · +2 coal');}this.remove(m);}return true;
  }
  remove(m){this.game.scene.remove(m.group);this.list=this.list.filter(v=>v!==m);}
  serialize(){return this.list.map(m=>({type:m.type,pos:{...m.pos},health:m.health}));}
  dispose(){for(const m of [...this.list])this.remove(m);this.geo.dispose();for(const mat of this.materials.values())mat.dispose();}
}
