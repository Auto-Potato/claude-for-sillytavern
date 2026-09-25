import { mountBrowserNavigation } from './src/browser-navigation.js';
import { mountSiteIcons } from './src/site-icons.js';
import { mountToasts } from './src/toasts.js';
import { eventSource, event_types, doNavbarIconClick, saveSettingsDebounced, processDroppedFiles } from '../../../../script.js';
import { mountCharacterImport } from './src/character-import.js';
import { mountCharacterLibrary } from './src/character-library.js';
import { mountEmbeddedWorldOption, persistWorldBinding } from './src/embedded-world-option.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../popup.js';
import { characters, getRequestHeaders } from '../../../../script.js';
import { convertCharacterBook, updateWorldInfoList, worldInfoCache, world_names } from '../../../world-info.js';
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
  const disposeImport = mountCharacterImport(document, window, processDroppedFiles);
  const disposeLibrary = mountCharacterLibrary(document, window, host);
  const disposeWorldOption = mountEmbeddedWorldOption({
    Popup, confirmType: POPUP_TYPE.CONFIRM, affirmative: POPUP_RESULT.AFFIRMATIVE, doc: document,
    getCharacter: () => characters[window.jQuery('#import_character_info').data('chid')],
    onError: message => window.toastr.error(message),
    hasWorld: name => world_names.includes(name),
    importWorld: async (character, bind) => {
      const name = character.data.character_book.name || `${character.name}'s Lorebook`;
      const data = convertCharacterBook(character.data.character_book);
      const response = await fetch('/api/worldinfo/edit', {
        method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({name, data}),
      });
      if (!response.ok) throw new Error(`World import failed: ${response.status}`);
      worldInfoCache.set(name, data);
      await updateWorldInfoList();
      await eventSource.emit(event_types.WORLDINFO_UPDATED, name, data);
      if (bind) {
        await persistWorldBinding((url, body) => fetch(url, {method:'POST',headers:getRequestHeaders(),body:JSON.stringify(body)}), character.avatar, name);
        const current = characters.find(item => item.avatar === character.avatar);
        if (current) { current.data ??= {}; current.data.extensions ??= {}; current.data.extensions.world = name; }
        if (characters[window.jQuery('#set_character_world').data('chid')]?.avatar === character.avatar) {
          window.jQuery('#character_world').val(name);
          window.jQuery('#set_character_world, #world_button').addClass('world_set');
        }
      }
      window.toastr.success(bind ? '世界书已导入并绑定到此角色' : '世界书已导入，角色绑定保持不变');
    },
  });
  const disposeBrowserNavigation = mountBrowserNavigation(document, window);
  startToasts();
  dispose = () => { disposeBrowserNavigation(); disposeWorldOption(); disposeLibrary(); disposeImport(); disposeIcons(); stopToasts(); disposeMessages(); disposeComposer(); disposeAppearance(); disposeHome(); disposeShell(); };
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
