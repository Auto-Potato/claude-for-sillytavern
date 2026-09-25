export function characterFields(card) {
  const data=card.data || card;
  return {description:data.description || '', openings:[data.first_mes || '', ...(data.alternate_greetings || [])]};
}

export function createCharacterData({request, refresh, isBusy}) {
  async function read(avatar) {
    const response=await request('/api/characters/get',{avatar_url:avatar});
    if(!response.ok)throw new Error('读取角色失败，请重试');
    return response.json();
  }
  async function update(avatar, fields, expected) {
    if(isBusy())throw new Error('请等待生成或聊天保存完成');
    const current=await read(avatar);
    if(expected && JSON.stringify(characterFields(current))!==JSON.stringify(expected))throw new Error('角色内容已在其他位置更新，请取消编辑后重新打开');
    const response=await request('/api/characters/merge-attributes',{avatar,...fields});
    if(!response.ok)throw new Error('保存角色失败，请重试');
    const saved=await read(avatar);
    await refresh(avatar,saved);
    return saved;
  }
  return {read,
    async save(avatar,draft,expected) {
      const fields={description:draft.description,first_mes:draft.openings[0] || '',alternate_greetings:draft.openings.slice(1)};
      const saved=await update(avatar,{...fields,data:fields},expected);
      if(JSON.stringify(characterFields(saved))!==JSON.stringify(draft))throw new Error('保存结果与编辑内容不一致，请重新检查');
      return saved;
    },
    async bind(avatar,name) {
      const saved=await update(avatar,{data:{extensions:{world:name}}});
      if((saved.data?.extensions?.world || '')!==name)throw new Error('世界书绑定未保存，请重试');
      return saved;
    },
  };
}
