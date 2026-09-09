const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('wildwoodDesktop', Object.freeze({
  isDesktop:true,
  version:'1.1.0',
  toggleFullscreen:() => ipcRenderer.invoke('wildwood:fullscreen'),
  quit:() => ipcRenderer.send('wildwood:quit'),
}));
