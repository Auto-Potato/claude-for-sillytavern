// Keep SillyTavern's active chat untouched while browsing saved history.
export function mountReadOnlyChat(doc,win,host){
  const shell=doc.getElementById('sheld'),abort=new win.AbortController();
  const demoMode=new URLSearchParams(win.location.search).get('cwn-readonly-demo')==='1';
  const panel=doc.createElement('section');panel.id='cwn-readonly-chat';panel.hidden=true;
  const bar=doc.createElement('div');bar.className='cwn-readonly-bar';
  const status=doc.createElement('span');status.setAttribute('role','status');
  const back=doc.createElement('button');back.type='button';back.setAttribute('aria-label','返回原聊天');back.title='返回原聊天';back.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(3 3) scale(.75)"><path d="m6 3-4 4 4 4M2 7h12a7 7 0 0 1 0 14h-2"/><g fill="currentColor" stroke="none"><circle cx="2" cy="21" r="1"/><circle cx="5" cy="21" r="1"/><circle cx="8" cy="21" r="1"/></g></g></svg>';
  const stop=doc.createElement('button');stop.type='button';stop.setAttribute('aria-label','停止生成');stop.title='停止生成';stop.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/></svg>';
  const open=doc.createElement('button');open.type='button';open.setAttribute('aria-label','退出预览');open.title='退出预览';open.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const content=doc.createElement('div');content.className='cwn-readonly-content';
  bar.append(status,back,stop,open);panel.append(bar,content);shell.append(panel);
  let request=null,selected=null,active=false,disposed=false,opening=false;
  let generating=host.isGenerating();
  const savedInert=new Map();
  function renderStatus(){

    status.textContent=generating?'原聊天正在生成 · 当前仅供阅读':'只读预览 · 可打开聊天继续操作';
    stop.hidden=!generating;open.hidden=generating||!selected;open.disabled=opening;
  }
  function close(){
    request?.abort();request=null;active=false;selected=null;
    panel.hidden=true;shell.classList.remove('cwn-reading-history');
    for(const [node,value]of savedInert)node.inert=value;savedInert.clear();
    content.replaceChildren();
  }
  async function show(row,demo=false){
    request?.abort();const controller=new win.AbortController();request=controller;
    selected=row;active=true;panel.hidden=false;shell.classList.add('cwn-reading-history');
    for(const node of shell.children){if(node===panel)continue;if(!savedInert.has(node))savedInert.set(node,node.inert);node.inert=true;}
    generating=demo||host.isGenerating();renderStatus();content.textContent=row?'正在读取聊天记录…':'欢迎 · 原聊天生成结束后可开始新对话。';
    if(!row)return;
    try{
      const messages=demo?[{name:'角色',text:'夜色渐深，窗外的灯光映在桌边。她放下手中的书，抬头望向你。\n\n这里展示的是只读聊天原场景，右上角为返回与停止图标。'},{name:'我',text:'我想先看看之前的聊天记录。'},{name:'角色',text:'这是一段用于查看布局的演示文字，不会调用 API。'}]:await host.readChat(row,controller.signal);
      if(disposed||request!==controller)return;
      const fragment=doc.createDocumentFragment();
      const heading=doc.createElement('h2');heading.textContent=row.name;fragment.append(heading);
      // Plain text deliberately avoids executing embedded HTML, scripts or native controls.
      for(const message of messages){
        const article=doc.createElement('article'),name=doc.createElement('h3'),text=doc.createElement('div');
        name.textContent=message.name;text.textContent=message.text;text.className='cwn-readonly-text';
        article.append(name,text);fragment.append(article);
      }
      content.replaceChildren(fragment);content.scrollTop=0;
    }catch(error){if(!disposed&&request===controller&&error.name!=='AbortError')content.textContent=error.message;}
  }
  back.addEventListener('click',close,{signal:abort.signal});
  stop.addEventListener('click',()=>{if(!demoMode)doc.getElementById('mes_stop')?.click();},{signal:abort.signal});
  open.addEventListener('click',async()=>{
    if(!selected||host.isGenerating()||opening)return;opening=true;renderStatus();
    try{await host.openRecent(selected);if(!disposed)close();}catch(error){status.textContent=error.message;}finally{opening=false;if(!disposed)renderStatus();}
  },{signal:abort.signal});
  const unsubscribe=host.subscribeGeneration(state=>{generating=!!state;if(active)renderStatus();});
  if(demoMode)void show({name:'聊天记录 · 图标演示',file:'demo'},true);
  return {show,close,isActive:()=>active,dispose(){disposed=true;close();unsubscribe();abort.abort();panel.remove();}};
}