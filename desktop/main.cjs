const {app, BrowserWindow, Menu, protocol, session, ipcMain, screen, dialog} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {serveAsset} = require('./assets.cjs');

const testing = process.argv.includes('--wildwood-test');
const argument = prefix => process.argv.find(a => a.startsWith(prefix))?.slice(prefix.length);
app.setName('Wildwood');
app.setAppUserModelId('com.wildwood.sandbox');
const profile = testing && argument('--wildwood-profile=')
  ? path.resolve(argument('--wildwood-profile='))
  : path.join(app.getPath('appData'), 'Wildwood');
app.setPath('userData', profile);
if (testing) app.commandLine.appendSwitch('enable-unsafe-swiftshader');

protocol.registerSchemesAsPrivileged([{scheme:'wildwood', privileges: {
  standard:true, secure:true, supportFetchAPI:true, corsEnabled:true, codeCache:true,
}}]);

let win = null;
const boundsFile = path.join(profile, 'window.json');
const owned = contents => contents && !contents.isDestroyed() && contents.getURL().startsWith('wildwood://game/');

function windowOptions() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(boundsFile, 'utf8')); } catch {}
  const width = Number.isFinite(saved.width) ? Math.max(960, Math.min(saved.width, 3840)) : 1280;
  const height = Number.isFinite(saved.height) ? Math.max(640, Math.min(saved.height, 2160)) : 800;
  const position = Number.isFinite(saved.x) && Number.isFinite(saved.y)
    && screen.getAllDisplays().some(({workArea:r}) => saved.x + width > r.x + 100 && saved.x < r.x+r.width-100 && saved.y+height>r.y+100 && saved.y<r.y+r.height-100)
    ? {x:saved.x, y:saved.y} : {};
  return {width,height,...position,maximized:saved.maximized === true};
}

async function createWindow() {
  const saved = windowOptions();
  win = new BrowserWindow({
    width:saved.width,height:saved.height,x:saved.x,y:saved.y,
    minWidth:960,minHeight:640,show:false,backgroundColor:'#172b2b',
    title:'Wildwood',icon:path.join(__dirname,'icon.png'),autoHideMenuBar:true,
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,
      contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false,
    },
  });
  if (saved.maximized) win.maximize();
  win.once('ready-to-show', () => { win.show(); });
  win.on('page-title-updated', event => {event.preventDefault();win.setTitle('Wildwood');});
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('wildwood://game/')) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('before-input-event', (event,input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) {
      event.preventDefault();win.setFullScreen(!win.isFullScreen());
    }
  });
  win.on('close', () => {
    try {
      fs.mkdirSync(profile,{recursive:true});
      fs.writeFileSync(boundsFile,JSON.stringify({...win.getNormalBounds(),maximized:win.isMaximized()}));
    } catch {}
  });
  win.on('closed', () => {win=null;session.defaultSession.flushStorageData();});
  win.webContents.on('render-process-gone', (_event, details) => {
    if (!['clean-exit'].includes(details.reason)) console.error('Wildwood renderer stopped:',details.reason);
  });
  await win.loadURL('wildwood://game/' + (testing ? '?test=1' : ''));
}

if (!testing && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (win) {if(win.isMinimized())win.restore();win.show();win.focus();}
  });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    protocol.handle('wildwood', request => serveAsset(path.join(app.getAppPath(),'dist'),request));
    const permissions = new Set(['pointerLock','fullscreen']);
    session.defaultSession.setPermissionRequestHandler((contents,permission,callback) => callback(owned(contents) && permissions.has(permission)));
    session.defaultSession.setPermissionCheckHandler((contents,permission,origin) => owned(contents) && origin.startsWith('wildwood://game') && permissions.has(permission));
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']}, (_details,callback) => callback({cancel:true}));
    session.defaultSession.on('will-download', (_event,item,contents) => {
      if (!owned(contents)) return;
      const filename = path.basename(item.getFilename()).replace(/[<>:"/\\|?*]/g,'-');
      const exportFolder = testing && argument('--wildwood-exports=');
      if (exportFolder) {
        fs.mkdirSync(exportFolder,{recursive:true});item.setSavePath(path.join(exportFolder,filename));
      } else item.setSaveDialogOptions({title:'Export your Wildwood world',defaultPath:path.join(app.getPath('downloads'),filename),filters:[{name:'Wildwood world',extensions:['json']}]});
    });
    ipcMain.handle('wildwood:fullscreen', event => {
      if (owned(event.sender) && win) {win.setFullScreen(!win.isFullScreen());return win.isFullScreen();}
      return false;
    });
    ipcMain.on('wildwood:quit', event => {if(owned(event.sender)) win?.close();});
    await createWindow();
  }).catch(error => {
    console.error(error);dialog.showErrorBox('Wildwood could not start',error.message);app.exit(1);
  });
}
app.on('window-all-closed', () => app.quit());
