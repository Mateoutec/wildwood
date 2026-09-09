import * as THREE from 'three';
import './style.css';
import {B,I,BLOCKS,ITEMS,isSolid,miningRule} from './blocks.js';
import {seedNumber,hash} from './noise.js';
import {SIZE,HEIGHT,chunkKey} from './terrain.js';
import {World} from './world.js';
import {WorldRenderer} from './world-renderer.js';
import {Inventory} from './inventory.js';
import {Player} from './player.js';
import {Mobs} from './mobs.js';
import {raycast,overlapsBlock} from './physics.js';
import {makeTextures} from './textures.js';
import {Atmosphere,Particles} from './atmosphere.js';
import {Sound} from './audio.js';
import {UI} from './ui.js';
import {readSave,writeSave,validateSave,readSettings,DEFAULT_SETTINGS,SETTINGS_KEY} from './save.js';

class Game {
  constructor() {
    this.canvas=document.querySelector('#game');this.screen='title';this.active=false;this.returnScreen='title';this.saved=null;this.settings={...DEFAULT_SETTINGS};
    try{this.saved=readSave();this.settings=readSettings();}catch{}
    this.textures=makeTextures();this.sound=new Sound(this.settings.volume);this.keys=new Set();this.mouseDown=false;this.rightDown=false;this.dragLook=false;this.middleDown=false;this.accumulator=0;this.lastFrame=performance.now();this.fps=60;this.frameCount=0;this.fpsElapsed=0;this.hudTimer=0;this.lanternTimer=0;this.saveTimer=0;this.actionCooldown=0;this.useCooldown=0;this.noticeCooldown=0;this.miningTime=0;this.miningKey='';this.swing=0;this.previousNight=false;this.heldId=-1;this.notesHidden=false;
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x93b7b3);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.13;this.renderer.shadowMap.enabled=this.settings.shadows;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.autoClear=false;this.renderer.info.autoReset=false;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(this.settings.fov,innerWidth/innerHeight,.05,500);this.camera.rotation.order='YXZ';
    this.atmosphere=new Atmosphere(this.scene,this.renderer);this.particles=new Particles(this.scene);
    this.outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006,1.006,1.006)),new THREE.LineBasicMaterial({color:0xfff2bf,transparent:true,opacity:.65,depthTest:true}));this.outline.visible=false;this.scene.add(this.outline);
    this.handScene=new THREE.Scene();this.handCamera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.01,10);this.handScene.add(new THREE.HemisphereLight(0xfff4d6,0x7a7056,2));const handLight=new THREE.DirectionalLight(0xffe3ac,2);handLight.position.set(-1,3,2);this.handScene.add(handLight);this.hand=new THREE.Group();this.handScene.add(this.hand);
    this.ui=new UI(this);this.resize();this.bind();
    this.setupWorld(null,{name:'Wildwood',seed:'WILLOW-2026',mode:'survival'},true);this.ui.render('title');
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.save(false);this.open('pause');this.ui.toast('Graphics context lost. Reload this page to restore your saved world.');});
    this.renderer.setAnimationLoop(now=>this.frame(now));
  }
  setupWorld(saved,options={},preview=false) {
    this.worldRenderer?.dispose();this.mobs?.dispose();this.particles.particles=[];
    this.seedLabel=saved?.seedLabel??options.seed??'WILLOW-2026';this.name=saved?.name??options.name??'My Wildwood';this.mode=saved?.mode??options.mode??'survival';
    this.world=new World(saved?.seed??seedNumber(this.seedLabel),saved?.edits??[]);this.spawn=saved?.spawn??this.world.findSpawn();
    this.player=new Player(saved?.player.pos??this.spawn,saved?.player);this.player.safe(this.world,this.player.pos);
    this.inventory=new Inventory(saved?.inventory);if(!saved)this.inventory.starter();this.inventory.selected=saved?.selected??0;
    this.time=saved?.time??(.34*720);this.progress=saved?.progress??{};this.placedCount=Number(this.progress.placedCount)||0;
    this.worldRenderer=new WorldRenderer(this.scene,this.world,this.textures);this.world.plan(this.player.pos.x,this.player.pos.z,this.settings.radius);
    this.mobs=new Mobs(this,saved?.mobs??[]);this.saveTimer=0;this.lanternTimer=0;this.heldId=-1;this.ui.revision=-1;
    this.previewOrigin=new THREE.Vector3(this.spawn.x+13,this.spawn.y+8,this.spawn.z+17);this.previewTarget=new THREE.Vector3(this.spawn.x-4,this.spawn.y+1.5,this.spawn.z-8);this.previewTime=0;
    this.atmosphere.updateLanterns(this.world,this.player.pos);if(!preview)this.active=true;
  }
  begin(saved,options) {
    this.sound.start();this.open('loading');this.active=false;
    // Give the loading overlay a paint before generating collision chunks.
    setTimeout(()=>{try{this.setupWorld(saved,options);this.open('loading');this.loadingStarted=performance.now();}catch(error){this.open('title');this.ui.toast(`Could not open world: ${error.message}`);console.error(error);}},40);
  }
  open(screen) {
    this.screen=screen;this.clearInput();this.outline.visible=false;if(document.pointerLockElement===this.canvas)document.exitPointerLock();this.ui.render(screen);if(screen!=='loading'&&screen!=='title'&&this.active)this.save(false);
  }
  resume() {
    if(!this.active)return;if(this.player.health<=0){this.deathCause||='Your last adventure ended here. Return to your clearing to begin again.';this.open('dead');return;}this.sound.start();this.screen='playing';this.ui.render('playing');this.clearInput();this.accumulator=0;
    try{const promise=this.canvas.requestPointerLock();promise?.catch(()=>this.enableDragLook());}catch{this.enableDragLook();}
  }
  enableDragLook(){if(this.screen!=='playing')return;this.dragLook=true;this.ui.toast('Mouse capture unavailable. Hold middle mouse to look; arrow keys also turn.');}
  clearInput(){this.keys.clear();this.mouseDown=false;this.rightDown=false;this.middleDown=false;this.miningTime=0;this.miningKey='';}
  bind() {
    window.addEventListener('resize',()=>this.resize());
    document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===this.canvas)this.dragLook=false;else if(this.screen==='playing'&&!this.dragLook)this.open('pause');});
    document.addEventListener('mousemove',e=>{if(this.screen==='playing'&&(document.pointerLockElement===this.canvas||(this.dragLook&&this.middleDown)))this.player.look(e.movementX,e.movementY,this.settings.sensitivity);});
    document.addEventListener('mousedown',e=>{if(this.screen!=='playing'||e.target.closest('button'))return;this.sound.start();if(e.button===0){this.mouseDown=true;this.attackMob();}if(e.button===2){this.rightDown=true;this.useItem();}if(e.button===1){e.preventDefault();if(this.dragLook)this.middleDown=true;else this.pickBlock();}});
    document.addEventListener('mouseup',e=>{if(e.button===0){this.mouseDown=false;this.miningTime=0;}if(e.button===2)this.rightDown=false;if(e.button===1)this.middleDown=false;});
    document.addEventListener('contextmenu',e=>e.preventDefault());
    document.addEventListener('wheel',e=>{if(this.screen==='playing'){e.preventDefault();this.select((this.inventory.selected+(e.deltaY>0?1:8))%9);}},{passive:false});
    document.addEventListener('keydown',e=>{
      if(e.code==='F11'&&!e.repeat&&window.wildwoodDesktop){e.preventDefault();window.wildwoodDesktop.toggleFullscreen();return;}
      if(e.target.matches('input,select,textarea'))return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','F3','Escape'].includes(e.code))e.preventDefault();
      if(e.code==='F3'&&!e.repeat){this.changeSetting('showFps',!this.settings.showFps);return;}
      if(e.code==='Escape'&&!e.repeat){if(this.screen==='playing')this.open('pause');else if(['inventory','pause'].includes(this.screen))this.resume();else if(['settings','help','new'].includes(this.screen))this.open(this.returnScreen||'title');return;}
      if(e.code==='KeyE'&&!e.repeat){if(this.screen==='playing')this.open('inventory');else if(this.screen==='inventory')this.resume();return;}
      if(this.screen!=='playing')return;
      this.keys.add(e.code);if(/^Digit[1-9]$/.test(e.code))this.select(Number(e.code.slice(-1))-1);
      if(e.code==='KeyF'&&!e.repeat&&this.mode==='creative'){this.player.flying=!this.player.flying;this.player.vel.y=0;this.ui.toast(this.player.flying?'Flight on · Space up · Ctrl down · F to land':'Flight off');}
    });
    document.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{if(this.screen==='playing')this.open('pause');this.clearInput();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.screen==='playing')this.open('pause');});
    window.addEventListener('pagehide',()=>this.save(false));
    window.addEventListener('beforeunload',()=>this.save(false));
  }
  resize(){this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)*this.settings.quality);this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.handCamera.aspect=this.camera.aspect;this.handCamera.updateProjectionMatrix();}
  changeSetting(key,value) {
    if(!(key in DEFAULT_SETTINGS))return;this.settings[key]=value;this.sound.volume=this.settings.volume;
    if(key==='quality')this.resize();if(key==='shadows'){this.renderer.shadowMap.enabled=value;this.scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}
    if(key==='radius')this.world.plan(this.player.pos.x,this.player.pos.z,value);
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(this.settings));}catch{this.ui.toast('Settings could not be saved in this browser.');}
  }
  select(index){this.inventory.selected=index;this.miningTime=0;this.miningKey='';this.sound.play('select');this.swing=.25;this.ui.updateHud(true);}
  nearBench(){return this.world.nearby(B.BENCH,this.player.pos,4);}
  notify(message){if(this.noticeCooldown<=0){this.ui.toast(message);this.noticeCooldown=1.8;}}
  attackMob(){if(!this.mobTarget||this.actionCooldown>0)return;const item=ITEMS[this.inventory.held?.id];this.mobs.hit(this.mobTarget.mob,item?.damage??(item?.tool?3:2));this.actionCooldown=.4;this.swing=.95;}
  pickBlock(){if(this.mode!=='creative'||!this.target)return;const id=this.target.id;this.inventory.slots[this.inventory.selected]={id,count:64};this.inventory.revision++;}
  useItem() {
    if(this.screen!=='playing'||this.useCooldown>0)return;this.useCooldown=.2;
    const held=this.inventory.held,item=held&&ITEMS[held.id],target=this.target;
    if(item?.food){if(this.player.health>=20){this.notify('You’re already at full health.');return;}this.player.health=Math.min(20,this.player.health+item.food);if(this.mode!=='creative')this.inventory.consumeSelected();this.sound.play('eat');this.swing=.55;return;}
    if(target?.id===B.BENCH&&!this.keys.has('ShiftLeft')){this.open('inventory');return;}
    if(!target||!held||!BLOCKS[held.id]||[B.AIR,B.BEDROCK,B.WATER].includes(held.id))return;
    const {x,y,z}=target.previous;
    if(y>=HEIGHT){this.notify(`Build limit: ${HEIGHT} blocks high.`);return;}
    if(y<=0||isSolid(this.world.getBlock(x,y,z)))return;
    if(overlapsBlock(this.player,x,y,z)||this.mobs.list.some(m=>overlapsBlock(m,x,y,z))){this.notify('Leave a little room to stand.');return;}
    if(this.world.setBlock(x,y,z,held.id)){
      if(held.id===B.LANTERN){this.progress.placed=true;this.lanternTimer=0;}
      this.placedCount++;this.progress.placedCount=this.placedCount;if(this.placedCount>=12)this.progress.shelter=true;
      if(this.mode!=='creative')this.inventory.consumeSelected();this.sound.play('place');this.swing=.65;
    }
  }
  aim(dt) {
    const origin=this.camera.position,dir=this.camera.getWorldDirection(new THREE.Vector3());
    this.target=raycast(this.world,origin,dir,6);this.mobTarget=this.mobs.pick(origin,dir,Math.min(3.7,this.target?.distance??3.7));
    this.outline.visible=!!this.target&&!this.mobTarget;if(this.outline.visible)this.outline.position.set(this.target.x+.5,this.target.y+.5,this.target.z+.5);
    this.actionCooldown=Math.max(0,this.actionCooldown-dt);this.useCooldown=Math.max(0,this.useCooldown-dt);this.noticeCooldown=Math.max(0,this.noticeCooldown-dt);
    if(this.rightDown&&this.useCooldown<=0)this.useItem();
    if(this.mobTarget){this.ui.target(this.mobTarget);this.miningTime=0;if(this.mouseDown)this.attackMob();return;}
    if(!this.target){this.ui.target(null);this.miningTime=0;this.miningKey='';return;}
    const t=this.target,block=BLOCKS[t.id],rule=miningRule(t.id,this.inventory.held?.id,this.mode==='creative'),valid=rule.allowed,key=`${t.x},${t.y},${t.z}`;
    if(key!==this.miningKey){this.miningKey=key;this.miningTime=0;}
    const duration=rule.duration;
    const hint=t.id===B.BENCH?'Right click to craft':!Number.isFinite(duration)?'Unbreakable':!valid&&this.mode!=='creative'?`${block.tier===2?'Stone':'Wooden'} pickaxe required`:'Hold left click to mine';
    if(this.mouseDown&&this.actionCooldown<=0){
      if(!Number.isFinite(duration)){this.notify('Bedrock is the foundation of this world.');}
      else if(valid||this.mode==='creative'){
        this.miningTime+=dt;this.swing=.4+Math.sin(this.miningTime*22)*.2;
        if(this.miningTime>=duration){this.breakBlock(t);this.miningTime=0;this.actionCooldown=this.mode==='creative'?.13:.12;}
      }else this.notify(hint);
    }else if(!this.mouseDown)this.miningTime=0;
    this.ui.target(t,this.miningTime/duration,hint);
  }
  breakBlock(t) {
    const block=BLOCKS[t.id],drop=block.drop??t.id;
    if(this.mode!=='creative'&&this.inventory.capacity(drop)<1){this.notify('Your backpack is full. Make room with E.');return false;}
    if(!this.world.setBlock(t.x,t.y,t.z,B.AIR))return false;
    if(this.mode!=='creative')this.inventory.add(drop,1);
    if(t.id===B.LOG)this.progress.logs=true;
    if(t.id===B.LEAVES&&hash(t.x,t.y,t.z,this.world.seed)>.7&&this.mode!=='creative'){if(this.inventory.add(I.BERRIES,1))this.ui.toast('A little forage · +1 wild berry');}
    if(t.id===B.LANTERN)this.lanternTimer=0;
    this.sound.play('break');this.particles.burst(t.x,t.y,t.z,block.color);this.swing=1;return true;
  }
  updateHand(dt) {
    const id=this.inventory.held?.id??0;
    if(id!==this.heldId){
      for(const child of [...this.hand.children]){child.geometry.dispose();for(const material of Array.isArray(child.material)?child.material:[child.material]){material.map?.dispose();material.dispose();}this.hand.remove(child);}
      this.heldId=id;const item=ITEMS[id];
      const part=(x,y,z,sx,sy,sz,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);this.hand.add(m);};
      if(item?.tool||item?.icon==='sword'){
        part(0,0,0,.05,.4,.055,0x986c42);part(-.007,.02,.029,.025,.33,.01,0xc49963);
        if(item.icon==='sword'){part(0,.3,0,.06,.4,.04,item.color);part(0,.105,0,.22,.045,.07,0x8e774a);}
        else{part(0,.21,0,.39,.06,.07,item.color);part(.17,.155,0,.06,.08,.07,item.color);part(-.17,.155,0,.06,.08,.07,item.color);}
      }else if(id&&BLOCKS[id]&&!BLOCKS[id].plant){
        const mats=[];const tileOrder=[0,1,2,3,4,5];
        for(const face of tileOrder){const tile=face===2?BLOCKS[id].top??BLOCKS[id].tile:face===3?BLOCKS[id].bottom??BLOCKS[id].tile:BLOCKS[id].tile;const map=this.textures.texture.clone();map.repeat.set(1/8,1/4);map.offset.set(tile%8/8,1-(Math.floor(tile/8)+1)/4);mats.push(new THREE.MeshLambertMaterial({map,alphaTest:.5}));}
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(.27,.27,.27),mats);mesh.rotation.set(.18,-.3,0);this.hand.add(mesh);
      }else if(id){part(0,.05,0,.16,.15,.11,item.color);part(.04,.14,0,.1,.04,.08,0x799651);}
      else{part(0,0,0,.14,.35,.15,0xbe9874);part(0,-.12,0,.15,.12,.16,0x536f57);}
    }
    this.swing=Math.max(0,this.swing-dt*3);
    const bob=this.player.bob*Math.sin(this.player.walk*3)*.012;
    this.hand.position.set(.44-this.swing*.07,-.39+bob+Math.sin(this.swing*Math.PI)*.04,-.72+this.swing*.13);this.hand.rotation.set(-.22-this.swing*.55,0,-.38-this.swing*.25);
  }
  step(dt) {
    this.time+=dt;const p=this.player;
    if(this.keys.has('ArrowLeft'))p.look(-dt*650,0,this.settings.sensitivity);if(this.keys.has('ArrowRight'))p.look(dt*650,0,this.settings.sensitivity);if(this.keys.has('ArrowUp'))p.look(0,-dt*450,this.settings.sensitivity);if(this.keys.has('ArrowDown'))p.look(0,dt*450,this.settings.sensitivity);
    p.update(dt,this);if(this.screen!=='playing')return;
    this.mobs.update(dt);this.particles.update(dt);this.saveTimer+=dt;this.lanternTimer-=dt;
    if(this.atmosphere.night&&!this.previousNight){this.progress.night=true;this.ui.toast('Night is falling. Find a little light.');}
    this.previousNight=this.atmosphere.night;
    if(this.saveTimer>=30){this.save(false);this.saveTimer=0;}
    if(this.lanternTimer<=0){this.atmosphere.updateLanterns(this.world,p.pos);this.lanternTimer=1;}
  }
  frame(now) {
    const dt=Math.min(.1,Math.max(0,(now-this.lastFrame)/1000));this.lastFrame=now;this.fpsElapsed+=dt;this.frameCount++;
    if(this.fpsElapsed>.75){this.fps=this.frameCount/this.fpsElapsed;this.fpsElapsed=0;this.frameCount=0;}
    this.world.stream(4);this.worldRenderer.update();
    if(this.screen==='playing'){
      this.accumulator+=dt;let steps=0;while(this.accumulator>=1/60&&steps++<6){this.step(1/60);this.accumulator-=1/60;if(this.screen!=='playing')break;}
      const p=this.player;this.camera.position.set(p.pos.x,p.pos.y+1.62+Math.sin(p.walk*3)*.028*p.bob,p.pos.z);this.camera.rotation.set(p.pitch,p.yaw,0,'YXZ');
      const targetFov=this.settings.fov+(this.keys.has('ShiftLeft')?5:0);this.camera.fov+=(targetFov-this.camera.fov)*Math.min(1,dt*5);this.camera.updateProjectionMatrix();
      this.aim(dt);this.world.plan(p.pos.x,p.pos.z,this.settings.radius);this.updateHand(dt);
    }else this.accumulator=0;
    if(!this.active){this.previewTime+=dt;this.camera.position.copy(this.previewOrigin).add(new THREE.Vector3(Math.sin(this.previewTime*.035)*4,Math.sin(this.previewTime*.08)*.3,0));this.camera.lookAt(this.previewTarget);this.camera.fov=this.settings.fov;this.camera.updateProjectionMatrix();}
    this.atmosphere.update(this.time,this.camera.position,this.settings.radius,this.player.underwater&&this.screen==='playing');
    if(this.screen==='loading'&&this.active){
      let ready=0;const cx=Math.floor(this.player.pos.x/SIZE),cz=Math.floor(this.player.pos.z/SIZE);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(this.worldRenderer.meshes.has(chunkKey(cx+dx,cz+dz)))ready++;
      this.ui.loading(ready/9);
      if(ready===9&&performance.now()-this.loadingStarted>700){this.camera.position.set(this.player.pos.x,this.player.pos.y+1.62,this.player.pos.z);this.camera.rotation.set(this.player.pitch,this.player.yaw,0,'YXZ');if(!this.mobs.list.length){for(let i=0;i<3;i++)this.mobs.spawnAround('sheep',6,17);}this.open('ready');}
    }
    this.hudTimer+=dt;if(this.hudTimer>.12){this.ui.updateHud();this.hudTimer=0;}
    this.renderer.info.reset();this.renderer.clear();this.renderer.render(this.scene,this.camera);
    if(this.screen==='playing'){this.renderer.clearDepth();this.renderer.render(this.handScene,this.handCamera);}
  }
  snapshot(){return {version:1,name:this.name,seedLabel:this.seedLabel,seed:this.world.seed,mode:this.mode,time:this.time,spawn:{...this.spawn},player:this.player.serialize(),inventory:this.inventory.serialize(),selected:this.inventory.selected,edits:this.world.serialize(),mobs:this.mobs.serialize(),progress:{...this.progress},savedAt:Date.now()};}
  save(notify=false) {
    if(!this.active||this.screen==='loading')return false;
    try{const snapshot=this.snapshot();writeSave(snapshot);this.saved=snapshot;if(notify)this.ui.toast('World saved · right where you left it.');return true;}
    catch(error){this.ui.toast('Local save failed. Use Pause → Export world to keep your progress.');console.warn('Save failed:',error.message);return false;}
  }
  exportWorld() {
    const data=this.active?this.snapshot():this.saved;if(!data){this.ui.toast('Create a world first.');return;}
    const blob=new Blob([JSON.stringify(data)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${data.name.replace(/[^a-z0-9_-]/gi,'-')}.wildwood.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.ui.toast('World exported. Keep this file somewhere safe.');
  }
  async importWorld(file) {
    if(file.size>25*1024*1024){this.ui.toast('That file is too large. Choose a Wildwood save under 25 MB.');return;}
    try{const data=validateSave(JSON.parse(await file.text()));this.begin(data);}catch(error){this.ui.toast(`Could not import: ${error.message}`);}
  }
  toTitle(){if(!this.save(true)){this.ui.toast('Export your world before leaving; local storage is full.');return;}this.active=false;this.returnScreen='title';this.open('title');}
  die(cause){this.deathCause=cause;this.open('dead');}
  respawn(){this.player.safe(this.world,{...this.spawn,y:this.world.getSurface(this.spawn.x,this.spawn.z)+.05});this.player.health=20;this.player.air=10;this.player.invulnerable=4;this.player.flying=false;this.world.plan(this.player.pos.x,this.player.pos.z,this.settings.radius);this.resume();this.ui.toast('A fresh start. Your backpack came with you.');}
}

try {
  const game=new Game();
  if(new URLSearchParams(location.search).has('test'))window.__wildwood=game;
}catch(error){
  console.error(error);document.querySelector('#app').innerHTML='<div style="position:fixed;inset:0;display:grid;place-items:center;background:#1d342e;color:#f6edda;font-family:Segoe UI;pointer-events:auto"><div style="max-width:440px;padding:30px"><h1 style="font-size:38px">The wild can wait.</h1><p>Wildwood could not start its 3D renderer. Open this page in Microsoft Edge or Google Chrome with graphics acceleration enabled.</p><p id="startup-error" style="font-family:monospace;font-size:12px"></p><button onclick="location.reload()" style="padding:12px 25px">Try again</button></div></div>';document.querySelector('#startup-error').textContent=error.message;
}
