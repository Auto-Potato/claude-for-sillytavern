// Format only the native timestamp; preserve its model tooltip and message data.
export function mountMessages(doc) {
  const chat = doc.getElementById('chat');
  if (!chat) return () => {};
  const originals = new Map();
  const win = doc.defaultView;
  let frame = 0;
  function placeArrows() {
    frame = 0;
    if (win.innerWidth <= 700) return;
    const viewport = chat.getBoundingClientRect();
    chat.querySelectorAll(':scope > .mes[is_user="false"]').forEach(message => {
      const rect = message.getBoundingClientRect();
      const top = Math.max(rect.top, viewport.top), bottom = Math.min(rect.bottom, viewport.bottom);
      if (bottom > top) message.style.setProperty('--cwn-swipe-top', `${(top + bottom) / 2 - rect.top}px`);
    });
  }
  function queueArrows() { if (!frame) frame = win.requestAnimationFrame(placeArrows); }
  chat.addEventListener('scroll', queueArrows, { passive: true });
  win.addEventListener('resize', queueArrows);
  const resize = new ResizeObserver(queueArrows);
  resize.observe(chat);
  function update() {
    chat.querySelectorAll('.timestamp').forEach(element => {
      const text = element.textContent;
      if (originals.get(element)?.formatted === text) return;
      const match = text.trim().match(/^(.*?)\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)$/i);
      if (!match) return;
      const date = match[1].replace(/^\d{4}\s*年\s*/, '').replace(/^\d{4}[-/.]/, '').replace(/,?\s*\b\d{4}\b/, '').trim();
      const formatted = `${date}\n${match[2]}`;
      originals.set(element, { original: text, formatted });
      element.textContent = formatted;
    });
    for (const element of originals.keys()) if (!chat.contains(element)) originals.delete(element);
    queueArrows();
  }
  const observer = new MutationObserver(update);
  observer.observe(chat, { childList: true, subtree: true, characterData: true });
  update();
  return () => {
    observer.disconnect();
    resize.disconnect();
    chat.removeEventListener('scroll', queueArrows);
    win.removeEventListener('resize', queueArrows);
    win.cancelAnimationFrame(frame);
    chat.querySelectorAll('.mes').forEach(message => message.style.removeProperty('--cwn-swipe-top'));
    for (const [element, value] of originals) if (element.textContent === value.formatted) element.textContent = value.original;
    originals.clear();
  };
}
