(() => {
  const api = window.petClient;
  const $ = (id) => document.getElementById(id);
  let state = null;
  let lockedId = null; // 进入本页时锁定的角色，不允许切到别人
  let editCloneId = null; // 分身独立形象编辑
  let peeking = null;
  let unpeekTimer;

  const toast = (text) => {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  const peekAt = (p) => {
    clearTimeout(unpeekTimer);
    if (peeking !== p) {
      peeking = p;
      renderStage();
    }
  };
  const unpeekSoon = () => {
    clearTimeout(unpeekTimer);
    unpeekTimer = setTimeout(() => {
      peeking = null;
      renderStage();
    }, 300);
  };

  const placeholder = (name) => {
    const d = document.createElement('div');
    d.className = 'ph';
    d.textContent = [...name][0] || '?';
    return d;
  };

  function currentOnly(s) {
    const id = lockedId || s.character;
    const characters = (s.characters || []).filter((c) => c.id === id);
    return { ...s, character: id, characters };
  }

  function activeEngineMode(s) {
    if (editCloneId) {
      return s.cloneLook?.engineMode === 'crosspet' ? 'crosspet' : 'webm';
    }
    const cur = s.characters.find((c) => c.id === s.character);
    if (cur && cur.hasWebmTwin === false) return 'crosspet';
    return (cur?.engineMode || 'webm') !== 'crosspet' ? 'webm' : 'crosspet';
  }

  function activeSkinId(s) {
    if (editCloneId) {
      const look = s.cloneLook;
      if (!look || look.engineMode !== 'crosspet') return '__webm__';
      return look.skin || '';
    }
    const cur = s.characters.find((c) => c.id === s.character);
    if (!cur || cur.engineMode !== 'crosspet') return '__webm__';
    return cur.skin || '';
  }

  function renderStage() {
    if (!state) return;
    const cur = state.characters.find((c) => c.id === state.character);
    const st = CharacterCards.stage(state.characters, state.character);
    // 分身预览：按分身当前衣服覆盖舞台文案
    let stageInfo = st;
    if (editCloneId && state.cloneLook && !peeking) {
      const usingWebm = state.cloneLook.engineMode !== 'crosspet';
      if (usingWebm) {
        stageInfo = { image: null, art: false, outfit: '动作原版（小小桌宠）' };
      } else {
        const skinId = state.cloneLook.skin || '';
        const skin = cur?.skins?.find((x) => x.id === skinId) || cur?.skins?.[0];
        const img = skin?.images?.['portrait-card'] || skin?.images?.portrait || skin?.images?.idle || null;
        stageInfo = { image: img, art: !!img, outfit: skin?.name || '原版' };
      }
    }
    const show = peeking || stageInfo;
    const box = $('stage');
    box.style.setProperty('--c', peeking?.accent || cur?.accent || '#2d7a8c');
    box.classList.toggle('art', !!show?.art);
    box.classList.toggle('peek', !!peeking);
    const title = editCloneId ? `${cur?.name || ''} · 分身` : cur?.name || '';
    $('charName').textContent = peeking?.name || title;
    $('outfitName').textContent = peeking
      ? peeking.outfit
        ? `${peeking.outfit}（预览）`
        : '预览'
      : show?.outfit || '';
    const name = peeking?.name || cur?.name || '?';
    if (show?.image) {
      const img = box.querySelector('img') || document.createElement('img');
      img.alt = '';
      img.onerror = () => box.replaceChildren(placeholder(name));
      if (img.getAttribute('src') !== show.image) img.src = show.image;
      if (!img.isConnected) box.replaceChildren(img);
    } else box.replaceChildren(placeholder(name));
  }

  function renderCards(s) {
    const cur = s.characters.find((c) => c.id === s.character);
    const accent = cur?.accent || '#2d7a8c';
    const usingWebm = activeEngineMode(s) !== 'crosspet';
    const selectedSkin = activeSkinId(s);
    const card = (c, color, onClick, peek) => {
      const b = document.createElement('button');
      b.className = 'pcard' + (c.on ? ' on' : '') + (c.avatar ? ' avatar' : '') + (c.art ? ' art' : '');
      b.style.setProperty('--c', color);
      b.title = c.name;
      b.setAttribute('aria-label', c.name);
      if (c.image) {
        const img = document.createElement('img');
        img.src = c.image;
        img.alt = '';
        img.onerror = () => img.replaceWith(placeholder(c.name));
        b.append(img);
      } else b.append(placeholder(c.name));
      const n = document.createElement('b');
      n.textContent = c.name;
      b.append(n);
      b.onclick = () => {
        clearTimeout(unpeekTimer);
        peeking = null;
        onClick();
      };
      b.onmouseenter = () => peekAt(c.on ? null : peek);
      b.onmouseleave = unpeekSoon;
      return b;
    };
    const canUseWebm = !!cur?.hasWebmTwin;
    const webmCard = {
      id: '__webm__',
      name: '动作原版',
      image: null,
      preview: null,
      art: false,
      on: canUseWebm && usingWebm,
    };
    const outfitList = CharacterCards.outfitCards(s.characters, s.character).map((o) => ({
      ...o,
      on: !usingWebm && (o.id || '') === (selectedSkin || ''),
    }));
    const cards = [];
    // 仅映射到小小桌宠的角色才提供「动作原版」；Gemini 等孤儿不出现该选项
    if (canUseWebm) {
      cards.push(
        card(
          webmCard,
          accent,
          () => void applySkin(s.character, '__webm__'),
          { image: null, art: false, outfit: '动作原版（小小桌宠）', name: cur?.name, accent },
        ),
      );
    }
    for (const o of outfitList) {
      cards.push(
        card(
          o,
          accent,
          () => void applySkin(s.character, o.id),
          { image: o.preview, art: o.art, outfit: o.name, name: cur?.name, accent },
        ),
      );
    }
    $('outfitCards').replaceChildren(...cards);
  }

  function renderPeakOutfits(s) {
    const box = $('peakOutfits');
    if (editCloneId) {
      box.replaceChildren();
      return;
    }
    if (box.contains(document.activeElement)) return;
    const curMap = s.peakSkins || {};
    const id = s.character;
    const rule = PeakHours.RULES[id];
    const c = s.characters.find((x) => x.id === id);
    if (!rule || !c?.skins || c.skins.length < 2) {
      box.replaceChildren();
      return;
    }
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="label">峰谷换装<small>${rule.label}。到点自动换；请在主页开关桌宠显示</small></div><div class="peaksel"></div>`;
    for (const [kind, title] of [
      ['peak', '高峰穿'],
      ['valley', '空闲穿'],
    ]) {
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `${c.name}${title}`);
      const want = curMap[id]?.[kind];
      sel.append(
        new Option('不换', '-', false, typeof want !== 'string'),
        ...c.skins.map((k) => new Option(k.name, k.id, false, want === k.id)),
      );
      sel.onchange = () => {
        void api
          .crosspetSetPeakSkins((() => {
            const next = JSON.parse(JSON.stringify(state?.peakSkins || {}));
            const e = { ...(next[id] || {}) };
            if (sel.value === '-') delete e[kind];
            else e[kind] = sel.value;
            if (Object.keys(e).length) next[id] = e;
            else delete next[id];
            return next;
          })())
          .then(applyState);
      };
      const lab = document.createElement('label');
      lab.textContent = title + ' ';
      lab.appendChild(sel);
      row.querySelector('.peaksel').appendChild(lab);
    }
    box.replaceChildren(row);
  }

  function applyState(s) {
    state = currentOnly(s);
    editCloneId = s.editCloneId || null;
    if (editCloneId && s.cloneLook) state.cloneLook = s.cloneLook;
    else if (editCloneId) state.cloneLook = (s.cloneLooks || []).find((l) => l.id === editCloneId) || null;
    const cur = state.characters.find((c) => c.id === state.character);
    $('outfitsTitle').textContent = editCloneId
      ? (cur ? `${cur.name} · 分身可选形象` : '分身可选形象')
      : (cur ? `${cur.name} 的可选形象` : '可选形象');
    const nameRow = $('name')?.closest('.row');
    if (nameRow) nameRow.hidden = !!editCloneId;
    if (document.activeElement !== $('name') && !editCloneId) {
      $('name').value = cur?.custom || '';
      $('name').placeholder = cur?.defaultName || '';
    }
    const tip = document.querySelector('.topbar p');
    if (tip) {
      tip.textContent = editCloneId
        ? '只改这个分身的形象。可选「动作原版」或 CrossPet 衣服；开关请回主页。'
        : '只改当前角色形象。可选「动作原版」切回小小桌宠，或选 CrossPet 衣服。开关请回主页。';
    }
    renderStage();
    renderCards(state);
    renderPeakOutfits(state);
  }

  async function applySkin(id, skin) {
    if (lockedId && id !== lockedId) {
      toast('本页只能修改当前角色');
      return;
    }
    if (editCloneId) {
      applyState(await api.crosspetCloneSkin(editCloneId, id, skin));
      toast(skin === '__webm__' ? '分身已切回动作原版，请回主页开关显示' : '分身已换 CrossPet 形象，请回主页开关显示');
      return;
    }
    applyState(await api.crosspetSkin(id, skin));
    toast(skin === '__webm__' ? '已切回动作原版，请回主页开关显示' : '已换 CrossPet 形象，请回主页开关显示');
  }

  $('back').onclick = () => api.crosspetCloseCollections();
  $('saveName').onclick = async () => {
    if (!state || editCloneId) return;
    applyState(await api.crosspetRename(state.character, $('name').value.trim()));
    toast('名字已保存');
  };
  $('name').onkeydown = (e) => {
    if (e.key === 'Enter') $('saveName').click();
  };

  api
    .crosspetGetCollections()
    .then((s) => {
      lockedId = s.character;
      editCloneId = s.editCloneId || null;
      applyState(s);
    })
    .catch((e) => toast(e.message || String(e)));
  api.onCrosspetChanged?.((s) => {
    if (!s || !s.characters) return;
    // 保持锁定角色 / 分身上下文
    const next = {
      ...s,
      character: lockedId || s.character,
      editCloneId: editCloneId || s.editCloneId || null,
    };
    applyState(next);
  });
})();
