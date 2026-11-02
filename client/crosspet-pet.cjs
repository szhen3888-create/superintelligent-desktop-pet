'use strict';
const path = require('node:path');
const { BrowserWindow, screen } = require('electron');
const service = require('./crosspet-service.cjs');

const PRIMARY = 'primary';
const instances = new Map(); // id -> BrowserWindow
let followTimer = null;
let stateWatcher = null;
const appsMap = (() => {
  try { return require(path.join(service.CROSSPET_ROOT, 'apps.json')); }
  catch { return {}; }
})();

function petPreload() {
  return path.join(__dirname, 'crosspet-pet-preload.cjs');
}

function petPage() {
  return path.join(service.CROSSPET_ROOT, 'web', 'index.html');
}

function instanceIndex(instanceId) {
  if (instanceId === PRIMARY) return 0;
  const keys = [...instances.keys()].filter((k) => k !== PRIMARY).sort();
  const i = keys.indexOf(instanceId);
  return (i < 0 ? keys.length : i) + 1;
}

async function pushManifest(win, characterId, skinOverride) {
  if (!win || win.isDestroyed()) return;
  const state = service.loadState();
  const skins = { ...(state.skins || {}) };
  if (typeof skinOverride === 'string') skins[characterId] = skinOverride;
  const manifest = service.buildManifest({ ...state, skins });
  const json = JSON.stringify(manifest);
  await win.webContents.executeJavaScript(`
    (function(){
      if (typeof init === 'function') init(${json});
      const id = ${JSON.stringify(characterId)};
      if (typeof setCharacter === 'function' && id) setCharacter(id, true);
      if (typeof setPeakSkins === 'function') setPeakSkins(${JSON.stringify(state.peakSkins || {})});
      if (typeof setQuotaAggregate === 'function') setQuotaAggregate(${JSON.stringify(!!state.quotaAggregate)});
      if (typeof setQuotaStyle === 'function') setQuotaStyle(${JSON.stringify(state.quotaStyle || 'bars')});
      if (typeof setPeakStyle === 'function') setPeakStyle(${JSON.stringify(state.peakStyle || 'bar')});
      if (typeof refreshLook === 'function' && id) refreshLook(id);
    })();
  `);
}

function placeWindow(win, size, slot) {
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea;
  const w = Math.max(280, Math.round(size * 1.15));
  const h = Math.max(320, Math.round(size * 1.45));
  const gap = 18;
  const col = slot % 4;
  const row = Math.floor(slot / 4);
  win.setSize(w, h);
  win.setPosition(
    wa.x + wa.width - w - 24 - col * (Math.round(w * 0.55) + gap),
    wa.y + wa.height - h - 24 - row * (Math.round(h * 0.35) + gap),
  );
}

async function createWindow(instanceId) {
  const win = new BrowserWindow({
    width: 320,
    height: 420,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: petPreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.on('closed', () => {
    instances.delete(instanceId);
    if (!instances.size) {
      stopFollow();
      stopStateWatch();
    }
  });
  await win.loadFile(petPage());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await injectBridge(win, instanceId);
  return win;
}

async function showInstance(instanceId, characterId, skin, size) {
  let win = instances.get(instanceId);
  if (!win || win.isDestroyed()) {
    win = await createWindow(instanceId);
    instances.set(instanceId, win);
  }
  placeWindow(win, size || 280, instanceIndex(instanceId));
  win.show();
  await pushManifest(win, characterId, skin || '');
  ensureTimers();
  return win;
}

async function showPet() {
  const state = service.loadState();
  state.visible = true;
  service.saveState(state);
  const skin = state.skins?.[state.character] || '';
  await showInstance(PRIMARY, state.character, skin, state.size || 280);
  return state;
}

function hideInstance(instanceId) {
  const win = instances.get(instanceId);
  if (win && !win.isDestroyed()) win.hide();
}

function hidePet() {
  const state = service.loadState();
  state.visible = false;
  service.saveState(state);
  hideInstance(PRIMARY);
  if (![...instances.values()].some((w) => w && !w.isDestroyed() && w.isVisible())) {
    stopFollow();
    stopStateWatch();
  }
  return state;
}

async function showClone(cloneId) {
  const state = service.loadState();
  const look = state.cloneLooks?.[cloneId];
  if (!look || look.engineMode !== 'crosspet') throw Error('该分身当前不是 CrossPet 形象');
  service.setCloneVisible(state, cloneId, true);
  await showInstance(cloneId, look.character, look.skin || '', state.size || 280);
  return service.getCloneLook(service.loadState(), cloneId);
}

function hideClone(cloneId) {
  const state = service.loadState();
  if (state.cloneLooks?.[cloneId]) service.setCloneVisible(state, cloneId, false);
  hideInstance(cloneId);
  if (![...instances.values()].some((w) => w && !w.isDestroyed() && w.isVisible())) {
    stopFollow();
    stopStateWatch();
  }
  return service.getCloneLook(service.loadState(), cloneId);
}

async function refreshFromState() {
  const state = service.loadState();
  if (state.visible) {
    const skin = state.skins?.[state.character] || '';
    if (!instances.get(PRIMARY) || instances.get(PRIMARY).isDestroyed()) await showPet();
    else await pushManifest(instances.get(PRIMARY), state.character, skin);
  }
  for (const [cloneId, look] of Object.entries(state.cloneLooks || {})) {
    if (look.engineMode !== 'crosspet' || !look.visible) {
      hideInstance(cloneId);
      continue;
    }
    const win = instances.get(cloneId);
    if (!win || win.isDestroyed()) await showClone(cloneId);
    else await pushManifest(win, look.character, look.skin || '');
  }
  return state;
}

async function refreshClone(cloneId) {
  const state = service.loadState();
  const look = state.cloneLooks?.[cloneId];
  if (!look) return null;
  if (look.engineMode === 'crosspet' && look.visible) return showClone(cloneId);
  hideClone(cloneId);
  return service.getCloneLook(state, cloneId);
}

function handlePetMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  const instanceId = msg.instanceId || PRIMARY;
  const win = instances.get(instanceId);
  if (msg.wear && typeof msg.wear.id === 'string') {
    const state = service.loadState();
    if (instanceId === PRIMARY) {
      service.setSkin(state, msg.wear.id, msg.wear.skin || '');
      void refreshFromState();
    } else {
      service.setCloneSkin(state, instanceId, msg.wear.id, msg.wear.skin || '');
      void refreshClone(instanceId);
    }
    return;
  }
  if (msg.move && win && !win.isDestroyed()) {
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + (msg.dx || 0)), Math.round(y + (msg.dy || 0)));
  }
  if (msg.click === 'pat' || msg.kind === 'pat') {
    void win?.webContents.executeJavaScript(`typeof handleClick==='function'&&handleClick('pat')`);
  }
}

function ensureTimers() {
  const state = service.loadState();
  startFollow(state);
  startStateWatch();
}

function startFollow(state) {
  stopFollow();
  if (!state.followApps && !state.followEvents) return;
  followTimer = setInterval(() => void tickFollow(), 2000);
  void tickFollow();
}

function stopFollow() {
  if (followTimer) clearInterval(followTimer);
  followTimer = null;
}

async function foregroundExe() {
  const { execFile } = require('node:child_process');
  return new Promise((resolve) => {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
$hwnd = [Fg]::GetForegroundWindow()
$pid = 0
[void][Fg]::GetWindowThreadProcessId($hwnd, [ref]$pid)
if ($pid -eq 0) { '' } else { try { (Get-Process -Id $pid -ErrorAction Stop).ProcessName.ToLower() + '.exe' } catch { '' } }
`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 3000 }, (err, stdout) => {
      if (err) return resolve('');
      resolve(String(stdout || '').trim().toLowerCase());
    });
  });
}

async function tickFollow() {
  const primary = instances.get(PRIMARY);
  if (!primary || primary.isDestroyed() || !primary.isVisible()) return;
  const state = service.loadState();
  if (!state.visible || !state.followApps) return;
  const exe = await foregroundExe();
  if (!exe) return;
  let target = appsMap[exe];
  if (target === '') return;
  if (!target) return;
  if (target === 'cursor' || target === 'workbuddy' || target === 'zcode') return;
  if (target && target !== state.character) {
    const list = service.buildSettingsCharacters(state);
    if (!list.some((c) => c.id === target)) return;
    service.setCharacter(state, target);
    await refreshFromState();
  }
}

function startStateWatch() {
  stopStateWatch();
  const dir = path.join(service.STATE_DIR, 'state');
  fsMk(dir);
  stateWatcher = setInterval(() => void pollAiState(), 1500);
}

function stopStateWatch() {
  if (stateWatcher) clearInterval(stateWatcher);
  stateWatcher = null;
}

function fsMk(dir) {
  try { require('node:fs').mkdirSync(dir, { recursive: true }); } catch {}
}

async function injectBridge(win, instanceId) {
  if (!win || win.isDestroyed()) return;
  await win.webContents.executeJavaScript(`
    (function () {
      if (window.__siHechongBridge) return;
      window.__siHechongBridge = true;
      const instanceId = ${JSON.stringify(instanceId)};
      const post = (msg) => window.siHechongPet && window.siHechongPet.post(Object.assign({}, msg, { instanceId }));
      window.chrome = window.chrome || {};
      window.chrome.webview = {
        postMessage: (msg) => post(msg),
        addEventListener: function () {},
        removeEventListener: function () {}
      };
      let dragging = false, lx = 0, ly = 0;
      document.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true; lx = e.screenX; ly = e.screenY;
      });
      window.addEventListener('mouseup', () => { dragging = false; });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.screenX - lx, dy = e.screenY - ly;
        lx = e.screenX; ly = e.screenY;
        if (dx || dy) post({ move: true, dx, dy });
      });
      document.addEventListener('click', () => { post({ click: 'pat' }); });
    })();
  `);
}

async function pollAiState() {
  const primary = instances.get(PRIMARY);
  if (!primary || primary.isDestroyed()) return;
  const fs = require('node:fs');
  const dir = path.join(service.STATE_DIR, 'state');
  if (!fs.existsSync(dir)) return;
  const state = service.loadState();
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('-state.json')) {
      if (!state.followEvents) continue;
      const id = file.replace(/-state\.json$/, '');
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        await primary.webContents.executeJavaScript(
          `typeof applyCharState==='function'&&applyCharState(${JSON.stringify(id)}, ${JSON.stringify(data)})`
        );
        if (data && data.pose && data.pose !== 'idle') {
          const list = service.buildSettingsCharacters(state);
          if (list.some((c) => c.id === id) && state.character !== id) {
            service.setCharacter(state, id);
            await refreshFromState();
          }
        }
      } catch {}
    } else if (file.endsWith('-quota.json')) {
      const id = file.replace(/-quota\.json$/, '');
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        await primary.webContents.executeJavaScript(
          `typeof setQuota==='function'&&setQuota(${JSON.stringify(id)}, ${JSON.stringify(data)})`
        );
      } catch {}
    }
  }
}

function closePet() {
  stopFollow();
  stopStateWatch();
  for (const win of instances.values()) {
    if (win && !win.isDestroyed()) win.destroy();
  }
  instances.clear();
}

function closeClone(cloneId) {
  const win = instances.get(cloneId);
  if (win && !win.isDestroyed()) win.destroy();
  instances.delete(cloneId);
}

function isOpen() {
  const primary = instances.get(PRIMARY);
  return !!(primary && !primary.isDestroyed() && primary.isVisible());
}

module.exports = {
  showPet,
  hidePet,
  showClone,
  hideClone,
  refreshClone,
  refreshFromState,
  handlePetMessage,
  closePet,
  closeClone,
  isOpen,
  getWindow: () => instances.get(PRIMARY) || null,
};
