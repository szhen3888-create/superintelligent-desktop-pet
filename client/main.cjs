const {app,BrowserWindow,ipcMain,Tray,Menu,nativeImage,dialog,shell,safeStorage}=require('electron');
const path=require('node:path'),fs=require('node:fs');
const service=require('./service.cjs');
const crosspet=require('./crosspet-service.cjs');
const crosspetPet=require('./crosspet-pet.cjs');
const crosspetIntegrate=require('./crosspet-integrate.cjs');
app.setName('SI合宠');fs.mkdirSync(path.join(service.HOME,'pet-control-client'),{recursive:true});app.setPath('userData',path.join(service.HOME,'pet-control-client'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let window,collectionsWindow,tray,quitting=false,peakTimer=null,collectionsEditCloneId=null;
if(!app.requestSingleInstanceLock()){app.quit();}else if(process.argv.includes('--quit')){app.quit();}else{
 app.on('second-instance',(_event,argv)=>{if(argv.includes('--quit')){void quitAll();return;}if(window){window.show();if(window.isMinimized())window.restore();window.focus();}});
 app.whenReady().then(async()=>{
  process.env.CROSSPET_DATA_DIR=crosspet.STATE_DIR;
  process.env.CROSSPET_STATE_DIR=path.join(crosspet.STATE_DIR,'state');
  fs.mkdirSync(process.env.CROSSPET_STATE_DIR,{recursive:true});
  const ai=require('./ai.cjs').createAI({service,safeStorage,onChanged:id=>{if(window&&!window.isDestroyed())window.webContents.send('ai:changed',id);}});
  const chatBridge=await require('./chat-bridge.cjs').startChatBridge({ai});
  service.setChatBridge(chatBridge.env);app.once('before-quit',()=>chatBridge.close());
  try{await service.ensureServer();}catch(e){dialog.showErrorBox('桌宠启动失败',e.message);app.quit();return;}
  try{const {startRoleAudit}=require(path.join(service.PACKAGE,'runtime/electron-helper/role-log.js'));const stopAudit=startRoleAudit({root:service.ROOT});app.once('before-quit',stopAudit);}catch(e){console.error('[pet-log] audit start failed:',e.message);}
  try{const broker=require(path.join(service.PACKAGE,'runtime/electron-helper/collision-link.cjs')).startBroker();broker.ready.catch(e=>console.error('[collision]',e.message));app.once('before-quit',()=>{void broker.close();});}catch(e){console.error('[collision] start failed:',e.message);}
  window=new BrowserWindow({width:1100,height:780,minWidth:800,minHeight:620,title:'SI合宠',backgroundColor:'#f4f8fa',autoHideMenuBar:true,show:false,icon:path.join(__dirname,'assets/app.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.setMenu(null);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  if(process.platform==='win32')window.hookWindowMessage(0x8042,()=>{void quitAll();});
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
  window.on('show',()=>service.list().then(publishRoles).catch(()=>{}));
  window.once('ready-to-show',()=>window.show());
  const image=nativeImage.createFromPath(path.join(__dirname,'assets/app.ico')).resize({width:24,height:24});
  tray=new Tray(image);tray.setToolTip('SI合宠 · 宠物在后台陪伴');
  const show=()=>{window.show();window.focus();};
  tray.on('click',show);tray.on('double-click',show);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'打开角色控制台',click:show},
    {label:'打开 CrossPet 合集',click:()=>openCollections()},
    {label:'全部开启',click:()=>showAll().catch(e=>dialog.showErrorBox('开启失败',e.message))},
    {label:'隐藏全部角色',click:()=>hideAll().catch(e=>dialog.showErrorBox('隐藏失败',e.message))},
    {type:'separator'},
    {label:'退出全部桌宠',click:()=>quitAll()}
  ]));
  const fromUi=(event)=>window&&!window.isDestroyed()&&event.sender===window.webContents
    ||collectionsWindow&&!collectionsWindow.isDestroyed()&&event.sender===collectionsWindow.webContents;
  const handle=(name,fn)=>ipcMain.handle(name,async(event,...args)=>{if(!fromUi(event)||event.senderFrame!==event.sender.mainFrame)throw Error('无效的窗口');return fn(...args);});
  handle('ai:settings',()=>ai.settings());
  handle('ai:save',input=>ai.save(input));
  handle('ai:test',()=>ai.test());
  handle('ai:history',id=>ai.history(id));
  handle('ai:send',(id,text)=>ai.send(id,text));
  handle('characters:list',()=>service.list());
  handle('characters:resize',(id,size)=>service.resize(id,size).then(publishRoles));
  handle('characters:clone',async id=>{
    const before=new Set((await service.list()).map(r=>r.id));
    const roles=await service.clone(id);
    const created=roles.find(r=>r.isClone&&!before.has(r.id));
    const parent=roles.find(r=>!r.isClone&&(r.id===id||r.entry===(created&&created.entry)));
    const linked=parent&&require('./character-links.cjs').crosspetIdFor(parent.entry);
    if(created&&linked) crosspet.ensureCloneLook(crosspet.loadState(),created.id,linked);
    return publishRoles(roles);
  });
  handle('characters:remove-clone',id=>service.clone(id,true).then(roles=>{
    try{crosspetPet.closeClone(id);}catch{}
    crosspet.removeCloneLook(crosspet.loadState(),id);
    publishCrosspet(collectionsPayload());
    return publishRoles(roles);
  }));
  handle('characters:toggle',(id,visible)=>service.toggle(id,visible));
  handle('characters:play',(id,name)=>service.play(id,name));
  handle('characters:folder',async id=>{const role=await service.find(id);const result=await shell.openPath(role.project);if(result)throw Error(result);return true;});
  handle('characters:hide-all',()=>hideAll());
  handle('characters:show-all',()=>showAll());
  handle('characters:import',async()=>{const result=await dialog.showOpenDialog(window,{title:'选择角色项目（包含 config.json 和 animations 文件夹）',properties:['openDirectory']});if(result.canceled)return null;return service.importProject(result.filePaths[0]);});
  handle('client:quit',()=>quitAll());

  handle('crosspet:summary',async()=>{
    // 自愈：状态与真实主窗不一致时对齐，避免「桌宠在但开关关着」
    const s=crosspet.loadState();
    try{
      if(crosspet.shouldShowPrimary(s)){
        if(!crosspetPet.isOpen()) await crosspetPet.showPet();
      }else if(crosspetPet.isOpen()){
        crosspetPet.hidePet();
      }
    }catch(e){console.error('[crosspet-sync]',e.message);}
    return crosspet.collectionsSummary(crosspet.loadState());
  });
  handle('crosspet:clone-looks',async()=>{
    const roles=await service.list();
    const links=require('./character-links.cjs');
    const s=crosspet.loadState();
    for(const r of roles.filter(x=>x.isClone)){
      const cid=links.crosspetIdFor(r.entry);
      if(cid) crosspet.ensureCloneLook(s,r.id,cid);
    }
    for(const id of Object.keys(s.cloneLooks||{})){
      if(!roles.some(r=>r.id===id)){
        try{crosspetPet.closeClone(id);}catch{}
        crosspet.removeCloneLook(crosspet.loadState(),id);
      }
    }
    return crosspet.cloneLooksSummary(crosspet.loadState());
  });
  handle('crosspet:get',()=>collectionsPayload());
  handle('crosspet:skin',(id,skin)=>{crosspet.setSkin(crosspet.loadState(),id,skin||'');return afterCrosspetChange();});
  handle('crosspet:clone-skin',(cloneId,characterId,skin)=>{
    crosspet.setCloneSkin(crosspet.loadState(),cloneId,characterId,skin||'');
    return afterCloneLookChange(cloneId);
  });
  handle('crosspet:rename',(id,name)=>{crosspet.rename(crosspet.loadState(),id,name||'');return afterCrosspetChange();});
  handle('crosspet:set-peak-skins',(map)=>{const s=crosspet.loadState();s.peakSkins=map&&typeof map==='object'?map:{};crosspet.saveState(s);return afterCrosspetChange();});
  handle('crosspet:toggle-desktop',async()=>{const s=crosspet.loadState();if(s.visible){crosspetPet.hidePet();return collectionsPayload();}await crosspetPet.showPet();return collectionsPayload();});
  handle('crosspet:toggle',async(id,visible)=>{
    const s=crosspet.loadState();
    if(visible){
      crosspet.setCharacter(s,id);
      crosspet.ensureCrosspetMode(crosspet.loadState(),id);
      await crosspetPet.showPet();
    }else{
      // 关的时候以真实状态为准：当前角色 / 正在显示 / 窗口开着，都关掉
      const cur=crosspet.loadState();
      if(cur.character===id||cur.visible||crosspetPet.isOpen()) crosspetPet.hidePet();
    }
    return crosspet.collectionsSummary(crosspet.loadState());
  });
  handle('crosspet:toggle-clone',async(cloneId,visible)=>{
    const s=crosspet.loadState();
    const look=s.cloneLooks?.[cloneId]||crosspet.ensureCloneLook(s,cloneId,s.character);
    if(visible){
      if(look.engineMode!=='crosspet') throw Error('该分身当前是动作原版，请先改形象');
      await crosspetPet.showClone(cloneId);
    }else{
      crosspetPet.hideClone(cloneId);
    }
    publishCrosspet(collectionsPayload());
    return crosspet.cloneLooksSummary(crosspet.loadState());
  });
  handle('crosspet:open-collections',(id,cloneId)=>openCollections(id,cloneId||null));
  handle('crosspet:close-collections',()=>{collectionsEditCloneId=null;if(collectionsWindow&&!collectionsWindow.isDestroyed())collectionsWindow.close();return true;});
  handle('crosspet:settings',()=>crosspetIntegrate.settingsBundle());
  handle('crosspet:set-follow',(key,value)=>{const s=crosspet.loadState();if(!['followApps','followEvents','quotaAggregate'].includes(key))throw Error('无效设置');s[key]=!!value;crosspet.saveState(s);void crosspetPet.refreshFromState();return crosspetIntegrate.settingsBundle(s);});
  handle('crosspet:set-style',(key,value)=>{const s=crosspet.loadState();if(!['quotaStyle','peakStyle'].includes(key))throw Error('无效设置');s[key]=String(value||'');crosspet.saveState(s);void crosspetPet.refreshFromState();return crosspetIntegrate.settingsBundle(s);});
  handle('crosspet:install',target=>crosspetIntegrate.install(target));
  handle('crosspet:uninstall',target=>crosspetIntegrate.uninstall(target));

  ipcMain.on('crosspet:pet-message',(_event,msg)=>crosspetPet.handlePetMessage(msg));

  await window.loadFile(path.join(__dirname,'index.html'));
  startPeakTimer();
  const boot=crosspet.loadState();
  if(crosspet.shouldShowPrimary(boot)){
    try{await crosspetPet.showPet();}catch(e){console.error('[crosspet]',e.message);}
  }else if(boot.visible){
    // 纠正：visible=true 但当前是「动作原版」映射角色 → 关掉幽灵窗
    try{crosspetPet.hidePet();}catch{}
  }
  for(const [cloneId,look] of Object.entries(boot.cloneLooks||{})){
    if(look.engineMode==='crosspet'&&look.visible){
      try{await crosspetPet.showClone(cloneId);}catch(e){console.error('[crosspet-clone]',e.message);}
    }
  }
  app.on('before-quit',()=>{crosspetPet.closePet();stopPeakTimer();});
  if(process.argv.includes('--verify-ai'))void require('./verify-ai.cjs').verifyAI(window,ai,service);
 }).catch(e=>{dialog.showErrorBox('控制台出错',e.message);app.quit();});
}
function collectionsPayload(){
  const state=crosspet.loadState();
  const editCloneId=collectionsEditCloneId;
  const cloneLook=editCloneId?crosspet.getCloneLook(state,editCloneId):null;
  return {
    character:state.character,
    visible:!!state.visible,
    peakSkins:state.peakSkins||{},
    characters:crosspet.buildSettingsCharacters(state),
    editCloneId:editCloneId||null,
    cloneLook,
    cloneLooks:crosspet.cloneLooksSummary(state),
  };
}
async function afterCrosspetChange(){
  const s=crosspet.loadState();
  try{
    if(crosspet.shouldShowPrimary(s)){
      await crosspetPet.refreshFromState();
    }else if(s.visible||crosspetPet.isOpen()){
      // 切回动作原版 / 不该显示时，关掉主窗并清 visible
      crosspetPet.hidePet();
    }
  }catch(e){console.error('[crosspet]',e.message);}
  const payload=collectionsPayload();
  publishCrosspet(payload);
  return payload;
}
async function afterCloneLookChange(cloneId){
  try{
    const s=crosspet.loadState();
    const look=s.cloneLooks?.[cloneId];
    if(!look) return collectionsPayload();
    const roles=await service.list();
    const child=roles.find(r=>r.id===cloneId);
    if(look.engineMode==='webm'){
      const wasCrossVisible=!!look.visible;
      crosspetPet.hideClone(cloneId);
      if(wasCrossVisible&&child&&!child.visible){
        await service.toggle(cloneId,true);
        publishRoles(await service.list());
      }
    }else if(child?.visible){
      await service.toggle(cloneId,false);
      publishRoles(await service.list());
      await crosspetPet.showClone(cloneId);
    }else if(look.visible){
      await crosspetPet.refreshClone(cloneId);
    }
  }catch(e){console.error('[crosspet-clone]',e.message);}
  const payload=collectionsPayload();
  publishCrosspet(payload);
  return payload;
}
function publishRoles(roles){if(window&&!window.isDestroyed())window.webContents.send('characters:changed',roles);return roles;}
function publishCrosspet(payload){
  if(window&&!window.isDestroyed())window.webContents.send('crosspet:changed',payload);
  if(collectionsWindow&&!collectionsWindow.isDestroyed())collectionsWindow.webContents.send('crosspet:changed',payload);
}
async function openCollections(focusId,cloneId){
  collectionsEditCloneId=cloneId||null;
  if(focusId){
    try{
      const s=crosspet.loadState();
      crosspet.setCharacter(s,focusId);
      if(cloneId) crosspet.ensureCloneLook(crosspet.loadState(),cloneId,focusId);
    }catch{}
  }
  if(collectionsWindow&&!collectionsWindow.isDestroyed()){collectionsWindow.focus();publishCrosspet(collectionsPayload());return true;}
  collectionsWindow=new BrowserWindow({
    width:980,height:820,minWidth:720,minHeight:640,title:cloneId?'SI合宠 · 分身形象':'SI合宠 · 选版本',parent:window||undefined,
    backgroundColor:'#f4f8fa',autoHideMenuBar:true,show:false,
    icon:path.join(__dirname,'assets/app.ico'),
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true},
  });
  collectionsWindow.setMenu(null);
  collectionsWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  collectionsWindow.webContents.on('will-navigate',event=>event.preventDefault());
  collectionsWindow.once('ready-to-show',()=>collectionsWindow.show());
  collectionsWindow.on('closed',()=>{collectionsWindow=null;collectionsEditCloneId=null;});
  await collectionsWindow.loadFile(path.join(__dirname,'collections','collections.html'));
  return true;
}
function startPeakTimer(){
  stopPeakTimer();
  peakTimer=setInterval(()=>void tickPeakSkins(),60*1000);
  void tickPeakSkins();
}
function stopPeakTimer(){if(peakTimer)clearInterval(peakTimer);peakTimer=null;}
async function tickPeakSkins(){
  // Peak switching is primarily handled inside the pet page via setPeakSkins + PeakHours.
  // Host keeps pet alive and refreshes peak map hourly in case the page missed a tick.
  const s=crosspet.loadState();
  if(!s.visible||!s.peakSkins||!Object.keys(s.peakSkins).length)return;
  try{await crosspetPet.refreshFromState();}catch{}
}
async function hideAll(){
  for(const role of await service.list())if(role.visible)await service.toggle(role.id,false);
  crosspetPet.hidePet();
  const s=crosspet.loadState();
  for(const cloneId of Object.keys(s.cloneLooks||{})) crosspetPet.hideClone(cloneId);
  publishCrosspet(collectionsPayload());
  return publishRoles(await service.list());
}
async function showAll(){for(const role of await service.list())if(!role.visible)await service.toggle(role.id,true);return publishRoles(await service.list());}
async function quitAll(){
  try{crosspetPet.closePet();}catch{}
  stopPeakTimer();
  if(collectionsWindow&&!collectionsWindow.isDestroyed()){collectionsWindow.destroy();collectionsWindow=null;}
  try{await service.request('/shutdown','POST');quitting=true;app.quit();}
  catch(e){if(['ECONNREFUSED','ECONNRESET'].includes(e.code)){quitting=true;app.quit();}else dialog.showErrorBox('退出失败',e.message);}
}
app.on('window-all-closed',()=>{});
module.exports={hideAll,showAll,quitAll};
