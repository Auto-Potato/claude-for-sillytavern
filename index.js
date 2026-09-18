import { mountSiteIcons } from './src/site-icons.js';
import { mountToasts } from './src/toasts.js';
import { eventSource, event_types, doNavbarIconClick, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { mountShell } from './src/shell.js';
import { mountHome } from './src/home.js';
import { host } from './src/host.js';
import { mountAppearance } from './src/appearance.js';
import { mountComposer } from './src/composer.js';
import { mountMessages } from './src/messages.js';

// The host initializes its widgets first. No polling, DOM-wide observer or reload.
let dispose;
let disposeToasts;
function startToasts() {
  if (!disposeToasts) {
    document.documentElement.classList.add('cwn-toasts-active');
    disposeToasts = mountToasts(window);
  }
}
function stopToasts() {
  disposeToasts?.();disposeToasts=undefined;
  document.documentElement.classList.remove('cwn-toasts-active');
}
if (extension_settings.claude_for_sillytavern?.enabled !== false) startToasts();
function start() {
  dispose?.();
  const disposeIcons = mountSiteIcons(document);
  const disposeShell = mountShell(document, window, toggle => doNavbarIconClick.call(toggle));
  const disposeHome = mountHome(document, window, host);
  const disposeAppearance = mountAppearance(document, window);
  const disposeComposer = mountComposer(document, host);
  const disposeMessages = mountMessages(document, host);
  startToasts();
  dispose = () => { disposeIcons(); stopToasts(); disposeMessages(); disposeComposer(); disposeAppearance(); disposeHome(); disposeShell(); };
}
eventSource.once(event_types.APP_READY, () => {
  const settings = extension_settings.claude_for_sillytavern ??= { enabled: true };
  const container = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
  if (container && !document.getElementById('cwn-extension-settings')) {
    const panel = document.createElement('div');
    panel.id = 'cwn-extension-settings';
    panel.className = 'extension_container';
    panel.innerHTML = `<div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header"><b>Claude for SillyTavern</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
      <div class="inline-drawer-content"><label class="checkbox_label" for="cwn-enabled"><input id="cwn-enabled" type="checkbox"><span>启用 Claude for SillyTavern</span></label></div>
    </div>`;
    container.append(panel);
    const checkbox = panel.querySelector('#cwn-enabled');
    checkbox.checked = settings.enabled !== false;
    checkbox.addEventListener('change', () => {
      settings.enabled = checkbox.checked;
      if (settings.enabled) start();
      else { dispose?.(); dispose = undefined; }
      saveSettingsDebounced();
    });
  }
  if (settings.enabled !== false) start();
});
window.addEventListener('pagehide', event => {
  if (!event.persisted) dispose?.();
});
