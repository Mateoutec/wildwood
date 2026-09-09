import {B,BLOCKS,isSolid} from './blocks.js';
import {SIZE,HEIGHT,SEA,index,chunkKey,columnAt,generateChunk} from './terrain.js';
export class World {
  constructor(seed,edits=[]) {
    this.seed=seed;this.chunks=new Map();this.edits=new Map();this.dirty=new Set();this.queue=[];this.center='';this.radius=4;this.cx=0;this.cz=0;
    for(const [key,entries] of edits)this.edits.set(key,new Map(entries));
    this.onUnload=()=>{};
  }
  ensureChunk(cx,cz) {
    const key=chunkKey(cx,cz);
    if(this.chunks.has(key))return this.chunks.get(key);
    const data=generateChunk(cx,cz,this.seed);
    for(const [i,id] of this.edits.get(key)||[]) data[i]=id;
    const chunk={cx,cz,key,data,revision:0};this.chunks.set(key,chunk);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)this.markDirty(cx+dx,cz+dz);
    return chunk;
  }
  markDirty(cx,cz){const key=chunkKey(cx,cz),chunk=this.chunks.get(key);if(chunk){chunk.revision++;this.dirty.add(key);}}
  getBlock(x,y,z,load=true) {
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
    if(y<0)return B.BEDROCK;if(y>=HEIGHT)return B.AIR;
    if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>100000||Math.abs(z)>100000)return B.BEDROCK;
    const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE);
    const c=load?this.ensureChunk(cx,cz):this.chunks.get(chunkKey(cx,cz));
    return c?c.data[index(x-cx*SIZE,y,z-cz*SIZE)]:B.AIR;
  }
  setBlock(x,y,z,id) {
    if(![x,y,z].every(Number.isInteger)||y<=0||y>=HEIGHT||Math.abs(x)>100000||Math.abs(z)>100000||!BLOCKS[id])return false;
    const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),lx=x-cx*SIZE,lz=z-cz*SIZE,c=this.ensureChunk(cx,cz),i=index(lx,y,lz);
    if(c.data[i]===B.BEDROCK||c.data[i]===id)return false;
    c.data[i]=id;
    if(!this.edits.has(c.key))this.edits.set(c.key,new Map());
    this.edits.get(c.key).set(i,id);this.markDirty(cx,cz);
    const xs=[0],zs=[0];if(lx===0)xs.push(-1);if(lx===SIZE-1)xs.push(1);if(lz===0)zs.push(-1);if(lz===SIZE-1)zs.push(1);
    for(const dx of xs)for(const dz of zs)if(dx||dz)this.markDirty(cx+dx,cz+dz);
    return true;
  }
  plan(x,z,radius=this.radius) {
    const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),center=`${cx},${cz},${radius}`;
    if(center===this.center)return;
    this.center=center;this.cx=cx;this.cz=cz;this.radius=radius;
    this.queue=[];
    for(let dz=-radius-1;dz<=radius+1;dz++)for(let dx=-radius-1;dx<=radius+1;dx++){
      const key=chunkKey(cx+dx,cz+dz);
      if(!this.chunks.has(key))this.queue.push({cx:cx+dx,cz:cz+dz,d:dx*dx+dz*dz});
      else this.dirty.add(key);
    }
    this.queue.sort((a,b)=>a.d-b.d);
    for(const [key,c] of this.chunks)if(Math.max(Math.abs(c.cx-cx),Math.abs(c.cz-cz))>radius+2){this.chunks.delete(key);this.dirty.delete(key);this.onUnload(key);}
  }
  stream(budget=5) {
    const start=performance.now();let n=0;
    while(this.queue.length&&performance.now()-start<budget&&n<2){const p=this.queue.shift();this.ensureChunk(p.cx,p.cz);n++;}
  }
  getSurface(x,z,load=true) {
    for(let y=HEIGHT-2;y>0;y--){const b=this.getBlock(x,y,z,load);if(isSolid(b)&&b!==B.LEAVES&&b!==B.LOG)return y+1;}
    return columnAt(x,z,this.seed).height+1;
  }
  findSpawn() {
    for(let r=0;r<96;r+=4)for(let i=0;i<Math.max(1,r*2);i++){
      const a=i/Math.max(1,r*2)*Math.PI*2,x=Math.round(Math.cos(a)*r),z=Math.round(Math.sin(a)*r),h=columnAt(x,z,this.seed).height+1;
      if(h<SEA+3)continue;
      if(!isSolid(this.getBlock(x,h,z))&&!isSolid(this.getBlock(x,h+1,z))&&!isSolid(this.getBlock(x+1,h,z)))return {x:x+.5,y:h+.05,z:z+.5};
    }
    return {x:.5,y:this.getSurface(0,0)+2,z:.5};
  }
  nearby(id,p,r=4) {
    for(let y=Math.max(1,Math.floor(p.y)-3);y<=Math.min(HEIGHT-1,Math.floor(p.y)+3);y++)for(let z=Math.floor(p.z)-r;z<=p.z+r;z++)for(let x=Math.floor(p.x)-r;x<=p.x+r;x++)if(this.getBlock(x,y,z,false)===id&&Math.hypot(x+.5-p.x,y+.5-p.y,z+.5-p.z)<=r+1)return true;
    return false;
  }
  serialize(){return [...this.edits].map(([key,map])=>[key,[...map]]);}
  get editCount(){let n=0;for(const map of this.edits.values())n+=map.size;return n;}
}
