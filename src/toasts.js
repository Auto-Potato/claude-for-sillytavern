// Compact notifications across all four severity levels.
export function mountToasts(win) {
  const api = win.toastr;
  if (!api) return () => {};
  const doc = win.document;
  const promoted = new Set();
  function raiseToasts() {
    for (const previous of promoted) {
      if (!previous.isConnected) { previous.removeAttribute('popover'); promoted.delete(previous); }
    }
    const container = doc.getElementById('toast-container');
    if (!container?.children.length || !container.showPopover) return;
    if (!container.hasAttribute('popover')) {
      container.setAttribute('popover', 'manual');
      promoted.add(container);
    }
    try {
      if (container.matches(':popover-open')) container.hidePopover();
      container.showPopover();
    } catch { /* Detached containers are removed by Toastr after fading out. */ }
  }
  function onToggle(event) {
    if (event.target.id !== 'toast-container' && event.newState === 'open') raiseToasts();
  }
  doc.addEventListener('toggle', onToggle, true);
  // Adopt notifications that were emitted before extension initialization.
  const pendingTimers=[];
  for(const toast of doc.querySelectorAll?.('#toast-container > .toast') || []) {
    const title=toast.querySelector('.toast-title');
    if(title?.textContent.trim())toast.querySelector('.toast-message')?.replaceChildren();
    pendingTimers.push(win.setTimeout(()=>{
      if(win.jQuery && api.clear)api.clear(win.jQuery(toast),{force:true});
    },1000));
  }
  raiseToasts();
  const originals = new Map();
  const wrappers = new Map();
  for (const kind of ['success', 'info', 'warning', 'error']) {
    const original = api[kind];
    originals.set(kind, original);
    const wrapper = function(message, title, options) {
      const result = original.call(this, title ? '' : message, title, {
        ...options, timeOut: 1000, extendedTimeOut: 0,
        showDuration: 120, hideDuration: 150, closeButton: false,
      });
      raiseToasts();
      return result;
    };
    wrappers.set(kind, wrapper);
    api[kind] = wrapper;
  }
  return () => {
    for(const timer of pendingTimers)win.clearTimeout(timer);
    doc.removeEventListener('toggle', onToggle, true);
    for (const container of promoted) {
      if (container.matches(':popover-open')) container.hidePopover();
      container.removeAttribute('popover');
    }
    promoted.clear();
    for (const [kind, original] of originals) {
      if (api[kind] === wrappers.get(kind)) api[kind] = original;
    }
  };
}