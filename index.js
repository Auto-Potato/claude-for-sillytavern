import { eventSource, event_types, doNavbarIconClick } from '../../../../script.js';
import { mountShell } from './src/shell.js';
import { mountHome } from './src/home.js';
import { host } from './src/host.js';
import { mountAppearance } from './src/appearance.js';
import { mountComposer } from './src/composer.js';
import { mountMessages } from './src/messages.js';

// The host initializes its widgets first. No polling, DOM-wide observer or reload.
let dispose;
function start() {
  dispose?.();
  const disposeShell = mountShell(document, window, toggle => doNavbarIconClick.call(toggle));
  const disposeHome = mountHome(document, window, host);
  const disposeAppearance = mountAppearance(document, window);
  const disposeComposer = mountComposer(document, host);
  const disposeMessages = mountMessages(document);
  dispose = () => { disposeMessages(); disposeComposer(); disposeAppearance(); disposeHome(); disposeShell(); };
}
eventSource.once(event_types.APP_READY, start);
window.addEventListener('pagehide', event => {
  if (!event.persisted) dispose?.();
});
