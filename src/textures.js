import * as THREE from 'three';
import {B,BLOCKS,ITEMS,tileFor} from './blocks.js';
import {hash} from './noise.js';
const PALETTE=['#92ae60','#967451','#997653','#999d95','#dfce99','#8c613c','#bf945e','#78944d','#c69b66','#8b9189','#979c92','#979c92','#7e9690','#465052','#72adb4','#a97948','#bf945e','#f9c875','#b9d8cf','#a7aca2','#e6ddc9','#63894b'];
export function makeTextures() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  for(let tile=0;tile<22;tile++) {
    const ox=(tile%8)*16,oy=Math.floor(tile/8)*16;
    ctx.save();ctx.translate(ox,oy);
    if(tile!==18&&tile!==21){ctx.fillStyle=PALETTE[tile];ctx.fillRect(0,0,16,16);}
    const px=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    if(tile!==18&&tile!==21)for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
      const n=hash(x,tile,y,728);ctx.fillStyle=n>.5?`rgba(255,247,217,${(n-.5)*.21})`:`rgba(29,38,32,${(.5-n)*.24})`;ctx.fillRect(x,y,1,1);
    }
    if(tile===0){for(let i=0;i<14;i++){const x=Math.floor(hash(i,0,0)*15),y=Math.floor(hash(i,1,0)*15);px(x,y,2,1,'#9dbb69');if(i%3===0)px(x,y+1,1,1,'#829c53');}}
    if(tile===1){px(0,0,16,3,'#90aa5c');for(let x=0;x<16;x++)px(x,3,1,Math.floor(hash(x,0,0)*3),'#809c50');}
    if(tile===5){for(let x=1;x<16;x+=3){px(x,0,1,16,'#684a31');px(x+1,0,1,16,'#a17a4d');}px(5,5,3,5,'#684a31');px(6,6,1,3,'#bb8b52');}
    if(tile===6){for(let i=1;i<8;i+=2){ctx.strokeStyle=i%4===1?'#88603b':'#d6ad70';ctx.strokeRect(i+.5,i+.5,15-i*2,15-i*2);}px(7,7,2,2,'#90623b');}
    if(tile===7){for(let i=0;i<20;i++){const x=Math.floor(hash(i,0,4)*15),y=Math.floor(hash(i,1,4)*15);px(x,y,3,2,i%2?'#648441':'#89a85a');}for(let i=0;i<8;i++)ctx.clearRect(Math.floor(hash(i,8,4)*15),Math.floor(hash(i,9,4)*15),1,1);}
    if(tile===8||tile===15||tile===16){for(let y=3;y<16;y+=4){px(0,y,16,1,'#977044');px(0,y+1,16,1,'#d4ad76');px(y%8?5:11,y-3,1,3,'#ac804d');}if(tile===15){px(0,0,2,16,'#785431');px(14,0,2,16,'#785431');px(3,4,10,4,'#6b5135');px(5,5,2,2,'#d3af70');}if(tile===16){px(0,0,16,2,'#795832');px(0,14,16,2,'#795832');for(let i=5;i<15;i+=5){px(i,2,1,12,'#825f38');px(2,i,12,1,'#825f38');}}}
    if(tile===9||tile===19){for(let y=0;y<16;y+=5){px(0,y,16,1,'#656e65');for(let x=(y%2?0:4);x<16;x+=8){px(x,y,1,5,'#656e65');px(x+1,y+1,6,1,'#b4b7a8');}}}
    if([10,11,12].includes(tile)){for(let i=0;i<7;i++){const x=1+Math.floor(hash(i,tile,4)*12),y=1+Math.floor(hash(i,tile,5)*12);px(x,y,3,2,tile===10?'#404a45':tile===11?'#ad7c61':'#5da795');px(x+1,y,1,1,tile===10?'#58615a':tile===11?'#dfb397':'#b6eee0');}}
    if(tile===13){for(let i=0;i<12;i++)px(Math.floor(hash(i,0,5)*15),Math.floor(hash(i,1,5)*15),3,2,'#30393b');}
    if(tile===14){for(let i=0;i<8;i++)px(Math.floor(hash(i,1,8)*13),Math.floor(hash(i,2,8)*15),3,1,'rgba(204,235,221,.25)');}
    if(tile===17){px(0,0,16,2,'#795d37');px(0,14,16,2,'#795d37');px(0,0,2,16,'#795d37');px(14,0,2,16,'#795d37');px(3,3,10,10,'#ffe0a0');px(5,4,6,8,'#fff0c4');px(7,0,2,16,'#b88842');}
    if(tile===18){px(0,0,16,1,'#b0d8cd');px(0,15,16,1,'#86b5af');px(0,0,1,16,'#b0d8cd');px(15,0,1,16,'#86b5af');for(let i=3;i<8;i++){px(i,12-i,1,1,'#d1e7da');px(i+6,18-i,1,1,'#d1e7da');}}
    if(tile===20){for(let y=0;y<16;y+=3)for(let x=0;x<16;x+=3)px(x,y,2,1,'#f5ecd7');}
    if(tile===21){px(7,6,2,10,'#638544');px(4,10,4,2,'#87a651');px(9,8,3,2,'#779647');px(5,3,6,4,'#e7ae62');px(6,2,4,6,'#f3c980');px(7,4,2,2,'#b96c42');px(11,9,4,3,'#e9ba77');}
    ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
  const glow=document.createElement('canvas');glow.width=128;glow.height=64;const g=glow.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,128,64);g.drawImage(canvas,16,32,16,16,16,32,16,16);
  const emissive=new THREE.CanvasTexture(glow);emissive.colorSpace=THREE.SRGBColorSpace;emissive.magFilter=emissive.minFilter=THREE.NearestFilter;
  const icons=new Map();
  for(const key of Object.keys(ITEMS)){const id=Number(key);if(id)icons.set(id,makeIcon(id,canvas));}
  return {canvas,texture,emissive,icons};
}
function makeIcon(id,atlas) {
  const c=document.createElement('canvas');c.width=c.height=48;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  const item=ITEMS[id];
  const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  if(BLOCKS[id]&&!BLOCKS[id].plant){
    const face=(tile,m,shade)=>{ctx.save();ctx.setTransform(...m);ctx.drawImage(atlas,(tile%8)*16,Math.floor(tile/8)*16,16,16,0,0,16,16);if(shade){ctx.fillStyle=`rgba(25,32,25,${shade})`;ctx.fillRect(0,0,16,16);}ctx.restore();};
    face(tileFor(id,4),[1,.5,0,1.125,8,12],.15);face(tileFor(id,0),[1,-.5,0,1.125,24,20],.3);face(tileFor(id,2),[1,.5,-1,.5,24,4],0);
  } else if(item.icon==='pick'||item.icon==='sword'){
    ctx.save();ctx.translate(24,24);ctx.rotate(.68);rect(-3,-3,6,24,'#715337');rect(-2,-4,3,23,'#c3955e');
    if(item.icon==='pick'){rect(-15,-13,30,6,'#4c5751');rect(-14,-15,28,5,item.color);rect(10,-11,5,7,item.color);rect(-15,-11,5,7,item.color);}
    else{rect(-3,-23,6,24,'#616b62');rect(-2,-24,5,22,item.color);rect(-9,-2,18,4,'#9b8056');}ctx.restore();
  } else if(item.icon==='stick'){ctx.save();ctx.translate(24,24);ctx.rotate(.65);rect(-3,-16,6,32,'#7d5937');rect(-2,-16,3,32,'#bf9560');ctx.restore();}
  else if(item.icon==='berries'){rect(22,8,3,9,'#65814a');rect(24,8,9,4,'#8ba457');[[15,16],[25,17],[20,26]].forEach(([x,y])=>{rect(x-2,y+2,13,9,'#9e534e');rect(x,y,9,12,item.color);rect(x+1,y+2,3,3,'#edb0a0');});}
  else if(BLOCKS[id]?.plant){ctx.drawImage(atlas,80,32,16,16,8,5,32,32);}
  else{ctx.beginPath();ctx.moveTo(11,17);ctx.lineTo(27,10);ctx.lineTo(38,18);ctx.lineTo(34,32);ctx.lineTo(19,38);ctx.lineTo(9,29);ctx.closePath();ctx.fillStyle=item.color;ctx.fill();rect(15,17,10,5,'rgba(255,255,230,.3)');rect(25,28,8,4,'rgba(30,40,35,.23)');}
  return c.toDataURL();
}
