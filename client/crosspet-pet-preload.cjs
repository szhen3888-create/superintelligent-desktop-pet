'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siHechongPet', {
  post: (msg) => ipcRenderer.send('crosspet:pet-message', msg),
});
