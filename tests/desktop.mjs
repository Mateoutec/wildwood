import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {validateSave} from '../src/save.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const packaged=process.argv.includes('--packaged'),portable=process.argv.includes('--portable');
const kind=portable?'portable':packaged?'packaged':'development';
const artifacts=path.join(root,'test-results',`desktop-${kind}`);
const profile=path.join(artifacts,`profile-${Date.now()}`),exportsFolder=path.join(profile,'exports');
await mkdir(profile,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const executablePath=portable?path.join(root,'desktop-release','Wildwood-Portable-1.1.0.exe'):packaged?path.join(root,'desktop-release','win-unpacked','Wildwood.exe'):undefined;
const args=[...(!packaged&&!portable?[root]:[]),'--wildwood-test',`--wildwood-profile=${profile}`,`--wildwood-exports=${exportsFolder}`];
let app,page,stderr='';const errors=[],requests=[],results=[];
const log=(name,details={})=>{results.push({name,...details});console.log(`PASS ${name} ${Object.keys(details).length?JSON.stringify(details):''}`);};
const waitScreen=s=>page.waitForFunction(screen=>window.__wildwood?.screen===screen,s,{timeout:60000});
async function nativeMouse(type,button='left') {
  const point=await page.evaluate(()=>({x:Math.round(innerWidth/2),y:Math.round(innerHeight/2)}));
  await app.evaluate(({BrowserWindow},input)=>BrowserWindow.getAllWindows()[0].webContents.sendInputEvent(input),{type,button,clickCount:1,...point});
}
async function launch() {
  app=await electron.launch({executablePath,args,cwd:root,env,timeout:90000});
  app.process().stderr.on('data',data=>{stderr=(stderr+data).slice(-40000);});
  page=await app.firstWindow();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>{errors.push(error.stack||error.message);console.error('PAGE ERROR',error.message);});
  page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());console.error('RENDERER ERROR',message.text());}});
  page.on('request',request=>requests.push(request.url()));
  await page.waitForFunction(()=>!!window.__wildwood,{timeout:60000});
  await page.waitForFunction(()=>__wildwood.worldRenderer.meshes.size>=40,{timeout:60000});
}
try {
  await launch();
  assert.equal(await page.evaluate(()=>location.origin),'wildwood://game');
  assert.equal(await page.evaluate(()=>window.wildwoodDesktop?.isDesktop),true);
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.equal(await page.evaluate(()=>typeof window.process),'undefined');
  assert.ok(await page.evaluate(()=>!!__wildwood.worldRenderer.worker));
  const preferences=await app.evaluate(({BrowserWindow,app})=>({packaged:app.isPackaged,userData:app.getPath('userData'),title:BrowserWindow.getAllWindows()[0].getTitle(),preferences:BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()}));
  assert.equal(preferences.preferences.sandbox,true);assert.equal(preferences.preferences.contextIsolation,true);assert.equal(preferences.preferences.nodeIntegration,false);
  if(packaged||portable)assert.equal(preferences.packaged,true);
  assert.equal(preferences.title,'Wildwood');assert.equal(path.resolve(preferences.userData),path.resolve(profile));
  log('standalone window loads local assets, WebGL and worker chunks',{kind});
  log('sandbox, context isolation and separate persistent profile');
  await page.screenshot({path:path.join(artifacts,'01-desktop-title.png')});
  if(portable){
    await page.click('[data-action="new"]');await page.click('[data-action="create"]');await waitScreen('ready');await page.click('[data-action="enter"]');await waitScreen('playing');await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
    await delay(800);await page.screenshot({path:path.join(artifacts,'02-portable-game.png')});log('single-file portable executable creates and plays a world');
  }else{
    await page.click('[data-action="new"]');await page.fill('#world-name','Desktop Regression');await page.click('[data-action="create"]');await waitScreen('ready');await page.click('[data-action="enter"]');await waitScreen('playing');
    await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));log('desktop pointer lock');
    const start=await page.evaluate(()=>({...__wildwood.player.pos}));await page.keyboard.down('KeyW');await delay(800);await page.keyboard.up('KeyW');const moved=await page.evaluate(()=>({...__wildwood.player.pos}));assert.ok(Math.hypot(start.x-moved.x,start.z-moved.z)>.5);
    const yaw=await page.evaluate(()=>__wildwood.player.yaw);await page.mouse.move(700,350);await delay(100);assert.notEqual(await page.evaluate(()=>__wildwood.player.yaw),yaw);log('first-person movement and mouse look in the app');
    await page.keyboard.press('Escape');await waitScreen('pause');const time=await page.evaluate(()=>__wildwood.time);await delay(300);assert.equal(await page.evaluate(()=>__wildwood.time),time);log('desktop pause freezes simulation');
    await page.keyboard.press('F11');await delay(400);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()),true);
    await page.keyboard.press('F11');await delay(400);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()),false);log('native full screen toggles with F11');
    await page.click('#overlay [data-action="settings"]');await page.locator('[data-setting="volume"]').focus();await page.keyboard.press('Home');await page.click('[data-action="back"]');await page.click('[data-action="resume"]');await waitScreen('playing');await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));await delay(350);
    await page.evaluate(()=>{const g=__wildwood;window.__desktopAimEvents=[];document.addEventListener('mousemove',e=>{window.__desktopAimEvents.push({dx:e.movementX,dy:e.movementY,x:e.clientX,y:e.clientY});if(window.__desktopAimEvents.length>10)window.__desktopAimEvents.shift();});g.mobs.list.slice().forEach(m=>g.mobs.remove(m));g.mobs.timer=999;for(let x=0;x<12;x++)for(let z=0;z<12;z++)g.world.setBlock(x,50,z,3);g.player.safe(g.world,{x:5.5,y:51.001,z:8.5});g.player.yaw=0;g.player.pitch=0;g.world.setBlock(5,52,5,2);g.select(0);});
    await delay(200);const earth=await page.evaluate(()=>__wildwood.inventory.count(2));await nativeMouse('mouseDown');await delay(800);await nativeMouse('mouseUp');assert.equal(await page.evaluate(()=>__wildwood.world.getBlock(5,52,5)),0);assert.equal(await page.evaluate(()=>__wildwood.inventory.count(2)),earth+1);log('native build mines blocks and collects drops');
    await page.evaluate(()=>__wildwood.world.setBlock(5,52,4,3));await page.keyboard.press('Digit3');await delay(150);await nativeMouse('mouseDown','right');await nativeMouse('mouseUp','right');await delay(150);assert.equal(await page.evaluate(()=>__wildwood.world.getBlock(5,52,5)),7);log('block placement and hotbar selection');
    await page.keyboard.press('KeyE');await waitScreen('inventory');const logs=await page.evaluate(()=>__wildwood.inventory.count(5));await page.click('[data-recipe="planks"]');assert.equal(await page.evaluate(()=>__wildwood.inventory.count(5)),logs-1);await page.screenshot({path:path.join(artifacts,'02-desktop-crafting.png')});log('inventory and crafting in the executable');
    await page.keyboard.press('KeyE');await waitScreen('playing');await page.keyboard.press('Escape');await waitScreen('pause');await page.click('[data-action="save"]');const snapshot=await page.evaluate(()=>__wildwood.snapshot());
    await page.click('[data-action="export"]');for(let i=0;i<50;i++){try{if((await readdir(exportsFolder)).length)break;}catch{}await delay(100);}
    const exportFile=(await readdir(exportsFolder)).find(name=>name.endsWith('.json'));assert.ok(exportFile);const exported=validateSave(JSON.parse(await readFile(path.join(exportsFolder,exportFile),'utf8')));assert.deepEqual(exported.inventory,snapshot.inventory);log('desktop export writes a valid world file');
    await page.click('[data-action="title"]');await page.locator('#import-file').setInputFiles(path.join(exportsFolder,exportFile));await waitScreen('ready');assert.equal(await page.evaluate(()=>__wildwood.world.getBlock(5,52,5)),7);log('desktop import restores a compatible world');
    await page.click('[data-action="enter"]');await waitScreen('playing');await page.evaluate(()=>{__wildwood.world.setBlock(-1,49,-1,15);__wildwood.progress.desktopCloseProbe=true;});
    await app.close();app=null;log('application closes without a browser or server');
    await launch();assert.ok(await page.locator('[data-action="continue"]').isVisible());assert.equal(await page.evaluate(()=>__wildwood.settings.volume),0);await page.click('[data-action="continue"]');await waitScreen('ready');assert.equal(await page.evaluate(()=>__wildwood.world.getBlock(-1,49,-1)),15);assert.ok(await page.evaluate(()=>__wildwood.progress.desktopCloseProbe));assert.deepEqual(await page.evaluate(()=>__wildwood.inventory.serialize()),snapshot.inventory);log('closing and reopening preserves last edits, inventory and settings');
    await page.click('[data-action="enter"]');await waitScreen('playing');await page.screenshot({path:path.join(artifacts,'03-desktop-game.png')});
    log('render performance sample',await page.evaluate(()=>({fps:Math.round(__wildwood.fps),chunks:__wildwood.worldRenderer.meshes.size,draws:__wildwood.renderer.info.render.calls})));
    await page.keyboard.press('Escape');await waitScreen('pause');const closed=app.waitForEvent('close');await page.click('#overlay [data-action="quit"]');await closed;app=null;log('Save & quit exits the Windows application');
  }
  assert.ok(!requests.some(url=>/^https?:/.test(url)),`Unexpected network requests: ${requests.filter(url=>/^https?:/.test(url))}`);assert.equal(errors.length,0,errors.join('\n'));log('no remote dependencies or renderer/worker errors');
  await writeFile(path.join(artifacts,'report.json'),JSON.stringify({passed:results.length,results,errors,executablePath,completedAt:new Date().toISOString()},null,2));console.log(`All ${results.length} ${kind} desktop checks passed.`);
}catch(error){console.error(error);if(page&&!page.isClosed())try{await page.screenshot({path:path.join(artifacts,'failure.png')});console.error(await page.evaluate(()=>({url:location.href,screen:window.__wildwood?.screen,aimEvents:window.__desktopAimEvents,yaw:window.__wildwood?.player.yaw,pitch:window.__wildwood?.player.pitch,target:window.__wildwood?.target,body:document.body.innerText.slice(-1500)})));}catch{}
  await writeFile(path.join(artifacts,'failure.json'),JSON.stringify({error:error.stack,results,errors,stderr},null,2));process.exitCode=1;
}finally{await app?.close();}
