import {B} from './blocks.js';
import {hash,noise2,noise3,fbm} from './noise.js';
export const SIZE=16, HEIGHT=64, SEA=18;
export const index=(x,y,z)=>x+SIZE*(z+SIZE*y);
export const chunkKey=(x,z)=>`${x},${z}`;
export function columnAt(x,z,seed) {
  const hills=fbm(x/90,z/90,seed)*12+fbm(x/29,z/29,seed+73,3)*3;
  const river=Math.abs(noise2(x/140+19,z/140-31,seed+417));
  const valley=Math.max(0,1-river/.14)*9;
  const rise=Math.max(0,noise2(x/65,z/65,seed+82)-.25)*16;
  const height=Math.max(6,Math.min(47,Math.floor(25+hills+rise-valley)));
  const sand=height<=SEA+1;
  return {height,sand,biome: sand?'Riverlands':rise>3?'Stone ridges':'Oak meadows'};
}
export function generateChunk(cx,cz,seed) {
  const data=new Uint8Array(SIZE*SIZE*HEIGHT);
  const ox=cx*SIZE,oz=cz*SIZE;
  for(let z=0;z<SIZE;z++) for(let x=0;x<SIZE;x++) {
    const wx=ox+x,wz=oz+z,{height:h,sand}=columnAt(wx,wz,seed);
    for(let y=0;y<=Math.max(h,SEA);y++) {
      let id;
      if(y===0) id=B.BEDROCK;
      else if(y>h) id=B.WATER;
      else if(y===h) id=sand?B.SAND:B.GRASS;
      else if(y>=h-3) id=sand?B.SAND:B.DIRT;
      else {
        id=B.STONE;
        if(y>3 && y<h-4 && noise3(wx/13,y/8,wz/13,seed+591)>.46) id=B.AIR;
        else {
          const ore=hash(wx,y,wz,seed+94);
          if(ore>.965) id=B.COAL;
          else if(y<20&&ore>.943) id=B.IRON;
          else if(y<11&&ore<.012) id=B.CRYSTAL;
        }
      }
      data[index(x,y,z)]=id;
    }
    if(!sand && hash(Math.floor(wx/3),0,Math.floor(wz/3),seed+927)>.966) {
      data[index(x,h,z)]=hash(wx,h,wz,seed+88)>.78?B.COAL:B.STONE;
      data[index(x,h-1,z)]=B.STONE;
    }
    if(!sand&&hash(wx,1,wz,seed+21)>.978) data[index(x,h+1,z)]=B.FLOWER;
  }
  // Neighboring tree origins make canopies independent of chunk load order.
  for(let gz=Math.floor((oz-3)/7);gz<=Math.floor((oz+SIZE+2)/7);gz++) for(let gx=Math.floor((ox-3)/7);gx<=Math.floor((ox+SIZE+2)/7);gx++) {
    if(hash(gx,23,gz,seed)<.35) continue;
    const tx=gx*7+Math.floor(hash(gx,44,gz,seed)*5),tz=gz*7+Math.floor(hash(gx,45,gz,seed)*5);
    const col=columnAt(tx,tz,seed);
    if(col.sand||col.height<SEA+3) continue;
    const h=4+Math.floor(hash(gx,26,gz,seed)*3),ty=col.height+1;
    for(let dy=0;dy<h+2;dy++) for(let dz=-2;dz<=2;dz++) for(let dx=-2;dx<=2;dx++) {
      const lx=tx+dx-ox,lz=tz+dz-oz,y=ty+dy;
      if(lx<0||lx>=SIZE||lz<0||lz>=SIZE||y>=HEIGHT)continue;
      const idx=index(lx,y,lz);
      if(dx===0&&dz===0&&dy<h) data[idx]=B.LOG;
      else if(dy>=h-2&&dy<=h+1&&Math.abs(dx)+Math.abs(dz)<=(dy===h+1?1:3)&&(!data[idx]||data[idx]===B.FLOWER)) data[idx]=B.LEAVES;
    }
  }
  return data;
}
