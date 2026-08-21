'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clicker', {
    getState: () => ipcRenderer.invoke('state:get'),
    updateConfig: patch => ipcRenderer.invoke('config:update', patch),
    setLanguage: value => ipcRenderer.invoke('language:set', value),
    captureBind: () => ipcRenderer.invoke('bind:capture'),
    cancelCapture: () => ipcRenderer.invoke('bind:cancel'),
    toggle: () => ipcRenderer.invoke('clicker:toggle'),
    resetCounter: () => ipcRenderer.invoke('counter:reset'),
    requestAccess: () => ipcRenderer.invoke('access:request'),
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    onState: handler => ipcRenderer.on('state', (event, state) => handler(state)),
    onClicks: handler => ipcRenderer.on('clicks', (event, clicks) => handler(clicks)),
    onBindRejected: handler => ipcRenderer.on('bind:rejected', (event, info) => handler(info))
});
