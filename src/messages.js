// Format only the native timestamp; preserve its model tooltip and message data.
export function mountMessages(doc, host) {
  const chat = doc.getElementById('chat');
  if (!chat) return () => {};
  const avatarShade=doc.createElement('button');
  avatarShade.id='cwn-avatar-shade';
  avatarShade.type='button';
  avatarShade.setAttribute('aria-label','关闭卡图');
  doc.body.append(avatarShade);
  function closeAvatarOutside(event) {
    const viewers=[...doc.querySelectorAll('body > .zoomed_avatar')];
    if(!viewers.length || event.target.closest('.zoomed_avatar img,.zoomed_avatar .dragClose'))return;
    event.preventDefault();event.stopImmediatePropagation();
    for(const viewer of viewers)viewer.querySelector('.dragClose')?.click();
  }
  doc.addEventListener('click',closeAvatarOutside,true);
  const originals = new Map();
  const win = doc.defaultView;
  let frame = 0, switching = false;
  let cancelledMessage = null;
  let editAnchor = null;
  let readingPositions = new WeakMap();
  function rememberEditAnchor(event) {
    const button=event.target.closest('.mes_edit');
    if(!button || !chat.contains(button))return;
    const message=button.closest('.mes');
    if(message.querySelector('.edit_textarea'))return;
    readingPositions.set(message,{top:message.getBoundingClientRect().top-chat.getBoundingClientRect().top});
    const bounds=button.getBoundingClientRect();
    editAnchor={message,center:bounds.top+bounds.height/2};
  }
  chat.addEventListener('click',rememberEditAnchor,true);
  function restoreEditAnchor() {
    if(!editAnchor)return;
    const {message,center}=editAnchor;
    if(!chat.contains(message)){editAnchor=null;return;}
    if(!message.querySelector('.edit_textarea'))return;
    const toolbar=message.querySelector('.mes_edit_buttons');
    if(!toolbar)return;
    editAnchor=null;
    // Native focus has finished; compensate before paint using the new toolbar,
    // not the old scroll offset (the message may now be much shorter).
    const bounds=toolbar.getBoundingClientRect();
    const viewport=chat.getBoundingClientRect();
    const target=Math.max(viewport.top+bounds.height/2,Math.min(center,viewport.bottom-bounds.height/2));
    chat.scrollTop+=bounds.top+bounds.height/2-target;
  }
  function rememberCancel(event) {
    const button=event.target.closest('.mes_edit_cancel,.mes_edit_done');
    if(!button || !chat.contains(button))return;
    cancelledMessage=button.closest('.mes');
  }
  chat.addEventListener('click',rememberCancel,true);
  function scrollCancelledMessage() {
    if(!cancelledMessage || cancelledMessage.querySelector('.edit_textarea'))return;
    const message=cancelledMessage;
    cancelledMessage=null;
    const saved=readingPositions.get(message);
    readingPositions.delete(message);
    if(!saved || !chat.contains(message))return;
    // MutationObserver runs before paint: restore immediately so no intermediate
    // frame shows the native editor's old scroll position against restored text.
    const viewport=chat.getBoundingClientRect();
    chat.scrollTop+=message.getBoundingClientRect().top-viewport.top-saved.top;
  }
  async function cycle(event) {
    const button=event.target.closest('.swipe_left,.swipe_right');
    if(!button || !chat.contains(button))return;
    // Capture before SillyTavern's delegated handler can overswipe and generate.
    event.preventDefault();event.stopImmediatePropagation();
    if(switching)return;
    const message=button.closest('.mes');
    switching=true;
    try{await host.cycleCandidate(Number(message.getAttribute('mesid')),button.classList.contains('swipe_left')?-1:1);}
    catch(error){console.warn('Claude theme: candidate switch failed',error);}
    finally{switching=false;update([message]);}
  }
  chat.addEventListener('click',cycle,true);
  function placeArrows() {
    frame = 0;

    const viewport = chat.getBoundingClientRect();
    chat.querySelectorAll(':scope > .mes.last_mes[is_user="false"]').forEach(message => {
      const rect = message.getBoundingClientRect();
      const top = Math.max(rect.top, viewport.top), bottom = Math.min(rect.bottom, viewport.bottom);
      message.classList.toggle('cwn-swipe-visible', bottom > top && rect.bottom > viewport.top + 8 && rect.top < viewport.bottom - 8);
      if (bottom > top) message.style.setProperty('--cwn-swipe-top', `${(top + bottom) / 2 - rect.top}px`);
    });
  }
  function queueArrows() { if (!frame) frame = win.requestAnimationFrame(placeArrows); }
  chat.addEventListener('scroll', queueArrows, { passive: true });
  let resizeTimer=0;
  function settleResize(){win.clearTimeout(resizeTimer);resizeTimer=win.setTimeout(queueArrows,120);}
  win.addEventListener('resize', settleResize);
  const resize = new ResizeObserver(settleResize);
  resize.observe(chat);
  function refreshCodeBars(message) {
    message.querySelectorAll('.mes_text pre').forEach(pre=>{
      if(pre.querySelector(':scope > .cwn-code-bar'))return;
      const code=pre.querySelector('code');
      if(!code)return;
      const bar=doc.createElement('div');bar.className='cwn-code-bar';
      const label=doc.createElement('span');
      label.textContent=code.className.match(/language-([\w+-]+)/)?.[1] || 'text';
      bar.append(label);pre.prepend(bar);
    });
  }
  function update(messages = chat.querySelectorAll(':scope > .mes')) {
    restoreEditAnchor();
    scrollCancelledMessage();
    for(const message of messages){
      if(!chat.contains(message))continue;
      if(!message.querySelector('.edit_textarea') && editAnchor?.message!==message)readingPositions.delete(message);
      refreshCodeBars(message);
      message.classList.toggle('cwn-has-candidates',host.candidateCount(Number(message.getAttribute('mesid')))>1);
    message.querySelectorAll('.timestamp').forEach(element => {
      const text = element.textContent;
      if (originals.get(element)?.formatted === text) return;
      const match = text.trim().match(/^(.*?)\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)$/i);
      if (!match) return;
      const date = match[1].replace(/^\d{4}\s*年\s*/, '').replace(/^\d{4}[-/.]/, '').replace(/,?\s*\b\d{4}\b/, '').trim();
      const formatted = `${date}\n${match[2]}`;
      originals.set(element, { original: text, formatted });
      element.textContent = formatted;
    });
    }

    queueArrows();
  }
  const observer = new MutationObserver(records=>{
    const dirty=new Set();
    let removed=false;
    for(const record of records){
      const target=record.target.nodeType===1?record.target:record.target.parentElement;
      const message=target?.closest('.mes');
      if(message && message.parentElement===chat)dirty.add(message);
      for(const node of record.addedNodes || []){
        if(node.nodeType===1 && node.matches('.mes') && node.parentElement===chat)dirty.add(node);
      }
      if(record.removedNodes?.length)removed=true;
    }
    if(removed){
      for(const element of originals.keys())if(!chat.contains(element))originals.delete(element);
      if(editAnchor && !chat.contains(editAnchor.message))editAnchor=null;
      if(cancelledMessage && !chat.contains(cancelledMessage))cancelledMessage=null;
    }
    if(dirty.size)update(dirty);
  });
  observer.observe(chat, { childList: true, subtree: true, characterData: true });
  update();
  return () => {
    observer.disconnect();
    chat.querySelectorAll('.cwn-code-bar').forEach(bar=>bar.remove());
    doc.removeEventListener('click',closeAvatarOutside,true);
    avatarShade.remove();
    chat.removeEventListener('click',rememberEditAnchor,true);
    editAnchor=null;
    readingPositions = new WeakMap();
    chat.removeEventListener('click',rememberCancel,true);
    cancelledMessage=null;
    chat.removeEventListener('click',cycle,true);
    resize.disconnect();
    chat.removeEventListener('scroll', queueArrows);
    win.removeEventListener('resize', settleResize);
    win.clearTimeout(resizeTimer);
    win.cancelAnimationFrame(frame);
    chat.querySelectorAll('.mes').forEach(message => {message.style.removeProperty('--cwn-swipe-top');message.classList.remove('cwn-swipe-visible','cwn-has-candidates');});
    for (const [element, value] of originals) if (element.textContent === value.formatted) element.textContent = value.original;
    originals.clear();
  };
}
