'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { hasWebmTwin } = require('./character-links.cjs');

const CROSSPET_ROOT = path.resolve(__dirname, '../../crosspet');
const CHAR_ROOT = path.join(CROSSPET_ROOT, 'characters');
const STATE_DIR = path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local'), 'SI-HeChong');
const STATE_FILE = path.join(STATE_DIR, 'crosspet-state.json');
const META = new Set(['character.json', 'LICENSE.md']);

const WEBM_SKIN = '__webm__'; // 选回小小桌宠动作原版（非 CrossPet 立绘）
const defaultState = () => ({
  character: 'deepseek',
  visible: false,
  names: {},
  skins: {},
  // deepseek: 'webm' | 'crosspet' —— 主页开关只开其中一种，避免叠两个，也可切回原版
  engineModes: {},
  // 分身独立形象：{ [webmCloneId]: { character, skin, engineMode, visible } }
  cloneLooks: {},
  peakSkins: {},
  followApps: true,
  followEvents: true,
  quotaAggregate: false,
  quotaStyle: 'bars',
  peakStyle: 'bar',
  size: 280,
  integrations: {},
});

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(path.join(STATE_DIR, 'state'), { recursive: true });
}

function loadState() {
  ensureStateDir();
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function listCharacterDirs() {
  if (!fs.existsSync(CHAR_ROOT)) return [];
  return fs.readdirSync(CHAR_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(CHAR_ROOT, d.name, 'character.json')))
    .map((d) => d.name)
    .sort();
}

function collectPoses(dir) {
  const poses = {};
  for (const name of fs.readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.webp')) continue;
    if (['avatar.webp', 'portrait.webp', 'portrait-card.webp', 'compact.webp'].includes(name)) continue;
    const base = name.replace(/\.webp$/i, '');
    const pose = base.replace(/-\d+$/, '');
    if (pose === 'idle-blink') continue;
    const url = pathToFileURL(path.join(dir, name)).href;
    (poses[pose] || (poses[pose] = [])).push(url);
  }
  for (const key of Object.keys(poses)) poses[key].sort();
  return poses;
}

function imageUrl(dir, file) {
  const p = path.join(dir, file);
  return fs.existsSync(p) ? pathToFileURL(p).href : null;
}

function loadRaw(id) {
  const dir = path.join(CHAR_ROOT, id);
  const cfg = readJson(path.join(dir, 'character.json'));
  return { id, dir, cfg, poses: collectPoses(dir) };
}

function buildCatalog() {
  const raw = Object.fromEntries(listCharacterDirs().map((id) => [id, loadRaw(id)]));
  const bases = [];
  const skinsByBase = {};
  for (const item of Object.values(raw)) {
    const skinOf = item.cfg.skinOf;
    if (skinOf) {
      (skinsByBase[skinOf] || (skinsByBase[skinOf] = [])).push(item);
    } else if (!item.cfg.egg) {
      bases.push(item);
    }
  }
  // eggs that are not skins still appear as standalone collection cards if they have host only
  for (const item of Object.values(raw)) {
    if (item.cfg.egg && !item.cfg.skinOf && !bases.some((b) => b.id === item.id)) {
      // keep eggs out of primary roster; they play via host
    }
  }
  return { raw, bases: bases.sort((a, b) => a.id.localeCompare(b.id)), skinsByBase };
}

function outfitName(item) {
  return item.cfg.outfit || item.cfg.skinName || (item.cfg.skinOf ? item.id : '原版');
}

function buildSettingsCharacters(state) {
  const { raw, bases, skinsByBase } = buildCatalog();
  return bases.map((base) => {
    const skins = [
      { id: '', name: outfitName(base), images: {
        portrait: imageUrl(base.dir, 'portrait.webp'),
        'portrait-card': imageUrl(base.dir, 'portrait-card.webp'),
        avatar: imageUrl(base.dir, 'avatar.webp'),
        idle: imageUrl(base.dir, 'idle.webp'),
      } },
      ...(skinsByBase[base.id] || []).map((s) => ({
        id: s.id,
        name: outfitName(s),
        images: {
          portrait: imageUrl(s.dir, 'portrait.webp') || imageUrl(s.dir, 'idle.webp'),
          'portrait-card': imageUrl(s.dir, 'portrait-card.webp') || imageUrl(s.dir, 'idle.webp'),
          avatar: imageUrl(s.dir, 'avatar.webp'),
          idle: imageUrl(s.dir, 'idle.webp'),
        },
      })),
    ];
    const custom = state.names[base.id];
    // 无 WebM 对应的角色（如 Gemini）永远是 CrossPet，不能落到「动作原版」假状态
    const engineMode = !hasWebmTwin(base.id) || state.engineModes?.[base.id] === 'crosspet'
      ? 'crosspet'
      : 'webm';
    return {
      id: base.id,
      name: custom || base.cfg.name || base.id,
      defaultName: base.cfg.name || base.id,
      custom: custom || '',
      accent: base.cfg.accent || '#2d7a8c',
      images: skins[0].images,
      skins,
      skin: state.skins[base.id] || '',
      engineMode,
      hasWebmTwin: hasWebmTwin(base.id),
    };
  });
}

/** 主 CrossPet 窗此刻是否应该显示该角色 */
function shouldShowPrimary(state, id = state.character) {
  if (!state.visible || state.character !== id) return false;
  if (!hasWebmTwin(id)) return true;
  return state.engineModes?.[id] === 'crosspet';
}

function mergeCharacter(baseRaw, skinId) {
  const skinRaw = skinId ? loadRaw(skinId) : null;
  const cfg = { ...baseRaw.cfg };
  let poses = { ...baseRaw.poses };
  let blink = imageUrl(baseRaw.dir, 'idle-blink.webp');
  let lines = { ...(baseRaw.cfg.lines || {}) };
  if (skinRaw) {
    Object.assign(cfg, skinRaw.cfg);
    delete cfg.skinOf;
    delete cfg.skinName;
    poses = { ...poses, ...skinRaw.poses };
    blink = imageUrl(skinRaw.dir, 'idle-blink.webp') || blink;
    lines = { ...lines, ...(skinRaw.cfg.lines || {}) };
  }
  cfg.lines = lines;
  return {
    ...cfg,
    name: cfg.name || baseRaw.id,
    skin: skinId || '',
    blink,
    poses,
    egg: !!baseRaw.cfg.egg,
    host: baseRaw.cfg.host,
    hostSkin: baseRaw.cfg.hostSkin,
    reactTo: baseRaw.cfg.reactTo,
  };
}

function buildManifest(state) {
  const { raw, bases, skinsByBase } = buildCatalog();
  const characters = {};
  for (const base of bases) {
    const worn = state.skins[base.id] || '';
    const valid = !worn || (skinsByBase[base.id] || []).some((s) => s.id === worn);
    const skinId = valid ? worn : '';
    const merged = mergeCharacter(base, skinId);
    if (state.names[base.id]) merged.name = state.names[base.id];
    characters[base.id] = merged;
  }
  // include egg characters as separate entries for playEgg
  for (const item of Object.values(raw)) {
    if (!item.cfg.egg) continue;
    characters[item.id] = {
      ...item.cfg,
      name: item.cfg.name || item.id,
      skin: '',
      blink: imageUrl(item.dir, 'idle-blink.webp'),
      poses: item.poses,
      egg: true,
    };
  }
  return { characters };
}

function collectionsSummary(state) {
  return buildSettingsCharacters(state).map((c) => {
    const engineMode = c.engineMode === 'crosspet' ? 'crosspet' : 'webm';
    const skinName = engineMode === 'webm'
      ? '动作原版'
      : (c.skins.find((s) => s.id === c.skin) || c.skins[0]).name;
    return {
      id: c.id,
      name: c.name,
      accent: c.accent,
      count: c.skins.length,
      skin: engineMode === 'webm' ? WEBM_SKIN : c.skin,
      skinName,
      engineMode,
      hasWebmTwin: !!c.hasWebmTwin,
      preview: c.images.portrait || c.images.idle || c.images.avatar || '',
      avatar: c.images.avatar || c.images.idle || '',
      // 与真实桌宠窗一致：孤儿角色不看 engineModes；映射角色需处于 crosspet 模式
      visible: shouldShowPrimary(state, c.id),
    };
  });
}

function setCharacter(state, id) {
  const list = buildSettingsCharacters(state);
  if (!list.some((c) => c.id === id)) throw Error('找不到这个 CrossPet 角色');
  state.character = id;
  return saveState(state);
}

function setSkin(state, id, skin) {
  setCharacter(state, id);
  if (!state.engineModes) state.engineModes = {};
  if (skin === WEBM_SKIN) {
    if (!hasWebmTwin(id)) {
      // Gemini 等没有动作原版，忽略并保持 CrossPet
      state.engineModes[id] = 'crosspet';
      return saveState(state);
    }
    state.engineModes[id] = 'webm';
    return saveState(state);
  }
  const card = buildSettingsCharacters(state).find((c) => c.id === id);
  if (skin && !card.skins.some((s) => s.id === skin)) throw Error('找不到这套衣服');
  state.engineModes[id] = 'crosspet';
  if (skin) state.skins[id] = skin; else delete state.skins[id];
  return saveState(state);
}

/** 打开桌宠前确保可显示：孤儿强制 crosspet；映射角色切到 crosspet */
function ensureCrosspetMode(state, id) {
  if (!state.engineModes) state.engineModes = {};
  state.engineModes[id] = 'crosspet';
  return saveState(state);
}

function skinLabel(state, characterId, skin, engineMode) {
  if (engineMode !== 'crosspet') return '动作原版';
  const card = buildSettingsCharacters(state).find((c) => c.id === characterId);
  if (!card) return '原版';
  return (card.skins.find((s) => s.id === (skin || '')) || card.skins[0]).name;
}

function getCloneLook(state, cloneId) {
  const look = state.cloneLooks?.[cloneId];
  if (!look) return null;
  const engineMode = look.engineMode === 'crosspet' ? 'crosspet' : 'webm';
  return {
    id: cloneId,
    character: look.character,
    skin: engineMode === 'webm' ? WEBM_SKIN : (look.skin || ''),
    skinName: skinLabel(state, look.character, look.skin || '', engineMode),
    engineMode,
    visible: !!look.visible,
  };
}

function cloneLooksSummary(state) {
  return Object.keys(state.cloneLooks || {}).map((id) => getCloneLook(state, id)).filter(Boolean);
}

function setCloneSkin(state, cloneId, characterId, skin) {
  if (!cloneId || typeof cloneId !== 'string') throw Error('分身无效');
  setCharacter(state, characterId);
  if (!state.cloneLooks) state.cloneLooks = {};
  const prev = state.cloneLooks[cloneId] || {};
  if (skin === WEBM_SKIN) {
    state.cloneLooks[cloneId] = {
      character: characterId,
      skin: prev.skin || '',
      engineMode: 'webm',
      visible: !!prev.visible,
    };
    return saveState(state);
  }
  const card = buildSettingsCharacters(state).find((c) => c.id === characterId);
  if (skin && !card.skins.some((s) => s.id === skin)) throw Error('找不到这套衣服');
  state.cloneLooks[cloneId] = {
    character: characterId,
    skin: skin || '',
    engineMode: 'crosspet',
    visible: !!prev.visible,
  };
  return saveState(state);
}

function setCloneVisible(state, cloneId, visible) {
  if (!state.cloneLooks) state.cloneLooks = {};
  const look = state.cloneLooks[cloneId];
  if (!look) throw Error('请先为该分身选择形象');
  look.visible = !!visible;
  return saveState(state);
}

function ensureCloneLook(state, cloneId, characterId) {
  if (!state.cloneLooks) state.cloneLooks = {};
  if (!state.cloneLooks[cloneId]) {
    state.cloneLooks[cloneId] = {
      character: characterId,
      skin: '',
      engineMode: 'webm',
      visible: false,
    };
    saveState(state);
  } else if (!state.cloneLooks[cloneId].character) {
    state.cloneLooks[cloneId].character = characterId;
    saveState(state);
  }
  return state.cloneLooks[cloneId];
}

function removeCloneLook(state, cloneId) {
  if (!state.cloneLooks?.[cloneId]) return state;
  delete state.cloneLooks[cloneId];
  return saveState(state);
}

function rename(state, id, name) {
  if (!buildSettingsCharacters(state).some((c) => c.id === id)) throw Error('找不到这个角色');
  if (name) state.names[id] = name; else delete state.names[id];
  return saveState(state);
}

module.exports = {
  CROSSPET_ROOT,
  CHAR_ROOT,
  STATE_DIR,
  STATE_FILE,
  WEBM_SKIN,
  loadState,
  saveState,
  buildCatalog,
  buildManifest,
  buildSettingsCharacters,
  collectionsSummary,
  shouldShowPrimary,
  setCharacter,
  setSkin,
  ensureCrosspetMode,
  setCloneSkin,
  setCloneVisible,
  ensureCloneLook,
  removeCloneLook,
  getCloneLook,
  cloneLooksSummary,
  rename,
  imageUrl,
};
