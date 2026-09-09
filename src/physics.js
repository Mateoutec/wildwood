import {B,isSolid} from './blocks.js';
export const bodyBounds = b=>({min:{x:b.pos.x-b.radius,y:b.pos.y,z:b.pos.z-b.radius},max:{x:b.pos.x+b.radius,y:b.pos.y+b.height,z:b.pos.z+b.radius}});
export function overlapsBlock(body,x,y,z) {
  const {min,max}=bodyBounds(body);
  return max.x>x+.001&&min.x<x+.999&&max.y>y+.001&&min.y<y+.999&&max.z>z+.001&&min.z<z+.999;
}
export function collides(world,body) {
  const {min,max}=bodyBounds(body);
  for(let y=Math.floor(min.y+.001);y<=Math.floor(max.y-.001);y++)for(let z=Math.floor(min.z+.001);z<=Math.floor(max.z-.001);z++)for(let x=Math.floor(min.x+.001);x<=Math.floor(max.x-.001);x++)if(isSolid(world.getBlock(x,y,z)))return true;
  return false;
}
export function moveBody(world,body,dt) {
  body.grounded=false;body.blocked=false;let impact=0;
  for(const axis of ['x','z','y']) {
    const delta=body.vel[axis]*dt;
    if(Math.abs(delta)<1e-8)continue;
    body.pos[axis]+=delta;
    const {min,max}=bodyBounds(body);
    let nearest=body.pos[axis],hit=false;
    for(let y=Math.floor(min.y+.0001);y<=Math.floor(max.y-.0001);y++)for(let z=Math.floor(min.z+.0001);z<=Math.floor(max.z-.0001);z++)for(let x=Math.floor(min.x+.0001);x<=Math.floor(max.x-.0001);x++) {
      if(!isSolid(world.getBlock(x,y,z)))continue;
      const coord=axis==='x'?x:axis==='y'?y:z;
      const offset=axis==='y'?(delta>0?body.height:0):body.radius;
      const edge=delta>0?coord-offset-.0001:coord+1+offset+.0001;
      nearest=delta>0?Math.min(nearest,edge):Math.max(nearest,edge);hit=true;
    }
    if(hit){body.pos[axis]=nearest;if(axis==='y'&&delta<0){body.grounded=true;impact=-body.vel.y;}else if(axis!=='y')body.blocked=true;body.vel[axis]=0;}
  }
  return impact;
}
export function raycast(world,origin,dir,maxDistance=6) {
  let x=Math.floor(origin.x),y=Math.floor(origin.y),z=Math.floor(origin.z),dist=0,normal={x:0,y:0,z:0};
  const sx=Math.sign(dir.x),sy=Math.sign(dir.y),sz=Math.sign(dir.z);
  const dx=dir.x?Math.abs(1/dir.x):Infinity,dy=dir.y?Math.abs(1/dir.y):Infinity,dz=dir.z?Math.abs(1/dir.z):Infinity;
  let tx=dir.x?(sx>0?x+1-origin.x:origin.x-x)*dx:Infinity;
  let ty=dir.y?(sy>0?y+1-origin.y:origin.y-y)*dy:Infinity;
  let tz=dir.z?(sz>0?z+1-origin.z:origin.z-z)*dz:Infinity;
  for(let i=0;i<128&&dist<=maxDistance;i++) {
    const id=world.getBlock(x,y,z,false);
    if(id!==B.AIR&&id!==B.WATER)return {x,y,z,id,normal,distance:dist,previous:{x:x+normal.x,y:y+normal.y,z:z+normal.z}};
    if(tx<=ty&&tx<=tz){x+=sx;dist=tx;tx+=dx;normal={x:-sx,y:0,z:0};}
    else if(ty<=tz){y+=sy;dist=ty;ty+=dy;normal={x:0,y:-sy,z:0};}
    else {z+=sz;dist=tz;tz+=dz;normal={x:0,y:0,z:-sz};}
  }
  return null;
}
