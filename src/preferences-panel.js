const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const chevron = icon('m9 5 7 7-7 7');
export const preferenceRows = [
  ['chat', 'messageTimestampsEnabled', '消息时间', '在消息旁显示发送时间'],
  ['chat', 'messageTokensEnabled', 'Token 数量', '显示每条消息的 Token 数'],
  ['chat', 'messageTimerEnabled', '生成耗时', '显示回复生成所用时间'],
  ['chat', 'media_display', '附件显示', ''],
  ['input', 'send_on_enter', '回车发送', '选择 Enter 键的发送行为'],
  ['input', 'play_message_sound', '消息提示音', '回复完成时播放提示音'],
  ['input', 'gestures-checkbox', '滑动切换回复', '在手机上使用原版回复滑动手势'],
  ['advanced', 'mesIDDisplayEnabled', '消息编号', ''],
  ['advanced', 'auto_fix_generated_markdown', '自动修复 Markdown', ''],
  ['advanced', 'auto_scroll_chat_to_bottom', '自动滚动到底部', ''],
];

export function mountPreferencesPanel(doc, win, settings, save) {
  const drawer = doc.getElementById('user-settings-block');
  if (!drawer) return () => {};
  const abort = new win.AbortController();
  const restore = [];
  const move = (node, target) => {
    if (!node || !target) return;
    const marker = doc.createComment('cwn-preference-position');
    node.before(marker);
    target.append(node);
    restore.push(() => marker.replaceWith(node));
  };
  const root = doc.createElement('div');
  root.id = 'cwn-preferences-panel';
  root.innerHTML = `<nav class="cf-nav"><button type="button" class="cf-icon" data-back aria-label="返回侧边栏">${icon('m15 5-7 7 7 7')}</button></nav>
    <div class="cf-scroll"><h1 class="cwn-type-title">偏好</h1>
    <section class="cf-group"><h2 class="cwn-type-section">外观</h2>
      <div class="cf-label">界面模式</div><div class="cf-segment" role="group" aria-label="界面模式">
        <button type="button" data-mode="light">${icon('M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0')}日间</button>
        <button type="button" data-mode="dark">${icon('M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z')}夜间</button>
        <button type="button" data-mode="system">${icon('M3 4h18v13H3zM8 21h8m-4-4v4')}系统</button></div>
      <div class="cf-sample"><small>阅读效果</small><p>窗外的风掠过书页，午后的光停在桌角。<br>「今天，想从哪里开始？」</p></div>
      <div class="cf-row"><label for="cwn-reading-size">正文字号</label><div class="cf-range"><input id="cwn-reading-size" type="range" min="13" max="22" step="1"><output for="cwn-reading-size"></output></div></div>
      <div class="cf-row" data-language><label for="ui_language_select">界面语言</label></div>
    </section>
    <section class="cf-group" data-group="chat"><h2 class="cwn-type-section">聊天显示</h2></section>
    <section class="cf-group" data-group="input"><h2 class="cwn-type-section">输入与交互</h2></section>
    <section class="cf-more"><h2 class="cwn-type-section">更多设置</h2>
      <details><summary>${icon('M4 5h16M4 12h16M4 19h16M8 3v4m8 3v4M9 17v4')}<span><strong>高级显示</strong><small>消息编号、格式与渲染</small></span>${chevron}</summary><div data-group="advanced"></div></details>
      <details data-account><summary>${icon('M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2')}<span><strong>账户</strong><small>账户管理与登录状态</small></span>${chevron}</summary><div class="cf-account"></div></details>
    </section></div>`;
  for (const [group, id, label, hint] of preferenceRows) {
    const control = doc.getElementById(id);
    if (!control) continue;
    const row = doc.createElement('div');
    row.className = 'cf-row';
    row.innerHTML = `<div><label for="${id}">${label}</label>${hint ? `<small>${hint}</small>` : ''}</div>`;
    root.querySelector(`[data-group="${group}"]`).append(row);
    move(control, row);
  }
  const language = doc.getElementById('ui_language_select');
  if (language) move(language, root.querySelector('[data-language]'));
  else root.querySelector('[data-language]').hidden = true;
  const account = doc.getElementById('account_controls');
  if (account) move(account, root.querySelector('.cf-account'));
  else root.querySelector('[data-account]').hidden = true;
  drawer.append(root);
  drawer.classList.add('cwn-preferences-mounted');
  const html = doc.documentElement;
  const previousSize = html.style.getPropertyValue('--cwn-reading-size');
  const previousPriority = html.style.getPropertyPriority('--cwn-reading-size');
  const slider = root.querySelector('#cwn-reading-size');
  function paintSize() {
    const value = Math.min(22, Math.max(13, Number(settings.readingFontSize) || 15));
    slider.value = String(value);
    slider.style.setProperty('--cf-range-progress', `${(value - 13) / 9 * 100}%`);
    root.querySelector('output').textContent = `${value} px`;
    html.style.setProperty('--cwn-reading-size', `${value}px`);
  }
  slider.addEventListener('input', () => {
    settings.readingFontSize = Number(slider.value);
    paintSize();
    save();
  }, { signal: abort.signal });
  function paintMode() {
    let mode = 'light';
    try { mode = win.localStorage.getItem('claude-theme-next.appearance') || mode; } catch {}
    root.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  }
  root.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) drawer.querySelector('.cwn-panel-back')?.click();
    const button = event.target.closest('[data-mode]');
    if (button) doc.dispatchEvent(new win.CustomEvent('cwn-appearance-change', { detail: button.dataset.mode }));
  }, { signal: abort.signal });
  doc.addEventListener('cwn-appearance-change', paintMode, { signal: abort.signal });
  win.addEventListener('storage', paintMode, { signal: abort.signal });
  paintMode();
  paintSize();
  return () => {
    abort.abort();
    for (const undo of restore.reverse()) undo();
    root.remove();
    drawer.classList.remove('cwn-preferences-mounted');
    if (previousSize) html.style.setProperty('--cwn-reading-size', previousSize, previousPriority);
    else html.style.removeProperty('--cwn-reading-size');
  };
}
