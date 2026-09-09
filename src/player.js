import {B} from './blocks.js';
import {moveBody,collides} from './physics.js';
export class Player {
  constructor(pos,saved) {
    this.pos={...pos};this.vel={x:0,y:0,z:0};this.radius=.29;this.height=1.78;this.grounded=false;this.blocked=false;
    this.yaw=saved?.yaw??-.6;this.pitch=saved?.pitch??-.12;this.health=saved?.health??20;this.air=10;this.invulnerable=0;this.flying=false;this.walk=0;this.step=0;this.bob=0;this.underwater=false;this.inWater=false;
  }
  look(dx,dy,sensitivity){this.yaw-=dx*.002*sensitivity;this.pitch=Math.max(-1.52,Math.min(1.52,this.pitch-dy*.002*sensitivity));}
  damage(amount,game,cause='The wilderness got the better of you.') {
    if(game.mode==='creative'||this.invulnerable>0||this.health<=0)return false;
    this.health=Math.max(0,this.health-amount);this.invulnerable=.85;game.sound.play('hit');game.ui.flash();if(!this.health)game.die(cause);return true;
  }
  update(dt,game) {
    const {world,keys,settings}=game,wasGrounded=this.grounded;this.invulnerable=Math.max(0,this.invulnerable-dt);
    this.inWater=world.getBlock(this.pos.x,this.pos.y+.6,this.pos.z)===B.WATER;
    this.underwater=world.getBlock(this.pos.x,this.pos.y+1.6,this.pos.z)===B.WATER;
    if(this.underwater&&!this.flying){this.air=Math.max(0,this.air-dt);if(!this.air)this.damage(2,game,'You ran out of air. Hold Space to swim up.');}else this.air=Math.min(10,this.air+dt*3);
    let forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
    const length=Math.hypot(forward,side);if(length){forward/=length;side/=length;}
    const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),speed=this.flying?(sprint?16:9):this.inWater?3.1:sprint?7:4.4;
    const tx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)*speed,tz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side)*speed,blend=Math.min(1,dt*(wasGrounded||this.flying?17:7));
    this.vel.x+=(tx-this.vel.x)*blend;this.vel.z+=(tz-this.vel.z)*blend;
    if(this.flying){this.vel.y=((keys.has('Space')?1:0)-(keys.has('ControlLeft')||keys.has('KeyC')?1:0))*speed;}
    else if(this.inWater){this.vel.y=Math.max(-3,this.vel.y-7*dt);if(keys.has('Space'))this.vel.y=4.3;}
    else {this.vel.y=Math.max(-32,this.vel.y-24*dt);if(wasGrounded&&keys.has('Space'))this.vel.y=8.4;}
    const impact=moveBody(world,this,dt);
    if(impact>12.5&&!this.inWater&&!this.flying)this.damage(Math.ceil((impact-12.5)*.85),game,'That was a long way down.');
    if(settings.autoJump&&this.blocked&&this.grounded&&length&&!this.flying)this.vel.y=8.4;
    const moving=Math.hypot(this.vel.x,this.vel.z);this.walk+=moving*dt;this.bob+=(Number(this.grounded&&moving>.5&&!this.flying)-this.bob)*dt*10;
    if(this.walk-this.step>2.2&&this.grounded&&moving>1){this.step=this.walk;game.sound.play('step');}
    if(this.pos.y<0)this.damage(20,game,'You wandered beyond the world.');
  }
  safe(world,pos){this.pos={...pos};this.vel={x:0,y:0,z:0};let attempts=0;while(collides(world,this)&&attempts++<65)this.pos.y+=1;}
  serialize(){return {pos:{...this.pos},yaw:this.yaw,pitch:this.pitch,health:this.health};}
}
