import { importCharacterResources } from './character-resources.js';
import * as st from '../../../../../script.js';
import { world_names, updateWorldInfoList } from '../../../../world-info.js';
import { Popup, POPUP_TYPE } from '../../../../popup.js';
import { characterFields, createCharacterData } from './character-data.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const back=(action,label)=>`<button type="button" class="detail-back" data-action="${action}" aria-label="${label}">${icon('m15 5-7 7 7 7')}</button>`;

export function mountCharacterLibrary(doc,win,host) {
  const drawer=doc.getElementById('right-nav-panel');if(!drawer)return()=>{};
  const pane=doc.createElement('div');pane.id='cwn-character-library';drawer.append(pane);drawer.classList.add('cwn-library-mounted');
  const zone=doc.getElementById('cwn-character-import-zone'),home=zone?.parentNode,next=zone?.nextSibling;
  const abort=new win.AbortController();let card=null,avatar='',opening=0,draft=null,baseline=null,busy=false,disposed=false,query='',revision=0;
  const data=createCharacterData({
    request:(url,body)=>fetch(url,{method:'POST',headers:st.getRequestHeaders(),body:JSON.stringify(body)}),
    isBusy:()=>st.isGenerating()||st.isChatSaving,
    refresh:async(key,saved)=>{
      const index=st.characters.findIndex(c=>c.avatar===key);
      if(index>=0)Object.assign(st.characters[index],saved);
      if(String(index)===String(st.this_chid))st.select_selected_character(index,{switchMenu:false});
      await st.eventSource.emit(st.event_types.CHARACTER_EDITED,{id:index,character:saved});
    },
  });
  const heightKey=()=>`cwn-opening-height-${win.innerWidth<=700?'mobile':'desktop'}`;
  function rememberHeight(){
    const editor=pane.querySelector('[data-field="opening"]');
    if(!editor?.style.height)return;
    const height=Math.round(editor.getBoundingClientRect().height);
    if(height>0)try{win.localStorage.setItem(heightKey(),String(height));}catch{}
  }
  const editorResize=new win.ResizeObserver(rememberHeight);
  function restoreHeight(){
    editorResize.disconnect();
    const editor=pane.querySelector('[data-field="opening"]');if(!editor)return;
    try{const height=Number(win.localStorage.getItem(heightKey()));if(Number.isFinite(height)&&height>=120&&height<=4000)editor.style.height=`${height}px`;}catch{}
    editorResize.observe(editor);
  }
  function responsive(){pane.classList.toggle('phone',win.innerWidth<=700);restoreHeight();}
  responsive();win.addEventListener('resize',responsive,{signal:abort.signal});
  function confirm(title,body){const content=doc.createElement('div'),heading=doc.createElement('h3');heading.textContent=title;content.append(heading);if(typeof body==='string'&&body){const p=doc.createElement('p');p.textContent=body;content.append(p);}else if(body)content.append(body);const popup=new Popup(content,POPUP_TYPE.CONFIRM,'',{okButton:'确定',cancelButton:'取消'});popup.dlg.classList.add('cwn-character-dialog');return popup.show();}
  const image=key=>`/characters/${encodeURIComponent(key)}`;
  function changed(){return !!draft&&JSON.stringify(draft)!==JSON.stringify(baseline);}
  function editActions(){const row=pane.querySelector('.library-edit');if(row)row.hidden=!changed();}
  function controls(){pane.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=busy || (e.dataset.action==='prev'&&opening===0) || (e.dataset.action==='next'&&card&&opening>=(draft||characterFields(card)).openings.length));}
  function beginDraft(){if(!draft){baseline=characterFields(card);draft=structuredClone(baseline);}}
  function discard(){draft=null;baseline=null;opening=Math.min(opening,characterFields(card).openings.length-1);}

  async function run(fn){if(busy)return;busy=true;controls();try{await fn();}catch(error){win.toastr.error(error.message||'操作失败，请重试');}finally{busy=false;if(!disposed)controls();}}
  function drawCards(){
    const rows=st.characters.filter(c=>(c.name||'').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    pane.querySelector('.library-grid').innerHTML=rows.map(c=>`<button type="button" class="library-card" data-avatar="${esc(c.avatar)}"><img src="${esc(image(c.avatar))}" alt="" loading="lazy"><span class="cwn-type-item">${esc(c.name)}</span></button>`).join('')||'<p class="library-muted">没有匹配的角色卡</p>';
    pane.querySelector('.library-count').textContent=`角色卡 · ${rows.length}`;
  }
  function list(){
    rememberHeight();editorResize.disconnect();card=null;draft=null;revision++;
    pane.innerHTML=`<button type="button" class="design-menu" data-action="menu" aria-label="返回导航菜单">${icon('M4 6h16M4 12h16M4 18h16')}</button><div class="library-heading"><h1 class="cwn-type-title">角色卡</h1><button class="library-import" data-action="import">${icon('M12 5v14M5 12h14')}<span>导入</span></button></div><div class="library-drop"></div><input class="library-search" type="search" placeholder="搜索角色" aria-label="搜索角色" value="${esc(query)}"><p class="library-count library-muted"></p><div class="library-grid"></div>`;
    if(zone)pane.querySelector('.library-drop').append(zone);drawCards();drawer.scrollTop=0;
  }
  function render(){
    if(disposed||!card)return;
    rememberHeight();
    const fields=draft||characterFields(card),items=fields.openings;opening=Math.min(opening,items.length);
    const book=card.data?.extensions?.world || '';
    const missingBook=!!book&&!world_names.includes(book);
    pane.innerHTML=`<div class="detail-view">${back('back','返回角色卡列表')}<div class="detail-hero"><img class="detail-cover" src="${esc(image(avatar))}" alt=""><div class="detail-identity"><div class="detail-title-row"><h1 class="cwn-type-title">${esc(card.name||card.data?.name)}</h1><button type="button" class="detail-resources" data-action="resources" aria-label="导入角色卡资源" title="导入角色卡资源">${icon('M12 5v14M5 12h14')}</button></div><div class="library-edit" ${changed()?'':'hidden'}><button class="edit-confirm" data-action="save" aria-label="保存修改">✓ 保存</button><button class="edit-confirm" data-action="cancel" aria-label="取消编辑">× 取消</button></div></div></div>
    <section class="detail-section"><h2 class="cwn-type-section">角色描述</h2><textarea class="library-editor" data-field="description" aria-label="角色描述" placeholder="暂无角色描述">${esc(fields.description)}</textarea></section>
    <section class="detail-section"><div class="detail-section-head"><h2 class="cwn-type-section">开场白</h2><span class="library-muted" aria-live="polite">${opening+1} / ${characterFields(card).openings.length}${opening>=characterFields(card).openings.length?' · 新开场白':''}</span></div><div class="opening-switch"><button class="opening-arrow" data-action="prev" aria-label="上一个开场白" >${icon('m14 6-6 6 6 6')}</button><div class="detail-opening"><textarea class="library-editor" data-field="opening" aria-label="开场白" placeholder="输入新的开场白">${esc(items[opening]||'')}</textarea></div><button class="opening-arrow" data-action="next" aria-label="下一个开场白" >${icon('m10 6 6 6-6 6')}</button></div></section>
    <section class="detail-section"><h2 class="cwn-type-section">角色世界书</h2><div class="detail-world"><div><strong>${esc(book||'尚未绑定世界书')}</strong><small>${missingBook?'绑定的世界书未找到，请导入或重新选择':'跟随此角色用于各条聊天'}</small></div><button class="detail-link" data-action="world">${book?'更换':'绑定'}</button></div></section><div class="library-footer"><button class="detail-delete" data-action="delete">删除角色卡</button><button class="library-chat" data-action="chat">开始新聊天</button></div></div>`;
    controls();editActions();restoreHeight();
  }
  async function canLeave(){if(!changed())return true;return !!await confirm('是否舍弃当前修改？');}
  async function open(key){const stamp=++revision;const [loaded]=await Promise.all([data.read(key),updateWorldInfoList()]);if(disposed||stamp!==revision)return;avatar=key;card=loaded;opening=0;draft=null;render();drawer.scrollTop=0;}
  pane.addEventListener('input',event=>{const el=event.target;if(el.matches('.library-search')){query=el.value;drawCards();}if(el.dataset.field){beginDraft();if(el.dataset.field==='description')draft.description=el.value;if(el.dataset.field==='opening'){if(opening<draft.openings.length||el.value)draft.openings[opening]=el.value;}editActions();controls();}},{signal:abort.signal});
  pane.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||busy)return;
    if(button.dataset.avatar){run(()=>open(button.dataset.avatar));return;}
    const action=button.dataset.action;
    if(action==='import')doc.getElementById('character_import_file')?.click();
    if(action==='menu')drawer.querySelector('.cwn-panel-back')?.click();
    if(action==='cancel')run(async()=>{if(await confirm('是否舍弃当前修改？')){discard();render();}});
    if(action==='prev'||action==='next'){const count=(draft||characterFields(card)).openings.length;opening=Math.max(0,Math.min(count,opening+(action==='next'?1:-1)));const y=drawer.scrollTop;render();drawer.scrollTop=y;return;}
    if(action==='back')run(async()=>{if(await canLeave())list();});
    if(action==='save')run(async()=>{if(!changed()||!await confirm('是否保存当前修改？'))return;card=await data.save(avatar,draft,baseline);discard();render();win.toastr.success('角色详情已保存');});
    if(action==='resources')run(async()=>{const fresh=await data.read(avatar);await importCharacterResources(fresh,{doc,win,bind:(key,name)=>data.bind(key,name)});card=await data.read(avatar);render();});
    if(action==='world')run(async()=>{
      if(!await canLeave())return;draft=null;[card]=await Promise.all([data.read(avatar),updateWorldInfoList()]);render();
      const body=doc.createElement('div');const label=doc.createElement('label');label.textContent='角色世界书';const select=doc.createElement('select');select.className='text_pole';select.setAttribute('aria-label','角色世界书');
      const currentBook=card.data?.extensions?.world||'';
      const names=[...new Set(['',...world_names,...(currentBook?[currentBook]:[])])];
      for(const name of names){const option=doc.createElement('option');option.value=name;option.textContent=name?(world_names.includes(name)?name:`${name}（未找到）`):'不绑定世界书';select.append(option);}
      select.value=currentBook;label.append(select);body.append(label);
      if(await confirm('绑定角色世界书',body)&&select.value!==currentBook){if(select.value&&!world_names.includes(select.value))throw new Error('这本世界书不存在，请先导入');card=await data.bind(avatar,select.value);win.toastr.success('角色世界书绑定已保存');}render();
    });
    if(action==='delete')run(async()=>{
      if(st.isGenerating()||st.isChatSaving)throw new Error('请等待生成或聊天保存完成');
      if(!await canLeave())return;
      const message=doc.createElement('p');message.textContent=`删除「${card.name}」？此操作删除角色卡，保留聊天记录。`;
      if(await confirm('删除角色卡',message)){if(await st.deleteCharacter(avatar,{deleteChats:false})){list();win.toastr.success('角色卡已删除');}}
    });
    if(action==='chat')run(async()=>{if(!await canLeave())return;await host.startCharacterChat(avatar);discard();render();if(win.innerWidth<=700&&doc.documentElement.classList.contains('cwn-menu-open'))doc.getElementById('cwn-backdrop')?.click();else if(drawer.classList.contains('openDrawer'))doc.querySelector('#rightNavHolder > .drawer-toggle')?.click();});
  },{signal:abort.signal});
  const observer=new win.MutationObserver(()=>{if(drawer.classList.contains('openDrawer')&&!card)list();});observer.observe(drawer,{attributes:true,attributeFilter:['class']});
  const refresh=()=>{if(!disposed&&!card)list();};
  for(const type of ['CHARACTER_EDITED','CHARACTER_DELETED','CHARACTER_DUPLICATED','CHARACTER_RENAMED'])st.eventSource.on(st.event_types[type],refresh);
  // Native imports rebuild their list; observe that list, not the whole document.
  const nativeList=doc.getElementById('rm_print_characters_block');const imports=new win.MutationObserver(refresh);if(nativeList)imports.observe(nativeList,{childList:true});
  // A click can target the common ancestor after a drag leaves the panel.
  // Dismiss only a primary-pointer click that both starts and ends outside.
  let outsidePress=null;
  const isOutside=event=>!event.target.closest('dialog')&&!event.composedPath().includes(doc.getElementById('top-settings-holder'));
  doc.addEventListener('pointerdown',event=>{
    outsidePress=event.isPrimary&&event.button===0&&win.innerWidth>700&&drawer.classList.contains('openDrawer')&&isOutside(event)
      ?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;
  },{capture:true,signal:abort.signal});
  doc.addEventListener('pointermove',event=>{
    if(outsidePress&&event.pointerId===outsidePress.id&&Math.hypot(event.clientX-outsidePress.x,event.clientY-outsidePress.y)>6)outsidePress=null;
  },{capture:true,signal:abort.signal});
  doc.addEventListener('pointercancel',()=>{outsidePress=null;},{capture:true,signal:abort.signal});
  win.addEventListener('blur',()=>{outsidePress=null;},{signal:abort.signal});
  const outside=event=>{
    const press=outsidePress;outsidePress=null;
    if(press&&event.button===0&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<=6&&win.innerWidth>700&&drawer.classList.contains('openDrawer')&&!busy&&!changed()&&isOutside(event))doc.querySelector('#rightNavHolder > .drawer-toggle')?.click();
  };
  doc.addEventListener('click',outside,{signal:abort.signal});list();
  return()=>{rememberHeight();editorResize.disconnect();disposed=true;revision++;abort.abort();observer.disconnect();imports.disconnect();for(const type of ['CHARACTER_EDITED','CHARACTER_DELETED','CHARACTER_DUPLICATED','CHARACTER_RENAMED'])st.eventSource.removeListener(st.event_types[type],refresh);if(zone&&home)home.insertBefore(zone,next?.parentNode===home?next:null);pane.remove();drawer.classList.remove('cwn-library-mounted');};
}
