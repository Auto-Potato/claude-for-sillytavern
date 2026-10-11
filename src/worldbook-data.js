// Patch a fresh copy of an entry; fields not exposed by the simplified editor survive.
export function patchEntry(book, uid, patch, baseline) {
  const next=structuredClone(book), entry=next.entries?.[uid];
  if(!entry)throw new Error('此条目已不存在，请返回列表刷新');
  for(const key of Object.keys(patch)) {
    if(baseline && JSON.stringify(entry[key])!==JSON.stringify(baseline[key]))throw new Error('此条目已在其他位置修改，请返回重新打开');
    entry[key]=structuredClone(patch[key]);
  }
  syncOriginal(next,entry,patch);
  return next;
}
const originalKeys={comment:'comment',content:'content',key:'keys',constant:'constant',disable:'enabled',order:'insertion_order',position:'extensions.position',depth:'extensions.depth',role:'extensions.role',probability:'extensions.probability',useProbability:'extensions.useProbability',vectorized:'extensions.vectorized'};
function syncOriginal(book,entry,patch) {
  const original=book.originalData?.entries?.find(e=>String(e.uid??e.id)===String(entry.uid));
  if(!original)return;
  for(const [key,value] of Object.entries(patch)) {
    const path=originalKeys[key];if(!path)continue;
    const parts=path.split('.');let target=original;
    for(const part of parts.slice(0,-1))target=target[part]??=( {} );
    target[parts.at(-1)]=key==='disable'?!value:structuredClone(value);
  }
}
export function appendEntry(book,template,originalEntry) {
  const next=structuredClone(book);next.entries??={};
  let uid=0;while(Object.hasOwn(next.entries,uid))uid++;
  next.entries[uid]={...structuredClone(template),uid,displayIndex:Math.max(-1,...Object.values(next.entries).map(e=>Number(e.displayIndex)||0))+1};
  if(Array.isArray(next.originalData?.entries)){
    const source=originalEntry??book.originalData.entries.find(e=>String(e.uid??e.id)===String(template.uid));
    const original={...structuredClone(source||{}),id:uid,uid,keys:structuredClone(template.key||[]),secondary_keys:structuredClone(template.keysecondary||[]),comment:template.comment||'',content:template.content||'',constant:!!template.constant,selective:!!template.selective,enabled:!template.disable,insertion_order:template.order??100,extensions:{...structuredClone(source?.extensions||template.extensions||{}),display_index:next.entries[uid].displayIndex}};
    const extras={scanDepth:'scan_depth',caseSensitive:'case_sensitive',matchWholeWords:'match_whole_words',selectiveLogic:'selectiveLogic',groupWeight:'groupWeight',groupOverride:'group_override',useGroupScoring:'use_group_scoring',automationId:'automation_id',excludeRecursion:'exclude_recursion',preventRecursion:'prevent_recursion',delayUntilRecursion:'delay_until_recursion',outletName:'outlet_name',ignoreBudget:'ignore_budget'};
    for(const key of ['depth','role','position','probability','useProbability','vectorized','group','sticky','cooldown','delay','triggers','matchPersonaDescription','matchCharacterDescription','matchCharacterPersonality','matchCharacterDepthPrompt','matchScenario','matchCreatorNotes'])extras[key]=key.startsWith('match')?key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()):key;
    for(const [key,destination] of Object.entries(extras))if(template[key]!==undefined)original.extensions[destination]=structuredClone(template[key]);
    next.originalData.entries.push(original);
  }
  return {book:next,uid};
}
export function removeEntry(book,uid) {
  const next=structuredClone(book);if(!next.entries?.[uid])throw new Error('条目已不存在');
  delete next.entries[uid];
  if(Array.isArray(next.originalData?.entries))next.originalData.entries=next.originalData.entries.filter(e=>String(e.uid??e.id)!==String(uid));
  return next;
}
export function createWorldbookData({request,changed=()=>{}}) {
  async function read(name) {
    const response=await request('/api/worldinfo/get',{name});
    if(!response.ok)throw new Error('世界书读取失败');
    const data=await response.json();if(!data?.entries || Array.isArray(data.entries))throw new Error('世界书格式不正确');
    return data;
  }
  async function write(name,data) {
    const response=await request('/api/worldinfo/edit',{name,data});
    if(!response.ok)throw new Error('世界书保存失败，修改尚未保存');
    const saved=await read(name);
    if(JSON.stringify(saved)!==JSON.stringify(data))throw new Error('保存结果与当前修改不一致，请重新读取');
    await changed(name,saved);return saved;
  }
  async function update(name,uid,patch,baseline) {return write(name,patchEntry(await read(name),uid,patch,baseline));}
  async function transfer(source,target,uid,move) {
    if(source===target)throw new Error('请选择另一本世界书');
    const from=await read(source),entry=from.entries[uid];if(!entry)throw new Error('条目已不存在');
    const original=from.originalData?.entries?.find(e=>String(e.uid??e.id)===String(uid));
    const added=appendEntry(await read(target),entry,original);
    await write(target,added.book);
    if(move){
      const fresh=await read(source);
      if(JSON.stringify(fresh.entries[uid])!==JSON.stringify(entry))throw new Error('目标已复制；源条目有新修改，已保留源条目');
      try{await write(source,removeEntry(fresh,uid));}catch(error){throw new Error(`目标已复制；源条目删除未确认：${error.message}`);}
    }
    return added.uid;
  }
  return {read,write,update,transfer};
}
