import { mountScriptPanel } from './script-panel.js';
import { mountCharacterPicker } from './character-picker.js';
// Keep sending, attachments and generation controls owned by SillyTavern.
export function mountComposer(doc, host) {
  const row = doc.getElementById('nonQRFormItems');
  if (!row) return () => {};
  const abort = new doc.defaultView.AbortController();
  const disposeScripts=mountScriptPanel(doc,doc.defaultView);
  const controls = doc.createElement('div');
  controls.id = 'cwn-composer-context';
  function shortcut(target, label) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'cwn-context-button';
    button.addEventListener('click', () => { if(target) doc.getElementById(target)?.click(); }, { signal:abort.signal });
    button.setAttribute('aria-label', label);
    controls.append(button);
    return button;
  }
  const character = shortcut(null, '选择角色');
  let selectedAvatar=null, starting=false, disposed=false;
  const pickerHost={
    characterChoices:()=>host.characterChoices().map(item=>({...item,active:host.isHome()?item.avatar===selectedAvatar:item.active})),
    async chooseCharacter(avatar){
      if(host.isHome()){selectedAvatar=avatar;render();}
      else await host.chooseCharacter(avatar);
    },
  };
  const disposePicker=mountCharacterPicker(doc,character,pickerHost);
  const input=doc.getElementById('send_textarea'), send=doc.getElementById('send_but');
  const regenerate=doc.createElement('button');regenerate.id='cwn-regenerate';regenerate.type='button';regenerate.className='fa-solid fa-rotate-right';regenerate.setAttribute('aria-label','重新生成');regenerate.title='重新生成';
  doc.getElementById('extensionsMenuButton')?.before(regenerate);
  let noticeTimer,shakeTimer;
  const notice=doc.createElement('span');notice.className='cwn-api-notice';notice.setAttribute('role','status');row.append(notice);
  function rejectOffline(target){
    clearTimeout(noticeTimer);clearTimeout(shakeTimer);target.classList.remove('cwn-reject');void target.offsetWidth;target.classList.add('cwn-reject');shakeTimer=setTimeout(()=>target.classList.remove('cwn-reject'),320);
    const text='未连接到API!';let index=0;notice.textContent='';
    function type(){notice.textContent=text.slice(0,++index);if(index<text.length)noticeTimer=setTimeout(type,35);else noticeTimer=setTimeout(()=>notice.textContent='',2200);}type();
  }
  doc.addEventListener('click',event=>{
    if(!host.isHome()&&event.target.closest('#send_but')&&doc.getElementById('send_form')?.classList.contains('no-connection')){event.preventDefault();event.stopImmediatePropagation();rejectOffline(send);}
  },{capture:true,signal:abort.signal});
  regenerate.addEventListener('click',()=>{
    if(host.isHome())return;
    if(doc.getElementById('send_form')?.classList.contains('no-connection')){rejectOffline(regenerate);return;}
    doc.getElementById('option_regenerate')?.click();
  },{signal:abort.signal});
  const originalLabel=send?.getAttribute('aria-label');
  const error=doc.createElement('div');error.className='cwn-start-error';error.setAttribute('role','status');controls.after(error);
  async function start(){
    if(starting)return;
    if(!selectedAvatar){character.click();return;}
    const draft=input?.value || '';
    starting=true;character.disabled=true;error.textContent='';
    if(input)input.readOnly=true;
    send?.setAttribute('aria-busy','true');
    try{await host.startCharacterChat(selectedAvatar);}
    catch(reason){if(!disposed)error.textContent=reason.message || '创建聊天失败，请重试。';}
    finally{
      starting=false;
      if(!disposed){
        character.disabled=false;send?.removeAttribute('aria-busy');
        if(input){input.readOnly=false;input.value=draft;input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));input.focus({preventScroll:true});}
        render();
      }
    }
  }
  doc.addEventListener('click',event=>{
    if(event.target.closest('#send_but') && (host.isHome()||starting)){event.preventDefault();event.stopImmediatePropagation();void start();}
  },{capture:true,signal:abort.signal});
  input?.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&(host.isHome()||starting)){event.preventDefault();event.stopImmediatePropagation();void start();}
  },{capture:true,signal:abort.signal});
  const model = shortcut('API-status-top', '配置模型与 API');
  const effort = doc.createElement('span');
  effort.className = 'cwn-composer-effort';
  effort.textContent = 'High';
  effort.title = '原版装饰标签，不改变模型设置';
  effort.setAttribute('aria-hidden', 'true');
  controls.append(effort);
  function render() {
    const info = host.composerInfo();
    const welcome=host.isHome();
    const chosen=welcome?host.characterChoices().find(item=>item.avatar===selectedAvatar)?.name:info.character;
    character.textContent = chosen || '选择角色';
    if(send)send.setAttribute('aria-label',welcome?'开始新聊天':'发送消息');
    character.title = `选择角色：${chosen || '未选择'}`;
    model.textContent = info.model || 'API 设置';
    model.title = `配置模型与 API：${info.model || '打开连接设置'}`;
  }
  row.append(controls,error);
  const unsubscribe = host.subscribeComposer(render);
  render();
  return () => { clearTimeout(noticeTimer);clearTimeout(shakeTimer);notice.remove();disposeScripts(); regenerate.remove(); disposed=true;error.remove();if(input)input.readOnly=false;if(send){send.removeAttribute('aria-busy');if(originalLabel===null)send.removeAttribute('aria-label');else send.setAttribute('aria-label',originalLabel);}disposePicker(); abort.abort(); unsubscribe(); controls.remove(); };
}




