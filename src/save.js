import {BLOCKS,ITEMS} from './blocks.js';
import {HEIGHT,SIZE} from './terrain.js';
export const SAVE_KEY='wildwood.world.v1',BACKUP_KEY='wildwood.backup.v1',SETTINGS_KEY='wildwood.settings.v1';
const finite=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
const validPosition=p=>p&&finite(p.x,-100000,100000)&&finite(p.y,-10,HEIGHT+200)&&finite(p.z,-100000,100000);
export function validateSave(data) {
  if(!data||data.version!==1)throw new Error('This file is not a supported Wildwood world.');
  if(!Number.isInteger(data.seed)||data.seed<0||data.seed>4294967295)throw new Error('Invalid world seed.');
  if(!validPosition(data.player?.pos)||!validPosition(data.spawn))throw new Error('Invalid player position.');
  if(!['survival','creative'].includes(data.mode))throw new Error('Invalid game mode.');
  if(!finite(data.time,0,1e8)||!finite(data.player.health,0,20)||!finite(data.player.yaw,-1e9,1e9)||!finite(data.player.pitch,-Math.PI/2,Math.PI/2))throw new Error('Invalid player state.');
  if(!Array.isArray(data.inventory)||data.inventory.length!==36)throw new Error('Invalid inventory.');
  for(const slot of data.inventory)if(slot!==null&&(!ITEMS[slot?.id]||slot.id===0||!Number.isInteger(slot.count)||slot.count<1||slot.count>(ITEMS[slot.id].stack||64)))throw new Error('Invalid inventory item.');
  if(!Array.isArray(data.edits)||data.edits.length>50000)throw new Error('Invalid world data.');
  let total=0;const keys=new Set();
  for(const entry of data.edits){
    if(!Array.isArray(entry)||entry.length!==2)throw new Error('Invalid chunk.');
    const [key,list]=entry;
    if(typeof key!=='string'||!/^(-?\d+),(-?\d+)$/.test(key)||key.split(',').some(v=>Math.abs(Number(v))>6250)||keys.has(key)||!Array.isArray(list)||list.length>SIZE*SIZE*HEIGHT)throw new Error('Invalid chunk.');
    keys.add(key);total+=list.length;const indices=new Set();
    if(total>300000)throw new Error('This world exceeds the 300,000 edited-block limit.');
    for(const change of list){if(!Array.isArray(change)||change.length!==2||!Number.isInteger(change[0])||change[0]<SIZE*SIZE||change[0]>=SIZE*SIZE*HEIGHT||!BLOCKS[change[1]]||indices.has(change[0]))throw new Error('Invalid block data.');indices.add(change[0]);}
  }
  if(data.mobs!==undefined){if(!Array.isArray(data.mobs)||data.mobs.length>24)throw new Error('Invalid wildlife data.');for(const mob of data.mobs)if(!mob||!['sheep','hollow'].includes(mob.type)||!validPosition(mob.pos)||!finite(mob.health,.001,14))throw new Error('Invalid wildlife data.');}
  return {...data,name:String(data.name||'My Wildwood').slice(0,48),seedLabel:String(data.seedLabel||data.seed).slice(0,64),selected:Number.isInteger(data.selected)?Math.max(0,Math.min(8,data.selected)):0,progress:data.progress&&typeof data.progress==='object'?data.progress:{}};
}
export function readSave(storage=localStorage) {
  for(const key of [SAVE_KEY,BACKUP_KEY]){
    try {const raw=storage.getItem(key);if(raw)return validateSave(JSON.parse(raw));}catch{}
  }
  return null;
}
export function writeSave(data,storage=localStorage) {
  const valid=validateSave(data),raw=JSON.stringify(valid),old=storage.getItem(SAVE_KEY);
  // Commit the new primary first. A quota failure leaves the old save intact.
  storage.setItem(SAVE_KEY,raw);
  if(old){try{validateSave(JSON.parse(old));storage.setItem(BACKUP_KEY,old);}catch{}}
  return raw;
}
export const DEFAULT_SETTINGS={sensitivity:1,fov:78,radius:4,volume:.35,shadows:true,autoJump:true,showFps:false,quality:1};
export function readSettings(storage=localStorage) {
  let s={};try{s=JSON.parse(storage.getItem(SETTINGS_KEY)||'{}')||{};}catch{}
  return {sensitivity:finite(s.sensitivity,.2,2.5)?s.sensitivity:1,fov:finite(s.fov,60,100)?s.fov:78,radius:[2,3,4,5,6].includes(s.radius)?s.radius:4,volume:finite(s.volume,0,1)?s.volume:.35,shadows:typeof s.shadows==='boolean'?s.shadows:true,autoJump:typeof s.autoJump==='boolean'?s.autoJump:true,showFps:!!s.showFps,quality:[.65,1,1.5].includes(s.quality)?s.quality:1};
}
