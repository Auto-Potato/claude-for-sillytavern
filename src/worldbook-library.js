import * as st from '../../../../../script.js';
import * as wi from '../../../../world-info.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../popup.js';
import { getSanitizedFilename } from '../../../../utils.js';
import { power_user } from '../../../../power-user.js';
import { createWorldbookData, appendEntry, removeEntry } from './worldbook-data.js';
import { worldbookSource, recordWorldbookSource } from './worldbook-sources.js';
import { importZoneContent } from './import-zone.js';
import { createImportDialog } from './import-dialog.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=path=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const icons={pencil:svg('m4 16 12-12 4 4-12 12H4zM14 6l4 4'),back:svg('m15 5-7 7 7 7'),menu:svg('M4 6h16M4 12h16M4 18h16'),plus:svg('M12 5v14M5 12h14'),copy:svg('M9 9h11v11H9zM15 5V3H3v12h2'),trash:svg('M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7'),move:svg('M5 12h14m-5-5 5 5-5 5')};
const positions=[['0','角色定义之前'],['1','角色定义之后'],['4:0','指定深度 · 系统'],['4:1','指定深度 · 用户'],['4:2','指定深度 · 助手'],['5','示例消息之前'],['6','示例消息之后'],['2','作者注释之前'],['3','作者注释之后'],['7','指定出口']];

export function mountWorldbookLibrary(doc,win) {
  const drawer=doc.getElementById('WorldInfo');if(!drawer)return()=>{};
  const pane=doc.createElement('div');pane.id='cwn-worldbook-library';drawer.append(pane);drawer.classList.add('cwn-worldbook-mounted');
  const abort=new win.AbortController(),signal=abort.signal;
  let screen='library',name='',book=null,uid=null,baseline=null,busy=false,disposed=false,query='',editing=false;
  const pagePositions=new Map();
  let renderedPage=null;
  const checkedSources=new Set();
  const request=(url,body)=>fetch(url,{method:'POST',headers:st.getRequestHeaders(),body:JSON.stringify(body)});
  const data=createWorldbookData({request,changed:async(n,saved)=>{wi.worldInfoCache.set(n,saved);await st.eventSource.emit(st.event_types.WORLDINFO_UPDATED,n,saved);await wi.reloadEditor(n);}});
  const file=doc.createElement('input');file.type='file';file.accept='.json';file.multiple=true;file.hidden=true;doc.body.append(file);
  const importDialog=createImportDialog(doc,win,{kind:'worldbook',label:'世界书',chooseFile:()=>file.click(),importFile:f=>run(()=>importFiles([f]))});
  function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>k!=='id'&&k!=='uid').map(k=>[k,canonical(value[k])]));return value;}
  async function discoverCovers(){
    for(const n of wi.world_names){
      if(disposed)return;
      if(worldbookSource(n)||checkedSources.has(n))continue;checkedSources.add(n);
      const candidates=st.characters.filter(c=>(c.data?.character_book?.name||`${c.name}'s Lorebook`)===n&&c.data?.character_book?.entries?.length);
      if(!candidates.length)continue;
      try{const original=(await data.read(n)).originalData;if(!original?.entries)continue;
        const signature=JSON.stringify(canonical(original));
        const matches=candidates.filter(c=>JSON.stringify(canonical(c.data.character_book))===signature);
        if(matches.length===1){recordWorldbookSource(n,matches[0]);if(!disposed&&screen==='library')drawBooks();}
      }catch(error){console.debug('[Claude worldbook] Cover source unavailable',n,error);}
    }
  }
  const button=(action,label,cls='quiet',icon='')=>`<button type="button" class="${cls}" data-action="${action}">${icon}${label}</button>`;
  const iconButton=(action,label,icon,extra='')=>`<button type="button" class="icon-button ${extra}" data-action="${action}" aria-label="${label}" title="${label}">${icon}</button>`;
  function cover(n,mini=false){const source=worldbookSource(n);return `<span class="cover ${mini?'mini-cover':''}">${esc(Array.from(n)[0]||'书')}${source?.avatar?`<img src="/characters/${encodeURIComponent(source.avatar)}" alt="" loading="lazy">`:''}</span>`;}
  function checkbox(n,cls=''){return `<label class="enable-book ${cls}"><input type="checkbox" data-active="${esc(n)}" aria-label="启用${esc(n)}" ${wi.selected_world_info.includes(n)?'checked':''}>${cls?'':'启用这本世界书'}</label>`;}
  async function popup(title,body='',type=POPUP_TYPE.CONFIRM,value=''){
    const content=doc.createElement('div');content.className='cwn-resource-content';const heading=doc.createElement('h3');heading.textContent=title;content.append(heading);
    if(typeof body==='string'&&body){const p=doc.createElement('p');p.textContent=body;content.append(p);}else if(body)content.append(body);
    const dialog=new Popup(content,type,value,{okButton:'确定',cancelButton:'取消'});dialog.dlg.classList.add('cwn-character-dialog','cwn-resource-dialog');return dialog.show();
  }
  const confirm=async(title,body)=>await popup(title,body)===POPUP_RESULT.AFFIRMATIVE;
  async function run(fn){if(busy||disposed)return;busy=true;pane.inert=true;try{await fn();}catch(error){console.error('[Claude worldbook]',error);win.toastr.error(error.message||'操作失败，请重试');}finally{busy=false;pane.inert=false;}}
  async function ensureExists(n){await wi.updateWorldInfoList();if(!wi.world_names.includes(n))throw new Error('这本世界书已不存在，请返回列表刷新');}
  function render(){
    if(disposed)return;
    // Read the outgoing DOM, not the already-changed route/query variables.
    const previousBody=pane.querySelector('.wb-scroll');
    if(previousBody&&renderedPage!==null){
      pagePositions.set(renderedPage,{top:previousBody.scrollTop,query:previousBody.querySelector('[data-search]')?.value??''});
    }
    const pageKey=JSON.stringify([screen,screen==='library'?'':name,screen==='entry'?uid:null]);
    const position=pagePositions.get(pageKey);
    if(pageKey!==renderedPage&&screen!=='entry')query=position?.query??'';
    renderedPage=pageKey;
    pane.dataset.depth=String(screen==='entry'?2:screen==='book'?1:0);pane.classList.toggle('phone',win.innerWidth<=700);
    if(screen==='library'&&pane.querySelector('.book-grid')){drawBooks();void discoverCovers();return;}
    pane.innerHTML=`<div class="wb-nav ${screen==='library'?'wb-library-nav':''}">${iconButton('back',screen==='library'?'返回导航':'返回上一页',icons.back)}</div><div class="wb-scroll"></div>`;
    const body=pane.querySelector('.wb-scroll');
    if(screen==='library'){
      body.innerHTML=`<div class="heading"><h1 class="cwn-type-title">世界书</h1>${button('import','导入','solid mobile-import',icons.plus)}</div><button type="button" class="cwn-import-zone" id="cwn-worldbook-import-zone" data-action="import">${importZoneContent('世界书')}</button><input class="search" data-search placeholder="搜索世界书" aria-label="搜索世界书" value="${esc(query)}"><div class="summary"><span>世界书 · ${wi.world_names.length}</span><span>已启用 ${wi.selected_world_info.length} 本</span></div><div class="book-grid"></div>`;
      drawBooks();void discoverCovers();
    }else if(screen==='book'){
      const source=worldbookSource(name);
      body.innerHTML=`<div class="book-hero">${cover(name,true)}<div class="book-identity"><div class="book-title-row"><h1 class="cwn-type-title">${esc(name)}</h1><div class="book-more-wrap"><button type="button" class="icon-button" data-action="more" aria-label="世界书操作" aria-expanded="false">⋯</button><div class="book-more-menu" hidden>${button('rename','重命名','quiet',icons.pencil)}${button('copy-book','复制世界书','quiet',icons.copy)}${button('delete-book','删除世界书','quiet danger',icons.trash)}</div></div></div><p class="muted">${source?'来自角色卡 · '+esc(source.name):'世界书'}</p>${checkbox(name)}</div></div><input class="search" data-search placeholder="搜索条目" aria-label="搜索条目" value="${esc(query)}"><div class="entry-toolbar"><span class="muted">${Object.keys(book.entries).length} 个条目</span><label class="mode">编辑模式<input type="checkbox" class="toggle" data-mode ${editing?'checked':''}></label>${button('add','新增条目','quiet',icons.plus)}</div><div class="entry-list ${editing?'editing':''}"></div>`;
      drawEntries();
    }else{
      const e=book.entries[uid];baseline=structuredClone(e);
      const position=e.position===4?`4:${e.role??0}`:String(e.position??0);
      body.innerHTML=`<div class="entry-heading"><p class="muted">${esc(name)}</p><h1 class="cwn-type-title">${esc(e.comment||'未命名条目')}</h1></div><div class="entry-state"><div class="lights" role="group" aria-label="触发方式">${['blue','green',...(e.vectorized?['vector']:[])].map(mode=>`<button type="button" data-light="${mode}" aria-pressed="${(e.vectorized?'vector':e.constant?'blue':'green')===mode}"><span class="dot ${mode==='green'?'green':''}"></span>${mode==='blue'?'常驻':mode==='green'?'条件':'向量'}</button>`).join('')}</div><label>启用<input class="toggle" type="checkbox" data-field="disable" aria-label="启用此条目" ${!e.disable?'checked':''}></label></div><label class="field"><span>条目名称</span><input data-field="comment" aria-label="条目名称" value="${esc(e.comment)}"></label><label class="field keyword-field" ${e.constant||e.vectorized?'hidden':''}><span>主要关键字</span><input data-field="key" aria-label="主要关键字" value="${esc((e.key||[]).join(', '))}"><small>多个关键字用逗号分隔</small></label><label class="field"><span>插入位置</span><select data-field="position" aria-label="插入位置">${positions.map(([v,t])=>`<option value="${v}" ${v===position?'selected':''}>${t}</option>`).join('')}</select></label><div class="parameters">${[['depth','深度',e.depth??4],['order','顺序',e.order??100],['probability','概率',e.probability??100]].map(([key,label,value])=>`<label class="field"><span>${label}${key==='probability'?' %':''}</span><input type="number" step="1" ${key==='probability'?'min="0" max="100"':key==='depth'?'min="0"':''} data-field="${key}" aria-label="${label}" value="${value}"></label>`).join('')}</div><label class="field"><span>内容</span><textarea data-field="content" aria-label="条目内容">${esc(e.content)}</textarea></label><div class="entry-actions">${button('transfer','移动 / 复制到…','quiet',icons.move)}${button('copy-entry','复制条目','quiet',icons.copy)}${button('delete-entry','删除条目','quiet danger',icons.trash)}</div><div class="save-row">${button('back','取消','outline')}${button('save','保存修改','solid')}</div>`;
      body.dataset.light=e.vectorized?'vector':e.constant?'blue':'green';
    }
    body.scrollTop=position?.top??0;
  }
  const bookMarkup=new WeakMap();
  function drawBooks(){
    const grid=pane.querySelector('.book-grid');if(!grid)return;
    const markup=wi.world_names.filter(n=>n.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(n=>`<article class="book"><button type="button" class="cover-button" data-book="${esc(n)}" aria-label="查看${esc(n)}">${cover(n)}<span class="book-title">${esc(n)}</span></button>${checkbox(n,'cover-enable')}</article>`).join('')||'<p class="empty">没有找到世界书</p>';
    if(bookMarkup.get(grid)!==markup){grid.innerHTML=markup;bookMarkup.set(grid,markup);}
    const summary=pane.querySelectorAll('.summary > span');
    if(summary[0])summary[0].textContent=`世界书 · ${wi.world_names.length}`;
    if(summary[1])summary[1].textContent=`已启用 ${wi.selected_world_info.length} 本`;
  }
  function drawEntries(){pane.querySelector('.entry-list').innerHTML=Object.values(book.entries).sort((a,b)=>(a.displayIndex??a.uid)-(b.displayIndex??b.uid)).filter(e=>(e.comment||'').includes(query)||(e.content||'').includes(query)).map(e=>`<div class="entry-row" data-uid="${esc(e.uid)}"><button type="button" class="entry-open" data-entry="${esc(e.uid)}"><span class="dot ${e.constant?'':'green'}"></span><span><strong>${esc(e.comment||'未命名条目')}</strong><small>${esc(e.content||'暂无内容')}</small></span></button><input type="checkbox" class="toggle entry-enabled" data-enabled="${esc(e.uid)}" aria-label="启用条目${esc(e.comment||e.uid)}" ${!e.disable?'checked':''}><div class="row-actions">${iconButton('copy-entry','复制条目',icons.copy)}${iconButton('delete-entry','删除条目',icons.trash,'danger')}</div></div>`).join('')||'<p class="empty">没有找到条目</p>';}
  function draftPatch(){
    if(screen!=='entry')return {};
    const patch={},fields=pane.querySelectorAll('[data-field]');
    for(const el of fields){const key=el.dataset.field;let value;
      if(key==='disable')value=!el.checked;
      else if(key==='key'){if(el.value===(baseline.key||[]).join(', '))continue;value=wi.splitKeywordsAndRegexes(el.value);}
      else if(key==='position'){const [pos,role]=el.value.split(':').map(Number);value=pos;if(pos===4&&role!==(baseline.role??0))patch.role=role;}
      else if(['depth','order','probability'].includes(key)){value=Number(el.value);if(!el.value||!Number.isInteger(value)||(key==='depth'&&value<0)||(key==='probability'&&(value<0||value>100)))throw new Error('请填写有效的深度、顺序与概率');if(value===(baseline[key]??(key==='depth'?4:100)))continue;}
      else value=el.value;
      if(JSON.stringify(value)!==JSON.stringify(baseline[key]??(key==='disable'?false:'')))patch[key]=value;
    }
    const mode=pane.querySelector('.wb-scroll').dataset.light,old=baseline.vectorized?'vector':baseline.constant?'blue':'green';
    if(mode!==old){patch.constant=mode==='blue';patch.vectorized=mode==='vector';}
    if(Object.hasOwn(patch,'probability'))patch.useProbability=true;
    return patch;
  }
  function dirty(){try{return Object.keys(draftPatch()).length>0;}catch{return true;}}
  async function canLeave(){return screen!=='entry'||!dirty()||await confirm('是否舍弃当前修改？');}
  async function back(){if(busy)return false;if(!await canLeave())return false;if(screen==='entry'){const fresh=await data.read(name);book=fresh;screen='book';}else if(screen==='book'){await wi.updateWorldInfoList();screen='library';}else {drawer.querySelector('.cwn-panel-back')?.click();return true;}query='';render();return true;}
  pane.cwnNavigation={depth:()=>screen==='entry'?2:screen==='book'?1:0,back};
  async function active(n,enabled){await ensureExists(n);const selected=new Set(wi.selected_world_info);enabled?selected.add(n):selected.delete(n);wi.updateWorldInfoSettings({},[...selected]);for(const option of doc.querySelectorAll('#world_info option'))option.selected=selected.has(wi.world_names[Number(option.value)]);win.jQuery('#world_info').trigger('change.select2');await st.eventSource.emit(st.event_types.WORLDINFO_SETTINGS_UPDATED);}
  async function freshBook(){await ensureExists(name);book=await data.read(name);}
  async function save(){await ensureExists(name);book=await data.update(name,uid,draftPatch(),baseline);render();win.toastr.success('修改已保存');}
  async function askName(title,initial){const result=await popup(title,'',POPUP_TYPE.INPUT,initial);if(typeof result!=='string'||!result.trim())return null;const next=result.trim();const sanitized=await getSanitizedFilename(next+'.json');if(sanitized!==next+'.json')throw new Error('名称含有不支持的字符');await wi.updateWorldInfoList();if(wi.world_names.some(n=>n.localeCompare(next,undefined,{sensitivity:'base'})===0))throw new Error('已存在同名世界书，请换一个名称');return next;}
  async function importFiles(files){for(const f of files){const parsed=JSON.parse(await f.text());let contents=parsed;if(Array.isArray(parsed.entries))contents=wi.convertCharacterBook(parsed);if(!contents?.entries||Array.isArray(contents.entries))throw new Error(`${f.name} 不是支持的世界书 JSON`);const n=(await getSanitizedFilename(f.name)).replace(/\.json$/i,'');if(!n)throw new Error('世界书名称不能为空');await wi.updateWorldInfoList();if(wi.world_names.includes(n)&&!await confirm('覆盖同名世界书？',n))continue;await data.write(n,contents);recordWorldbookSource(n,null);}await wi.updateWorldInfoList();screen='library';query='';render();}
  async function action(action,target){
    const row=target.closest('[data-uid]');const selectedUid=row?Number(row.dataset.uid):uid;
    if(action==='import'){if(win.innerWidth<=700)void importDialog.open();else file.click();return;}
    if(action==='save'){await save();return;}
    if(action==='add'){await freshBook();const added=appendEntry(book,wi.newWorldInfoEntryTemplate);book=await data.write(name,added.book);uid=added.uid;screen='entry';render();return;}
    if(['copy-entry','delete-entry','transfer'].includes(action)){
      if(!await canLeave())return;await freshBook();
      if(action==='copy-entry'){const entry=book.entries[selectedUid];if(!entry)throw new Error('条目已不存在');book=await data.write(name,appendEntry(book,entry).book);screen='book';render();return;}
      if(action==='delete-entry'){if(!await confirm('删除此条目？',book.entries[selectedUid]?.comment||'未命名条目'))return;book=await data.write(name,removeEntry(book,selectedUid));screen='book';render();return;}
      await wi.updateWorldInfoList();const targets=wi.world_names.filter(n=>n!==name);if(!targets.length)throw new Error('需要另一本世界书作为目标');
      const form=doc.createElement('div');form.className='wb-transfer';form.innerHTML=`<label>目标世界书<select aria-label="目标世界书">${targets.map(n=>`<option>${esc(n)}</option>`).join('')}</select></label><label class="cwn-resource-bind"><input type="checkbox">移动条目（同时从当前世界书移除）</label>`;
      if(await confirm('移动 / 复制条目',form)){const targetName=form.querySelector('select').value;await ensureExists(targetName);await data.transfer(name,targetName,selectedUid,form.querySelector('input').checked);await freshBook();screen='book';render();}return;
    }
    if(action==='copy-book'){const next=await askName('复制世界书',name+' 副本');if(!next)return;await freshBook();await data.write(next,book);recordWorldbookSource(next,worldbookSource(name));await wi.updateWorldInfoList();name=next;render();return;}
    if(action==='rename'){
      const next=await askName('重命名世界书',name);if(!next)return;await freshBook();
      // Write and verify the replacement before changing references or removing the old file.
      await data.write(next,book);recordWorldbookSource(next,worldbookSource(name));const wasActive=wi.selected_world_info.includes(name);
      for(const card of st.characters.filter(c=>c.data?.extensions?.world===name)){const response=await request('/api/characters/merge-attributes',{avatar:card.avatar,data:{extensions:{world:next}}});if(!response.ok)throw new Error('新世界书已保存，角色绑定更新失败；原世界书已保留');await st.getOneCharacter(card.avatar);}
      for(const lore of wi.world_info.charLore||[])lore.extraBooks=(lore.extraBooks||[]).map(n=>n===name?next:n);
      if(win.jQuery('#character_world').val()===name)win.jQuery('#character_world').val(next);
      if(power_user.persona_description_lorebook===name)power_user.persona_description_lorebook=next;
      for(const persona of Object.values(power_user.persona_descriptions||{}))if(persona.lorebook===name)persona.lorebook=next;
      if(st.chat_metadata[wi.METADATA_KEY]===name){st.chat_metadata[wi.METADATA_KEY]=next;await st.saveMetadata();}
      st.saveSettingsDebounced();await wi.updateWorldInfoList();
      if(!await wi.deleteWorldInfo(name))throw new Error('新世界书已保存，原世界书未能删除');recordWorldbookSource(name,null);
      if(wasActive)await active(next,true);name=next;render();return;
    }
    if(action==='delete-book'){if(!await confirm('删除这本世界书？',name))return;if(!await wi.deleteWorldInfo(name))throw new Error('世界书删除失败');recordWorldbookSource(name,null);screen='library';query='';render();}
  }
  pane.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.action==='more'){const menu=pane.querySelector('.book-more-menu');menu.hidden=!menu.hidden;target.setAttribute('aria-expanded',String(!menu.hidden));return;}
    if(target.dataset.action==='back'){void back().catch(e=>win.toastr.error(e.message));return;}
    if(target.dataset.light){pane.querySelector('.wb-scroll').dataset.light=target.dataset.light;pane.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b===target)));pane.querySelector('.keyword-field').hidden=target.dataset.light!=='green';return;}
    void run(async()=>{if(target.dataset.book){name=target.dataset.book;await freshBook();screen='book';query='';render();}else if(target.dataset.entry){uid=Number(target.dataset.entry);await freshBook();if(!book.entries[uid])throw new Error('条目已不存在');screen='entry';render();}else if(target.dataset.action)await action(target.dataset.action,target);});
  },{signal});
  pane.addEventListener('input',event=>{if(event.target.matches('[data-search]')){query=event.target.value;screen==='library'?drawBooks():drawEntries();}},{signal});
  pane.addEventListener('change',event=>{const target=event.target;if(target.hasAttribute('data-mode')){editing=target.checked;pane.querySelector('.entry-list').classList.toggle('editing',editing);}else if(target.hasAttribute('data-active'))void run(async()=>{try{await active(target.dataset.active,target.checked);}finally{render();}});else if(target.hasAttribute('data-enabled'))void run(async()=>{try{await ensureExists(name);book=await data.update(name,Number(target.dataset.enabled),{disable:!target.checked});}finally{drawEntries();}});},{signal});
  file.addEventListener('change',()=>{const files=[...file.files];file.value='';void run(()=>importFiles(files));},{signal});
  pane.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},{capture:true,signal});
  doc.addEventListener('click',event=>{if(!event.target.closest('.book-more-wrap')){pane.querySelector('.book-more-menu')?.setAttribute('hidden','');pane.querySelector('[data-action="more"]')?.setAttribute('aria-expanded','false');}},{signal});
  doc.addEventListener('keydown',event=>{if(event.key!=='Escape'||!drawer.classList.contains('openDrawer')||doc.querySelector('dialog[open]'))return;const menu=pane.querySelector('.book-more-menu:not([hidden])');if(menu){menu.hidden=true;pane.querySelector('[data-action="more"]')?.focus();}else void back();event.preventDefault();event.stopImmediatePropagation();},{capture:true,signal});
  for(const type of ['dragenter','dragover','dragleave','drop'])doc.addEventListener(type,event=>{
    const zone=event.target.closest?.('#cwn-worldbook-import-zone');if(!zone)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(type==='dragleave'&&zone.contains(event.relatedTarget))return;
    const hasFiles=type==='drop'?event.dataTransfer?.files?.length>0:Array.from(event.dataTransfer?.types||[]).includes('Files');
    const allowed=win.innerWidth>700&&!busy&&hasFiles;
    zone.classList.toggle('cwn-drag-over',allowed&&type!=='drop'&&type!=='dragleave');
    if(event.dataTransfer)event.dataTransfer.dropEffect=allowed?'copy':'none';
    if(type==='drop'&&allowed){const files=[...event.dataTransfer.files];void run(()=>importFiles(files));}
  },{capture:true,signal});
  win.addEventListener('dragend',()=>pane.querySelector('#cwn-worldbook-import-zone')?.classList.remove('cwn-drag-over'),{signal});
  const resize=()=>pane.classList.toggle('phone',win.innerWidth<=700);win.addEventListener('resize',resize,{signal});
  let outsidePress=null;
  const outside=event=>!event.target.closest('dialog')&&!event.composedPath().includes(doc.getElementById('top-settings-holder'));
  doc.addEventListener('pointerdown',event=>{outsidePress=event.isPrimary&&event.button===0&&win.innerWidth>700&&drawer.classList.contains('openDrawer')&&outside(event)?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;},{capture:true,signal});
  doc.addEventListener('pointermove',event=>{if(outsidePress&&Math.hypot(event.clientX-outsidePress.x,event.clientY-outsidePress.y)>6)outsidePress=null;},{capture:true,signal});
  doc.addEventListener('pointercancel',()=>outsidePress=null,{capture:true,signal});
  win.addEventListener('blur',()=>outsidePress=null,{signal});
  doc.addEventListener('click',event=>{const press=outsidePress;outsidePress=null;if(press&&!busy&&outside(event)&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<=6)void run(async()=>{if(await canLeave())doc.querySelector('#WI-SP-button > .drawer-toggle')?.click();});},{signal});
  let opened=drawer.classList.contains('openDrawer');
  const observer=new win.MutationObserver(()=>{const now=drawer.classList.contains('openDrawer');if(now&&!opened)void run(async()=>{await wi.updateWorldInfoList();if(screen!=='entry'){if(screen==='book'&&wi.world_names.includes(name))book=await data.read(name);else screen='library';render();}});opened=now;});observer.observe(drawer,{attributes:true,attributeFilter:['class']});
  // Refresh a visible shelf when another native importer changes available books.
  const namesObserver=new win.MutationObserver(()=>{if(!busy&&screen==='library'&&!disposed)render();});const selector=doc.getElementById('world_editor_select');if(selector)namesObserver.observe(selector,{childList:true});
  render();
  return()=>{importDialog.dispose();disposed=true;abort.abort();observer.disconnect();namesObserver.disconnect();pane.remove();file.remove();drawer.classList.remove('cwn-worldbook-mounted');};
}
