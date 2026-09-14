export function createChatActions(st, group, storage, request = fetch) {
  const key = row => JSON.stringify([row.group || '', row.avatar || '', row.file]);
  const read = name => { try { return JSON.parse(storage.getItem(name) || '{}') || {}; } catch { return {}; } };
  const save = value => storage.setItem('cwn-chat-pins', JSON.stringify(value));
  function pins() {
    const result = new Map();
    for (const row of Object.values(read('pinnedChats'))) if (row?.file_name) {
      const item = {...row, file:row.file_name.replace(/\.jsonl$/, '')}; result.set(key(item), item);
    }
    for (const [id, row] of Object.entries(read('cwn-chat-pins'))) { if (row) result.set(id,row); else result.delete(id); }
    return result;
  }
  function resolve(row) {
    if (st.isGenerating() || st.isChatSaving) throw new Error('请等待生成和保存完成后再操作。');
    const entity = row.group ? group.groups.find(g=>String(g.id)===String(row.group)) : st.characters.find(c=>c.avatar===row.avatar);
    if (!entity) throw new Error('角色或群聊已不存在，请刷新。');
    return {entity, characterId:st.characters.indexOf(entity), groupId:row.group ? entity.id : undefined};
  }
  async function exists(row) {
    const response=await request('/api/chats/recent',{method:'POST',headers:st.getRequestHeaders(),body:JSON.stringify({pinned:[{avatar:row.avatar,group:row.group,file_name:row.file+'.jsonl'}],max:0})});
    if(!response.ok)throw new Error('无法核实聊天状态，请刷新后重试。');
    const data=await response.json();
    if(!Array.isArray(data))throw new Error('聊天状态返回异常。');
    return data.some(r=>r.file_name===row.file+'.jsonl' && (row.group ? String(r.group)===String(row.group) : r.avatar===row.avatar));
  }
  return {
    pins,
    async pin(row) { resolve(row); if(!await exists(row))throw new Error('聊天已不存在。'); const values=read('cwn-chat-pins');values[key(row)]=pins().has(key(row))?null:row;save(values); },
    isPinned: row => pins().has(key(row)),
    async rename(row, value) {
      const name=value.trim();
      if(!name || name.length>120 || /[\\/:*?"<>|\x00-\x1f]/.test(name) || /[. ]$/.test(name))throw new Error('请输入 1–120 个字符的名称，不含文件名禁用字符。');
      if(name===row.file)return;
      const context=resolve(row), next={...row,file:name};
      if(!await exists(row))throw new Error('聊天已不存在。');
      if(await exists(next))throw new Error('该名称已存在，请换一个名称。');
      const pinned=pins().has(key(row));
      await st.renameGroupOrCharacterChat({...context,oldFileName:row.file,newFileName:name,loader:false});
      if(!await exists(next) || await exists(row))throw new Error('重命名未完成，请刷新后检查。');
      const values=read('cwn-chat-pins');values[key(row)]=null;values[key(next)]=pinned?next:null;save(values);
    },
    async remove(row) {
      const {entity,characterId,groupId}=resolve(row);
      if(!await exists(row))throw new Error('聊天已不存在，请刷新。');
      const current=st.getCurrentChatId()===row.file && (row.group ? String(group.selected_group)===String(groupId) : !group.selected_group && String(st.this_chid)===String(characterId));
      let emitted=false;
      const type=st.event_types[row.group?'GROUP_CHAT_DELETED':'CHAT_DELETED'];
      const onDeleted=file=>{if(file===row.file)emitted=true;};
      st.eventSource.on(type,onDeleted);
      const oldChats=row.group?[...entity.chats]:null;
      try {
        if(row.group)await group.deleteGroupChatByName(groupId,row.file);
        else await st.deleteCharacterChatByName(characterId,row.file);
        if(!emitted) { if(oldChats)entity.chats=oldChats; throw new Error('删除未完成，请刷新后检查。'); }
        if(current)await st.closeCurrentChat();
        const values=read('cwn-chat-pins');values[key(row)]=null;save(values);
      } finally { st.eventSource.removeListener(type,onDeleted); }
    },
  };
}
