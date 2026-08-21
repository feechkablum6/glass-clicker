'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
    onNotice: handler => ipcRenderer.on('notice', (event, notice) => handler(notice)),
    onDetail: handler => ipcRenderer.on('notice:detail', (event, update) => handler(update)),
    idle: id => ipcRenderer.send('overlay:idle', id)
});
