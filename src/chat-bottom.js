// A viewport overlay, independent of message/iframe transforms and scroll height.
export function mountChatBottom(doc, win) {
  const chat = doc.getElementById('chat');
  if (!chat) return () => {};
  const composer = doc.getElementById('form_sheld');
  const button = doc.createElement('button');
  button.id = 'cwn-chat-bottom';
  button.type = 'button';
  button.hidden = true;
  button.title = '回到底部';
  button.setAttribute('aria-label', '回到底部');
  button.setAttribute('aria-controls', 'chat');
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6"/></svg>';
  doc.body.append(button);
  let frame = 0;
  function render() {
    frame = 0;
    const rect = chat.getBoundingClientRect();
    const viewport = win.visualViewport;
    const top = viewport?.offsetTop || 0;
    const bottom = top + (viewport?.height || win.innerHeight);
    const composerRect = composer?.getBoundingClientRect();
    const edge = Math.min(rect.bottom, bottom, composerRect?.height ? composerRect.top : bottom);
    const away = chat.scrollHeight - chat.clientHeight - chat.scrollTop > 12;
    button.hidden = !away || !rect.width || edge - Math.max(rect.top, top) < 64;
    if (button.hidden) return;
    button.style.left = `${Math.max(rect.left + 12, Math.min(rect.right, win.innerWidth) - 56)}px`;
    button.style.top = `${edge - 56}px`;
  }
  const queue = () => { if (!frame) frame = win.requestAnimationFrame(render); };
  const abort = new win.AbortController();
  button.addEventListener('click', () => {
    chat.scrollTo({ top: chat.scrollHeight, behavior: win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, { signal: abort.signal });
  chat.addEventListener('scroll', queue, { passive: true, signal: abort.signal });
  win.addEventListener('resize', queue, { signal: abort.signal });
  win.visualViewport?.addEventListener('resize', queue, { signal: abort.signal });
  win.visualViewport?.addEventListener('scroll', queue, { signal: abort.signal });
  const resize = new win.ResizeObserver(queue);
  resize.observe(chat);
  if (composer) resize.observe(composer);
  const children = new Set();
  function syncChildren() {
    for (const node of children) if (node.parentElement !== chat) { resize.unobserve(node); children.delete(node); }
    for (const node of chat.children) if (!children.has(node)) { children.add(node); resize.observe(node); }
    queue();
  }
  const observer = new win.MutationObserver(syncChildren);
  observer.observe(chat, { childList: true });
  syncChildren();
  return () => {
    abort.abort();observer.disconnect();resize.disconnect();children.clear();
    win.cancelAnimationFrame(frame);button.remove();
  };
}
