import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../popup.js';
import { convertCharacterBook, updateWorldInfoList, world_names, worldInfoCache } from '../../../../world-info.js';
import { allowScopedScripts, isScopedScriptsAllowed, RegexProvider } from '../../../../extensions/regex/engine.js';
import { getRequestHeaders, eventSource, event_types } from '../../../../../script.js';

export function embeddedResources(card) {
  const extensions = card.data?.extensions || {};
  const helper = Array.isArray(extensions.tavern_helper) ? Object.fromEntries(extensions.tavern_helper) : extensions.tavern_helper;
  return {
    world: card.data?.character_book?.entries?.length > 0,
    regex: Array.isArray(extensions.regex_scripts) && extensions.regex_scripts.length > 0,
    scripts: (helper?.scripts ?? extensions.TavernHelper_scripts ?? []).length > 0,
  };
}

// Helper owns a reactive enablement store; writing extension_settings directly
// would be overwritten by its next save. Keep this optional integration isolated.
function helperStore(doc) {
  const store = doc.getElementById('tavern_helper')?.__vue_app__?.config.globalProperties.$pinia?._s?.get('global_settings');
  return Array.isArray(store?.settings?.script?.enabled?.characters) ? store : null;
}

export async function importCharacterResources(card, { doc, win, bind }) {
  const resources = embeddedResources(card);
  let offered = 0;
  const ask = async (content, action = '导入') => {
    const popup = new Popup(content, POPUP_TYPE.CONFIRM, '', { okButton: action, cancelButton: '取消' });
    popup.dlg.classList.add('cwn-character-dialog', 'cwn-resource-dialog');
    return await popup.show() === POPUP_RESULT.AFFIRMATIVE;
  };
  const content = (title, note, resource) => {
    const box = doc.createElement('div');box.className = 'cwn-resource-content';
    const heading = doc.createElement('h3');heading.textContent = title;box.append(heading);
    if (note) { const p = doc.createElement('p');p.textContent = note;box.append(p); }
    if (resource) {
      const row = doc.createElement('div');row.className = 'cwn-resource-card';
      const symbol = doc.createElement('span');symbol.className = 'cwn-resource-symbol';symbol.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${title.includes('世界书') ? 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15' : title.includes('正则') ? 'M5 7h14M5 12h10M5 17h6' : 'm8 5-6 7 6 7m8-14 6 7-6 7'}"/></svg>`;
      const name = doc.createElement('span');name.textContent = resource;
      row.append(symbol, name);box.append(row);
    }
    return box;
  };
  if (resources.world) {
    offered++;
    await updateWorldInfoList();
    const name = card.data.character_book.name || `${card.name}'s Lorebook`;
    const box = content('导入角色世界书', world_names.includes(name) ? '导入将覆盖同名世界书。' : '此角色卡附带以下世界书。', name);
    const label = doc.createElement('label');label.className = 'cwn-resource-bind';
    const checkbox = doc.createElement('input');checkbox.type = 'checkbox';checkbox.checked = true;
    label.append(checkbox, doc.createTextNode('同时绑定到此角色'));box.append(label);
    if (await ask(box)) {
      const data = convertCharacterBook(card.data.character_book);
      const response = await fetch('/api/worldinfo/edit', {method:'POST',headers:getRequestHeaders(),body:JSON.stringify({name,data})});
      if (!response.ok) throw new Error('世界书导入失败，请重试');
      worldInfoCache.set(name, data);
      await updateWorldInfoList();
      await eventSource.emit(event_types.WORLDINFO_UPDATED, name, data);
      if (checkbox.checked) await bind(card.avatar, name);
      win.toastr.success(checkbox.checked ? '世界书已导入并绑定到此角色' : '世界书已导入');
    }
  }
  if (resources.regex && !isScopedScriptsAllowed(card)) {
    offered++;
    if (await ask(content('启用角色正则', '此角色卡附带以下正则，是否启用？', `${card.name} · ${card.data.extensions.regex_scripts.length} 条正则`), '启用')) {
      allowScopedScripts(card);
      RegexProvider.instance.clear();
      win.toastr.success('角色正则已启用');
    }
  }
  if (resources.scripts) {
    const store = helperStore(doc);
    if (!store) {
      offered++;
      win.toastr.warning('酒馆助手未就绪或版本不兼容，暂时无法启用角色脚本');
    } else if (!store.settings.script.enabled.characters.includes(card.name)) {
      offered++;
      // Same confirmation and name-based allowlist as Helper's character prompt.
      if (await ask(content('启用酒馆助手脚本', '此角色卡附带酒馆助手脚本，是否启用？', card.name), '启用')) {
        store.settings.script.enabled.characters.push(card.name);
        win.toastr.success('角色脚本已启用');
      }
    }
  }
  if (!offered) win.toastr.info(Object.values(resources).some(Boolean) ? '角色资源已经启用' : '这张角色卡没有附带可导入的资源');
}
