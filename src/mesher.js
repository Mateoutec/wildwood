import {B,BLOCKS,isOpaque,tileFor} from './blocks.js';
import {SIZE,HEIGHT} from './terrain.js';
export const PAD=SIZE+2;
export const padIndex=(x,y,z)=>(x+1)+PAD*((z+1)+PAD*(y+1));
export const FACES=[
  {n:[1,0,0],c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],shade:.86},
  {n:[-1,0,0],c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],shade:.72},
  {n:[0,1,0],c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1},
  {n:[0,-1,0],c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.55},
  {n:[0,0,1],c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],shade:.92},
  {n:[0,0,-1],c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],shade:.78},
];
const empty=()=>({positions:[],normals:[],uvs:[],colors:[],indices:[]});
function quad(out,positions,normal,tile,shades) {
  const base=out.positions.length/3,col=tile%8,row=Math.floor(tile/8),u0=(col*16+.15)/128,u1=(col*16+15.85)/128,v1=1-(row*16+.15)/64,v0=1-(row*16+15.85)/64;
  for(let i=0;i<4;i++){out.positions.push(...positions[i]);out.normals.push(...normal);const a=shades[i];out.colors.push(a,a,a);}
  out.uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);
  if(shades[0]+shades[2]>shades[1]+shades[3])out.indices.push(base,base+1,base+3,base+1,base+2,base+3);
  else out.indices.push(base,base+1,base+2,base,base+2,base+3);
}
export function buildMesh(pad) {
  const solid=empty(),water=empty();
  const get=(x,y,z)=>pad[padIndex(x,y,z)]||0;
  for(let y=0;y<HEIGHT;y++)for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++) {
    const id=get(x,y,z);if(!id)continue;
    if(id===B.FLOWER){
      for(const c of [[[.12,0,.12],[.88,0,.88],[.88,.85,.88],[.12,.85,.12]],[[.88,0,.12],[.12,0,.88],[.12,.85,.88],[.88,.85,.12]]]){
        const p=c.map(v=>[v[0]+x,v[1]+y,v[2]+z]);quad(solid,p,[0,1,0],21,[1,1,1,1]);quad(solid,[...p].reverse(),[0,1,0],21,[1,1,1,1]);
      }continue;
    }
    for(let f=0;f<6;f++) {
      const {n,c,shade}=FACES[f],neighbor=get(x+n[0],y+n[1],z+n[2]);
      if(isOpaque(neighbor)||(neighbor===id&&(id===B.WATER||id===B.LEAVES||id===B.GLASS)))continue;
      if(y===0&&f===3)continue;
      const positions=c.map(v=>[x+v[0],y+(id===B.WATER&&v[1]===1&&get(x,y+1,z)!==B.WATER?.86:v[1]),z+v[2]]);
      const axes=[0,1,2].filter(i=>!n[i]);
      const shades=c.map(v=>{
        if(id===B.LANTERN)return 1.15;
        const p=[x+n[0],y+n[1],z+n[2]],a=axes[0],b=axes[1],s1=[...p],s2=[...p],cor=[...p];
        s1[a]+=v[a]?1:-1;s2[b]+=v[b]?1:-1;cor[a]+=v[a]?1:-1;cor[b]+=v[b]?1:-1;
        const side1=+isOpaque(get(...s1)),side2=+isOpaque(get(...s2)),corner=+isOpaque(get(...cor));
        const ao=side1&&side2?0:3-side1-side2-corner;
        return shade*(.65+ao*.1167);
      });
      quad(id===B.WATER?water:solid,positions,n,tileFor(id,f),shades);
    }
  }
  const pack=o=>({positions:new Float32Array(o.positions),normals:new Float32Array(o.normals),uvs:new Float32Array(o.uvs),colors:new Float32Array(o.colors),indices:new Uint32Array(o.indices)});
  return {solid:pack(solid),water:pack(water)};
}
