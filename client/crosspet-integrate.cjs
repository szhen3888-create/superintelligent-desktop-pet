'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');
const service = require('./crosspet-service.cjs');

const PYTHON = path.join(service.CROSSPET_ROOT, 'python', 'python.exe');
const SCRIPT = path.join(service.CROSSPET_ROOT, 'tools', 'integrate.py');

const TARGETS = [
  'claude-hooks', 'claude-mod', 'codex', 'deepseek', 'gemini', 'antigravity',
  'workbuddy', 'zcode', 'hermes', 'qwen', 'cursor', 'grok',
];

function run(args) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      CROSSPET_DATA_DIR: service.STATE_DIR,
      CROSSPET_STATE_DIR: path.join(service.STATE_DIR, 'state'),
      PYTHONUTF8: '1',
    };
    const child = spawn(PYTHON, [SCRIPT, ...args], {
      cwd: service.CROSSPET_ROOT,
      env,
      windowsHide: true,
    });
    let out = '', err = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve((out || err).trim());
      else reject(Error((err || out || `integrate failed (${code})`).trim()));
    });
  });
}

async function status() {
  try {
    const text = await run(['status']);
    const map = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([a-z0-9-]+)\s*:\s*(on|off|yes|no|installed|missing|✓|×|OK|—)/i)
        || line.match(/^\s*([a-z0-9-]+)\b.*(已接入|未接入|on|off)/i);
      if (m) map[m[1].toLowerCase()] = /已接入|on|yes|installed|✓|OK/i.test(line);
    }
    // fallback: mark unknown from state
    const state = service.loadState();
    for (const t of TARGETS) if (map[t] === undefined) map[t] = !!state.integrations[t];
    return { text, map, targets: TARGETS };
  } catch (e) {
    const state = service.loadState();
    return {
      text: e.message,
      map: Object.fromEntries(TARGETS.map((t) => [t, !!state.integrations[t]])),
      targets: TARGETS,
      error: e.message,
    };
  }
}

async function install(target) {
  if (!TARGETS.includes(target)) throw Error('不支持的接入目标：' + target);
  const text = await run(['install', target]);
  const state = service.loadState();
  state.integrations[target] = true;
  service.saveState(state);
  return { text, state: await settingsBundle(state) };
}

async function uninstall(target) {
  if (!TARGETS.includes(target)) throw Error('不支持的接入目标：' + target);
  const text = await run(['uninstall', target]);
  const state = service.loadState();
  delete state.integrations[target];
  service.saveState(state);
  return { text, state: await settingsBundle(state) };
}

async function settingsBundle(state = service.loadState()) {
  const st = await status();
  return {
    followApps: !!state.followApps,
    followEvents: !!state.followEvents,
    quotaAggregate: !!state.quotaAggregate,
    quotaStyle: state.quotaStyle || 'bars',
    peakStyle: state.peakStyle || 'bar',
    integrations: st.map,
    integrationText: st.text,
    targets: TARGETS,
  };
}

module.exports = { TARGETS, status, install, uninstall, settingsBundle, run };
