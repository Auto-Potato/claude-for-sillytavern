// Only augment the native first-use embedded lore confirmation, not other imports.
export function mountEmbeddedWorldOption({ Popup, confirmType, affirmative, getCharacter, importWorld, doc, onError, hasWorld = () => false }) {
  const original = Popup.prototype.show;
  let active = true;
  async function show(...args) {
    const text = this.content?.textContent || '';
    if (!active || this.type !== confirmType ||
        !text.includes('This character has an embedded World/Lorebook.') ||
        !text.includes('Would you like to import it now?')) return original.apply(this, args);
    const character = getCharacter();
    if (!character?.data?.character_book) return original.apply(this, args);
    const snapshot = structuredClone(character);
    const label = doc.createElement('label');
    label.className = 'cwn-resource-bind';
    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = true;
    const caption = doc.createElement('span');
    caption.textContent = '同时绑定到此角色';
    label.append(checkbox, caption);
    const name = snapshot.data.character_book.name || `${snapshot.name}'s Lorebook`;
    const heading = doc.createElement('h3');heading.textContent = '导入角色世界书';
    const note = doc.createElement('p');note.textContent = hasWorld(name) ? '导入将覆盖同名世界书。' : '此角色卡附带以下世界书。';
    const resource = doc.createElement('div');resource.className = 'cwn-resource-card';
    const symbol = doc.createElement('span');symbol.className = 'cwn-resource-symbol';
    symbol.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15"/></svg>';
    const title = doc.createElement('span');title.textContent = name;resource.append(symbol, title);
    this.content.replaceChildren(heading, note, resource, label);
    this.dlg.classList.add('cwn-character-dialog', 'cwn-resource-dialog');
    this.okButton.textContent = '导入';this.cancelButton.textContent = '取消';
    const result = await original.apply(this, args);
    label.remove();
    if (result !== affirmative) return result;
    if (getCharacter()?.avatar !== snapshot.avatar) {
      onError('角色已切换，请重新打开该角色后导入世界书');
      return 0;
    }
    try { await importWorld(snapshot, checkbox.checked); }
    catch (error) { console.error('[Claude theme] Embedded lore import failed', error); onError('导入或绑定未完成，请检查后重试'); }
    // The native caller must not run its automatic import-and-bind branch again.
    return 0;
  }
  Popup.prototype.show = show;
  return () => { active = false; if (Popup.prototype.show === show) Popup.prototype.show = original; };
}

// Persist by avatar identity and verify server data, independent of hidden form events.
export async function persistWorldBinding(request, avatar, name) {
  const saved = await request('/api/characters/merge-attributes', {avatar, data:{extensions:{world:name}}});
  if (!saved.ok) throw new Error(`Character binding failed: ${saved.status}`);
  const loaded = await request('/api/characters/get', {avatar_url:avatar});
  if (!loaded.ok) throw new Error(`Character verification failed: ${loaded.status}`);
  const character = await loaded.json();
  if (character.data?.extensions?.world !== name) throw new Error('Character world binding was not persisted');
  return character;
}
