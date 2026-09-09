import test from 'node:test';
import assert from 'node:assert/strict';
import {B,I,RECIPES,isSolid,miningRule} from '../src/blocks.js';
import {seedNumber} from '../src/noise.js';
import {generateChunk,index,SIZE,HEIGHT,chunkKey} from '../src/terrain.js';
import {World} from '../src/world.js';
import {Inventory} from '../src/inventory.js';
import {moveBody,collides,raycast,overlapsBlock} from '../src/physics.js';
import {buildMesh,PAD,padIndex} from '../src/mesher.js';
import {validateSave,writeSave,readSave,SAVE_KEY,BACKUP_KEY,readSettings} from '../src/save.js';
const seed=seedNumber('WILLOW-2026');
test('terrain is deterministic, varies by seed, and contains trees, ore, water and caves',()=>{
  const first=generateChunk(0,0,seed);assert.deepEqual(first,generateChunk(0,0,seed));assert.notDeepEqual(first,generateChunk(0,0,seed+1));
  const types=new Set();let undergroundAir=false;
  for(let cz=-3;cz<=3;cz++)for(let cx=-3;cx<=3;cx++){const data=generateChunk(cx,cz,seed);for(const id of data)types.add(id);for(let z=0;z<16;z++)for(let x=0;x<16;x++){assert.equal(data[index(x,0,z)],B.BEDROCK);for(let y=4;y<12;y++)if(data[index(x,y,z)]===0)undergroundAir=true;}}
  for(const id of [B.GRASS,B.DIRT,B.STONE,B.LOG,B.LEAVES,B.COAL,B.IRON,B.CRYSTAL,B.WATER])assert.ok(types.has(id),`missing type ${id}`);assert.ok(undergroundAir);
});
test('chunk boundary edits, negative coordinates, unloading and reload preserve exactly',()=>{
  const w=new World(seed);w.ensureChunk(-1,-1);w.ensureChunk(0,-1);w.ensureChunk(-1,0);w.ensureChunk(0,0);w.dirty.clear();
  assert.ok(w.setBlock(-1,50,-1,B.LANTERN));assert.equal(w.getBlock(-1,50,-1),B.LANTERN);
  assert.ok(w.dirty.has('-1,-1'));assert.ok(w.dirty.has('0,-1'));assert.ok(w.dirty.has('-1,0'));assert.ok(w.dirty.has('0,0'));
  const reloaded=new World(seed,JSON.parse(JSON.stringify(w.serialize())));assert.equal(reloaded.getBlock(-1,50,-1),B.LANTERN);
  assert.ok(!w.setBlock(0,0,0,B.AIR));assert.ok(!w.setBlock(0,HEIGHT,0,B.LOG));assert.ok(!w.setBlock(.5,30,0,B.LOG));
  w.plan(1000,1000,2);assert.ok(!w.chunks.has('-1,-1'));assert.equal(w.getBlock(-1,50,-1),B.LANTERN);
});
test('spawn is dry and player-sized space is clear',()=>{const w=new World(seed),p=w.findSpawn(),body={pos:p,radius:.29,height:1.78};assert.ok(!collides(w,body));assert.ok(isSolid(w.getBlock(p.x,p.y-.1,p.z)));assert.notEqual(w.getBlock(p.x,p.y,p.z),B.WATER);});
test('inventory merges stacks, rejects full additions and cannot duplicate a moved item',()=>{
  const inv=new Inventory();assert.ok(inv.add(B.LOG,70));assert.equal(inv.slots[0].count,64);assert.equal(inv.slots[1].count,6);inv.move(1,2);assert.equal(inv.slots[1],null);assert.equal(inv.count(B.LOG),70);inv.move(2,0);assert.equal(inv.count(B.LOG),70);
  assert.ok(!inv.remove(B.LOG,71));assert.equal(inv.count(B.LOG),70);assert.ok(inv.remove(B.LOG,65));assert.equal(inv.count(B.LOG),5);
  inv.slots=Array.from({length:36},()=>({id:B.STONE,count:64}));assert.ok(!inv.add(B.LOG,1));assert.equal(inv.count(B.STONE),2304);assert.ok(!inv.add(B.STONE,-1));
});
test('crafting enforces bench and ingredients atomically, including output capacity',()=>{
  const inv=new Inventory();inv.add(B.LOG,1);assert.ok(inv.craft('planks').ok);assert.equal(inv.count(B.PLANKS),4);assert.equal(inv.count(B.LOG),0);
  inv.add(B.COBBLE,3);inv.add(I.STICK,2);assert.ok(!inv.craft('stone-pick',false).ok);assert.equal(inv.count(B.COBBLE),3);assert.ok(inv.craft('stone-pick',true).ok);assert.equal(inv.count(I.STONE_PICK),1);assert.equal(inv.count(I.STICK),0);
  const full=new Inventory();full.slots=Array.from({length:36},()=>({id:B.STONE,count:64}));full.slots[0]={id:B.LOG,count:64};const before=full.serialize();assert.ok(!full.craft('planks').ok);assert.deepEqual(full.serialize(),before);
  full.slots[0]={id:B.LOG,count:1};assert.ok(full.craft('planks').ok);assert.equal(full.count(B.PLANKS),4);
});
test('mining works with empty hands and held blocks, but ores require real tools',()=>{
  for(const held of [undefined,B.DIRT,B.PLANKS,I.BERRIES,I.SWORD]){const rule=miningRule(B.LOG,held);assert.ok(rule.allowed);assert.equal(rule.duration,1.1);assert.ok(Number.isFinite(miningRule(B.DIRT,held).duration));}
  assert.ok(!miningRule(B.STONE,B.STONE).allowed);assert.ok(!miningRule(B.COAL,B.COBBLE).allowed);assert.ok(miningRule(B.STONE,I.WOOD_PICK).allowed);assert.ok(!miningRule(B.IRON,I.WOOD_PICK).allowed);assert.ok(miningRule(B.IRON,I.STONE_PICK).allowed);assert.ok(miningRule(B.IRON,I.IRON_PICK).duration<miningRule(B.IRON,I.STONE_PICK).duration);assert.ok(miningRule(B.IRON,undefined,true).allowed);assert.ok(!miningRule(B.BEDROCK,I.IRON_PICK,true).allowed);
});
const flat={getBlock(x,y,z){x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);return y<1||x===3&&y<4?B.STONE:B.AIR;}};
test('gravity lands without penetration, walls stop movement, jumping clears the ground',()=>{
  const b={pos:{x:.5,y:8,z:.5},vel:{x:0,y:0,z:0},height:1.78,radius:.29,grounded:false};let impact=0;
  for(let i=0;i<120;i++){b.vel.y=Math.max(-32,b.vel.y-24/60);impact=Math.max(impact,moveBody(flat,b,1/60));}
  assert.ok(b.grounded);assert.ok(Math.abs(b.pos.y-1)<.001);assert.ok(impact>15);assert.ok(!collides(flat,b));
  for(let i=0;i<120;i++){b.vel.x=7;b.vel.y=-.4;moveBody(flat,b,1/60);}assert.ok(b.pos.x<2.711);assert.ok(!collides(flat,b));
  b.vel.y=8.4;moveBody(flat,b,1/60);assert.ok(b.pos.y>1.1);assert.ok(!b.grounded);assert.ok(overlapsBlock(b,2,1,0));
});
test('DDA picking returns correct placement face, handles negative and zero axes, respects reach',()=>{
  const w={getBlock(x,y,z){return x===-2&&y===3&&z===0?B.LOG:B.AIR;}};
  const hit=raycast(w,{x:.5,y:3.5,z:.5},{x:-1,y:0,z:0},6);assert.deepEqual([hit.x,hit.y,hit.z],[-2,3,0]);assert.deepEqual(hit.normal,{x:1,y:0,z:0});assert.deepEqual(hit.previous,{x:-1,y:3,z:0});assert.equal(raycast(w,{x:.5,y:3.5,z:.5},{x:-1,y:0,z:0},1),null);
});
test('meshing emits only visible faces, culls chunk-border faces, has finite AO and outward winding',()=>{
  const pad=new Uint8Array(PAD*PAD*(HEIGHT+2));pad[padIndex(0,10,0)]=B.STONE;
  let mesh=buildMesh(pad);assert.equal(mesh.solid.indices.length,36);assert.equal(mesh.water.indices.length,0);
  const {positions,normals,indices}=mesh.solid;
  for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,u=[0,1,2].map(j=>positions[b+j]-positions[a+j]),v=[0,1,2].map(j=>positions[c+j]-positions[a+j]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(cross.reduce((s,n,j)=>s+n*normals[a+j],0)>0);}
  pad[padIndex(1,10,0)]=B.STONE;mesh=buildMesh(pad);assert.equal(mesh.solid.indices.length,60);
  pad[padIndex(-1,10,0)]=B.STONE;mesh=buildMesh(pad);assert.equal(mesh.solid.indices.length,54);assert.ok([...mesh.solid.colors].every(Number.isFinite));
  pad[padIndex(4,10,0)]=B.WATER;pad[padIndex(5,10,0)]=B.WATER;mesh=buildMesh(pad);assert.equal(mesh.water.indices.length,60);
});
function sampleSave(){const w=new World(seed),spawn=w.findSpawn(),inv=new Inventory();inv.starter();w.setBlock(-1,45,16,B.LANTERN);return {version:1,name:'Regression world',seedLabel:'WILLOW-2026',seed,mode:'survival',time:245,spawn,player:{pos:{...spawn},yaw:0,pitch:0,health:17},inventory:inv.serialize(),selected:4,edits:w.serialize(),progress:{logs:true},mobs:[],savedAt:1};}
const memory=()=>{const map=new Map();return {map,getItem:key=>map.get(key)||null,setItem:(key,v)=>map.set(key,v)};};
test('world save round trip includes blocks, inventory, health, position and clock',()=>{const s=sampleSave(),storage=memory();writeSave(s,storage);const loaded=readSave(storage);assert.deepEqual(loaded,s);const w=new World(loaded.seed,loaded.edits);assert.equal(w.getBlock(-1,45,16),B.LANTERN);});
test('corrupt primary save falls back to backup; a quota error keeps the previous primary',()=>{
  const storage=memory(),s=sampleSave();writeSave(s,storage);writeSave({...s,time:300},storage);assert.ok(storage.getItem(BACKUP_KEY));storage.setItem(SAVE_KEY,'broken{');assert.equal(readSave(storage).time,245);
  storage.setItem(SAVE_KEY,JSON.stringify(s));storage.setItem=()=>{throw new Error('QuotaExceededError');};assert.throws(()=>writeSave({...s,time:500},storage));assert.equal(readSave(storage).time,245);
});
test('invalid imports and malformed settings fail safely',()=>{
  const s=sampleSave();assert.throws(()=>validateSave({...s,version:999}));assert.throws(()=>validateSave({...s,player:{...s.player,pos:{x:Infinity,y:0,z:0}}}));assert.throws(()=>validateSave({...s,edits:[['0,0',[[0,0]]]]}));assert.throws(()=>validateSave({...s,mobs:[null]}));assert.throws(()=>validateSave({...s,inventory:[{id:9999,count:-1}]}));
  const storage=memory();storage.setItem('wildwood.settings.v1',JSON.stringify({radius:99,fov:NaN,shadows:false}));assert.equal(readSettings(storage).radius,4);assert.equal(readSettings(storage).fov,78);assert.equal(readSettings(storage).shadows,false);
});
