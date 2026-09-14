// Native drawer actions keep SillyTavern's icon, pin and widget state in sync.
export function mountNavigation({ doc, win, rail, chatShell, menu, backdrop, media, toggleDrawer }) {
  const abort = new win.AbortController();
  const root = doc.documentElement;
  const savedInert = [rail.inert, chatShell.inert];
  let open = false;
  let disposed = false;
  const drawers = [...rail.querySelectorAll(':scope > .drawer, :scope > .cwn-nav-pane > .drawer')].map(drawer => ({
    panel: drawer.querySelector(':scope > .drawer-content'),
    toggle: drawer.querySelector(':scope > .drawer-toggle'),
  })).filter(({panel, toggle}) => panel && toggle);
  const listen = (node, type, fn) => node.addEventListener(type, fn, { signal: abort.signal });
  const isOpen = ({panel}) => panel.classList.contains('openDrawer');
  function render() {
    const mobileOpen = media.matches && open;
    root.classList.toggle('cwn-menu-open', mobileOpen);
    menu.setAttribute('aria-expanded', String(mobileOpen));
    menu.setAttribute('aria-label', mobileOpen ? '关闭导航' : '打开导航');
    rail.inert = savedInert[0] || (media.matches && !open);
    chatShell.inert = savedInert[1] || mobileOpen;
  }
  function closePanels() {
    for (const entry of drawers.filter(isOpen)) toggleDrawer(entry.toggle);
  }
  function dismiss() {
    closePanels();
    open = false;
    render();
    if (media.matches) menu.focus();
  }
  const additions = [];
  for (const entry of drawers) {
    const header = doc.createElement('div');
    header.className = 'cwn-panel-actions';
    const back = doc.createElement('button');
    back.type = 'button';
    back.className = 'cwn-panel-back';
    back.textContent = '← 返回导航';
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = '关闭面板';
    header.append(back, close);
    entry.panel.prepend(header);
    additions.push(header);
    listen(back, 'click', event => {
      event.stopPropagation();
      closePanels();
      open = true;
      render();
      const returnTarget = entry.toggle.parentElement.id === 'persona-management-button'
        ? doc.getElementById('cwn-profile-identity') : entry.toggle.querySelector('.drawer-icon');
      returnTarget?.focus();
    });
    listen(close, 'click', event => {
      event.stopPropagation();
      dismiss();
      if (!media.matches) {
        const returnTarget = entry.toggle.parentElement.id === 'persona-management-button'
          ? doc.getElementById('cwn-profile-identity') : entry.toggle.querySelector('.drawer-icon');
        returnTarget?.focus();
      }
    });
  }
  // Observe only the nine native panel class attributes, never their contents.
  // This also catches native shortcut buttons and asynchronously opened drawers.
  const observer = new win.MutationObserver(records => {
    if (disposed) return;
    if (media.matches && records.some(record =>
      !record.oldValue?.split(/\s+/).includes('openDrawer') && record.target.classList.contains('openDrawer'))) {
      open = true;
    }
    render();
  });
  for (const {panel} of drawers) observer.observe(panel, { attributes:true, attributeFilter:['class'], attributeOldValue:true });
  listen(menu, 'click', event => {
    event.stopPropagation();
    if (open) dismiss();
    else { open = true; render(); }
  });
  listen(backdrop, 'click', event => { event.stopPropagation(); dismiss(); });
  listen(doc, 'keydown', event => {
    // Let native dialogs, Select2 and editors consume Escape first.
    if (event.defaultPrevented || event.key !== 'Escape' || !media.matches || !open) return;
    if (doc.querySelector('dialog[open], .select2-container--open')) return;
    event.preventDefault();
    if (drawers.some(isOpen)) { closePanels(); menu.focus(); }
    else dismiss();
  });
  listen(media, 'change', () => {
    open = media.matches && drawers.some(isOpen);
    render();
    if (media.matches && rail.inert && rail.contains(doc.activeElement)) menu.focus();
  });
  open = media.matches && drawers.some(isOpen);
  render();
  return () => {
    disposed = true;
    abort.abort();
    observer.disconnect();
    additions.forEach(node => node.remove());
    root.classList.remove('cwn-menu-open');
    [rail.inert, chatShell.inert] = savedInert;
  };
}

