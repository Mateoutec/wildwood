// Rasterize the game's existing vector cube mark into Windows icon sizes.
// No remote art, native toolchain or image dependency is needed.
const fs = require('node:fs');
const path = require('node:path');
const {deflateSync} = require('node:zlib');
const crcTable = Array.from({length:256},(_,n) => {for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(buffer) {let c=0xffffffff;for(const b of buffer)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type, bytes) {const name=Buffer.from(type),out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length,0);name.copy(out,4);bytes.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,bytes])),out.length-4);return out;}
const shapes=[{points:[[12,22],[32,11],[52,22],[32,34]],color:[173,199,110]}, {points:[[12,22],[32,34],[32,55],[12,43]],color:[102,128,75]}, {points:[[32,34],[52,22],[52,43],[32,55]],color:[219,165,101]}];
function inside(x,y,polygon) {let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)result=!result;}return result;}
function png(size) {
  const scan=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    let r=0,g=0,b=0,alpha=0;
    for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++) {
      const px=(x+(sx+.5)/2)*64/size,py=(y+(sy+.5)/2)*64/size;
      const dx=Math.max(14-px,px-50,0),dy=Math.max(14-py,py-50,0);
      if(dx*dx+dy*dy>196)continue;
      let color=[23,43,43];for(const shape of shapes)if(inside(px,py,shape.points))color=shape.color;
      r+=color[0];g+=color[1];b+=color[2];alpha++;
    }
    const i=y*(size*4+1)+1+x*4;if(alpha){scan[i]=r/alpha;scan[i+1]=g/alpha;scan[i+2]=b/alpha;scan[i+3]=alpha*255/4;}
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
const sizes=[16,32,48,64,128,256],images=sizes.map(png),head=Buffer.alloc(6+16*sizes.length);head.writeUInt16LE(1,2);head.writeUInt16LE(sizes.length,4);let offset=head.length;
images.forEach((bytes,i)=>{const p=6+i*16;head[p]=head[p+1]=sizes[i]===256?0:sizes[i];head.writeUInt16LE(1,p+4);head.writeUInt16LE(32,p+6);head.writeUInt32LE(bytes.length,p+8);head.writeUInt32LE(offset,p+12);offset+=bytes.length;});
fs.writeFileSync(path.join(__dirname,'icon.ico'),Buffer.concat([head,...images]));fs.writeFileSync(path.join(__dirname,'icon.png'),images.at(-1));
console.log('Wildwood Windows icons generated.');
