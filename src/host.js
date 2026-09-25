import { resolveRecentRows } from './recent-chats.js';
import { createOperationLock } from './operation-lock.js';
import { SWIPE_DIRECTION } from '../../../../constants.js';
import { accountStorage } from '../../../../util/AccountStorage.js';
import { createChatActions } from './chat-actions.js';
import * as st from '../../../../../script.js';
import * as group from '../../../../group-chats.js';
import { getChatCompletionModel } from '../../../../openai.js';

const chatActions = createChatActions(st, group, accountStorage);
let startingWelcome=false, newlyOpened=null, welcomeRevision=0;
const localRefresh=new Set();
export const host = {
  isGenerating:()=>st.isGenerating(),
  isCurrentChat(row){return st.getCurrentChatId()===row.file && (row.group?String(group.selected_group)===String(row.group):!group.selected_group&&st.characters[st.this_chid]?.avatar===row.avatar);},
  async readChat(row,signal){
    const response=await fetch(row.group?'/api/chats/group/get':'/api/chats/get',{
      method:'POST',headers:st.getRequestHeaders(),signal,
      body:JSON.stringify(row.group?{id:row.file}:{ch_name:row.name,file_name:row.file,avatar_url:row.avatar})
    });
    if(!response.ok)throw new Error('历史聊天读取失败，请重试。');
    const data=await response.json();
    if(!Array.isArray(data))throw new Error('历史聊天格式异常。');
    return data.filter(message=>typeof message?.mes==='string').map(message=>({name:message.name||'',text:message.mes,isUser:!!message.is_user}));
  },
  subscribeGeneration(callback){
    const current=()=>({file:st.getCurrentChatId(),avatar:group.selected_group?null:st.characters[st.this_chid]?.avatar,group:group.selected_group || null});
    const started=(_type,_options,dryRun)=>{if(!dryRun)callback(current());};
    const ended=()=>callback(null);
    st.eventSource.on(st.event_types.GENERATION_STARTED,started);
    st.eventSource.on(st.event_types.GENERATION_ENDED,ended);
    st.eventSource.on(st.event_types.GENERATION_STOPPED,ended);
    callback(st.isGenerating()?current():null);
    return ()=>{
      st.eventSource.removeListener(st.event_types.GENERATION_STARTED,started);
      st.eventSource.removeListener(st.event_types.GENERATION_ENDED,ended);
      st.eventSource.removeListener(st.event_types.GENERATION_STOPPED,ended);
    };
  },
  welcomeRevision:()=>welcomeRevision,
  candidateCount(id){return st.chat[id]?.swipes?.length || 0;},
  async cycleCandidate(id,direction){
    if(st.isGenerating() || st.isChatSaving || document.querySelector('#chat .edit_textarea'))return;
    const message=st.chat[id], count=message?.swipes?.length || 0;
    if(!message || message.is_user || count<2)return;
    const current=Number(message.swipe_id)||0;
    const target=((current+(direction<0?-1:1))%count+count)%count;
    await st.swipe(null,direction<0?SWIPE_DIRECTION.LEFT:SWIPE_DIRECTION.RIGHT,{message,forceMesId:id,forceSwipeId:target});
  },
  async rerollLastReply(){
    if(st.isGenerating() || st.isChatSaving)throw new Error('请等待当前生成或保存完成。');
    const message=st.chat.at(-1);
    if(!message || message.is_user || message.is_system)throw new Error('最后一条消息不是角色回复，无法重新生成。');
    if(document.querySelector('#chat .edit_textarea'))throw new Error('请先结束消息编辑。');
    await st.swipe(null, SWIPE_DIRECTION.RIGHT, {message,forceSwipeId:message.swipes?.length || 1});
  },
  async startCharacterChat(avatar){
    if(startingWelcome || st.isGenerating() || st.isChatSaving)throw new Error("请等待当前操作完成。");
    startingWelcome=true;
    try{
      const id=st.characters.findIndex(c=>c.avatar===avatar);
      if(id<0)throw new Error('该角色已不存在，请重新选择。');
      await st.unshallowCharacter(id);
      // Set up the native target without loading its previous chat and scripts.
      await st.clearChat({clearData:true});
      group.resetSelectedGroup();
      st.setCharacterId(id);
      st.setCharacterName(st.characters[id].name);
      st.select_selected_character(id,{switchMenu:false});
      const previous=st.getCurrentChatId();
      await st.doNewChat({deleteCurrentChat:false});
      if(st.getCurrentChatId()===previous || st.characters[st.this_chid]?.avatar!==avatar)throw new Error("新聊天创建未完成，请重试。");
      newlyOpened={avatar,file:st.getCurrentChatId()};
      st.setActiveCharacter(avatar);st.saveSettingsDebounced();
    } finally {startingWelcome=false;for(const refresh of localRefresh)refresh();}
  },
  characterChoices:()=>st.characters.map((c,index)=>({avatar:c.avatar,name:c.name||`角色 ${index+1}`,image:`/characters/${encodeURIComponent(c.avatar)}`,active:!group.selected_group&&String(st.this_chid)===String(index)})),
  async chooseCharacter(avatar){
    if(st.isGenerating()||st.isChatSaving)throw new Error('请等待当前生成或保存完成后再切换角色。');
    const id=st.characters.findIndex(c=>c.avatar===avatar);
    if(id<0)throw new Error('该角色已不存在，请重新打开列表。');
    await st.selectCharacterById(id,{switchMenu:false});
    if(group.selected_group||st.characters[st.this_chid]?.avatar!==avatar)throw new Error('角色切换未完成，请稍后重试。');
    st.setActiveCharacter(avatar);st.saveSettingsDebounced();
  },
  pinChat: chatActions.pin, renameChat: chatActions.rename, deleteChat: chatActions.remove,
  userName: () => st.name1,
  userAvatar: () => st.user_avatar ? `${st.getUserAvatar(st.user_avatar)}?cwn-avatar=${avatarRevision}` : st.default_user_avatar,
  composerInfo: () => ({
    character: group.selected_group ? group.groups.find(g => String(g.id) === String(group.selected_group))?.name : st.characters[st.this_chid]?.name,
    model: st.main_api === 'openai' ? getChatCompletionModel() : null,
  }),
  subscribeComposer(callback) {
    localRefresh.add(callback);
    const keys = ['CHAT_CHANGED', 'CHARACTER_EDITED', 'GROUP_UPDATED', 'SETTINGS_UPDATED', 'CHATCOMPLETION_MODEL_CHANGED', 'CHATCOMPLETION_SOURCE_CHANGED'];
    for (const key of keys) st.eventSource.on(st.event_types[key], callback);
    return () => { localRefresh.delete(callback);for (const key of keys) st.eventSource.removeListener(st.event_types[key], callback); };
  },
  isHome: () => startingWelcome || (!(newlyOpened && !group.selected_group && newlyOpened.avatar===st.characters[st.this_chid]?.avatar && newlyOpened.file===st.getCurrentChatId()) && (st.getCurrentChatId() === undefined || st.chat.length === 0 || st.chat.every(message => message.is_system))),
  subscribe(callback) {
    const events = ['CHARACTER_PAGE_LOADED', 'CHAT_CHANGED', 'CHAT_CREATED', 'CHAT_DELETED', 'CHAT_RENAMED', 'GROUP_CHAT_CREATED', 'GROUP_CHAT_DELETED'];
    const changed=()=>callback(true), rendered=()=>callback(false);
    localRefresh.add(changed);
    const renderEvents=['USER_MESSAGE_RENDERED','CHARACTER_MESSAGE_RENDERED','MESSAGE_DELETED','SETTINGS_UPDATED','PERSONA_CHANGED','PERSONA_RENAMED','PERSONA_UPDATED'];
    // Overwrite uploads rebuild the native persona list without PERSONA_CHANGED.
    const avatars = document.getElementById('user_avatar_block');
    const avatarObserver = new MutationObserver(() => { avatarRevision++; rendered(); });
    if (avatars) avatarObserver.observe(avatars, { childList:true, subtree:true });
    for (const key of events) st.eventSource.on(st.event_types[key], changed);
    for (const key of renderEvents) st.eventSource.on(st.event_types[key], rendered);
    return () => {
      localRefresh.delete(changed);
      avatarObserver.disconnect();
      for (const key of events) st.eventSource.removeListener(st.event_types[key], changed);
      for (const key of renderEvents) st.eventSource.removeListener(st.event_types[key], rendered);
    };
  },
  async recent(signal) {
    const knownCharacters=st.characters.map(c=>({avatar:c.avatar,name:c.name}));
    const knownGroups=group.groups.map(g=>({id:g.id,name:g.name}));
    const response = await fetch('/api/chats/recent', {
      method:'POST', headers:st.getRequestHeaders(), body:JSON.stringify({max:20,pinned:[...chatActions.pins().values()].map(r=>({avatar:r.avatar,group:r.group,file_name:r.file+'.jsonl'}))}), signal,
    });
    if (!response.ok) throw new Error('最近聊天读取失败，请点击刷新重试。');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('最近聊天返回格式异常。');
    return resolveRecentRows(rows,
      [...st.characters,...knownCharacters], [...group.groups,...knownGroups],
      row=>chatActions.isPinned(row));
  },
  async openRecent(row) {
    if (st.isGenerating() || st.isChatSaving) throw new Error('请等待当前生成或保存完成后再切换聊天。');
    if (row.group) {
      const entity = group.groups.find(g => String(g.id) === String(row.group));
      if (!entity) throw new Error('该群聊已不存在，请刷新列表。');
      await group.openGroupById(entity.id);
      if (String(group.selected_group) !== String(entity.id)) throw new Error('群聊切换未完成，请稍后重试。');
      if (st.getCurrentChatId() !== row.file) await group.openGroupChat(entity.id, row.file);
      st.setActiveGroup(entity.id);
    } else {
      const id = st.characters.findIndex(c => c.avatar === row.avatar);
      if (id < 0) throw new Error('该角色已不存在，请刷新列表。');
      await st.selectCharacterById(id, {switchMenu:false});
      if (String(st.this_chid) !== String(id) || group.selected_group) throw new Error('角色切换未完成，请稍后重试。');
      if (st.getCurrentChatId() !== row.file) await st.openCharacterChat(row.file);
      st.setActiveCharacter(row.avatar);
    }
    st.saveSettingsDebounced();
  },
  async newChat() {
    if (st.isGenerating() || st.isChatSaving) throw new Error('请等待当前生成或保存完成后再开始新对话。');
    newlyOpened=null;
    if(!await st.closeCurrentChat())throw new Error('返回欢迎页未完成，请稍后重试。');
    welcomeRevision++;
    for(const refresh of localRefresh)refresh();
  },
};

let avatarRevision = Date.now();

// All theme entry points that change chat state share the same lock.
const runChatOperation=createOperationLock();
for(const name of ['startCharacterChat','chooseCharacter','openRecent','newChat','pinChat','renameChat','deleteChat','cycleCandidate','rerollLastReply']) {
  const operation=host[name];
  host[name]=(...args)=>runChatOperation(()=>operation(...args));
}