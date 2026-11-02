const api=window.petClient,container=document.querySelector('#characters'),feedback=document.querySelector('#feedback');
// WebM ↔ CrossPet：同一形象不重复占卡；未映射的 CrossPet 角色单独成卡补进主页
const WEB_TO_CROSSPET={main:'deepseek',ojousama:'claude',character3:'grok',character4:'gpt',character5:'glm',character6:'qwen'};
const CROSSPET_TO_WEB=Object.fromEntries(Object.entries(WEB_TO_CROSSPET).map(([w,c])=>[c,w]));
let roles=[],crosspets=[],cloneLooks=[],busy=false;const expanded=new Set(),cloneExpanded=new Set();
function message(text,error=false){feedback.textContent=text;feedback.className=error?'error':'';}
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
async function run(task,success){if(busy)return;busy=true;document.querySelector('main').querySelectorAll('button,select,input').forEach(b=>b.disabled=true);try{await task();if(success)message(success);}catch(e){message(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,''),true);}finally{busy=false;render();}}
function crosspetOf(role){const id=WEB_TO_CROSSPET[role.entry]||WEB_TO_CROSSPET[role.id];return id?crosspets.find(c=>c.id===id):null;}
function orphanCrosspets(){return crosspets.filter(c=>!CROSSPET_TO_WEB[c.id]);}
function lookOf(cloneId){return cloneLooks.find(l=>l.id===cloneId)||null;}
function sizeControl(role){
 const box=el('div','size-control');box.dataset.sizeFor=role.id;
 const label=el('label','size-label','显示大小'),range=el('input','size-range'),number=el('input','size-number');
 range.type='range';number.type='number';range.min=number.min='120';range.max=number.max='2000';range.step=number.step='1';range.value=number.value=String(role.size);range.disabled=number.disabled=busy;
 number.id='size-'+role.id;label.htmlFor=number.id;range.setAttribute('aria-label',role.name+'的大小滑块');number.setAttribute('aria-label',role.name+'的大小数值');
 range.oninput=()=>{number.value=range.value;};number.oninput=()=>{if(number.validity.valid)range.value=number.value;};
 const apply=el('button','quiet','应用'),reset=el('button','quiet','恢复默认');apply.disabled=reset.disabled=busy;
 apply.onclick=()=>{if(!number.reportValidity()||!number.value)return;run(async()=>{roles=await api.resize(role.id,Number(number.value));},role.name+'的大小已更新');};
 reset.onclick=()=>run(async()=>{roles=await api.resize(role.id,462);},role.name+'已恢复默认大小');
 box.append(label,range,number,apply,reset);return box;
}
async function toggleLinked(role,nextVisible){
  const linked=crosspetOf(role);
  if(!linked){
    roles=await api.toggle(role.id,nextVisible);
    return;
  }
  const useCrosspet=linked.engineMode==='crosspet';
  // 同一形象只开一种：CrossPet 立绘 或 小小桌宠动作原版
  if(useCrosspet){
    if(role.visible) roles=await api.toggle(role.id,false);
    crosspets=await api.crosspetToggle(linked.id,nextVisible);
  }else{
    if(linked.visible) crosspets=await api.crosspetToggle(linked.id,false);
    roles=await api.toggle(role.id,nextVisible);
  }
}
async function toggleClone(child,linked,nextVisible){
  const look=lookOf(child.id);
  const useCrosspet=!!(look&&look.engineMode==='crosspet');
  if(useCrosspet){
    if(child.visible) roles=await api.toggle(child.id,false);
    cloneLooks=await api.crosspetToggleClone(child.id,nextVisible);
  }else{
    if(look&&look.visible) cloneLooks=await api.crosspetToggleClone(child.id,false);
    roles=await api.toggle(child.id,nextVisible);
  }
}
function renderWebmCard(role,clones){
  const linked=crosspetOf(role);
  const onDesktop=!!(role.visible||(linked&&linked.visible));
  const card=el('article','character');card.dataset.id=role.id;
  const portrait=el('div','portrait');
  if(role.preview){const video=el('video');video.src=role.preview;video.muted=true;video.loop=true;video.autoplay=true;video.playsInline=true;if(role.poster)video.poster=role.poster;portrait.append(video);}
  else if(role.poster){const image=el('img');image.src=role.poster;image.alt=role.name;portrait.append(image);}else portrait.append(el('span','fallback',role.name.slice(0,1)));
  portrait.append(el('span',onDesktop?'state visible':'state',onDesktop?'桌面显示中':'已隐藏'));
  const content=el('div','character-content'),row=el('div','title-row');row.append(el('h2','',role.name));
  const toggle=el('button','switch');toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(onDesktop));toggle.setAttribute('aria-label',`${onDesktop?'隐藏':'显示'}${role.name}`);toggle.disabled=busy;
  toggle.onclick=()=>run(async()=>{await toggleLinked(role,!onDesktop);},`${role.name}${onDesktop?'已隐藏':'已显示在桌面'}`);row.append(toggle);
  const meta=linked
    ? `${role.actions.length} 个动作 · ${linked.count} 套形象 · 当前：${linked.skinName||'动作原版'}`
    : `${role.actions.length} 个动作 · 独立角色项目`;
  content.append(row,el('p','role-count',meta));
  const actions=el('div','character-actions'),detailsButton=el('button','quiet',expanded.has(role.id)?'收起动作':'查看动作'),folder=el('button','quiet','角色文件夹');
  detailsButton.setAttribute('aria-expanded',String(expanded.has(role.id)));detailsButton.onclick=()=>{expanded.has(role.id)?expanded.delete(role.id):expanded.add(role.id);render();};folder.onclick=()=>run(()=>api.folder(role.id));actions.append(detailsButton,folder);
  const clone=el('button','quiet',`添加分身（${role.cloneCount||0}/8）`);clone.disabled=busy||role.cloneCount>=8;clone.title='每个角色最多添加8个分身，本体不计入上限';clone.onclick=()=>run(async()=>{roles=await api.clone(role.id);cloneLooks=await api.crosspetCloneLooks();cloneExpanded.add(role.entry);},'分身已添加并显示在桌面');actions.append(clone);
  const children=clones.filter(c=>c.entry===role.entry);
  const manage=el('button','quiet',`${cloneExpanded.has(role.entry)?'收起分身':'分身管理'}（${children.length}/8）`);manage.disabled=busy;manage.setAttribute('aria-expanded',String(cloneExpanded.has(role.entry)));manage.setAttribute('aria-controls','clones-'+role.id);manage.onclick=()=>{cloneExpanded.has(role.entry)?cloneExpanded.delete(role.entry):cloneExpanded.add(role.entry);render();};actions.append(manage);
  if(linked){
    const editLook=el('button','quiet','修改形象');
    editLook.disabled=busy;
    editLook.title=`只修改「${role.name}」的形象，不开关桌宠`;
    editLook.onclick=()=>run(()=>api.crosspetOpenCollections(linked.id));
    actions.append(editLook);
  }
  const panel=el('section','clone-panel');panel.id='clones-'+role.id;panel.hidden=!cloneExpanded.has(role.entry);panel.setAttribute('aria-label',role.name+'的分身管理');
  panel.append(el('p','clone-heading',role.name+'的分身（'+children.length+'/8）'));
  if(!children.length)panel.append(el('p','clone-empty','还没有分身，点击“添加分身”创建。'));
  for(const child of children){
    const look=lookOf(child.id);
    const onDesk=!!(child.visible||(look&&look.visible));
    const skinLabel=look?look.skinName||'动作原版':'动作原版';
    const item=el('div','clone-item');item.dataset.cloneId=child.id;
    const line=el('div','clone-line'),name=el('span','clone-name',child.name),state=el('span','clone-status',onDesk?`桌面显示中 · ${skinLabel}`:`已隐藏 · ${skinLabel}`);line.append(name,state);
    const toggle=el('button','quiet',onDesk?'隐藏':'显示');toggle.disabled=busy;toggle.setAttribute('aria-label',(onDesk?'隐藏':'显示')+child.name);
    toggle.onclick=()=>run(async()=>{await toggleClone(child,linked,!onDesk);});
    const remove=el('button','quiet','移除分身');remove.disabled=busy;remove.onclick=()=>run(async()=>{roles=await api.removeClone(child.id);cloneLooks=await api.crosspetCloneLooks();},'分身已移除');
    line.append(toggle,remove);
    if(linked){
      const editLook=el('button','quiet','修改形象');
      editLook.disabled=busy;
      editLook.title=`为「${child.name}」单独选形象`;
      editLook.onclick=()=>run(()=>api.crosspetOpenCollections(linked.id,child.id));
      line.append(editLook);
    }
    item.append(line,sizeControl(child));
    const useWebm=!look||look.engineMode!=='crosspet';
    if(useWebm){
      const chooser=el('details','clone-action-details'),summary=el('summary','', '动作点播');chooser.append(summary);const row=el('div','play-row'),select=el('select');select.setAttribute('aria-label',child.name+'的动作');
      for(const action of child.actions){const option=el('option','',action);option.value=action;select.append(option);}
      const play=el('button','','播放');play.disabled=busy||!child.visible;play.onclick=()=>run(()=>api.play(child.id,select.value),'正在播放：'+select.value);row.append(select,play);chooser.append(row);item.append(chooser);
    }else{
      item.append(el('p','clone-empty','CrossPet 形象可在桌面拖动；切回「动作原版」后可点播动作。'));
    }
    panel.append(item);
  }
  content.append(actions,sizeControl(role));
  const details=el('div','details');details.hidden=!expanded.has(role.id);const label=el('label','',role.visible?'选择一个动作，在桌面播放':'先开启桌面显示，再点播动作');
  const playRow=el('div','play-row'),select=el('select');select.id='action-'+role.id;label.htmlFor=select.id;select.setAttribute('aria-label',role.name+'的动作');
  for(const name of role.actions){const option=el('option','',name);option.value=name;select.append(option);}
  const play=el('button','','播放');play.disabled=busy||!role.visible;play.onclick=()=>run(()=>api.play(role.id,select.value),'正在播放：'+select.value);playRow.append(select,play);details.append(label,playRow);card.append(portrait,content,details,panel);return card;
}
function renderCrosspetOnlyCard(item){
  const card=el('article','character');card.dataset.id='crosspet:'+item.id;
  const portrait=el('div','portrait');
  if(item.preview||item.avatar){const image=el('img');image.src=item.preview||item.avatar;image.alt=item.name;portrait.append(image);}
  else portrait.append(el('span','fallback',item.name.slice(0,1)));
  portrait.append(el('span',item.visible?'state visible':'state',item.visible?'桌面显示中':'已隐藏'));
  const content=el('div','character-content'),row=el('div','title-row');row.append(el('h2','',item.name));
  const toggle=el('button','switch');toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(!!item.visible));toggle.setAttribute('aria-label',`${item.visible?'隐藏':'显示'}${item.name}`);toggle.disabled=busy;
  toggle.onclick=()=>run(async()=>{crosspets=await api.crosspetToggle(item.id,!item.visible);},`${item.name}${item.visible?'已隐藏':'已显示在桌面'}`);
  row.append(toggle);
  content.append(row,el('p','role-count',`${item.count} 套形象 · 当前：${item.skinName||'原版'}`));
  const actions=el('div','character-actions');
  const editLook=el('button','quiet','修改形象');
  editLook.disabled=busy;
  editLook.title='只修改当前角色形象，不开关桌宠';
  editLook.onclick=()=>run(()=>api.crosspetOpenCollections(item.id));
  actions.append(editLook);
  content.append(actions);
  card.append(portrait,content);
  return card;
}
function render(){
 container.replaceChildren();document.querySelectorAll('header button,.toolbar button,footer button').forEach(b=>b.disabled=busy);
 const originals=roles.filter(r=>!r.isClone),clones=roles.filter(r=>r.isClone);
 const extras=orphanCrosspets();
 const visibleCount=roles.filter(r=>r.visible).length+extras.filter(c=>c.visible).length+originals.filter(r=>{const l=crosspetOf(r);return l&&l.visible&&!r.visible;}).length+cloneLooks.filter(l=>l.visible&&!roles.find(r=>r.id===l.id&&r.visible)).length;
 document.querySelector('#summary').textContent=`${originals.length+extras.length} 位角色 · ${clones.length} 个分身 · ${visibleCount} 个实例正在桌面陪伴`;
 for(const role of originals) container.append(renderWebmCard(role,clones));
 for(const item of extras) container.append(renderCrosspetOnlyCard(item));
 if(!originals.length&&!extras.length)container.append(el('p','loading','还没有角色，点击“添加角色”导入你的第一个角色项目。'));
}
async function reloadAll(){
  const [list,summary,looks]=await Promise.all([api.list(),api.crosspetSummary(),api.crosspetCloneLooks()]);
  roles=list;crosspets=summary;cloneLooks=looks;
  // 纠正：本体按当前模式只保留一种桌宠
  for(const role of roles.filter(r=>!r.isClone)){
    const linked=crosspetOf(role);
    if(!linked) continue;
    if(linked.engineMode==='crosspet'){
      if(role.visible) roles=await api.toggle(role.id,false);
    }else if(linked.visible){
      crosspets=await api.crosspetToggle(linked.id,false);
    }
  }
  // 纠正：分身按各自形象只开一种
  for(const child of roles.filter(r=>r.isClone)){
    const look=lookOf(child.id);
    if(look&&look.engineMode==='crosspet'){
      if(child.visible) roles=await api.toggle(child.id,false);
    }else if(look&&look.visible){
      cloneLooks=await api.crosspetToggleClone(child.id,false);
    }
  }
  document.querySelector('#connection').textContent='本地服务已连接';
}
document.querySelector('#refresh').onclick=()=>run(async()=>{await reloadAll();},'角色列表已更新');
document.querySelector('#hide-all').onclick=()=>run(async()=>{roles=await api.hideAll();crosspets=await api.crosspetSummary();cloneLooks=await api.crosspetCloneLooks();},'所有角色已隐藏');
document.querySelector('#show-all').onclick=()=>run(async()=>{
  const originals=roles.filter(r=>!r.isClone);
  for(const role of originals){
    const linked=crosspetOf(role);
    if(linked) await toggleLinked(role,true);
    else if(!role.visible) roles=await api.toggle(role.id,true);
  }
  for(const child of roles.filter(r=>r.isClone)){
    const linked=crosspetOf(child);
    await toggleClone(child,linked,true);
  }
  for(const item of orphanCrosspets()){
    if(!item.visible) crosspets=await api.crosspetToggle(item.id,true);
  }
},'所有角色已开启');
document.querySelector('#import').onclick=()=>run(async()=>{const result=await api.import();if(result){roles=result;message('角色已导入，可开启桌面显示');}});
document.querySelector('#quit').onclick=()=>run(()=>api.quit());
api.onChanged(updated=>{roles=updated;if(!busy)render();});
api.onCrosspetChanged((payload)=>{
  api.crosspetSummary().then(list=>{crosspets=list;}).catch(()=>{});
  if(payload&&Array.isArray(payload.cloneLooks)) cloneLooks=payload.cloneLooks;
  else api.crosspetCloneLooks().then(list=>{cloneLooks=list;if(!busy)render();}).catch(()=>{});
  if(!busy)render();
});
run(async()=>{await reloadAll();});
