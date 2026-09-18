import { mountRailResize } from './rail-resize.js';
import { MOBILE_BREAKPOINT, visibleShellHeight } from './viewport.js';
import { mountNavigation } from './navigation.js';

export function mountShell(doc, win, toggleDrawer) {
  const chatShell = doc.getElementById('sheld');
  const rail = doc.getElementById('top-settings-holder');
  if (!chatShell || !rail) throw new Error('Claude Theme Next requires the SillyTavern 1.18 chat shell.');
  const abort = new AbortController();
  const listen = (node, type, fn) => node?.addEventListener(type, fn, { signal: abort.signal });
  const media = win.matchMedia(`(max-width:${MOBILE_BREAKPOINT}px)`);
  const root = doc.documentElement;
  let raf = 0;
  let disposed = false;
  // Normalize only the shell boundary, never message bodies or native controls.
  // A placeholder makes teardown return the exact original DOM position.
  const placeholder = doc.createComment('Claude Theme Next: original chat shell position');
  const moved = chatShell.parentElement !== doc.body;
  if (moved) {
    chatShell.before(placeholder);
    doc.body.append(chatShell);
  }
  const originalHeight = chatShell.style.getPropertyValue('--cwn-visible-height');
  const originalPriority = chatShell.style.getPropertyPriority('--cwn-visible-height');
  const menu = doc.createElement('button');
  menu.id = 'cwn-menu';
  menu.type = 'button';
  for (let i=0;i<3;i++) menu.append(doc.createElement('span'));
  menu.setAttribute('aria-label', '打开导航');
  menu.setAttribute('aria-controls', 'top-settings-holder');
  const backdrop = doc.createElement('button');
  backdrop.id = 'cwn-backdrop';
  backdrop.type = 'button';
  backdrop.setAttribute('aria-label', '关闭导航');
  const brand = doc.createElement('div');
  brand.id = 'cwn-brand';
  brand.textContent = 'Claude';
  rail.prepend(brand);
  const railIcon=doc.createElement('button');
  railIcon.type='button';
  railIcon.id='cwn-desktop-rail-icon';
  railIcon.setAttribute('aria-label','收起侧边栏');
  railIcon.setAttribute('aria-expanded','true');
  railIcon.setAttribute('aria-controls','top-settings-holder');
  railIcon.innerHTML='<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2.5"></rect><path d="M9 4v16"></path></svg>';
  doc.body.append(railIcon);
  const previousRailInert=rail.inert;
  let railHidden=false, railMotion=null;
  function syncRailToggle(){
    const hidden=railHidden&&!media.matches;
    root.classList.toggle('cwn-rail-hidden',hidden);
    railIcon.setAttribute('aria-expanded',String(!hidden));
    railIcon.setAttribute('aria-label',hidden?'展开侧边栏':'收起侧边栏');
    railIcon.title=hidden?'展开侧边栏':'收起侧边栏';
    if(!media.matches)rail.inert=hidden || previousRailInert;

  }
  listen(railIcon,'click',()=>{
    // Commit layout once; fade without transforming fixed-position descendants.

    railMotion?.cancel();
    railHidden=!railHidden;syncRailToggle();

    if(!win.matchMedia('(prefers-reduced-motion:reduce)').matches && !media.matches){

      railMotion=chatShell.animate([
        {opacity:.92},{opacity:1}
      ],{duration:240,easing:'cubic-bezier(.22,.61,.36,1)'});
    }
  });
  listen(media,'change',syncRailToggle);
  const labels = [];
  const navNames = {'ai-config-button':'预设','sys-settings-button':'API 连接','advanced-formatting-button':'格式化','WI-SP-button':'世界书','user-settings-button':'偏好','logo_block':'背景','backgrounds-button':'背景','extensions-settings-button':'扩展','persona-management-button':'用户设定','rightNavHolder':'角色卡'};
  for (const toggle of rail.querySelectorAll(':scope > .drawer > .drawer-toggle')) {
    const icon = toggle.querySelector('.drawer-icon');
    const title = icon?.getAttribute('title') || toggle.getAttribute('title');
    if (!title) continue;
    const label = doc.createElement('span');
    label.className = 'cwn-nav-label';
    label.textContent = navNames[toggle.parentElement.id] || title;
    toggle.append(label);
    labels.push(label);
  }
  doc.body.append(menu, backdrop);
  const pane = doc.createElement('div');
  pane.className = 'cwn-nav-pane';
  const drawerSlots = [];
  for (const drawer of rail.querySelectorAll(':scope > .drawer')) {
    const slot = doc.createComment('original drawer position');
    drawer.before(slot); drawerSlots.push([drawer,slot]); pane.append(drawer);
  }
  rail.append(pane);
  const disposeRailResize = mountRailResize(doc, win, rail, media);
  const disposeNavigation = mountNavigation({doc, win, rail, chatShell, menu, backdrop, media, toggleDrawer});
  function measure() {
    raf = 0;
    if (disposed) return;
    const height = visibleShellHeight({mobile:media.matches,
      focused:chatShell.contains(doc.activeElement) && doc.activeElement?.matches('textarea,input,[contenteditable="true"]'),
      innerHeight:win.innerHeight, viewportHeight:win.visualViewport?.height, scale:win.visualViewport?.scale ?? 1});
    const value = height === null ? '' : `${height}px`;
    if (chatShell.style.getPropertyValue('--cwn-visible-height') === value) return;
    if (value) chatShell.style.setProperty('--cwn-visible-height', value);
    else chatShell.style.removeProperty('--cwn-visible-height');
  }
  function queueMeasure() {
    if (!raf && !disposed) raf = win.requestAnimationFrame(measure);
  }
  listen(media, 'change', queueMeasure);
  listen(win.visualViewport, 'resize', queueMeasure);
  listen(win, 'resize', queueMeasure);
  listen(chatShell, 'focusin', queueMeasure);
  listen(chatShell, 'focusout', queueMeasure);
  root.classList.add('cwn-active');
  queueMeasure();
  return () => {
    if (disposed) return;
    disposed = true;
    railMotion?.cancel();
    abort.abort();
    disposeRailResize();
    disposeNavigation();
    if (raf) win.cancelAnimationFrame(raf);
    root.classList.remove('cwn-active', 'cwn-menu-open', 'cwn-rail-hidden');
    menu.remove(); backdrop.remove(); brand.remove(); railIcon.remove();
    labels.forEach(label => label.remove());
    for (const [drawer,slot] of drawerSlots) slot.replaceWith(drawer);
    pane.remove();
    if (originalHeight) chatShell.style.setProperty('--cwn-visible-height', originalHeight, originalPriority);
    else chatShell.style.removeProperty('--cwn-visible-height');
    if (moved && placeholder.isConnected) placeholder.replaceWith(chatShell);
  };
}
