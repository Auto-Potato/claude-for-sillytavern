import { takeGreeting } from './greeting.js';
import { chatLabel } from './chat-label.js';

export function mountHome(doc, win, host) {
  const shell = doc.getElementById('sheld'), rail = doc.getElementById('top-settings-holder');
  const abort = new win.AbortController();
  let disposed=false, loading=false, pending=false, switching=false;
  const listen=(node,type,fn)=>node.addEventListener(type,fn,{signal:abort.signal});
  const hero=doc.createElement('section');
  hero.id='cwn-home'; hero.setAttribute('aria-label','欢迎');
  const mark=doc.createElement('span'); mark.className='cwn-star'; mark.setAttribute('aria-hidden','true');
  const heading=doc.createElement('h1');
  hero.append(mark,heading); shell.prepend(hero);
  const newChat=doc.createElement('button'); newChat.id='cwn-new-chat'; newChat.type='button';
  const newIcon=doc.createElement('span');newIcon.className='cwn-new-icon';newIcon.setAttribute('aria-hidden','true');
  const newLabel=doc.createElement('span');newLabel.textContent='新对话';newChat.append(newIcon,newLabel);
  const pane=rail.querySelector('.cwn-nav-pane');
  if(pane) pane.prepend(newChat); else rail.querySelector('#cwn-brand').after(newChat);
  const recent=doc.createElement('section'); recent.id='cwn-recent'; recent.setAttribute('aria-label','最近聊天');
  const header=doc.createElement('div'); header.className='cwn-recent-heading';
  const title=doc.createElement('h2'); title.textContent='最近聊天';
  const edit=doc.createElement('button'); edit.type='button'; edit.className='cwn-recent-edit'; edit.setAttribute('aria-label','编辑最近聊天'); edit.setAttribute('aria-pressed','false');
  header.append(title,edit);
  const list=doc.createElement('div'); list.className='cwn-recent-list';
  const status=doc.createElement('p'); status.className='cwn-recent-status'; status.setAttribute('role','status');
  recent.append(header,list,status); (pane || rail).append(recent);
  const profile=doc.createElement('div'); profile.id='cwn-profile';
  const identity=doc.createElement('button');identity.id='cwn-profile-identity';identity.type='button';
  identity.setAttribute('aria-label','用户设定');
  const face=doc.createElement('img');face.alt='';
  const profileText=doc.createElement('span');profileText.className='cwn-profile-text';
  const profileName=doc.createElement('strong');
  const profileHint=doc.createElement('span');profileHint.textContent='Max plan';
  const theme=doc.createElement('button');theme.id='cwn-theme-toggle';theme.type='button';
  theme.innerHTML="<svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><g class='cwn-sun'><circle cx='12' cy='12' r='4'/><path d='M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5'/></g><path class='cwn-moon' d='M20 14a8.5 8.5 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z'/></svg>";
  const syncTheme=()=>{const dark=doc.documentElement.dataset.cwnTheme==='dark';theme.setAttribute('aria-label',dark?'切换为白天模式':'切换为夜间模式');theme.title=theme.getAttribute('aria-label');};
  const themeObserver=new win.MutationObserver(syncTheme);themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-cwn-theme']});syncTheme();
  listen(theme,'click',()=>doc.dispatchEvent(new win.CustomEvent('cwn-appearance-change',{detail:doc.documentElement.dataset.cwnTheme==='dark'?'light':'dark'})));
  profileText.append(profileName,profileHint);identity.append(face,profileText);profile.append(identity,theme);rail.append(profile);
  listen(identity,'click',()=>rail.querySelector('#persona-management-button .drawer-icon')?.click());
  const rows=new WeakMap();
  const actions=doc.createElement('div');actions.id='cwn-chat-actions';actions.setAttribute('popover','auto');
  actions.setAttribute('role','menu');actions.setAttribute('aria-label','聊天操作');
  for(const [icon,label] of [['M8 3h8l-1 6 3 3v2h-5v7l-1-2-1 2v-7H6v-2l3-3-1-6Z','置顶'],['m4 16 12-12 4 4-12 12H4v-4Z M14 6l4 4','重命名'],['M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7','删除']]) {
    const item=doc.createElement('button');item.type='button';item.setAttribute('role','menuitem');
    item.dataset.action=label;item.title='';
    const glyph=doc.createElement('span');glyph.innerHTML="<svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='"+icon+"'/></svg>";glyph.setAttribute('aria-hidden','true');
    const text=doc.createElement('span');text.textContent=label;item.append(glyph,text);actions.append(item);
  }
  rail.append(actions);
  const dialog=doc.createElement('dialog');dialog.id='cwn-chat-dialog';dialog.setAttribute('aria-labelledby','cwn-dialog-title');
  rail.append(dialog);
  let dialogReturn=null, mutating=false, pinMotion=null;
  listen(dialog,'cancel',event=>{if(mutating)event.preventDefault();});
  listen(dialog,'close',()=>{dialogReturn?.focus();dialogReturn=null;});
  listen(actions,'click',event=>{
    const kind=event.target.closest('button')?.dataset.action;
    if(mutating || switching || !kind)return;
    const trigger=actionTrigger,row=rows.get(trigger);if(!row)return;
    closeActions();
    if(kind==='置顶'){void mutate(async()=>{await host.pinChat(row);pinMotion={avatar:row.avatar,group:row.group,file:row.file};});return;}
    dialogReturn=trigger;
    const form=doc.createElement('form');form.method='dialog';
    const heading=doc.createElement('h2');heading.id='cwn-dialog-title';heading.textContent=kind==='删除'?'删除这段聊天？':'重命名';
    const label=chatLabel(row);
    form.append(heading);
    if(kind==='重命名') {
      const input=doc.createElement('input');input.id='cwn-chat-name';input.type='text';input.autocomplete='off';input.placeholder='输入聊天名称';input.value=label.subtitle?label.title:'';input.autofocus=true;
      input.setAttribute('aria-label','聊天名称');form.append(input);
    } else {
      const name=doc.createElement('strong');name.className='cwn-delete-name';name.textContent=label.title;
      const warning=doc.createElement('p');warning.textContent='仅删除这段聊天，角色卡会保留。删除后无法撤销。';form.append(name,warning);
    }
    const note=doc.createElement('p');note.className='cwn-dialog-preview';note.setAttribute('role','alert');form.append(note);
    const footer=doc.createElement('div');footer.className='cwn-dialog-buttons';
    const cancel=doc.createElement('button');cancel.type='submit';cancel.textContent='取消';cancel.value='cancel';
    const confirm=doc.createElement('button');confirm.type='submit';confirm.textContent=kind==='删除'?'确认删除':'保存名称';confirm.value='confirm';confirm.className=kind==='删除'?'cwn-danger':'cwn-primary';
    if(kind==='删除')cancel.autofocus=true;
    footer.append(cancel,confirm);form.append(footer);
    form.addEventListener('submit',async event=>{
      if(event.submitter===cancel)return;
      event.preventDefault();if(mutating)return;
      confirm.disabled=cancel.disabled=true;note.textContent='';
      const ok=await mutate(()=>kind==='删除'?host.deleteChat(row):host.renameChat(row,form.querySelector('input').value),note);
      confirm.disabled=cancel.disabled=false;
      if(ok && !disposed)dialog.close();
    });
    dialog.replaceChildren(form);dialog.showModal();
  });
  let actionTrigger=null;
  const closeActions=()=>{if(actions.matches(':popover-open'))actions.hidePopover();actionTrigger?.setAttribute('aria-expanded','false');actionTrigger=null;};
  listen(actions,'toggle',()=>{if(!actions.matches(':popover-open')){actionTrigger?.setAttribute('aria-expanded','false');actionTrigger=null;}});
  listen(pane || rail,'scroll',closeActions);
  listen(win,'resize',closeActions);
  async function mutate(fn, errorNode=status) {
    if(mutating || switching || disposed)return false;
    mutating=true;newChat.disabled=true;
    try { await fn();if(!disposed){syncHome();await refreshList();}return true; }
    catch(error){if(!disposed)errorNode.textContent=error.message || '操作失败，请重试。';return false;}
    finally{mutating=false;if(!disposed)newChat.disabled=false;}
  }
  let wasHome=false, greetingName;
  function syncHome() {
    if(disposed) return;
    const isHome=host.isHome();
    shell.classList.toggle('cwn-home-active',isHome);
    shell.classList.remove('cwn-show-welcome');
    const name=host.userName?.()?.trim() || '';
    profileName.textContent=name || '用户';
    const avatar=host.userAvatar?.() || '/img/user-default.png';
    if(face.getAttribute('src')!==avatar) face.setAttribute('src',avatar);
    if(isHome && (!wasHome || greetingName!==name)) {
      heading.textContent=takeGreeting(win,name);
      greetingName=name;
    }
    wasHome=isHome;
  }
  function closeNavigation() {
    if(doc.documentElement.classList.contains('cwn-menu-open')) doc.getElementById('cwn-menu')?.click();
  }
  async function action(fn) {
    if(switching || mutating || disposed) return;
    switching=true; newChat.disabled=true; list.setAttribute('aria-busy','true');
    try { await fn(); if(!disposed) { closeNavigation(); syncHome(); } }
    catch(error) { if(!disposed) status.textContent=error.message || '操作未完成，请重试。'; }
    finally { switching=false; if(!disposed) {newChat.disabled=false;list.removeAttribute('aria-busy');} }
  }
  async function refreshList() {
    if(disposed) return;
    if(loading) {pending=true;return;}
    loading=true; status.textContent='正在读取…';
    try {
      const data=await host.recent(abort.signal);
      if(disposed) return;
      const fragment=doc.createDocumentFragment();
      for(const row of data) {
        const button=doc.createElement('button'); button.type='button'; button.className='cwn-recent-item';
        const label=chatLabel(row);
        button.classList.toggle('cwn-custom-chat',Boolean(label.subtitle));
        const name=doc.createElement('strong');name.textContent=label.title;
        const avatar=doc.createElement('img');avatar.alt='';avatar.loading='lazy';avatar.src=row.image || '/img/user-default.png';
        const file=doc.createElement('span');file.textContent=label.subtitle;
        if(row.pinned)button.setAttribute('aria-label',label.title+'，已置顶');
        button.title=`${row.name}\n${row.file}`;button.append(avatar,name,file); rows.set(button,row);
        const rowWrap=doc.createElement('div');rowWrap.className='cwn-recent-row';
        rowWrap.classList.toggle('cwn-pinned',Boolean(row.pinned));
        if(pinMotion && pinMotion.avatar===row.avatar && pinMotion.group===row.group && pinMotion.file===row.file) {
          rowWrap.classList.add(row.pinned?'cwn-pin-in':'cwn-pin-out');pinMotion=null;
        }
        const more=doc.createElement('button');more.type='button';more.className='cwn-recent-more';more.textContent='⋯';
        more.setAttribute('aria-label',`更多操作：${label.title}`);
        more.title='更多操作';
        rows.set(more,row);rowWrap.append(button,more);fragment.append(rowWrap);
      }
      closeActions();list.replaceChildren(fragment);status.textContent=data.length ? '' : '还没有最近聊天';
    } catch(error) {if(!disposed && error.name!=='AbortError') status.textContent=error.message;}
    finally {
      loading=false;
      if(!disposed) {if(pending){pending=false;void refreshList();}}
    }
  }
  listen(newChat,'click',()=>void action(()=>host.newChat()));
  listen(list,'click',event=>{
    if(mutating || switching)return;
    const more=event.target.closest('.cwn-recent-more');
    if(more) {
      if(actionTrigger===more){closeActions();return;}
      closeActions();actionTrigger=more;more.setAttribute('aria-expanded','true');more.setAttribute('aria-haspopup','menu');
      actions.querySelector('[data-action="置顶"] span:last-child').textContent=rows.get(more).pinned?'取消置顶':'置顶';
      actions.showPopover();
      const r=more.getBoundingClientRect(),box=actions.getBoundingClientRect();
      const above=r.bottom+6+box.height>win.innerHeight-8;
      actions.style.left=`${Math.max(8,Math.min(r.right-box.width,win.innerWidth-box.width-8))}px`;
      actions.style.top=`${Math.max(8,above?r.top-box.height-6:r.bottom+6)}px`;
      actions.style.transformOrigin=above?'bottom right':'top right';
      return;
    }
    closeActions();
    const row=rows.get(event.target.closest('.cwn-recent-item'));
    if(row) void action(()=>host.openRecent(row));
  });
  listen(edit,'click',()=>{const active=recent.classList.toggle('cwn-editing');edit.setAttribute('aria-pressed',String(active));edit.setAttribute('aria-label',active?'结束编辑最近聊天':'编辑最近聊天');});
  const unsubscribe=host.subscribe((refresh=true)=>{syncHome();if(refresh) void refreshList();});
  syncHome();void refreshList();
  return ()=>{
    disposed=true;themeObserver.disconnect();closeActions();dialogReturn=null;dialog.remove();actions.remove();abort.abort();unsubscribe();hero.remove();newChat.remove();recent.remove();profile.remove();
    shell.classList.remove('cwn-home-active','cwn-show-welcome');
  };
}

