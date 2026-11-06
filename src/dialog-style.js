// Native confirm / input popups share the theme's dialog appearance.
// Wide, large, transparent and editor popups keep their own layouts.
const SKIP = ['wide_dialogue_popup', 'wider_dialogue_popup', 'large_dialogue_popup', 'transparent_dialogue_popup', 'ce-inline-regex-editor'];

/** Whether a native popup should take the shared theme dialog style. */
export function usesThemeDialog(popup, types) {
  if (![types.CONFIRM, types.INPUT].includes(popup?.type)) return false;
  return !SKIP.some(name => popup.dlg?.classList.contains(name));
}

let pending = null;
/**
 * Label the next native confirm opened by a theme action (e.g. a host button
 * the theme clicks). Native popups without a heading receive the given title.
 */
export function labelNextDialog({ title, cancel, within = 1500 }) {
  pending = { title, cancel, until: Date.now() + within };
}

/** Apply a pending label to a popup's DOM; returns whether it was used. */
export function applyDialogLabel(popup, doc, now = Date.now()) {
  const label = pending;
  if (!label) return false;
  pending = null;
  if (now > label.until) return false;
  const content = popup.content || popup.dlg?.querySelector('.popup-content');
  if (label.title && content && !content.querySelector('h1,h2,h3,h4')) {
    const heading = doc.createElement('h3');
    heading.textContent = label.title;
    content.prepend(heading);
  }
  if (label.cancel && popup.cancelButton) {
    popup.cancelButton.textContent = label.cancel;
    popup.cancelButton.dataset.i18n = label.cancel;
  }
  return true;
}

export function mountDialogStyle({ Popup, POPUP_TYPE, doc = globalThis.document }) {
  const original = Popup.prototype.show;
  let active = true;
  function show(...args) {
    if (active && usesThemeDialog(this, POPUP_TYPE)) {
      this.dlg.classList.add('cwn-character-dialog', 'cwn-native-dialog');
      if (this.type === POPUP_TYPE.CONFIRM) applyDialogLabel(this, doc);
    }
    return original.apply(this, args);
  }
  Popup.prototype.show = show;
  return () => {
    active = false;
    pending = null;
    if (Popup.prototype.show === show) Popup.prototype.show = original;
  };
}
