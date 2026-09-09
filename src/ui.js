import {B,ITEMS,RECIPES,CREATIVE_ITEMS} from './blocks.js';
import {columnAt} from './terrain.js';
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cube='<svg viewBox="0 0 32 36" fill="none"><path d="M2 10 16 2 30 10 16 18Z" fill="currentColor"/><path d="M2 10 16 18V34L2 26Z" fill="currentColor" opacity=".65"/><path d="M16 18 30 10V26L16 34Z" fill="currentColor" opacity=".85"/></svg>';
const heart='<svg viewBox="0 0 20 18"><path d="M2 2H8V4H12V2H18V10H16V12H14V14H12V16H8V14H6V12H4V10H2Z" fill="currentColor"/></svg>';
const sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></svg>';
const arrow='<span aria-hidden="true">↗</span>';
export class UI {
  constructor(game) {
    this.game=game;this.picked=null;this.revision=-1;this.lastSelected=-1;this.recipeRevision=-1;this.lastBench=false;this.lastHud=0;this.toastTimer=0;
    document.querySelector('#app').innerHTML=`
      <div id="hud" hidden>
        <div class="hud-brand"><span class="mark">${cube}</span><div><strong>WILDWOOD</strong><small id="biome">Oak meadows</small></div></div>
        <div class="world-clock"><span id="sun-icon">${sun}</span><div><b id="day-time">Day 1</b><span id="clock-time">08:24</span></div><span id="compass">N</span></div>
        <div id="crosshair"><i></i><i></i></div>
        <div id="target" hidden><span id="target-name"></span><small id="target-tool"></small><div id="mining"><i></i></div></div>
        <div id="field-notes"></div>
        <div class="hud-bottom"><div class="vitals"><div id="health" aria-label="Health"></div><span id="health-label"></span><span id="air" hidden></span></div><div id="held-name"></div><div id="hotbar"></div><div class="bar-caption"><span><kbd>1</kbd>–<kbd>9</kbd> select <i>·</i> scroll to switch</span><span id="mode-label">SURVIVAL</span></div></div>
        <div class="corner-help"><span><kbd>E</kbd> Backpack & crafting</span><span><kbd>Esc</kbd> Pause</span></div><div id="debug" hidden></div>
      </div>
      <div id="title-screen">
        <header class="title-header"><div class="mini-brand"><span class="mark">${cube}</span> WILDWOOD <span class="edition">VOXEL SANDBOX</span></div><span class="build-tag"><i></i> A WORLD OF YOUR OWN</span></header>
        <main class="title-grid"><section class="title-copy"><div class="eyebrow"><span></span> GO WHERE YOUR CURIOSITY TAKES YOU</div><h1>Small blocks.<br><em>Endless</em> stories.</h1><p>Find a clearing. Make a home.<br>There’s a little wilderness waiting for you.</p><div class="title-chips"><span>EXPLORE</span><i>✦</i><span>BUILD</span><i>✦</i><span>BELONG</span></div></section>
        <section class="menu-card"><span class="overline">THE NEXT CHAPTER</span><h2>Welcome to<br>Wildwood.</h2><p class="card-description">A quiet place to create.<br>A wild place to survive.</p><div id="saved-world"></div><button class="button primary" id="continue" data-action="continue" hidden>Continue journey ${arrow}</button><button class="button" id="new-adventure" data-action="new">New adventure ${arrow}</button><div class="menu-links"><button data-action="help">How to play</button><button data-action="settings">Settings</button></div><button class="import-link" data-action="import">↥ Import a saved world</button><div class="local-note"><span class="tiny-diamond"></span> YOUR WORLD SAVES ON THIS DEVICE</div></section></main>
        <footer class="title-footer"><span>TAKE YOUR TIME. LEAVE YOUR MARK.</span><span>Made of little things. <b>v${window.wildwoodDesktop?.version||'1.1.0'}</b></span></footer>
      </div>
      <div id="overlay" hidden></div><div id="toast" role="status" aria-live="polite"></div><div id="damage-flash"></div><input type="file" id="import-file" accept=".json,.wildwood,application/json" hidden />`;
    this.nodes=Object.fromEntries([...document.querySelectorAll('[id]')].map(n=>[n.id,n]));
    this.nodes.app.addEventListener('click',e=>this.click(e));
    this.nodes.app.addEventListener('input',e=>{const key=e.target.dataset.setting;if(key){const value=e.target.type==='checkbox'?e.target.checked:Number(e.target.value);game.changeSetting(key,value);const output=e.target.closest('.setting-row')?.querySelector('output');if(output)output.textContent=this.settingText(key,value);}});
    this.nodes['import-file'].addEventListener('change',e=>{const file=e.target.files[0];if(file)game.importWorld(file);e.target.value='';});
    if(window.wildwoodDesktop){
      const desktopButtons=document.createElement('div');desktopButtons.className='desktop-buttons';
      desktopButtons.innerHTML='<button data-action="fullscreen">Full screen <kbd>F11</kbd></button><button data-action="quit">Quit game</button>';
      this.nodes['title-screen'].querySelector('.menu-card').append(desktopButtons);
    }
    this.titleSave();
  }
  icon(id){return `<img class="item-icon" src="${this.game.textures.icons.get(id)}" alt="${escapeHtml(ITEMS[id]?.name||'')}" draggable="false" />`;}
  titleSave() {
    const saved=this.game.saved;this.nodes.continue.hidden=!saved;this.nodes['new-adventure'].classList.toggle('primary',!saved);
    this.nodes['saved-world'].innerHTML=saved?`<div class="save-summary"><span class="save-symbol">${cube}</span><div><b>${escapeHtml(saved.name)}</b><small>Day ${Math.floor(saved.time/720)+1} <i>·</i> ${saved.mode==='creative'?'Creative':'Survival'} <i>·</i> ${new Date(saved.savedAt||Date.now()).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></div></div>`:'';
  }
  click(e) {
    const el=e.target.closest('[data-action],[data-slot],[data-recipe],[data-palette]');if(!el||el.disabled)return;
    const game=this.game;
    if(el.dataset.slot!==undefined){
      const idx=Number(el.dataset.slot);
      if(game.screen==='playing'){game.select(idx);return;}
      if(e.shiftKey){const from=game.inventory.slots[idx];if(from){const range=idx<9?[9,36]:[0,9];let to=-1;for(let i=range[0];i<range[1];i++)if(!game.inventory.slots[i]||(game.inventory.slots[i].id===from.id&&game.inventory.slots[i].count<(ITEMS[from.id].stack||64))){to=i;break;}if(to>=0)game.inventory.move(idx,to);}}
      else if(this.picked===null)this.picked=game.inventory.slots[idx]?idx:null;
      else {game.inventory.move(this.picked,idx);this.picked=null;}
      this.renderInventory();return;
    }
    if(el.dataset.recipe){const result=game.inventory.craft(el.dataset.recipe,game.nearBench());if(result.ok){game.progress.crafted=true;if(result.recipe.id==='stone-pick')game.progress.stone=true;game.sound.play('craft');this.toast(`Crafted ${result.recipe.out[1]} × ${result.recipe.name}`);}else this.toast(result.reason);this.renderInventory();return;}
    if(el.dataset.palette){const id=Number(el.dataset.palette);game.inventory.slots[game.inventory.selected]={id,count:ITEMS[id].stack||64};game.inventory.revision++;this.toast(`${ITEMS[id].name} added to selected hotbar slot`);this.renderInventory();return;}
    switch(el.dataset.action){
      case 'new':game.returnScreen='title';game.open('new');break;
      case 'continue':game.begin(game.saved);break;
      case 'create':{const name=document.querySelector('#world-name').value.trim()||'My Wildwood',seed=document.querySelector('#world-seed').value.trim()||`WILLOW-${Math.floor(Math.random()*99999)}`,mode=document.querySelector('input[name="mode"]:checked').value;game.begin(null,{name,seed,mode});break;}
      case 'resume':case 'enter':game.resume();break;
      case 'back':game.open(game.returnScreen||'title');break;
      case 'settings':case 'help':game.returnScreen=game.active?'pause':'title';game.open(el.dataset.action);break;
      case 'save':game.save(true);break;
      case 'export':game.exportWorld();break;
      case 'import':this.nodes['import-file'].click();break;
      case 'title':game.toTitle();break;
      case 'fullscreen':window.wildwoodDesktop?.toggleFullscreen();break;
      case 'quit':if(!game.active||game.save(false))window.wildwoodDesktop?.quit();break;
      case 'respawn':game.respawn();break;
      case 'inventory-close':this.picked=null;game.resume();break;
      case 'discard':if(this.picked!==null){game.inventory.slots[this.picked]=null;game.inventory.revision++;this.picked=null;this.renderInventory();}break;
      case 'notes':game.notesHidden=!game.notesHidden;this.updateHud(true);break;
    }
  }
  panel(inner,extra=''){return `<div class="scrim"><section class="dialog ${extra}">${inner}</section></div>`;}
  render(screen) {
    this.nodes['title-screen'].hidden=screen!=='title'&&(this.game.active||!['new','settings','help'].includes(screen));
    this.nodes.hud.hidden=!this.game.active||screen==='loading'||screen==='ready';
    this.nodes.overlay.hidden=screen==='title'||screen==='playing';
    document.body.classList.toggle('is-playing',screen==='playing');
    document.body.classList.toggle('underwater',this.game.player?.underwater&&screen==='playing');
    if(screen==='title'){this.titleSave();return;}
    if(screen==='playing')return;
    const back='<button class="close-button" data-action="back" aria-label="Back">×</button>';
    if(screen==='new')this.nodes.overlay.innerHTML=this.panel(`${back}<span class="overline">A BLANK PAGE</span><h2>Your next adventure.</h2><p class="muted">Every seed is a new corner of the wilderness.</p><label class="input-label">WORLD NAME<input id="world-name" maxlength="48" value="My Wildwood" autocomplete="off" /></label><label class="input-label">WORLD SEED <small>Same seed, same landscape</small><input id="world-seed" maxlength="64" value="WILLOW-2026" autocomplete="off" /></label><div class="mode-options"><label><input type="radio" name="mode" value="survival" checked /><span><b>Survival</b><small>Gather, craft, and brave the night.</small></span></label><label><input type="radio" name="mode" value="creative" /><span><b>Creative</b><small>Unlimited blocks. Flight. Pure possibility.</small></span></label></div>${this.game.saved?'<p class="save-warning">Your current world stays saved until this new adventure is ready. Export it first if you want to keep both.</p>':''}<button class="button primary" data-action="create">Create world ${arrow}</button>`,'new-dialog');
    if(screen==='loading')this.nodes.overlay.innerHTML=this.panel('<span class="loading-cube">'+cube+'</span><span class="overline">GROWING YOUR WILDERNESS</span><h2>A world takes root.</h2><p class="muted">Planting oaks. Carving rivers. Hiding little wonders.</p><div class="loading-bar"><i id="load-progress"></i></div><small id="load-label">Preparing your clearing…</small>','loading-dialog');
    if(screen==='ready')this.nodes.overlay.innerHTML=this.panel(`<span class="overline">WELCOME TO ${escapeHtml(this.game.name).toUpperCase()}</span><h2>Your clearing is ready.</h2><p class="muted">Move with <kbd>W A S D</kbd>, look with your mouse.<br>Hold left click to mine. Right click to build.<br><kbd>E</kbd> opens your backpack and crafting.</p><button class="button primary" data-action="enter">Step into Wildwood ${arrow}</button><small class="quiet">Your mouse will be captured. Press Esc to pause.</small>`,'ready-dialog');
    if(screen==='pause')this.nodes.overlay.innerHTML=this.panel(`<span class="overline">TAKE A BREATHER</span><h2>A moment of quiet.</h2><p class="muted">${escapeHtml(this.game.name)} <span class="dot">·</span> Day ${Math.floor(this.game.time/720)+1}</p><button class="button primary" data-action="resume">Back to the wild ${arrow}</button><div class="two-buttons"><button class="button" data-action="save">Save world</button><button class="button" data-action="export">Export world ↗</button></div><div class="two-buttons"><button class="button subtle" data-action="settings">Settings</button><button class="button subtle" data-action="help">Field guide</button></div><button class="button text-button" data-action="title">Save & return to title</button>${window.wildwoodDesktop?'<div class="desktop-buttons"><button data-action="fullscreen">Full screen <kbd>F11</kbd></button><button data-action="quit">Save & quit game</button></div>':''}<div class="local-note">The world is paused. Autosaves every 30 seconds.</div>`,'pause-dialog');
    if(screen==='settings')this.renderSettings(back);
    if(screen==='help')this.nodes.overlay.innerHTML=this.panel(`${back}<span class="overline">THE FIELD GUIDE</span><h2>Make yourself at home.</h2><div class="control-grid">${[['W A S D','Move'],['Mouse','Look around'],['Space','Jump / swim up'],['Shift','Sprint'],['Left click','Hold to mine / attack'],['Right click','Place / eat / use bench'],['1 – 9 / wheel','Select hotbar slot'],['E','Backpack & crafting'],['Esc','Pause / release mouse'],['F','Creative: toggle flight'],['Ctrl / C','Creative: fly down'],['F3','Performance display']].map(([key,v])=>`<div><kbd>${key}</kbd><span>${v}</span></div>`).join('')}</div><div class="guide-notes"><p><b>Start small.</b> Your pack has a pickaxe, building blocks, a workbench, lanterns, and berries. Hold left click on an oak trunk, then press E to craft planks.</p><p><b>Dig a little deeper.</b> A wooden pick mines stone and coal. Place a workbench within four blocks to craft a stone pick, a sword, glass, and iron tools.</p><p><b>Watch the sky.</b> A day lasts 12 minutes. Hollows emerge at night. Eat berries with right click to heal, or build a shelter. Wildflowers and leaves provide berries; sheep provide wool and food.</p><p><b>Keep your world.</b> Autosaves stay in this browser at this address. Export a world from Pause to back it up or move it. Respawning keeps your inventory.</p></div><button class="button primary" data-action="back">Got it ${arrow}</button>`,'help-dialog');
    if(screen==='inventory'){this.picked=null;this.renderInventory();}
    if(screen==='dead')this.nodes.overlay.innerHTML=this.panel(`<span class="overline">EVERY ADVENTURE HAS A DETOUR</span><h2>The wild got you.</h2><p class="muted">${escapeHtml(this.game.deathCause)}</p><p class="muted">Your world and backpack are safe.<br>You’ll return to your first clearing.</p><button class="button primary" data-action="respawn">Find your feet again ${arrow}</button>`,'pause-dialog');
    if(screen==='help'&&window.wildwoodDesktop){
      this.nodes.overlay.querySelector('.guide-notes p:last-child').innerHTML='<b>Keep your world.</b> Your progress saves automatically in this app. To bring a world from the browser, export it there and import that file on the title screen. Export from Pause to make backups. Respawning keeps your backpack. Press <kbd>F11</kbd> for full screen.';
    }
  }
  settingText(key,value){return key==='fov'?`${value}°`:key==='radius'?`${value*16} blocks`:key==='volume'?`${Math.round(value*100)}%`:key==='sensitivity'?`${value.toFixed(2)}×`:`${value}×`;}
  renderSettings(back) {
    const s=this.game.settings;
    this.nodes.overlay.innerHTML=this.panel(`${back}<span class="overline">MAKE IT YOURS</span><h2>A few little adjustments.</h2>${[['sensitivity','Mouse sensitivity',.2,2.5,.05],['fov','Field of view',60,100,1],['radius','View distance',2,6,1],['volume','Sound effects',0,1,.05]].map(([key,label,min,max,step])=>`<label class="setting-row"><span>${label}<output>${this.settingText(key,s[key])}</output></span><input aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-setting="${key}" /></label>`).join('')}<label class="setting-row select-row"><span>Render resolution</span><select data-setting="quality" aria-label="Render resolution"><option value="0.65" ${s.quality===.65?'selected':''}>Performance · 65%</option><option value="1" ${s.quality===1?'selected':''}>Balanced · 100%</option><option value="1.5" ${s.quality===1.5?'selected':''}>Crisp · 150%</option></select></label>${[['shadows','Soft shadows','Turn off for a faster frame rate.'],['autoJump','Auto jump','Hop up terrain while walking.'],['showFps','Performance display','Frame rate, chunks, and coordinates.']].map(([key,label,hint])=>`<label class="toggle-row"><span><b>${label}</b><small>${hint}</small></span><input type="checkbox" data-setting="${key}" ${s[key]?'checked':''}/></label>`).join('')}<button class="button primary" data-action="back">All set ${arrow}</button>`,'settings-dialog');
  }
  slot(i,hotbar=false) {
    const s=this.game.inventory.slots[i],selected=hotbar?i===this.game.inventory.selected:i===this.picked;
    return `<button class="slot ${selected?'selected':''} ${s?'filled':''}" data-slot="${i}" title="${s?escapeHtml(ITEMS[s.id].name):'Empty slot'}" aria-label="Slot ${i+1}: ${s?escapeHtml(ITEMS[s.id].name)+', '+s.count:'empty'}">${i<9?`<span class="slot-key">${i+1}</span>`:''}${s?`${this.icon(s.id)}<b class="count">${s.count>1?s.count:''}</b>`:''}</button>`;
  }
  renderInventory() {
    if(this.picked!==null&&!this.game.inventory.slots[this.picked])this.picked=null;
    const g=this.game,bench=g.nearBench();
    this.nodes.overlay.innerHTML=this.panel(`<div class="inventory-heading"><div><span class="overline">A LITTLE OF EVERYTHING</span><h2>Your backpack.</h2></div><button class="close-button" data-action="inventory-close" aria-label="Close backpack">×</button><span class="bench-status ${bench?'available':''}"><i></i>${bench?'Workbench in reach':'Hand crafting'}</span></div><div class="inventory-layout"><section class="inventory-items"><div class="section-label">BACKPACK <span>${g.inventory.slots.filter(Boolean).length} / 36 slots</span></div><div class="slot-grid">${Array.from({length:27},(_,i)=>this.slot(i+9)).join('')}</div><div class="section-label hotbar-label">HOTBAR <span>Keys 1–9</span></div><div class="slot-grid">${Array.from({length:9},(_,i)=>this.slot(i)).join('')}</div><p class="inventory-tip">Click an item, then a slot to move or merge it.<br><kbd>Shift</kbd> + click moves between backpack and hotbar.</p><div class="picked-info">${this.picked!==null?`${this.icon(g.inventory.slots[this.picked].id)}<b>${escapeHtml(ITEMS[g.inventory.slots[this.picked].id].name)}</b><button class="small-button" data-action="discard">Discard</button>`:'<span>Good things start with what you have.</span>'}</div>${g.mode==='creative'?`<div class="section-label">CREATIVE PALETTE <span>Click to fill selected hotbar slot</span></div><div class="palette">${CREATIVE_ITEMS.map(id=>`<button data-palette="${id}" title="${ITEMS[id].name}" aria-label="Add ${ITEMS[id].name}">${this.icon(id)}</button>`).join('')}</div>`:''}</section><section class="crafting"><div class="section-label">CRAFT SOMETHING <span>${bench?'Workbench recipes unlocked':'Place a bench for more'}</span></div><div class="recipes">${RECIPES.map(r=>{const can=g.inventory.canCraft(r,bench);return `<button class="recipe ${can?'craftable':''}" data-recipe="${r.id}" ${can?'':'disabled'} title="${escapeHtml(r.hint)}"><span class="recipe-icon">${this.icon(r.out[0])}<b>×${r.out[1]}</b></span><span class="recipe-copy"><b>${r.name}</b><small>${r.needs.map(([id,n])=>`<span class="${g.inventory.count(id)>=n?'enough':'missing'}">${n} ${ITEMS[id].name}</span>`).join(' + ')}</small>${r.bench&&!bench?'<em>Requires a nearby workbench</em>':''}</span><span class="craft-arrow">${can?'+':'·'}</span></button>`;}).join('')}</div></section></div><div class="inventory-footer"><span>The world waits while you craft.</span><button data-action="inventory-close"><kbd>E</kbd> Return to the wild →</button></div>`,'inventory-dialog');
    this.recipeRevision=g.inventory.revision;this.lastBench=bench;
  }
  updateHud(force=false) {
    const g=this.game,inv=g.inventory,p=g.player;if(!g.active||!p)return;
    if(force||this.revision!==inv.revision||this.lastSelected!==inv.selected){this.nodes.hotbar.innerHTML=Array.from({length:9},(_,i)=>this.slot(i,true)).join('');this.nodes['held-name'].textContent=inv.held?ITEMS[inv.held.id].name:'Empty hand';this.revision=inv.revision;this.lastSelected=inv.selected;}
    this.nodes.health.innerHTML=Array.from({length:10},(_,i)=>`<span class="heart ${p.health>i*2?'':'empty'} ${p.health===i*2+1?'half':''}">${heart}</span>`).join('');
    this.nodes['health-label'].textContent=g.mode==='creative'?'∞':`${Math.ceil(p.health)} / 20`;
    this.nodes.air.hidden=p.air>=10;this.nodes.air.textContent=`AIR ${Math.ceil(p.air)}s`;
    const phase=g.time%720/720,h=Math.floor(phase*24),m=Math.floor((phase*24-h)*60);
    this.nodes['day-time'].textContent=`Day ${Math.floor(g.time/720)+1}`;this.nodes['clock-time'].textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${g.atmosphere.night?'· NIGHT':''}`;
    this.nodes['sun-icon'].innerHTML=g.atmosphere.night?'<span class="moon-icon">☾</span>':sun;
    const compass=['N','W','S','E'];this.nodes.compass.textContent=compass[((Math.round(p.yaw/(Math.PI/2))%4)+4)%4];
    this.nodes.biome.textContent=columnAt(p.pos.x,p.pos.z,g.world.seed).biome;this.nodes['mode-label'].textContent=g.mode==='creative'?(p.flying?'CREATIVE · FLYING':'CREATIVE · F TO FLY'):'SURVIVAL';
    this.nodes.debug.hidden=!g.settings.showFps;this.nodes.debug.textContent=`${Math.round(g.fps)} FPS · ${g.worldRenderer.meshes.size} chunks · ${g.renderer.info.render.calls} draws\nXYZ ${p.pos.x.toFixed(1)} / ${p.pos.y.toFixed(1)} / ${p.pos.z.toFixed(1)} · ${g.world.editCount} edits`;
    const progress=g.progress,chapter=progress.logs&&progress.crafted&&progress.placed;
    const tasks=chapter?[[progress.stone,'Craft a stone pickaxe'],[progress.shelter,'Place 12 blocks for a shelter'],[progress.night,'See your first night']]:[[progress.logs,'Gather an oak log'],[progress.crafted,'Craft something · press E'],[progress.placed,'Place an amber lantern']];
    this.nodes['field-notes'].innerHTML=`<button class="notes-toggle" data-action="notes"><span class="overline">FIELD NOTES ${chapter?'02':'01'}</span><span>${g.notesHidden?'+':'−'}</span></button>${g.notesHidden?'':`<h3>${chapter?'A home in the wild.':'Make yourself at home.'}</h3>${tasks.map(([done,label])=>`<div class="quest ${done?'done':''}"><i>${done?'✓':''}</i><span>${label}</span></div>`).join('')}`}`;
    document.body.classList.toggle('underwater',p.underwater&&g.screen==='playing');
  }
  target(hit,progress=0,hint='') {
    this.nodes.target.hidden=!hit;if(!hit)return;
    this.nodes['target-name'].textContent=hit.mob?(hit.mob.type==='sheep'?'Meadow sheep':'Hollow'):`${ITEMS[hit.id]?.name||''}`;
    this.nodes['target-tool'].textContent=hit.mob?`${Math.ceil(hit.mob.health)} health · left click to attack`:hint;
    this.nodes.mining.hidden=progress<=0;this.nodes.mining.firstElementChild.style.width=`${Math.min(1,progress)*100}%`;
  }
  loading(value){const bar=document.querySelector('#load-progress');if(bar)bar.style.width=`${value*100}%`;const label=document.querySelector('#load-label');if(label)label.textContent=`Preparing your clearing… ${Math.round(value*100)}%`;}
  toast(message){clearTimeout(this.toastTimer);this.nodes.toast.textContent=message;this.nodes.toast.classList.add('visible');this.toastTimer=setTimeout(()=>this.nodes.toast.classList.remove('visible'),3400);}
  flash(){this.nodes['damage-flash'].classList.remove('flash');void this.nodes['damage-flash'].offsetWidth;this.nodes['damage-flash'].classList.add('flash');}
}
