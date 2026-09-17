// One feedback slot: replace repeated notices and release finished animations.
export function createComposerNotice() {
  let active;
  function clear() {
    if (!active) return;
    const { element, animation } = active;
    active = undefined;
    animation.onfinish = null;
    animation.cancel();
    element.textContent = '';
  }
  function show(element, text) {
    clear();
    element.textContent = text;
    const reduced = element.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = element.animate([
      { opacity: 0, translate: reduced ? 'none' : '0 8px', offset: 0 },
      { opacity: 1, translate: '0 0', offset: 1 / 7 },
      { opacity: 1, translate: '0 0', offset: 6 / 7 },
      { opacity: 0, translate: reduced ? 'none' : '0 -8px', offset: 1 },
    ], { duration: 1400, easing: 'linear', fill: 'forwards' });
    active = { element, animation };
    animation.onfinish = () => { if (active?.animation === animation) clear(); };
  }
  return { show, clear };
}
