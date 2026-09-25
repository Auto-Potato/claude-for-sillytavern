// Only augment the native first-use embedded lore confirmation, not other imports.
export function mountEmbeddedWorldOption({ Popup, confirmType, affirmative, getCharacter, importWorld, doc, onError }) {
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
    label.className = 'cwn-bind-world-option';
    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = true;
    const caption = doc.createElement('span');
    caption.textContent = '同时绑定到此角色';
    label.append(checkbox, caption);
    this.content.append(label);
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
