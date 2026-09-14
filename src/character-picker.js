export function mountCharacterPicker(doc, button, host) {
  const win=doc.defaultView, abort=new win.AbortController();
  const menu=doc.createElement('div');menu.id='cwn-character-menu';menu.setAttribute('popover','auto');menu.setAttribute('role','dialog');menu.setAttribute('aria-label','快速切换角色卡');
  const search=doc.createElement('input');search.type='search';search.placeholder='搜索角色卡';search.setAttribute('aria-label','搜索角色卡');search.className='cwn-character-search';
  const list=doc.createElement('div');list.className='cwn-character-list';
  const status=doc.createElement('div');status.setAttribute('role','status');status.className='cwn-character-status';
  menu.append(search,list,status);doc.body.append(menu);
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
  let busy=false,disposed=false;
  const on=(node,type,fn)=>node.addEventListener(type,fn,{signal:abort.signal});
  function position(){
    if(!menu.matches(':popover-open'))return;
    const viewport=win.visualViewport,topEdge=Math.max(0,viewport?.offsetTop||0),bottom=topEdge+(viewport?.height||win.innerHeight);
    const rect=button.getBoundingClientRect(),mobile=win.innerWidth<=700;
    const width=Math.min(320,Math.max(248,win.innerWidth-24));
    let top=Math.max(topEdge+12,rect.bottom+8),limit=bottom-12;
    if(mobile){top=topEdge+64;const composer=doc.querySelector('#form_sheld')?.getBoundingClientRect();if(composer?.top>top)limit=Math.min(limit,composer.top-10);}
    const height=Math.min(420,Math.max(96,limit-top));
    menu.style.width=mobile?'calc(100% - 24px)':width+'px';menu.style.left=mobile?'12px':Math.min(Math.max(12,rect.right-width),win.innerWidth-width-12)+'px';menu.style.top=top+'px';menu.style.maxHeight=height+'px';list.style.maxHeight=Math.max(48,Math.min(352,height-60))+'px';
  }
  function render(){
    const query=search.value.trim().toLocaleLowerCase(),fragment=doc.createDocumentFragment();
    for(const item of host.characterChoices()){
      if(query&&!item.name.toLocaleLowerCase().includes(query))continue;
      const option=doc.createElement('button');option.type='button';option.className='cwn-character-option';option.classList.toggle('is-active',item.active);option.dataset.avatar=item.avatar;option.disabled=busy;
      const face=doc.createElement('span');face.className='cwn-character-avatar';const img=doc.createElement('img');img.src=item.image;img.alt='';img.loading='lazy';face.append(img);
      const label=doc.createElement('span');label.className='cwn-character-name';label.textContent=item.name;option.append(face,label);
      if(item.active){const check=doc.createElement('span');check.className='cwn-character-check';check.textContent='✓';check.setAttribute('aria-label','当前角色');option.append(check);}
      fragment.append(option);
    }
    if(!fragment.childNodes.length){const empty=doc.createElement('div');empty.className='cwn-character-empty';empty.textContent='没有匹配的角色卡';fragment.append(empty);}
    list.replaceChildren(fragment);
  }
  on(button,'click',()=>{if(menu.matches(':popover-open')){menu.hidePopover();return;}search.value='';status.textContent='';render();menu.showPopover();button.setAttribute('aria-expanded','true');position();search.focus({preventScroll:true});});
  on(menu,'toggle',()=>{button.setAttribute('aria-expanded',String(menu.matches(':popover-open')));});
  on(search,'input',render);
  on(list,'click',async event=>{
    const option=event.target.closest('button[data-avatar]');if(!option||busy)return;
    busy=true;status.textContent='';search.disabled=true;render();
    try{await host.chooseCharacter(option.dataset.avatar);if(!disposed){menu.hidePopover();button.focus({preventScroll:true});}}
    catch(error){if(!disposed)status.textContent=error.message||'角色切换失败，请重试。';}
    finally{busy=false;if(!disposed){search.disabled=false;render();}}
  });
  on(win,'resize',position);if(win.visualViewport){on(win.visualViewport,'resize',position);on(win.visualViewport,'scroll',position);}
  return()=>{disposed=true;abort.abort();menu.remove();button.removeAttribute('aria-haspopup');button.removeAttribute('aria-expanded');};
}
